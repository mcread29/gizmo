# Research library changelog

All dates are ISO dates. This file records corpus-level migrations and audit classes; topic-local prose retains its own history.

## 2026-08-20 — Agent-harness-engineering preprint watch addition

### Added

- Added five 2026 preprints on agent harness engineering, surfaced by a web-search sweep for research published 2026-07-15 through 2026-08-20 and abstract-verified directly against arXiv on 2026-08-20: *ACM: Agentic Context Management for Long Horizon Tasks* (arXiv:2607.23809), *Diagnosis Before Recovery (DARC)* (arXiv:2608.11772), *Looping Is Not Reliability* (arXiv:2607.24604), *Self-Authored Verification Is Unreliable in Heuristic Self-Improving Agents (SEAL)* (arXiv:2607.24300), and *EA-Graph: Artifact-Anchored Verification Memory for Coding Agents under Upstream Drift* (arXiv:2608.04278).
- Added canonical works `W074–W078` and topic aliases `H52–H56`, five modern-schema source notes, five claims `HC036–HC040`, and five evidence observations `HE056–HE060`.
- Appended search-log rows `H-20260820-000` through `H-20260820-005`, including the discovery sweep and per-paper exact-identifier verification, and the explicit exclusion of one meta-synthesis (arXiv:2607.05775) that predated the requested window.

### Evidence boundaries retained

- All five additions are **abstract-only acquisitions**: no primary-text section, table, or figure locator was reviewed. Every linked evidence observation is capped at grade D under the confidence rubric's abstract/metadata-only rule, regardless of how the source paper's own abstract frames its results.
- The EA-Graph claim (HC040) explicitly retains the source paper's own reported non-significant result for larger models alongside its reported positive result for smaller models, rather than citing only the favorable half.
- The Looping-Is-Not-Reliability claim (HC038) retains the authors' own caveat that their proposed contract is an executable specification, not a demonstrated reliability improvement, and that the underlying evaluation is a 30-task HumanEval sample.
- Full-text acquisition and re-grading are scheduled by 2026-10-20 per the topic's standard preprint recheck cadence.

### Updated corpus totals

- Canonical works: **78** (`W001–W078`).
- Topic aliases/source notes: **90** (`56 H + 34 M`).
- Claim records: **84** (`40 HC + 44 MC`).
- Evidence observations: **114** (`60 HE + 54 ME`).

## 2026-07-20 — Distributed state, transactions, and agent side effects expansion

### Added

- Added the focused review [`agent-harness-engineering/distributed-state-and-transactions.md`](agent-harness-engineering/distributed-state-and-transactions.md), covering ambiguous timeout outcomes, lost acknowledgements/duplicates, end-to-end idempotency, cross-tool atomicity, sagas/compensation, leases/fencing/split brain, optimistic concurrency, logs/replay/reconciliation, exactly-once assumptions, and side-effect failure injection.
- Added 17 canonical works `W057–W073` and harness aliases `H35–H51`: Sagas; Birrell–Nelson RPC; Gray–Cheriton leases; Raft; Gray–Reuter; Kung–Robinson OCC; RFC 9110; Chubby; RIFL; end-to-end arguments; ARIES; FoundationDB; Gray–Lamport transaction commit; Helland; and direct agent evidence from Atomix, RAC, and Cordon.
- Added 17 modern-schema source notes, 11 claims `HC025–HC035`, and 25 observations `HE031–HE055`, including a bounded corpus observation that deliberately remains unsupported rather than asserting global absence.
- Added an agent-specific failure-injection matrix and protocol with post-effect/pre-response loss, duplicate delivery, stale writers, split brain, CAS/ABA, changed external state, compensation failure, restart, and partial-commit oracles.
- Initialized the project directory as a Git repository at the user's request; no commit was created.

### Evidence boundaries retained

