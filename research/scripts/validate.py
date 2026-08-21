#!/usr/bin/env python3
"""Validate the structural integrity of the research Markdown library.

The validator intentionally has no third-party dependencies. The checked-in corpus
must use the modern source/evidence schema and canonical work registry. Legacy
source metadata is accepted only when ``--allow-legacy`` is explicitly supplied
for imports or fixtures. Record-only checks become active for a topic as soon as
its first claim or evidence record appears.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Iterable

RECORD_ID_RE = re.compile(r"\b(?:HC|HE|MC|ME)\d{2,}\b", re.IGNORECASE)
CLAIM_ID_RE = re.compile(r"\b(?:HC|MC)\d{2,}\b", re.IGNORECASE)
EVIDENCE_ID_RE = re.compile(r"\b(?:HE|ME)\d{2,}\b", re.IGNORECASE)
SOURCE_ID_RE = re.compile(r"\b[HM]\d{2,}\b", re.IGNORECASE)
WORK_ID_RE = re.compile(r"\bW\d{2,}\b", re.IGNORECASE)
WORK_SOURCE_PAIR_RE = re.compile(
    r"\b(W\d{2,})\b\s*/\s*(?:\[([HM]\d{2,})\]|([HM]\d{2,})\b)",
    re.IGNORECASE,
)
ANY_LIBRARY_ID_RE = re.compile(r"\b(?:HC|HE|MC|ME|[HMW])\d{2,}\b", re.IGNORECASE)
FIELD_RE = re.compile(r"^\s*[-*]\s+\*\*([^*]+?):\*\*\s*(.*?)\s*$")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
INLINE_LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
REFERENCE_USE_RE = re.compile(r"(?<!!)\[[^\]]+\]\[([^\]]*)\]")
REFERENCE_DEF_RE = re.compile(r"^\s*\[([^\]]+)\]:\s*(\S+)", re.MULTILINE)
AUTOLINK_RE = re.compile(r"<((?:https?|mailto):[^>]+)>", re.IGNORECASE)
URL_RE = re.compile(r"https?://[^\s<>\])}]+", re.IGNORECASE)

UNKNOWN_MARKERS = (
    "unknown",
    "not reported",
    "not available",
    "not applicable",
    "not retained",
    "none",
    "not independently verified",
    "not verified",
    "unverified",
)

CLAIM_TYPES = {
    "descriptive",
    "comparative",
    "causal",
    "mechanistic",
    "predictive",
    "normative",
    "existence",
    "absence",
    "synthesis",
}
EVIDENCE_CLAIM_TYPES = CLAIM_TYPES
POLARITIES = {"supports", "against", "null", "qualifies", "mixed", "not-applicable"}
CLAIM_STATUSES = {"supported", "mixed", "disputed", "unsupported", "superseded"}
ASSESSMENT_RE = re.compile(
    r"(?P<grade>[A-E]) \[D(?P<D>[0-3]) V(?P<V>[0-3]) U(?P<U>[0-3]) "
    r"C(?P<C>[0-3]) E(?P<E>[0-3]) X(?P<X>[0-3]) P(?P<P>[0-3]) R(?P<R>[0-3])\]"
)
LEGACY_PROFILE_RE = re.compile(
    r"(?:PM=(?:H|M|L|U|NA);?\s*DR=|P[0-3]/D[0-3]/I[0-3]/U[0-3]/B[0-3]/E[0-3]/X[0-3]/R[0-3]/A[0-3])",
    re.IGNORECASE,
)

# These expressions encode factual forms explicitly identified as stale by the
# 2026-07-20 audit.  Corrected text which mentions a value to qualify it is not
# matched.  Additions should be narrow enough not to reject audit/change logs.
KNOWN_BAD_FACTS = (
    (re.compile(r"\b(?:CodePlan[^\n]{0,100})?5\s+(?:of|/)\s*6\s+repositor", re.I),
     "CodePlan's published result is 5 of 7 repositories, not 5 of 6"),
    (re.compile(r"\bRepoCoder\b(?:(?!\bnot\b)[^\n]){0,100}\b(?:dense|vector)\s+retriev", re.I),
     "RepoCoder uses lexical Jaccard retrieval, not dense/vector retrieval"),
    (re.compile(r"\b23\.5%\s+(?:WebArena\s+)?(?:in-paper\s+)?(?:accessibility-tree\s+)?baseline\b", re.I),
     "AWM's in-paper accessibility-tree baseline is 15.0%; 23.5% is an external richer-observation result"),
    (re.compile(r"\b(?:up to\s+)?70%\s+(?:serving\s+)?speedup\s+(?:with(?:out)?|at)\s+no\s+(?:accuracy|quality)\s+loss", re.I),
     "Repoformer's approximately 70% point has a small quality loss; accuracy-preserving points are about 27–33%"),
    (re.compile(r"\bSWE-Pruner\b[^\n]{0,120}\b(?:30|50)\s+(?:rounds?|interaction rounds?)\b", re.I),
     "SWE-Pruner arXiv v4 uses 250 interaction rounds"),
)

SKIP_DIRS = {"scripts", "tests", "__pycache__"}
MODERN_SOURCE_FIELDS = (
    "work id / topic aliases",
    "authors",
    "year / venue",
    "document type",
    "publication status",
    "stable ids",
    "canonical url",
    "version reviewed / version date",
    "published version / supersedes",
    "correction or retraction status",
    "accessed / last verified",
    "acquisition",
    "artifact uri / sha-256",
    "acquisition extent",
    "discovery",
    "use status",
    "reviewers",
)


@dataclasses.dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    path: str
    line: int
    message: str


@dataclasses.dataclass
class Document:
    path: Path
    rel: str
    text: str
    lines: list[str]
    fields: dict[str, tuple[str, int]]


@dataclasses.dataclass
class Record:
    identifier: str
    kind: str
    document: Document
    definition_line: int


class Validator:
    def __init__(
        self,
        root: Path,
        *,
        allow_legacy: bool = False,
        check_external: bool = False,
        external_timeout: float = 10.0,
    ) -> None:
        self.root = root.resolve()
        self.allow_legacy = allow_legacy
        self.check_external = check_external
        self.external_timeout = external_timeout
        self.findings: list[Finding] = []
        self.documents: list[Document] = []
        self.by_path: dict[Path, Document] = {}
        self.records: dict[str, Record] = {}
        self.source_notes: dict[str, Document] = {}
        self.registry_aliases: dict[str, set[str]] = defaultdict(set)
        self.registry_work_aliases: dict[str, set[str]] = defaultdict(set)
        self.registry_files: set[Path] = set()

    def add(self, severity: str, code: str, document: Document | Path | None, line: int, message: str) -> None:
        if isinstance(document, Document):
            path = document.rel
        elif isinstance(document, Path):
            try:
                path = document.resolve().relative_to(self.root).as_posix()
            except ValueError:
                path = document.as_posix()
        else:
            path = "."
        self.findings.append(Finding(severity, code, path, line, message))

    def run(self) -> list[Finding]:
        if not self.root.is_dir():
            self.add("error", "ROOT_NOT_FOUND", self.root, 0, "research root is not a directory")
            return self.findings
        self._load_documents()
        self._check_markdown_links()
        self._check_tables()
        self._index_sources_and_records()
        self._check_bibliographies()
        self._load_registry()
        self._check_source_metadata()
        self._check_persistent_identifier_duplicates()
        self._check_registry_coverage()
        self._check_records()
        self._check_evidence_tables()
        self._check_synthesis_links()
        self._check_source_backlinks()
        self._check_stale_facts()
        if self.check_external:
            self._check_external_urls()
        self.findings.sort(key=lambda item: (item.path, item.line, item.severity, item.code, item.message))
        return self.findings

    def _load_documents(self) -> None:
        for path in sorted(self.root.rglob("*.md")):
            rel_parts = path.relative_to(self.root).parts
            if any(part in SKIP_DIRS for part in rel_parts):
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError) as exc:
                self.add("error", "READ_ERROR", path, 0, str(exc))
                continue
            lines = text.splitlines()
            fields: dict[str, tuple[str, int]] = {}
            for line_number, line in enumerate(lines, 1):
                match = FIELD_RE.match(line)
                if match:
                    fields[normal_field(match.group(1))] = (strip_markdown(match.group(2)), line_number)
            document = Document(path.resolve(), path.relative_to(self.root).as_posix(), text, lines, fields)
            self.documents.append(document)
            self.by_path[document.path] = document

    def _check_markdown_links(self) -> None:
        for document in self.documents:
            if "_templates" in document.path.parts:
                continue
            definitions = {key.casefold(): value for key, value in REFERENCE_DEF_RE.findall(document.text)}
            targets: list[tuple[str, int]] = []
            for line_number, line in enumerate(document.lines, 1):
                if is_fenced_line(document.lines, line_number):
                    continue
                for match in INLINE_LINK_RE.finditer(line):
                    targets.append((clean_link_target(match.group(1)), line_number))
                for match in REFERENCE_USE_RE.finditer(line):
                    label = match.group(1).casefold()
                    if label and label not in definitions:
                        self.add("error", "UNDEFINED_LINK_REFERENCE", document, line_number, f"undefined Markdown link reference [{match.group(1)}]")
                    elif label:
                        targets.append((clean_link_target(definitions[label]), line_number))
            for target, line_number in targets:
                if not target or target.startswith(("http://", "https://", "mailto:", "data:")):
                    continue
                parsed = urllib.parse.urlsplit(target)
                if parsed.scheme or parsed.netloc:
                    continue
                raw_path = urllib.parse.unquote(parsed.path)
                if not raw_path:
                    destination = document.path
                elif raw_path.startswith("/"):
                    destination = (self.root / raw_path.lstrip("/")).resolve()
                else:
                    destination = (document.path.parent / raw_path).resolve()
                try:
                    destination.relative_to(self.root)
                except ValueError:
                    self.add("error", "LOCAL_LINK_ESCAPES_ROOT", document, line_number, f"local link escapes research root: {target}")
                    continue
                if not destination.exists():
                    self.add("error", "BROKEN_LOCAL_LINK", document, line_number, f"local link target does not exist: {target}")
                    continue
                if parsed.fragment and destination.is_file() and destination.suffix.lower() in {".md", ".markdown"}:
                    target_document = self.by_path.get(destination)
                    if target_document is None:
                        try:
                            target_text = destination.read_text(encoding="utf-8")
                        except (OSError, UnicodeError):
                            continue
                        anchors = markdown_anchors(target_text)
                    else:
                        anchors = markdown_anchors(target_document.text)
                    fragment = urllib.parse.unquote(parsed.fragment).casefold()
                    if fragment not in anchors:
                        self.add("error", "BROKEN_LOCAL_ANCHOR", document, line_number, f"anchor #{parsed.fragment} not found in {raw_path or document.path.name}")

    def _check_tables(self) -> None:
        for document in self.documents:
            if "_templates" in document.path.parts:
                continue
            lines = document.lines
            index = 0
            while index + 1 < len(lines):
                if not looks_like_table_row(lines[index]) or not is_separator_candidate(lines[index + 1]):
                    index += 1
                    continue
                start = index
                table_lines = [lines[index], lines[index + 1]]
                index += 2
                while index < len(lines) and looks_like_table_row(lines[index]):
                    table_lines.append(lines[index])
                    index += 1
                rows = [split_table_row(line) for line in table_lines]
                expected = len(rows[0])
                if expected < 2:
                    self.add("error", "TABLE_TOO_NARROW", document, start + 1, "Markdown table must have at least two columns")
                    continue
                for offset, row in enumerate(rows):
                    if len(row) != expected:
                        self.add("error", "TABLE_COLUMN_COUNT", document, start + offset + 1, f"table row has {len(row)} columns; header has {expected}")
                if len(rows[1]) != expected or any(not re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in rows[1]):
                    self.add("error", "TABLE_SEPARATOR", document, start + 2, "invalid Markdown table separator row")
                headers = [strip_markdown(cell).casefold() for cell in rows[0]]
                if len(set(headers)) != len(headers):
                    self.add("error", "TABLE_DUPLICATE_HEADER", document, start + 1, "table has duplicate column headers")
                for offset, row in enumerate(rows[2:], 2):
                    if len(row) == expected and any(not strip_markdown(cell) for cell in row):
                        self.add("error", "TABLE_EMPTY_CELL", document, start + offset + 1, "table data row contains an empty cell")
                self._check_table_vocab(document, start + 1, headers, rows[2:])

    def _check_table_vocab(self, document: Document, start_line: int, headers: list[str], rows: list[list[str]]) -> None:
        if document.path.name.casefold() != "evidence-table.md":
            return
        required_headers = {"claim type", "polarity", "claim status", "claim assessment", "publication maturity"}
        missing = required_headers - set(headers)
        if missing:
            self.add("error", "CANONICAL_TABLE_COLUMNS_MISSING", document, start_line, f"evidence table lacks canonical columns: {', '.join(sorted(missing))}")
        for column, header in enumerate(headers):
            if header not in required_headers:
                continue
            for row_offset, row in enumerate(rows, 2):
                if column >= len(row):
                    continue
                raw_value = strip_markdown(row[column])
                value = raw_value.casefold()
                line = start_line + row_offset
                if header == "polarity" and value not in POLARITIES:
                    self.add("error", "UNDEFINED_POLARITY", document, line, f"undefined polarity: {value!r}")
                elif header == "claim type" and value not in CLAIM_TYPES:
                    self.add("error", "UNDEFINED_CLAIM_TYPE", document, line, f"undefined claim type: {value!r}")
                elif header == "claim status" and value not in CLAIM_STATUSES:
                    self.add("error", "UNDEFINED_CLAIM_STATUS", document, line, f"undefined claim status: {value!r}")
                elif header == "claim assessment" and parse_assessment(raw_value) is None:
                    self.add("error", "INVALID_CANONICAL_ASSESSMENT", document, line, f"invalid canonical claim assessment: {raw_value!r}")
                elif header == "publication maturity" and not valid_maturity(raw_value):
                    self.add("error", "INVALID_PUBLICATION_MATURITY", document, line, f"publication maturity must use M0–M5: {raw_value!r}")

    def _index_sources_and_records(self) -> None:
        definitions: dict[str, list[tuple[Document, int, str]]] = defaultdict(list)
        for document in self.documents:
            first_heading = next(((number, line) for number, line in enumerate(document.lines, 1) if line.startswith("# ")), None)
            source_directory = document.path.parent.name == "source-notes"
            if source_directory and first_heading:
                source_ids = SOURCE_ID_RE.findall(first_heading[1])
                if source_ids:
                    source_id = source_ids[0].upper()
                    self.source_notes[source_id] = document
                    definitions[source_id].append((document, first_heading[0], "source"))
                else:
                    self.add("error", "SOURCE_NOTE_ID_MISSING", document, first_heading[0], "source-note title must contain an Hnn or Mnn ID")
            record_path = "claims" in document.path.parts or "evidence" in document.path.parts
            if record_path and document.path.name.casefold() != "readme.md" and first_heading:
                record_ids = [item.upper() for item in RECORD_ID_RE.findall(first_heading[1])]
                if not record_ids:
                    self.add("error", "RECORD_ID_MISSING", document, first_heading[0], "claim/evidence record title must contain an HC/HE/MC/ME ID")
                else:
                    identifier = record_ids[0]
                    kind = "claim" if CLAIM_ID_RE.fullmatch(identifier) else "evidence"
                    definitions[identifier].append((document, first_heading[0], kind))
                    if identifier not in self.records:
                        self.records[identifier] = Record(identifier, kind, document, first_heading[0])
                    if document.path.stem.upper() != identifier:
                        self.add("error", "RECORD_FILENAME_MISMATCH", document, first_heading[0], f"record {identifier} must be stored in {identifier}.md")
        for identifier, locations in definitions.items():
            if len(locations) > 1:
                for document, line, _kind in locations:
                    self.add("error", "DUPLICATE_RECORD_ID", document, line, f"{identifier} is defined {len(locations)} times")

    def _topic_documents(self) -> dict[Path, list[Document]]:
        topics: dict[Path, list[Document]] = defaultdict(list)
        for document in self.documents:
            relative = document.path.relative_to(self.root)
            if len(relative.parts) >= 2 and not relative.parts[0].startswith("_"):
                topics[self.root / relative.parts[0]].append(document)
        return topics

    def _check_bibliographies(self) -> None:
        for topic, documents in self._topic_documents().items():
            bibliography = next((doc for doc in documents if doc.path == topic / "bibliography.md"), None)
            notes = {identifier: doc for identifier, doc in self.source_notes.items() if topic in doc.path.parents}
            if bibliography is None and notes:
                self.add("error", "BIBLIOGRAPHY_MISSING", topic, 0, "topic has source notes but no bibliography.md")
                continue
            if bibliography is None:
                continue
            bibliography_ids: set[str] = set()
            for line_number, line in enumerate(bibliography.lines, 1):
                if re.match(r"^\s*(?:#{2,6}\s+|[-*]\s+)(?:\*\*)?\[?[HM]\d{2,}\]?(?:\*\*)?", line, re.I):
                    match = SOURCE_ID_RE.search(line)
                    if match:
                        identifier = match.group(0).upper()
                        if identifier in bibliography_ids:
                            self.add("error", "DUPLICATE_BIBLIOGRAPHY_ID", bibliography, line_number, f"duplicate bibliography entry {identifier}")
                        bibliography_ids.add(identifier)
            for identifier in sorted(bibliography_ids - notes.keys()):
                self.add("error", "BIBLIOGRAPHY_NOTE_MISSING", bibliography, line_of(bibliography, identifier), f"bibliography ID {identifier} has no source note")
            for identifier in sorted(notes.keys() - bibliography_ids):
                self.add("error", "SOURCE_NOTE_BIBLIOGRAPHY_MISSING", notes[identifier], 1, f"source-note ID {identifier} has no bibliography entry")
            defined = bibliography_ids | notes.keys()
            for document in documents:
                if document.path.parent.name == "source-notes" or document.path.name == "bibliography.md":
                    continue
                for line_number, line in enumerate(document.lines, 1):
                    for identifier in {item.upper() for item in SOURCE_ID_RE.findall(line)}:
                        if identifier not in defined:
                            self.add("error", "UNDEFINED_SOURCE_ID", document, line_number, f"citation {identifier} is not defined in this topic")

    def _check_source_metadata(self) -> None:
        legacy_required = {
            "authors": ("authors",),
            "year / venue": ("year / venue",),
            "publication status": ("publication status", "status"),
            "stable IDs": ("stable ids", "stable id"),
            "canonical URL": ("canonical url", "primary url"),
            "access date": ("accessed / last verified", "accessed"),
            "acquisition": ("acquisition",),
        }
        for identifier, document in sorted(self.source_notes.items()):
            modern = "work id / topic aliases" in document.fields
            legacy_mode = not modern and self.allow_legacy
            if modern:
                for legacy_name in ("status", "stable id", "primary url", "paper url", "version reviewed", "accessed"):
                    legacy_field = get_field(document, legacy_name)
                    if legacy_field is not None:
                        self.add("error", "LEGACY_SOURCE_METADATA", document, legacy_field[1], f"modern source note must not use legacy field {legacy_name!r}")
            if legacy_mode:
                required_groups = legacy_required.items()
            else:
                required_groups = ((name, (name,)) for name in MODERN_SOURCE_FIELDS)
            for display, aliases in required_groups:
                found = next((document.fields[name] for name in aliases if name in document.fields), None)
                if found is None:
                    self.add("error", "SOURCE_METADATA_MISSING", document, 1, f"{identifier} is missing required metadata: {display}")
                elif not meaningful_value(found[0]):
                    self.add("error", "SOURCE_METADATA_EMPTY", document, found[1], f"{display} must have a value or an accepted unknown marker")

            version = get_field(document, "version reviewed / version date")
            stable = get_field(document, "stable ids")
            if not modern and self.allow_legacy:
                version = version or get_field(document, "version reviewed")
                stable = stable or get_field(document, "stable id")
            if version is None:
                severity = "warning" if legacy_mode else "error"
                self.add(severity, "SOURCE_VERSION_MISSING", document, 1, f"{identifier} has no exact version reviewed or accepted unknown marker")
            elif not valid_version(version[0], stable[0] if stable else ""):
                self.add("error", "SOURCE_VERSION_UNPINNED", document, version[1], f"version is mutable or imprecise: {version[0]!r}")
            if stable and "arxiv" in stable[0].casefold() and not is_unknown(stable[0]):
                arxiv_ids = extract_arxiv_ids(stable[0])
                if arxiv_ids and not all(re.search(r"v\d+$", item, re.I) for item in arxiv_ids):
                    published_pin = version is not None and re.search(r"\b(?:published|proceedings|conference|journal|final|accepted|camera-ready|paper)\b", version[0], re.I)
                    explicit_unknown = version is not None and is_unknown(version[0])
                    if version is None or (not re.search(r"\bv\d+\b", version[0], re.I) and not published_pin and not explicit_unknown):
                        severity = "warning" if legacy_mode else "error"
                        self.add(severity, "ARXIV_VERSION_UNPINNED", document, stable[1], "arXiv identifier must include vN, Version reviewed must pin vN/a published artifact, or use an accepted unknown marker")

            work_field = get_field(document, "work id / topic aliases")
            if work_field is None:
                if not self.allow_legacy:
                    self.add("error", "SOURCE_WORK_ID_MISSING", document, 1, f"{identifier} must name its canonical W ID and registry aliases")
                continue
            actual_works = {item.upper() for item in WORK_ID_RE.findall(work_field[0])}
            actual_aliases = {item.upper() for item in SOURCE_ID_RE.findall(work_field[0])}
            expected_works = self.registry_aliases.get(identifier, set())
            if len(expected_works) != 1:
                self.add("error", "SOURCE_WORK_ID_UNRESOLVED", document, work_field[1], f"cannot resolve one canonical W ID for {identifier} from the registry")
                continue
            expected_work = next(iter(expected_works))
            expected_aliases = self.registry_work_aliases.get(expected_work, set())
            if actual_works != {expected_work} or actual_aliases != expected_aliases:
                expected = f"{expected_work} / {', '.join(sorted(expected_aliases))}"
                self.add("error", "SOURCE_WORK_ID_MISMATCH", document, work_field[1], f"Work ID / topic aliases must exactly match the registry: {expected}")

    def _load_registry(self) -> None:
        candidates = [
            document
            for document in self.documents
            if "registr" in document.path.name.casefold()
            or re.search(r"(?:^|[-_])works?(?:[-_.]|$)", document.path.name.casefold())
        ]
        for document in candidates:
            self.registry_files.add(document.path)
            current_work: str | None = None
            for line in document.lines:
                work_ids = {item.upper() for item in WORK_ID_RE.findall(line)}
                aliases = {item.upper() for item in SOURCE_ID_RE.findall(line)}
                if work_ids and aliases:
                    for alias in aliases:
                        self.registry_aliases[alias].update(work_ids)
                    for work_id in work_ids:
                        self.registry_work_aliases[work_id].update(aliases)
                heading = HEADING_RE.match(line)
                if heading:
                    found = WORK_ID_RE.search(heading.group(2))
                    current_work = found.group(0).upper() if found else None
                    continue
                if current_work and aliases:
                    for alias in aliases:
                        self.registry_aliases[alias].add(current_work)
                    self.registry_work_aliases[current_work].update(aliases)

    def _check_persistent_identifier_duplicates(self) -> None:
        identifier_notes: dict[tuple[str, str], set[str]] = defaultdict(set)
        identifier_locations: dict[tuple[str, str], tuple[Document, int]] = {}
        for alias, document in self.source_notes.items():
            values: list[tuple[str, int]] = []
            for field_name in ("stable ids", "stable id"):
                if field_name in document.fields:
                    values.append(document.fields[field_name])
            for value, line in values:
                for kind, persistent_id in extract_persistent_ids(value):
                    key = (kind, persistent_id)
                    identifier_notes[key].add(alias)
                    identifier_locations.setdefault(key, (document, line))
        for (kind, persistent_id), aliases in sorted(identifier_notes.items()):
            if len(aliases) < 2:
                continue
            mapped = {work for alias in aliases for work in self.registry_aliases.get(alias, set())}
            fully_mapped = all(self.registry_aliases.get(alias) for alias in aliases)
            if fully_mapped and len(mapped) == 1:
                continue
            document, line = identifier_locations[(kind, persistent_id)]
            self.add("warning", "DUPLICATE_PERSISTENT_ID", document, line, f"duplicate {kind} {persistent_id} across topic aliases: {', '.join(sorted(aliases))}; map them to one canonical W ID")

    def _check_registry_coverage(self) -> None:
        if not self.registry_files:
            return
        for alias, document in sorted(self.source_notes.items()):
            mapped = self.registry_aliases.get(alias, set())
            if not mapped:
                self.add("error", "REGISTRY_ALIAS_MISSING", document, 1, f"canonical W registry does not map alias {alias}")
            elif len(mapped) > 1:
                self.add("error", "REGISTRY_ALIAS_AMBIGUOUS", document, 1, f"alias {alias} maps to multiple works: {', '.join(sorted(mapped))}")

    def _check_records(self) -> None:
        for record in self.records.values():
            document = record.document
            expected_prefix = topic_prefix(document)
            if expected_prefix and not record.identifier.startswith(expected_prefix):
                self.add("error", "RECORD_TOPIC_PREFIX", document, record.definition_line, f"{record.identifier} has the wrong topic prefix; expected {expected_prefix}*")
            if record.kind == "claim":
                self._check_claim_record(record)
            else:
                self._check_evidence_record(record)

    def _check_claim_record(self, record: Record) -> None:
        document = record.document
        self._reject_legacy_profile_fields(document)
        claim_type = self._required_controlled_field(document, "claim type", CLAIM_TYPES, "UNDEFINED_CLAIM_TYPE")
        self._required_controlled_field(document, "polarity", POLARITIES, "UNDEFINED_POLARITY")
        status = self._required_controlled_field(document, "claim status", CLAIM_STATUSES, "UNDEFINED_CLAIM_STATUS")
        maturity = get_field(document, "publication maturity by evidence")
        if maturity is None:
            self.add("error", "CANONICAL_FIELD_MISSING", document, 1, "migrated claim record lacks Publication maturity by evidence")
        elif not valid_maturity(maturity[0]):
            self.add("error", "INVALID_PUBLICATION_MATURITY", document, maturity[1], "publication maturity must use M0–M5 per evidence record")
        assessment = get_field(document, "claim grade")
        if status and status[0] == "unsupported":
            if assessment and not assessment[0].casefold().startswith("not emitted"):
                self.add("error", "INVALID_UNSUPPORTED_CLAIM_GRADE", document, assessment[1], "unsupported claims must not emit a claim grade")
            assessment = get_field(document, "strongest observation grade")
        parsed_assessment = self._check_assessment_field(document, assessment, "claim")
        if status and parsed_assessment:
            displayed, _vector = parsed_assessment
            if status[0] in {"supported", "mixed"} and displayed not in {"A", "B", "C"}:
                self.add("error", "CLAIM_STATUS_GRADE_MISMATCH", document, assessment[1], f"{status[0]} claim has no A–C support grade")
            if status[0] == "unsupported" and displayed not in {"D", "E"}:
                self.add("error", "CLAIM_STATUS_GRADE_MISMATCH", document, assessment[1], "unsupported claim exposes an A–C observation")
        self._require_canonical_audit_fields(document)
        evidence_fields = ("evidence for", "evidence against", "null evidence", "qualifying evidence")
        linked_evidence: set[str] = set()
        for field_name in evidence_fields:
            field = get_field(document, field_name)
            if field:
                linked_evidence.update(item.upper() for item in EVIDENCE_ID_RE.findall(field[0]))
        for evidence_id in sorted(linked_evidence):
            target = self.records.get(evidence_id)
            if target is None or target.kind != "evidence":
                self.add("error", "CLAIM_EVIDENCE_MISSING", document, line_of(document, evidence_id), f"claim references nonexistent evidence {evidence_id}")
                continue
            evidence_claims = field_ids(target.document, ("claim id",), CLAIM_ID_RE)
            if record.identifier not in evidence_claims:
                self.add("error", "CLAIM_EVIDENCE_NOT_RECIPROCAL", document, line_of(document, evidence_id), f"{evidence_id} does not link back to {record.identifier}")

    def _check_evidence_record(self, record: Record) -> None:
        document = record.document
        self._reject_legacy_profile_fields(document)
        claim_ids = field_ids(document, ("claim id",), CLAIM_ID_RE)
        if not claim_ids:
            self.add("error", "EVIDENCE_CLAIM_MISSING", document, 1, "evidence record has no Claim ID")
        for claim_id in sorted(claim_ids):
            target = self.records.get(claim_id)
            if target is None or target.kind != "claim":
                self.add("error", "EVIDENCE_CLAIM_NOT_FOUND", document, line_of(document, claim_id), f"evidence references nonexistent claim {claim_id}")
                continue
            claim_evidence = field_ids(target.document, ("evidence for", "evidence against", "null evidence", "qualifying evidence"), EVIDENCE_ID_RE)
            if record.identifier not in claim_evidence:
                self.add("error", "EVIDENCE_CLAIM_NOT_RECIPROCAL", document, line_of(document, claim_id), f"{claim_id} does not link back to {record.identifier}")
        self._required_controlled_field(document, "claim type", EVIDENCE_CLAIM_TYPES, "UNDEFINED_CLAIM_TYPE")
        self._required_controlled_field(document, "polarity", POLARITIES, "UNDEFINED_POLARITY")
        evidence_status = self._required_controlled_field(document, "claim status", CLAIM_STATUSES, "UNDEFINED_CLAIM_STATUS")
        for claim_id in claim_ids:
            target = self.records.get(claim_id)
            target_status = get_field(target.document, "claim status") if target and target.kind == "claim" else None
            if evidence_status and target_status and evidence_status[0] != target_status[0].casefold():
                self.add("error", "EVIDENCE_CLAIM_STATUS_MISMATCH", document, evidence_status[1], f"claim status differs from {claim_id}")
        maturity = get_field(document, "publication maturity")
        if maturity is None:
            self.add("error", "CANONICAL_FIELD_MISSING", document, 1, "migrated evidence record lacks Publication maturity")
        elif not valid_maturity(maturity[0]):
            self.add("error", "INVALID_PUBLICATION_MATURITY", document, maturity[1], "publication maturity must begin with M0–M5")
        self._check_assessment_field(document, get_field(document, "observation grade"), "observation")
        self._require_canonical_audit_fields(document)
        source = get_field(document, "work id / topic source id")
        if source is None:
            self.add("error", "EVIDENCE_SOURCE_MISSING", document, 1, "evidence record must name canonical W ID / topic source ID pairs")
        else:
            aliases = {item.upper() for item in SOURCE_ID_RE.findall(source[0])}
            work_ids = {item.upper() for item in WORK_ID_RE.findall(source[0])}
            pairs = {
                (match.group(1).upper(), (match.group(2) or match.group(3)).upper())
                for match in WORK_SOURCE_PAIR_RE.finditer(source[0])
            }
            if not pairs:
                self.add("error", "EVIDENCE_WORK_SOURCE_PAIR_MISSING", document, source[1], "evidence source must use at least one W### / H## or W### / M## pair")
            paired_work_ids = {work_id for work_id, _alias in pairs}
            paired_aliases = {alias for _work_id, alias in pairs}
            for work_id, alias in sorted(pairs):
                if alias not in self.source_notes:
                    self.add("error", "EVIDENCE_SOURCE_NOT_FOUND", document, source[1], f"evidence source alias {alias} has no source note")
                    continue
                mapped = self.registry_aliases.get(alias, set())
                if len(mapped) != 1:
                    self.add("error", "EVIDENCE_SOURCE_UNRESOLVED", document, source[1], f"evidence source alias {alias} does not resolve to exactly one registry W ID")
                elif work_id not in mapped:
                    self.add("error", "EVIDENCE_WORK_ID_MISMATCH", document, source[1], f"{work_id} does not match registry mapping {next(iter(mapped))} / {alias}")
            for alias in sorted(aliases - paired_aliases):
                self.add("error", "EVIDENCE_SOURCE_WITHOUT_WORK_ID", document, source[1], f"source alias {alias} is not part of a W/source pair")
            for work_id in sorted(work_ids - paired_work_ids):
                self.add("error", "EVIDENCE_WORK_ID_WITHOUT_SOURCE", document, source[1], f"{work_id} is not part of a W/source pair")

    def _required_controlled_field(self, document: Document, name: str, allowed: set[str], code: str) -> tuple[str, int] | None:
        value = get_field(document, name)
        if value is None:
            self.add("error", "CANONICAL_FIELD_MISSING", document, 1, f"migrated record lacks {name.title()}")
            return None
        normalized = value[0].casefold()
        if normalized not in allowed:
            self.add("error", code, document, value[1], f"undefined {name}: {value[0]!r}")
            return None
        return normalized, value[1]

    def _reject_legacy_profile_fields(self, document: Document) -> None:
        for name in ("profile", "dimension profile", "confidence profile"):
            value = get_field(document, name)
            if value is not None:
                self.add("error", "LEGACY_CONFIDENCE_PROFILE", document, value[1], f"{name} is not accepted in a migrated record; use a canonical grade/vector field")
        for value, line in document.fields.values():
            if LEGACY_PROFILE_RE.search(value):
                self.add("error", "LEGACY_CONFIDENCE_PROFILE", document, line, "incompatible topic-local profile grammar is not accepted")

    def _require_canonical_audit_fields(self, document: Document) -> None:
        for name in ("score rationale (0–1)", "caps applied"):
            if get_field(document, name) is None:
                self.add("error", "CANONICAL_FIELD_MISSING", document, 1, f"migrated record lacks {name}")

    def _check_assessment_field(self, document: Document, field: tuple[str, int] | None, kind: str) -> tuple[str, dict[str, int]] | None:
        if field is None:
            self.add("error", "CANONICAL_FIELD_MISSING", document, 1, f"migrated record lacks canonical {kind} grade/vector")
            return None
        parsed = parse_assessment(field[0])
        if parsed is None:
            self.add("error", "INVALID_CANONICAL_ASSESSMENT", document, field[1], f"invalid canonical {kind} grade/vector: {field[0]!r}")
            return None
        displayed, vector = parsed
        expected = deterministic_grade(vector)
        caps = get_field(document, "caps applied")
        has_cap = caps is not None and caps[0].casefold() != "none"
        rank = {grade: index for index, grade in enumerate("ABCDE")}
        if (not has_cap and displayed != expected) or (has_cap and rank[displayed] < rank[expected]):
            self.add("error", "NONDETERMINISTIC_GRADE", document, field[1], f"displayed grade {displayed} is inconsistent with vector grade {expected} and stated caps")
        return parsed

    def _check_evidence_tables(self) -> None:
        records_by_topic: dict[Path, set[str]] = defaultdict(set)
        for identifier, record in self.records.items():
            topic = topic_root(record.document.path, self.root)
            if topic:
                records_by_topic[topic].add(identifier)
        for topic, identifiers in records_by_topic.items():
            claim_ids = {item for item in identifiers if CLAIM_ID_RE.fullmatch(item)}
            if not claim_ids:
                continue
            table_document = self.by_path.get((topic / "evidence-table.md").resolve())
            if table_document is None:
                self.add("error", "EVIDENCE_TABLE_MISSING", topic, 0, "topic has claim records but no evidence-table.md")
                continue
            rows = table_data_rows(table_document)
            seen: set[str] = set()
            for line_number, cells, headers in rows:
                row_text = " | ".join(cells)
                row_claims = {item.upper() for item in CLAIM_ID_RE.findall(row_text)}
                if not row_claims:
                    self.add("error", "EVIDENCE_TABLE_CLAIM_ID_MISSING", table_document, line_number, "evidence-table row has no stable claim ID")
                    continue
                if len(row_claims) > 1:
                    self.add("error", "EVIDENCE_TABLE_MULTIPLE_CLAIMS", table_document, line_number, f"evidence-table row has multiple claim IDs: {', '.join(sorted(row_claims))}")
                for claim_id in row_claims:
                    if claim_id not in claim_ids:
                        self.add("error", "EVIDENCE_TABLE_CLAIM_NOT_FOUND", table_document, line_number, f"evidence-table references nonexistent claim {claim_id}")
                    if claim_id in seen:
                        self.add("error", "EVIDENCE_TABLE_DUPLICATE_CLAIM", table_document, line_number, f"claim {claim_id} occurs in more than one evidence-table row")
                    seen.add(claim_id)
            for claim_id in sorted(claim_ids - seen):
                self.add("error", "CLAIM_NOT_IN_EVIDENCE_TABLE", self.records[claim_id].document, 1, f"claim {claim_id} has no evidence-table row")

    def _check_synthesis_links(self) -> None:
        records_by_topic: dict[Path, set[str]] = defaultdict(set)
        for identifier, record in self.records.items():
            if record.kind == "claim":
                topic = topic_root(record.document.path, self.root)
                if topic:
                    records_by_topic[topic].add(identifier)
        for topic, claim_ids in records_by_topic.items():
            synthesis = self.by_path.get((topic / "synthesis.md").resolve())
            if synthesis is None:
                self.add("error", "SYNTHESIS_MISSING", topic, 0, "topic has claim records but no synthesis.md")
            else:
                referenced = {item.upper() for item in CLAIM_ID_RE.findall(synthesis.text)}
                for claim_id in sorted(referenced - claim_ids):
                    self.add("error", "SYNTHESIS_CLAIM_NOT_FOUND", synthesis, line_of(synthesis, claim_id), f"synthesis references nonexistent claim {claim_id}")
            for claim_id in claim_ids:
                claim = self.records[claim_id].document
                locations = section_text(claim, "synthesis locations")
                if not locations.strip():
                    self.add("error", "CLAIM_SYNTHESIS_LOCATION_MISSING", claim, 1, "claim has no Synthesis locations")
                    continue
                location_files = re.findall(r"(?<![\w/.-])([A-Za-z0-9_.-]+\.md)\b", locations)
                if not location_files:
                    self.add("error", "CLAIM_SYNTHESIS_LOCATION_INVALID", claim, 1, "Synthesis locations must name at least one topic Markdown file")
                for name in location_files:
                    target_path = (topic / name).resolve()
                    target = self.by_path.get(target_path)
                    if target is None:
                        self.add("error", "CLAIM_SYNTHESIS_TARGET_MISSING", claim, 1, f"Synthesis location does not exist: {name}")
                    elif claim_id not in {item.upper() for item in CLAIM_ID_RE.findall(target.text)}:
                        self.add("error", "SYNTHESIS_BACKLINK_MISSING", target, 1, f"listed synthesis location does not backlink {claim_id}")

    def _check_source_backlinks(self) -> None:
        if not self.records:
            return
        for alias, note in self.source_notes.items():
            referenced_records = {item.upper() for item in RECORD_ID_RE.findall(note.text)}
            for identifier in sorted(referenced_records):
                if identifier not in self.records:
                    self.add("error", "SOURCE_BACKLINK_NOT_FOUND", note, line_of(note, identifier), f"source note backlink references nonexistent record {identifier}")
        for evidence_id, record in self.records.items():
            if record.kind != "evidence":
                continue
            source = get_field(record.document, "work id / topic source id", "work id", "topic source id")
            if not source:
                continue
            aliases = {item.upper() for item in SOURCE_ID_RE.findall(source[0])}
            extraction_status = get_field(record.document, "extraction status")
            if len(aliases) > 1 and extraction_status and "corpus observation" in extraction_status[0].casefold():
                # A registry-backed corpus observation cites the reviewed set as
                # its sampling frame; it is not an extraction from every note.
                continue
            claims = field_ids(record.document, ("claim id",), CLAIM_ID_RE)
            for alias in aliases:
                note = self.source_notes.get(alias)
                if note is None:
                    continue
                note_ids = {item.upper() for item in RECORD_ID_RE.findall(note.text)}
                if evidence_id not in note_ids:
                    self.add("error", "SOURCE_EVIDENCE_BACKLINK_MISSING", note, 1, f"source note {alias} does not backlink evidence {evidence_id}")
                for claim_id in claims:
                    if claim_id not in note_ids:
                        self.add("error", "SOURCE_CLAIM_BACKLINK_MISSING", note, 1, f"source note {alias} does not backlink claim {claim_id}")

    def _check_stale_facts(self) -> None:
        for document in self.documents:
            if document.path.name.startswith("REVIEW-") or "_templates" in document.path.parts:
                continue
            for pattern, explanation in KNOWN_BAD_FACTS:
                for match in pattern.finditer(document.text):
                    line = document.text.count("\n", 0, match.start()) + 1
                    self.add("error", "KNOWN_BAD_FACT", document, line, explanation)

    def _check_external_urls(self) -> None:
        locations: dict[str, tuple[Document, int]] = {}
        for document in self.documents:
            for line_number, line in enumerate(document.lines, 1):
                for url in URL_RE.findall(line):
                    locations.setdefault(url.rstrip(".,;:'\""), (document, line_number))
        for url, (document, line) in sorted(locations.items()):
            status, detail = check_external_url(url, self.external_timeout)
            if status == "missing":
                self.add("error", "EXTERNAL_CONFIRMED_MISSING", document, line, f"confirmed HTTP {detail}: {url}")
            elif status == "blocked":
                self.add("warning", "EXTERNAL_BLOCKED", document, line, f"anti-bot/access response HTTP {detail}, not a confirmed missing page: {url}")
            elif status == "network":
                self.add("warning", "EXTERNAL_NETWORK_ERROR", document, line, f"network/TLS/DNS response ({detail}), not a confirmed missing page: {url}")
            elif status == "http_error":
                self.add("warning", "EXTERNAL_HTTP_ERROR", document, line, f"HTTP {detail}, not classified as a confirmed 404: {url}")


def normal_field(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).casefold()


def strip_markdown(value: str) -> str:
    value = value.strip()
    value = re.sub(r"^\*\*(.*?)\**$", r"\1", value)
    value = re.sub(r"^`(.*)`$", r"\1", value)
    return value.strip()


def is_unknown(value: str) -> bool:
    normalized = strip_markdown(value).casefold().strip()
    return any(re.match(rf"^{re.escape(marker)}(?:\b|\s*[-—:;(])", normalized) for marker in UNKNOWN_MARKERS)


def meaningful_value(value: str) -> bool:
    normalized = strip_markdown(value)
    if not normalized or normalized.casefold() in {"-", "—", "n/a", "na", "tbd", "todo", "?"}:
        return False
    return True


def valid_version(value: str, stable_ids: str = "") -> bool:
    if not meaningful_value(value):
        return False
    if is_unknown(value):
        return True
    normalized = strip_markdown(value).casefold()
    if re.fullmatch(r"(?:latest|current|unversioned|rolling|mutable)(?:\s+(?:version|page|record))?", normalized):
        return False
    exact_signals = (
        r"v\d+(?:\.\d+)*\b",
        r"\b[0-9a-f]{7,40}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b(?:published|proceedings|conference|journal|final|accepted|camera-ready|paper|standard|release|revision|rev\.?|version)\b",
    )
    return any(re.search(pattern, normalized, re.I) for pattern in exact_signals) or bool(re.search(r"\bdoi\b", stable_ids, re.I))


def get_field(document: Document, *names: str) -> tuple[str, int] | None:
    for name in names:
        value = document.fields.get(normal_field(name))
        if value is not None:
            return value
    return None


def field_ids(document: Document, names: Iterable[str], pattern: re.Pattern[str]) -> set[str]:
    result: set[str] = set()
    for name in names:
        field = get_field(document, name)
        if field:
            result.update(item.upper() for item in pattern.findall(field[0]))
    return result


def line_of(document: Document, needle: str) -> int:
    for number, line in enumerate(document.lines, 1):
        if needle.casefold() in line.casefold():
            return number
    return 1


def section_text(document: Document, heading_name: str) -> str:
    start: int | None = None
    level = 0
    collected: list[str] = []
    for line in document.lines:
        heading = HEADING_RE.match(line)
        if heading:
            current_level = len(heading.group(1))
            name = strip_markdown(heading.group(2)).casefold()
            if start is not None and current_level <= level:
                break
            if name == heading_name.casefold():
                start = 1
                level = current_level
                continue
        elif start is not None:
            collected.append(line)
    return "\n".join(collected)


def clean_link_target(value: str) -> str:
    value = value.strip()
    if value.startswith("<") and ">" in value:
        return value[1:value.index(">")]
    # Markdown permits an optional quoted title after the target.
    match = re.match(r"(\S+?)(?:\s+[\"'].*[\"'])?$", value)
    return match.group(1) if match else value


def markdown_slug(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"!?\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[`*_~]", "", text).strip().casefold()
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE)
    return re.sub(r"[\s-]+", "-", text).strip("-")


def markdown_anchors(text: str) -> set[str]:
    anchors: set[str] = set()
    counts: dict[str, int] = defaultdict(int)
    for line in text.splitlines():
        heading = HEADING_RE.match(line)
        if heading:
            base = markdown_slug(heading.group(2))
            if base:
                count = counts[base]
                anchors.add(base if count == 0 else f"{base}-{count}")
                counts[base] += 1
        for explicit in re.findall(r"\b(?:id|name)=[\"']([^\"']+)[\"']", line, re.I):
            anchors.add(explicit.casefold())
    return anchors


def is_fenced_line(lines: list[str], one_based_line: int) -> bool:
    fenced = False
    marker: str | None = None
    for line in lines[:one_based_line]:
        match = re.match(r"^\s*(```+|~~~+)", line)
        if match:
            token = match.group(1)[0]
            if not fenced:
                fenced = True
                marker = token
            elif marker == token:
                fenced = False
                marker = None
    return fenced


def split_table_row(line: str) -> list[str]:
    content = line.strip()
    if content.startswith("|"):
        content = content[1:]
    if content.endswith("|") and not content.endswith(r"\|"):
        content = content[:-1]
    cells: list[str] = []
    current: list[str] = []
    escaped = False
    in_code = False
    for char in content:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            current.append(char)
            escaped = True
        elif char == "`":
            current.append(char)
            in_code = not in_code
        elif char == "|" and not in_code:
            cells.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    cells.append("".join(current).strip())
    return cells


def looks_like_table_row(line: str) -> bool:
    return line.lstrip().startswith("|") and line.rstrip().endswith("|")


def is_separator_candidate(line: str) -> bool:
    return looks_like_table_row(line) and all(re.fullmatch(r":?-+:?", cell.strip()) for cell in split_table_row(line))


def is_separator_row(line: str) -> bool:
    return is_separator_candidate(line) and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in split_table_row(line))


def table_data_rows(document: Document) -> list[tuple[int, list[str], list[str]]]:
    result: list[tuple[int, list[str], list[str]]] = []
    index = 0
    while index + 1 < len(document.lines):
        if looks_like_table_row(document.lines[index]) and is_separator_row(document.lines[index + 1]):
            headers = [strip_markdown(cell).casefold() for cell in split_table_row(document.lines[index])]
            index += 2
            while index < len(document.lines) and looks_like_table_row(document.lines[index]):
                result.append((index + 1, split_table_row(document.lines[index]), headers))
                index += 1
        else:
            index += 1
    return result


def parse_assessment(value: str) -> tuple[str, dict[str, int]] | None:
    normalized = strip_markdown(value)
    unsupported_prefix = "not emitted (unsupported); strongest observation "
    if normalized.casefold().startswith(unsupported_prefix):
        normalized = normalized[len(unsupported_prefix):]
    match = ASSESSMENT_RE.fullmatch(normalized)
    if match is None:
        return None
    return match.group("grade"), {name: int(match.group(name)) for name in "DVUCEXPR"}


def deterministic_grade(vector: dict[str, int]) -> str:
    core = [vector[name] for name in "DVUCE"]
    if all(value >= 2 for value in core) and sum(value == 3 for value in core) >= 4 and all(vector[name] >= 2 for name in "XPR"):
        return "A"
    if all(value >= 2 for value in core) and all(vector[name] >= 1 for name in "XPR"):
        return "B"
    if all(value >= 1 for value in core) and sum(vector[name] == 0 for name in "XPR") <= 1:
        return "C"
    return "D"


def valid_maturity(value: str) -> bool:
    normalized = strip_markdown(value)
    return bool(re.search(r"(?:^|\b(?:HE|ME)\d{3}\s+)M[0-5]\b", normalized)) and not LEGACY_PROFILE_RE.search(normalized)


def topic_root(path: Path, root: Path) -> Path | None:
    try:
        first = path.resolve().relative_to(root.resolve()).parts[0]
    except (ValueError, IndexError):
        return None
    if first.startswith("_") or first in SKIP_DIRS:
        return None
    return root / first


def topic_prefix(document: Document) -> str | None:
    parts = document.path.parts
    if "agent-harness-engineering" in parts:
        return "H"
    if "agent-rag-context-memory" in parts:
        return "M"
    # For additional topics, infer from the record itself rather than guessing.
    return None


def extract_arxiv_ids(value: str) -> set[str]:
    return {match.group(1).lower() for match in re.finditer(r"(?:arxiv\s*:\s*|arxiv\.org/(?:abs|html|pdf)/)(\d{4}\.\d{4,5}(?:v\d+)?)", value, re.I)}


def extract_persistent_ids(value: str) -> set[tuple[str, str]]:
    result: set[tuple[str, str]] = set()
    for item in extract_arxiv_ids(value):
        result.add(("arXiv", re.sub(r"v\d+$", "", item, flags=re.I)))
    for match in re.finditer(r"(?:doi\s*:?[\s\[]*|doi\.org/)(10\.\d{4,9}/[^\s<>\])};,]+)", value, re.I):
        result.add(("DOI", match.group(1).rstrip(".]").casefold()))
    for match in re.finditer(r"(?:openreview\s*:?\s*`?|openreview\.net/(?:forum|pdf)\?id=)([A-Za-z0-9_-]{6,})", value, re.I):
        result.add(("OpenReview", match.group(1)))
    return result


def check_external_url(url: str, timeout: float) -> tuple[str, str]:
    headers = {"User-Agent": "research-library-validator/1.0 (+structural-link-check)"}
    request = urllib.request.Request(url, headers=headers, method="HEAD")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return "ok", str(response.status)
    except urllib.error.HTTPError as exc:
        if exc.code in {405, 501}:
            get_request = urllib.request.Request(url, headers={**headers, "Range": "bytes=0-0"}, method="GET")
            try:
                with urllib.request.urlopen(get_request, timeout=timeout) as response:
                    return "ok", str(response.status)
            except urllib.error.HTTPError as get_exc:
                exc = get_exc
            except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as get_exc:
                return "network", str(get_exc.reason if isinstance(get_exc, urllib.error.URLError) else get_exc)
        if exc.code in {404, 410}:
            return "missing", str(exc.code)
        if exc.code in {401, 403, 405, 406, 407, 409, 418, 423, 425, 429, 451} or 500 <= exc.code <= 599:
            return "blocked", str(exc.code)
        return "http_error", str(exc.code)
    except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as exc:
        return "network", str(exc.reason if isinstance(exc, urllib.error.URLError) else exc)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    default_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root, help=f"research root (default: {default_root})")
    parser.add_argument("--external", action="store_true", help="also check external HTTP(S) URLs")
    parser.add_argument("--external-timeout", type=float, default=10.0, metavar="SECONDS", help="per-request timeout (default: 10)")
    parser.add_argument("--allow-legacy", action="store_true", help="accept legacy source-note metadata for fixtures/imports (modern metadata is required by default)")
    parser.add_argument("--warnings-as-errors", action="store_true", help="return failure when warnings are present")
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    validator = Validator(
        args.root,
        allow_legacy=args.allow_legacy,
        check_external=args.external,
        external_timeout=args.external_timeout,
    )
    findings = validator.run()
    counts = {severity: sum(item.severity == severity for item in findings) for severity in ("error", "warning")}
    if args.json:
        print(json.dumps({"root": str(validator.root), "findings": [dataclasses.asdict(item) for item in findings], "summary": counts}, indent=2))
    else:
        for item in findings:
            location = f"{item.path}:{item.line}" if item.line else item.path
            print(f"{item.severity.upper():7} {item.code:38} {location} — {item.message}")
        print(f"Validated {len(validator.documents)} Markdown files: {counts['error']} error(s), {counts['warning']} warning(s).")
    return 1 if counts["error"] or (args.warnings_as_errors and counts["warning"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
