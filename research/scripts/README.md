# Research library structural validator

`validate.py` checks the research corpus using Python 3's standard library only. It is safe to run before claim/evidence records are introduced: record-specific checks activate per topic when records exist. The same command validates the migrated layout after records and a canonical work registry appear.

## Usage

From the repository root:

```sh
research/scripts/validate.py
python3 research/scripts/validate.py --root research
python3 research/scripts/validate.py --json
```

Optional import/network checks:

```sh
# Explicit compatibility escape hatch for legacy fixtures/imports.
research/scripts/validate.py --allow-legacy

# Check unique external URLs (network access; 10 second/request default).
research/scripts/validate.py --external
research/scripts/validate.py --external --external-timeout 20

# Suitable for a warning-free CI policy.
research/scripts/validate.py --warnings-as-errors
```

The process exits `1` for any error, or for a warning with `--warnings-as-errors`; otherwise it exits `0`. External checks classify HTTP 404/410 as confirmed missing pages. Authentication, rate-limit, anti-bot, legal-block, server, DNS, TLS, and timeout responses are warnings with distinct codes, not confirmed 404s.

Run the unit tests with:

```sh
python3 -m unittest discover -s research/tests -v
```

## Checks

The validator reports stable diagnostic codes for:

- local Markdown files, directories, reference links, and heading anchors;
- topic citations, bibliography entries, and source-note ID coverage;
- all 17 required modern source-note metadata fields (legacy only with `--allow-legacy`);
- exact reviewed versions, versioned arXiv IDs, or an explicit unknown marker;
- duplicate DOI, base arXiv, and OpenReview identities across topic aliases;
- canonical `W###` registry coverage, exact source-note W/alias sets, and one-to-one alias mapping;
- matching registry-backed `W###` plus `H##`/`M##` identities in every evidence observation;
- unique `HC###`, `HE###`, `MC###`, and `ME###` record definitions and matching filenames;
- evidence-table claim IDs and one row per claim record;
- claim/evidence record existence and reciprocal references;
- source-note claim/evidence backlinks;
- claim links at every file named under `Synthesis locations`;
- canonical claim types, relationship polarities, claim statuses, publication maturity, dimension vectors, and deterministic grades;
- Markdown table separator, width, duplicate-header, and empty-cell consistency;
- narrowly defined stale factual strings identified by the corpus audit;
- optional external URLs.

Templates are not treated as instantiated records, and their placeholder links/table cells are skipped. Audit/change-log files are excluded from stale-fact checks so that they can describe an old value without reintroducing it as a claim.

## Controlled values

Migrated HC/HE/MC/ME records and both evidence tables accept only the values in [`../confidence-rubric.md`](../confidence-rubric.md):

- claim types: `descriptive`, `comparative`, `causal`, `mechanistic`, `predictive`, `normative`, `existence`, `absence`, `synthesis`;
- relationship polarities: `supports`, `against`, `null`, `qualifies`, `mixed`, `not-applicable`;
- claim statuses: `supported`, `mixed`, `disputed`, `unsupported`, `superseded`;
- publication maturity: `M0`–`M5`, independently recorded per artifact;
- assessment form: `C [D3 V2 U1 C2 E2 X1 P1 R2]`, with each dimension `0`–`3` in exact canonical order.

The validator recomputes the uncapped A–D grade from the vector. A displayed grade must match unless a recorded cap lowers it; caps may never raise a grade. Grade E remains available for unresolved/disputed extraction. Every migrated record must include a score rationale and caps field. Unsupported claims do not emit a claim grade, but must expose the strongest observation/vector when one exists. Supported and mixed claims require an A–C support grade.

The former harness `PM/DR/IV/UR/CM/EO/EV/IR/RP` and memory `P/D/I/U/B/E/X/R/A` profile grammars are rejected. Claim type, polarity, status, maturity, and assessment are validated independently.

## Explicit unknowns

A required field must contain a real value or begin with one of these case-insensitive markers, optionally followed by a reason:

- `unknown`
- `not reported`
- `not available`
- `not applicable`
- `not retained`
- `none`
- `not independently verified`
- `not verified`
- `unverified`

`N/A`, `TBD`, `TODO`, `?`, and a bare dash are not accepted because they do not distinguish unknown, inapplicable, and unfinished data. An exact version may use an accepted unknown marker, but vague mutable values such as `latest`, `current`, or `unversioned` fail.

## Migration behavior

The checked-in corpus is fully migrated. By default, every source note must contain the exact modern fields shown in [`../_templates/source-note.md`](../_templates/source-note.md), and `Work ID / topic aliases` must exactly equal the canonical W ID and complete alias set in [`../works-registry.md`](../works-registry.md). Every evidence observation must name at least one `W### / H##` or `W### / M##` pair, and each pair is checked against that registry. The corpus-level ME054 review observation enumerates its complete 34-source sampling frame; it is not treated as a direct extraction requiring backlinks from every note.

`--allow-legacy` is an explicit compatibility escape hatch for fixtures and incoming imports. It accepts the old `Status`, `Stable ID`, `Primary URL`, `Version reviewed`, and `Accessed` names; a missing legacy version remains a warning. It does not relax checks for a source note that already declares `Work ID / topic aliases`, and it is not used for corpus validation or CI.

Claim/evidence checks activate independently for every topic with records, which catches partial or dangling migrations rather than silently ignoring them. HC/HE/MC/ME records require the canonical root schema; templates are skipped as placeholders. Duplicate persistent IDs are accepted only when all aliases resolve to one canonical W ID.