- Established distributed-systems results are separated from direct LLM-agent experiments.
- Atomix and Cordon are labelled preprints; RAC is labelled peer reviewed. Their bundled runtimes, small/constructed evaluations, trusted adapters, compensation failures, opaque-effect exclusions, and partial-commit limits remain visible.
- Normative recommendations explicitly name their empirical premises.
- Failed broad SearXNG searches are logged as zero-result tool failures, not absence evidence. Exact DOI/arXiv/RFC/publisher/proceedings checks are logged prospectively with counts.
- The exactly-once conclusion is conditional rather than absolute: RIFL demonstrates a bounded participating-service result, while arbitrary independent/irreversible endpoints remain unproven in this corpus.

### Updated corpus totals

- Canonical works: **73** (`W001–W073`).
- Topic aliases/source notes: **85** (`51 H + 34 M`).
- Claim records: **79** (`35 HC + 44 MC`).
- Evidence observations: **109** (`55 HE + 54 ME`).

## 2026-07-20 — Corpus identity and confidence migration

### Added

- Added [`works-registry.md`](works-registry.md) as the canonical work-identity layer.
- Assigned immutable IDs `W001–W056` to 56 distinct works represented by 68 bibliography entries and 68 source-note files.
- Preserved all 68 topic IDs as aliases: 34 `H##` and 34 `M##` aliases, each mapped exactly once.
- Reconciled 12 cross-topic duplicate pairs:
  - `W005`: H05 ↔ M03 (ContextBench)
  - `W006`: H06 ↔ M25 (AI Agents That Matter)
  - `W010`: H10 ↔ M10 (Reflexion)
  - `W013`: H13 ↔ M22 (AgentDojo)
  - `W017`: H17 ↔ M05 (RepoCoder)
  - `W018`: H18 ↔ M06 (Repoformer)
  - `W023`: H23 ↔ M26 (τ-bench)
  - `W027`: H27 ↔ M23 (CaMeL)
  - `W028`: H28 ↔ M01 (LongMemEval)
  - `W029`: H29 ↔ M14 (TapeAgents)
  - `W030`: H30 ↔ M20 (equal-token multi-agent study)
  - `W031`: H31 ↔ M11 (ExpeL)
- Added [`confidence-rubric.md`](confidence-rubric.md), separating claim type, polarity, publication maturity, directness, internal/construct validity, statistical/measurement uncertainty, comparator/budget matching, evaluator quality, external validity, independent replication, and reproducibility.
- Defined a deterministic observation-grade and claim-status procedure, explicit unknown handling, and mandatory confidence caps.

### Migration rules

- `W###` is now the canonical citation identity; `H##`/`M##` IDs are compatibility aliases, not separate works.
- W IDs are immutable and must not be renumbered or reused. New versions and later publication records update the same work row unless they are genuinely distinct works.
- Canonical publication metadata and the exact artifact/version reviewed are recorded separately.
- Missing or unverified metadata is marked `unknown`; venue status is not inferred from manuscript templates.
- Duplicate topic notes remain independent topic-local extraction views, but all source-note headers and evidence identity fields now resolve through the shared W record.

### Correction classes recorded by the 2026-07-20 audit

The detailed corrections and remaining gaps are in [`REVIEW-2026-07-20.md`](REVIEW-2026-07-20.md). The audit identified these correction classes:

