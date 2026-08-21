# Agent harness engineering

**Status:** evidence-backed working synthesis  
**Last updated:** 2026-08-20  
**Literature cutoff:** 2026-08-20 (five 2026-08-20 additions are abstract-only acquisitions capped at grade D; see update log)

## Scope

This topic studies the software/runtime layer around one or more foundation models that turns model calls into a stateful, tool-using, governed execution process. It covers observation and action interfaces, context and memory, control loops, verification and recovery, security boundaries, multi-agent orchestration, and evaluation. Coding agents receive extra attention because repositories, terminals, tests, and patches expose unusually strong machine-checkable evidence.

It does **not** treat every prompt technique as harness engineering, assume that greater autonomy is better, or treat leaderboard movement as causal evidence about a harness unless the model, budget, environment, and evaluation are controlled.

## Reading map

1. [`methods.md`](methods.md) and append-only [`search-log.md`](search-log.md) — scope, retrospective search limits, screening, acquisition, review, adjudication, confidence, and update procedures.
2. [`synthesis.md`](synthesis.md) — integrated answer and design implications linked to stable claims.
3. [`architecture.md`](architecture.md) — a defensible runtime decomposition and control patterns.
4. [`context-and-tools.md`](context-and-tools.md) — repository context, action interfaces, and executable feedback.
5. [`reliability-security.md`](reliability-security.md) — permissions, prompt injection, verification, recovery, and oversight.
6. [`memory-and-orchestration.md`](memory-and-orchestration.md) — state, durable memory, delegation, and multi-agent tradeoffs.
7. [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md) — focused review of ambiguous effects, idempotency, atomicity, sagas, fencing, concurrency, replay, exactly-once assumptions, and failure injection.
8. [`evaluation.md`](evaluation.md) — how to evaluate a model–harness system without fooling yourself.
9. [`claims/`](claims/) — 40 stable `HC###` records using the canonical confidence rubric and synthesis locations.
10. [`evidence/`](evidence/) and [`evidence-table.md`](evidence-table.md) — 60 `HE###` observations and the compact claim/evidence/caveat matrix.
11. [`bibliography.md`](bibliography.md) and [`source-notes/`](source-notes/) — 56 bibliography/source-note records with exact HC/HE backlinks.
12. [`../REVIEW-2026-07-20.md`](../REVIEW-2026-07-20.md) — independent citation-integrity, method, and coverage audit that motivated the migration.

## Research questions

1. What belongs to an agent harness, and where are its boundaries?
2. Which harness choices have controlled or at least same-model empirical support?
3. What failure modes recur in long-horizon execution?
4. Which controls should be mechanical rather than entrusted to a prompt?
5. When do simple pipelines outperform open-ended agents?
6. How should harness quality be measured across success, cost, latency, safety, and reproducibility?

## Bottom line

The strongest conclusion is not that a particular agent architecture always wins. It is that observed agent performance is a property of the **model–harness–task–budget–evaluator combination**. Interface design, context selection, executable verification, and permissions can materially change outcomes while the model is held fixed; but added planning, reflection, tools, or agents also add cost and new failure surfaces. Good harness engineering is therefore controlled systems engineering: expose legible state and a small effective action space, externalize durable artifacts, verify with independent oracles, constrain side effects mechanically, instrument trajectories, pin harness releases, and compare against simple cost-matched baselines. For external effects, a timeout is an unknown outcome, retry safety must be end-to-end, transaction/rollback claims stop at participating resources, stale workers need resource-enforced fencing, and replay must be separated from reconciliation. ([HC002](claims/HC002.md), [HC008](claims/HC008.md), [HC010](claims/HC010.md), [HC014](claims/HC014.md), [HC019](claims/HC019.md), [HC023](claims/HC023.md), [HC025](claims/HC025.md), [HC026](claims/HC026.md), [HC027](claims/HC027.md), [HC029](claims/HC029.md), [HC031](claims/HC031.md)) [H01–H06; H13; H23; H28; H30; H32–H49]

## Update log

- 2026-07-20 — Initial review. Directly scraped primary paper pages and recent surveys; separated reported results from engineering synthesis; added reusable source-note and evidence-table structure.
- 2026-07-20 — Expanded with coding-context, reliability/security, memory/orchestration, Harness-Bench, Meta-Harness, and longitudinal scaffolding-evolution evidence; added release-regression and harness-optimization guidance.
- 2026-07-20 — Independent subagent audit corrected version/result mismatches, overbroad claims, publication metadata, and a dead primary-paper link; documented remaining method and coverage gaps.
- 2026-07-20 — Completed the topic-local structural migration: added retrospective/prospective methods and append-only search logging; assigned HC001–HC024 and HE001–HE030; normalized confidence dimensions; backfilled source-note structure and bibliography links; and linked major synthesis conclusions to stable claims.
- 2026-07-20 — Reconciled all HC/HE records and the evidence table to the canonical root confidence schema. Historical `H/M/L/U/NA` dimensions were deterministically mapped (`H→3`, `M→2`, `L→1`, `U/NA→0`) and then lowered where record caveats required; publication maturity was re-derived per artifact rather than scored.
- 2026-07-20 — Completed canonical identity/metadata migration for all 34 H source notes and 30 HE observations: source headers now use the modern 17-field schema and exact registry W/alias sets, every HE field names its matching W/H pair, and unavailable provenance/lifecycle details remain explicit unknowns rather than inferred values.
- 2026-07-20 — Added the distributed-state/transactions focused review: 17 primary/authoritative sources (H35–H51 / W057–W073), 11 claims (HC025–HC035), 25 evidence observations (HE031–HE055), a failure-injection matrix, direct-agent evidence from Atomix/RAC/Cordon, and an explicit bounded unproven section.
- 2026-08-20 — Web-search sweep for agent-harness research published 2026-07-15 through 2026-08-20 surfaced five new preprints on agent-controlled context management, diagnosis-conditioned recovery, repair-loop reliability, self-authored-verification gaming, and drift-aware verification memory. Added H52–H56 / W074–W078, claims HC036, HC037, HC038, HC039, and HC040, and evidence HE056–HE060. All five are abstract-only acquisitions (no full-text/table locator reviewed) and are capped at grade D under the confidence rubric; full-text review is scheduled by 2026-10-20.
