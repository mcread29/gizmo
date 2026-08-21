from __future__ import annotations

import importlib.util
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VALIDATOR_PATH = Path(__file__).parents[1] / "scripts" / "validate.py"
SPEC = importlib.util.spec_from_file_location("research_validate", VALIDATOR_PATH)
assert SPEC and SPEC.loader
validate = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = validate
SPEC.loader.exec_module(validate)


LEGACY_NOTE = """# [{alias}] Example work

- **Authors:** A. Author
- **Year / venue:** 2025, ExampleConf
- **Status:** peer reviewed
- **Stable ID:** arXiv:2501.00001v2
- **Primary URL:** <https://example.test/work>
- **Version reviewed:** arXiv v2, 2025-01-02
- **Accessed:** 2026-07-20
- **Acquisition:** primary paper reviewed

## Links to synthesis claims

{backlinks}
"""


class ValidatorFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / "research"
        self.root.mkdir()

    def tearDown(self):
        self.temporary.cleanup()

    def write(self, relative: str, text: str):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def add_legacy_topic(self, topic="topic", alias="H01", backlinks="Background only."):
        self.write(f"{topic}/bibliography.md", f"# Bibliography\n\n- **[{alias}]** Example work\n")
        self.write(
            f"{topic}/source-notes/{alias}-example.md",
            LEGACY_NOTE.format(alias=alias, backlinks=backlinks),
        )
        self.write(f"{topic}/README.md", "# Topic\n")

    def findings(self, **kwargs):
        return validate.Validator(self.root, **kwargs).run()

    def codes(self, **kwargs):
        return {finding.code for finding in self.findings(**kwargs)}

    def test_modern_metadata_is_default_and_legacy_requires_escape_hatch(self):
        self.add_legacy_topic()
        self.write("topic/page.md", "# Details\n\nSee [topic](README.md) and [section](#details). [H01]\n")
        self.assertIn("SOURCE_METADATA_MISSING", self.codes())
        self.assertEqual([], [item for item in self.findings(allow_legacy=True) if item.severity == "error"])

    def test_local_links_files_directories_anchors_and_references(self):
        self.add_legacy_topic()
        self.write("topic/target.md", "# Repeated heading\n\n## Repeated heading\n")
        self.write(
            "topic/links.md",
            "# Links\n\n[one](target.md#repeated-heading) [two](target.md#repeated-heading-1) "
            "[dir](source-notes/) [ref][target]\n\n[target]: target.md\n",
        )
        self.assertNotIn("BROKEN_LOCAL_LINK", self.codes())
        self.assertNotIn("BROKEN_LOCAL_ANCHOR", self.codes())
        self.write("topic/bad.md", "# Bad\n\n[missing](target.md#absent) [file](nope.md) [x][undefined]\n")
        codes = self.codes()
        self.assertIn("BROKEN_LOCAL_LINK", codes)
        self.assertIn("BROKEN_LOCAL_ANCHOR", codes)
        self.assertIn("UNDEFINED_LINK_REFERENCE", codes)

    def test_bibliography_note_and_citation_coverage(self):
        self.add_legacy_topic()
        self.write("topic/page.md", "# Page\n\nUndefined citation [H99].\n")
        self.write("topic/source-notes/H02-extra.md", LEGACY_NOTE.format(alias="H02", backlinks="None."))
        codes = self.codes()
        self.assertIn("SOURCE_NOTE_BIBLIOGRAPHY_MISSING", codes)
        self.assertIn("UNDEFINED_SOURCE_ID", codes)

    def test_metadata_unknown_marker_and_legacy_version_escape_hatch(self):
        self.add_legacy_topic()
        note = self.root / "topic/source-notes/H01-example.md"
        note.write_text(note.read_text().replace("- **Version reviewed:** arXiv v2, 2025-01-02\n", ""), encoding="utf-8")
        legacy = self.findings(allow_legacy=True)
        self.assertTrue(any(item.code == "SOURCE_VERSION_MISSING" and item.severity == "warning" for item in legacy))
        modern_default = self.findings()
        self.assertTrue(any(item.code == "SOURCE_VERSION_MISSING" and item.severity == "error" for item in modern_default))
        text = note.read_text().replace("arXiv:2501.00001v2", "arXiv:2501.00001")
        text = text.replace("- **Accessed:**", "- **Version reviewed:** unknown — exact artifact was not preserved\n- **Accessed:**")
        note.write_text(text, encoding="utf-8")
        codes = self.codes(allow_legacy=True)
        self.assertNotIn("SOURCE_VERSION_UNPINNED", codes)
        self.assertNotIn("ARXIV_VERSION_UNPINNED", codes)

    def test_modern_source_notes_require_extended_metadata(self):
        self.add_legacy_topic()
        note = self.root / "topic/source-notes/H01-example.md"
        note.write_text(
            note.read_text().replace(
                "- **Authors:** A. Author",
                "- **Work ID / topic aliases:** W001 / H01\n- **Authors:** A. Author",
            ),
            encoding="utf-8",
        )
        findings = self.findings()
        self.assertTrue(any(item.code == "SOURCE_METADATA_MISSING" and item.severity == "error" for item in findings))

    def test_modern_source_alias_set_must_exactly_match_registry(self):
        self.write("topic/bibliography.md", "# Bibliography\n\n- **[H01]** Example work\n")
        self.write("topic/README.md", "# Topic\n")
        note = self.write(
            "topic/source-notes/H01-example.md",
            """# [H01] Example work

- **Work ID / topic aliases:** W001 / H01, M01
- **Authors:** A. Author
- **Year / venue:** 2025, ExampleConf
- **Document type:** experiment
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2501.00001v2
- **Canonical URL:** <https://example.test/work>
- **Version reviewed / version date:** arXiv v2, 2025-01-02
- **Published version / supersedes:** unknown — relationship not retained
- **Correction or retraction status:** not independently verified
- **Accessed / last verified:** accessed 2026-07-20; last verified 2026-07-20
- **Acquisition:** primary paper reviewed
- **Artifact URI / SHA-256:** URI not retained; SHA-256 not computed
- **Acquisition extent:** full paper
- **Discovery:** unknown — query not retained
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained
""",
        )
        self.write(
            "works-registry.md",
            "# Registry\n\n| W ID | Topic aliases |\n|---|---|\n| W001 | H01, M01 |\n",
        )
        self.assertNotIn("SOURCE_WORK_ID_MISMATCH", self.codes())
        note.write_text(note.read_text().replace("W001 / H01, M01", "W001 / H01"), encoding="utf-8")
        self.assertIn("SOURCE_WORK_ID_MISMATCH", self.codes())

    def test_duplicate_identifiers_are_reported_then_reconciled_by_registry(self):
        self.add_legacy_topic("one", "H01")
        self.add_legacy_topic("two", "M01")
        self.assertIn("DUPLICATE_PERSISTENT_ID", self.codes())
        self.write(
            "works-registry.md",
            "# Registry\n\n| W ID | Topic aliases |\n|---|---|\n| W001 | H01, M01 |\n",
        )
        self.assertNotIn("DUPLICATE_PERSISTENT_ID", self.codes())
        self.assertNotIn("REGISTRY_ALIAS_MISSING", self.codes())

    def test_registry_requires_every_source_alias(self):
        self.add_legacy_topic("one", "H01")
        self.add_legacy_topic("two", "M01")
        self.write("works-registry.md", "# Registry\n\n| W ID | Topic aliases |\n|---|---|\n| W001 | H01 |\n")
        findings = self.findings()
        self.assertTrue(any(item.code == "REGISTRY_ALIAS_MISSING" and "M01" in item.message for item in findings))

    def add_record_system(self):
        topic = "agent-harness-engineering"
        self.add_legacy_topic(topic, "H01", "[HC001](../claims/HC001.md), [HE001](../evidence/HE001.md)")
        self.write(
            "works-registry.md",
            "# Registry\n\n| W ID | Topic aliases |\n|---|---|\n| W001 | H01 |\n",
        )
        self.write(
            f"{topic}/claims/HC001.md",
            """# [HC001] Claim

- **Claim text:** A bounded claim.
- **Claim type:** comparative
- **Polarity:** supports
- **Scope:** Example scope.
- **Claim status:** supported

## Evidence map

- **Evidence for:** [HE001](../evidence/HE001.md)
- **Evidence against:** none
- **Null evidence:** none
- **Qualifying evidence:** none

## Confidence

- **Claim grade:** C [D3 V2 U1 C2 E2 X1 P1 R2]
- **Publication maturity by evidence:** HE001 M4
- **Score rationale (0–1):** U1—uncertainty is limited; X1—one setting; P1—no independent replication
- **Caps applied:** none

## Synthesis locations

- synthesis.md — Main conclusion
""",
        )
        self.write(
            f"{topic}/evidence/HE001.md",
            """# [HE001] Observation

- **Claim ID:** [HC001](../claims/HC001.md)
- **Work ID / topic source ID:** W001 / H01
- **Claim type:** comparative
- **Polarity:** supports
- **Claim status:** supported
- **Publication maturity:** M4; peer reviewed
- **Observation grade:** C [D3 V2 U1 C2 E2 X1 P1 R2]
- **Score rationale (0–1):** U1—uncertainty is limited; X1—one setting; P1—no independent replication
- **Caps applied:** none
""",
        )
        self.write(f"{topic}/synthesis.md", "# Synthesis\n\nA bounded claim. [HC001](claims/HC001.md)\n")
        self.write(
            f"{topic}/evidence-table.md",
            """# Evidence table

| Claim ID | Claim | Evidence | Claim type | Polarity | Claim status | Claim assessment | Publication maturity |
|---|---|---|---|---|---|---|---|
| [HC001](claims/HC001.md) | A bounded claim. | [HE001](evidence/HE001.md) | comparative | supports | supported | C [D3 V2 U1 C2 E2 X1 P1 R2] | HE001 M4 |
""",
        )

    def test_record_system_passes_bidirectional_and_backlink_checks(self):
        self.add_record_system()
        errors = [item for item in self.findings(allow_legacy=True) if item.severity == "error"]
        self.assertEqual([], errors)

    def test_source_and_evidence_work_ids_must_match_registry(self):
        self.add_record_system()
        evidence = self.root / "agent-harness-engineering/evidence/HE001.md"
        evidence.write_text(evidence.read_text().replace("W001 / H01", "W999 / H01; W998"), encoding="utf-8")
        codes = self.codes(allow_legacy=True)
        self.assertIn("EVIDENCE_WORK_ID_MISMATCH", codes)
        self.assertIn("EVIDENCE_WORK_ID_WITHOUT_SOURCE", codes)

    def test_record_dangling_nonreciprocal_and_duplicate_ids(self):
        self.add_record_system()
        claim = self.root / "agent-harness-engineering/claims/HC001.md"
        claim.write_text(claim.read_text().replace("HE001.md", "HE999.md").replace("HE001]", "HE999]"), encoding="utf-8")
        self.write("agent-harness-engineering/claims/not-HC001.md", "# [HC001] Duplicate\n")
        codes = self.codes()
        self.assertIn("DUPLICATE_RECORD_ID", codes)
        self.assertIn("CLAIM_EVIDENCE_MISSING", codes)
        self.assertIn("EVIDENCE_CLAIM_NOT_RECIPROCAL", codes)

    def test_evidence_table_ids_vocab_and_shape(self):
        self.add_record_system()
        self.write(
            "agent-harness-engineering/evidence-table.md",
            """# Evidence table

| Claim ID | Claim type | Polarity | Claim status | Claim assessment | Publication maturity |
|---|---|---|---|---|---|
| no ID | invented | sideways | certain | `P3/D3/I2/U1/B1/E2/X1/R0/A2` | published |
| [HC001] | comparative | supports | supported | C [D3 V2 U1 C2 E2 X1 P1 R2] |
""",
        )
        self.write(
            "agent-harness-engineering/malformed-table.md",
            "| A | B |\n|--|---|\n| one | two |\n",
        )
        codes = self.codes()
        self.assertIn("EVIDENCE_TABLE_CLAIM_ID_MISSING", codes)
        self.assertIn("UNDEFINED_CLAIM_TYPE", codes)
        self.assertIn("UNDEFINED_POLARITY", codes)
        self.assertIn("INVALID_CANONICAL_ASSESSMENT", codes)
        self.assertIn("INVALID_PUBLICATION_MATURITY", codes)
        self.assertIn("TABLE_COLUMN_COUNT", codes)
        self.assertIn("TABLE_SEPARATOR", codes)

    def test_migrated_records_reject_legacy_profiles_and_nondeterministic_grades(self):
        self.add_record_system()
        claim = self.root / "agent-harness-engineering/claims/HC001.md"
        text = claim.read_text().replace(
            "- **Claim grade:** C [D3 V2 U1 C2 E2 X1 P1 R2]",
            "- **Claim grade:** B [D3 V2 U1 C2 E2 X1 P1 R2]\n- **Profile:** `PM=H;DR=H;IV=M;UR=L;CM=M;EO=M;EV=L;IR=L;RP=M`",
        )
        claim.write_text(text, encoding="utf-8")
        codes = self.codes()
        self.assertIn("LEGACY_CONFIDENCE_PROFILE", codes)
        self.assertIn("NONDETERMINISTIC_GRADE", codes)

    def test_canonical_assessment_helpers(self):
        parsed = validate.parse_assessment("C [D3 V2 U1 C2 E2 X1 P1 R2]")
        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual("C", validate.deterministic_grade(parsed[1]))
        self.assertIsNone(validate.parse_assessment("P3/D3/I2/U1/B1/E2/X1/R0/A2"))
        self.assertIsNone(validate.parse_assessment("PM=H;DR=H;IV=M;UR=L;CM=M;EO=M;EV=L;IR=L;RP=M"))

    def test_source_note_template_exactly_matches_modern_field_names(self):
        template = (VALIDATOR_PATH.parents[1] / "_templates" / "source-note.md").read_text(encoding="utf-8")
        fields = tuple(
            validate.normal_field(match.group(1))
            for line in template.splitlines()
            if (match := validate.FIELD_RE.match(line))
        )
        self.assertEqual(validate.MODERN_SOURCE_FIELDS, fields)

    def test_source_note_backlinks_and_synthesis_locations(self):
        self.add_record_system()
        note = self.root / "agent-harness-engineering/source-notes/H01-example.md"
        note.write_text(note.read_text().replace("[HE001](../evidence/HE001.md)", ""), encoding="utf-8")
        synthesis = self.root / "agent-harness-engineering/synthesis.md"
        synthesis.write_text("# Synthesis\n\nNo claim link.\n", encoding="utf-8")
        codes = self.codes()
        self.assertIn("SOURCE_EVIDENCE_BACKLINK_MISSING", codes)
        self.assertIn("SYNTHESIS_BACKLINK_MISSING", codes)

    def test_stale_facts_are_caught_but_corrected_negation_is_not(self):
        self.add_legacy_topic()
        self.write("topic/fact.md", "# Fact\n\nCodePlan passed 5 of 6 repositories.\n")
        self.assertIn("KNOWN_BAD_FACT", self.codes())
        self.write("topic/fact.md", "# Fact\n\nRepoCoder uses lexical Jaccard retrieval, not dense vector retrieval.\n")
        self.assertNotIn("KNOWN_BAD_FACT", self.codes())


class ExternalResponseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(BaseHTTPRequestHandler):
            def do_HEAD(self):
                statuses = {"/ok": 200, "/missing": 404, "/blocked": 403}
                self.send_response(statuses.get(self.path, 500))
                self.end_headers()

            def log_message(self, _format, *_args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_external_statuses_distinguish_missing_and_antibot(self):
        self.assertEqual("ok", validate.check_external_url(self.base + "/ok", 2)[0])
        self.assertEqual("missing", validate.check_external_url(self.base + "/missing", 2)[0])
        self.assertEqual("blocked", validate.check_external_url(self.base + "/blocked", 2)[0])


if __name__ == "__main__":
    unittest.main()
