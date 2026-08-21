# Research library

This directory is a reusable, source-first research library. Current topics:

- [`agent-harness-engineering/`](agent-harness-engineering/README.md)
- [`agent-rag-context-memory/`](agent-rag-context-memory/README.md)

**Current snapshot (2026-08-20):** 78 canonical works, 90 topic aliases/source notes, 84 claim records, and 114 evidence observations.

Corpus-level metadata and governance:

- [`works-registry.md`](works-registry.md) — canonical work identities, stable identifiers, reviewed versions, maturity, and duplicate mappings
- [`confidence-rubric.md`](confidence-rubric.md) — shared multidimensional evidence grading procedure
- [`CHANGELOG.md`](CHANGELOG.md) — audits, migrations, and correction classes
- [`REVIEW-2026-07-20.md`](REVIEW-2026-07-20.md) — independent citation-integrity, research-method, and coverage audit

## Layout

```text
research/
├── README.md
├── works-registry.md         # canonical W IDs and topic aliases
├── confidence-rubric.md      # shared evidence-confidence dimensions
├── CHANGELOG.md              # corpus audit and migration history
├── REVIEW-2026-07-20.md      # dated integrity/method/coverage audit
├── scripts/validate.py       # structural, provenance, and optional URL checks
├── tests/                    # standard-library validator fixtures
├── _templates/
│   ├── claim-record.md
│   ├── evidence-record.md
│   ├── methods.md
│   ├── source-note.md
│   └── topic-readme.md
└── <topic>/
    ├── README.md               # scope, map, status, update date
    ├── methods.md              # reproducible search/screen/update protocol
    ├── search-log.md           # append-only prospective search provenance
    ├── synthesis.md            # integrated conclusions
    ├── claims/                 # stable claim records
    ├── evidence/               # versioned evidence observations
    ├── evidence-table.md       # compact claim → evidence → limitations view
    ├── bibliography.md         # canonical source IDs and metadata
    └── source-notes/           # one auditable note per primary source
```

A topic may add focused reviews (for example, `context-and-tools.md`) when a single synthesis becomes too large.

## Evidence conventions

- **Work identity:** `W###` IDs in [`works-registry.md`](works-registry.md) are canonical, immutable, and identify distinct works. `H##` and `M##` IDs are topic-local compatibility aliases; two aliases can resolve to one W ID and must not be counted as independent works or replications.
- **Citations:** use the canonical W ID with its topic alias where the schema calls for both (for example, `W005 / H05`). All source notes and evidence observations are migrated and mechanically checked against the registry. Resolve important synthesis statements through stable claim and evidence IDs to an exact, versioned source artifact.
- **Confidence:** apply [`confidence-rubric.md`](confidence-rubric.md). Keep claim type, polarity, publication maturity, and the eight confidence dimensions separate; publish the score vector with any summary grade.
- **Source status:** label peer-reviewed work, preprints, technical reports, benchmarks, and practitioner material. Do not imply that an arXiv posting was peer reviewed.
- **Claims:** distinguish a paper's reported result from this library's synthesis. Include the benchmark, model/harness pairing, sample size, metric, and important caveats where available.
- **Quotations:** quote sparingly. Record a section, page, table, or figure locator and the exact source version. Paraphrases still require citations.
- **Web acquisition:** source notes record the URL, version, access date, and whether the full paper, abstract, or another primary page was scraped. A scrape is evidence collection, not independent replication.
- **Conflicts and null results:** retain negative evidence and disagreements. Do not average incomparable leaderboards.
- **Dates:** use ISO dates. Every topic records `Last updated` and its literature cutoff.

## Adding a topic

1. Copy `_templates/topic-readme.md` into `research/<topic>/README.md`.
2. Create `methods.md`, `synthesis.md`, `claims/`, `evidence/`, `evidence-table.md`, `bibliography.md`, and `source-notes/`.
3. Record databases, exact queries, screening decisions, citation chaining, and the searched universe behind absence claims.
4. Start from primary papers and proceedings; use surveys for discovery and taxonomy, not as the sole support for empirical claims.
5. Add one source note per work using `_templates/source-note.md`; deduplicate works in a corpus-level registry before assigning topic aliases.
6. Add stable claim and evidence records. Link every important synthesis clause to a claim, every claim to positive/negative/null/qualifying evidence, and every evidence observation to a versioned source locator.
7. Run the structural validator and tests before merging changes.

## Validation

From the repository root:

```sh
python3 research/scripts/validate.py --root research --warnings-as-errors
python3 -m unittest discover -s research/tests -v
```

External URL checks are opt-in because publisher anti-bot responses and network failures are not equivalent to confirmed missing pages:

```sh
python3 research/scripts/validate.py --root research --external
```