1. **Work identity and duplicate drift:** independent H/M records described the same work; Repoformer had already accumulated conflicting speed language.
2. **Version and publication provenance:** mutable/versionless arXiv references, missing `Version reviewed` fields, and peer-review status that differed from the artifact used for extraction.
3. **Numerical extraction and locator errors:** wrong table/section, protocol, denominator, or value family (including SWE-Pruner and CaMeL v2).
4. **Bundled-versus-isolated effects:** full-system results attributed too narrowly to one component (including AutoCodeRover and MemCon).
5. **Comparator and budget mismatch:** cross-system leaderboards or unequal configurations treated too much like causal ablations; equal-token multi-agent evidence overgeneralized to durable shared memory.
6. **Scope overstatement:** benchmark/model/attack-family findings generalized beyond tested conditions (including CaMeL and Repoformer speed/quality tradeoffs).
7. **Retrieval/mechanism classification:** lexical retrieval described as dense retrieval (RepoCoder).
8. **Evaluator and epistemic overstatement:** logs/tests/judges treated as automatic ground truth rather than fallible evidence.
9. **Publication metadata reconciliation:** verified venue record and reviewed preprint version separated (including AI Agents That Matter and CodePlan).
10. **Counterevidence retention:** full-context wins, null/harmful retrieval, and benchmark-to-deployment validity boundaries kept visible.
11. **Claim traceability gaps:** important synthesis clauses still lack stable claim/evidence observation IDs and exact backlinks.
12. **Reproducibility/search gaps:** absent reproducible search universes, incomplete artifact provenance, and uneven primary-table acquisition.

### Completed source/evidence metadata migration

- Migrated all **68/68** source-note headers to the 17-field modern schema while preserving Authors and Year/venue and retaining reviewed/acquisition URLs separately from canonical registry URLs.
- Added exact registry identity sets (`W### / H##[, M##]`) to **68/68** source notes.
- Added matching canonical W IDs beside topic aliases in **84/84** evidence observations; the corpus-level ME054 review observation enumerates all 34 registry-backed M-source pairs in its documented sampling frame.
- Made modern source metadata and registry-matched source/evidence identities the validator default; legacy source fields now require explicit `--allow-legacy`.
- Recorded unavailable lifecycle, discovery, reviewer, artifact, and verification details with accepted explicit unknown/not-retained markers rather than inferring values.

### Consistency result

- Bibliography IDs: **68 total**, **68 unique by topic alias**.
- Source notes: **68 total**, with a one-to-one filename/header mapping to bibliography aliases.
- Distinct works after reconciliation: **56**.
- Duplicate work pairs: **12 known and reconciled**; **0 additional normalized identifier duplicates discovered**.
- Registry coverage: **68/68 aliases**, **56/56 W IDs unique and contiguous**.

## 2026-07-20 — Claim/evidence and validation migration completed

### Added and migrated

- Added retrospective-honest `methods.md` and append-only `search-log.md` files to both topics.
- Added 68 stable claim records: `HC001–HC024` and `MC001–MC044`.
- Added 84 evidence observations: `HE001–HE030` and `ME001–ME054`.
- Linked evidence tables, source notes, syntheses, focused reviews, and claim/evidence records bidirectionally.
- Migrated all 68 source notes to the modern 17-field metadata header and mapped each alias to its canonical W ID.
- Mapped all 84 evidence files to matching canonical W IDs and topic aliases.
- Unified both topics on [`confidence-rubric.md`](confidence-rubric.md): canonical claim types, relationship polarities, claim statuses, artifact maturity `M0–M5`, `D/V/U/C/E/X/P/R` dimensions, deterministic grades, and explicit caps.
- Added [`scripts/validate.py`](scripts/validate.py), usage documentation, and 18 standard-library fixture tests.

### Preservation and limits

- Empirical numerical results were preserved during structural migration.
- Unknown historical queries, versions, artifacts, hashes, and reviewer identities remain explicit unknowns rather than reconstructed values.
- The initial search is not relabeled systematic; reproducible search requirements apply prospectively.
- Structural confidence normalization lowered or marked unsupported claims when the canonical rubric did not justify a stronger status.

### Final structural validation

- Markdown files validated: **258**.
- Canonical works: **56**; aliases: **68/68 mapped**.
- Modern source notes: **68/68**.
- Claim records: **68/68**; evidence records: **84/84**.
- Evidence W/topic identity mappings: **117/117 valid**.
- Validator result with warnings as errors: **0 errors, 0 warnings**.
- Unit tests: **18 passed**.
