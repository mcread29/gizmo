# RAG, context management, and memory for LLM agents

**Status:** evidence-backed working synthesis  
**Last updated:** 2026-07-20  
**Literature cutoff:** 2026-07-20

## Scope

This topic studies retrieval, working-context management, durable memory, and state as **agent-harness responsibilities around one or more fixed models**. It emphasizes controlled or same-model comparisons, task success as well as retrieval quality, token/call/latency/storage cost, repeated runs, holdouts, and failure evidence. Coding agents, tool/browser agents, persistent assistants, and multi-agent systems receive extra attention.

Excluded are weight-only memorization, generic RAG surveys, vendor claims without inspectable experiments, and cross-benchmark leaderboard comparisons presented as causal evidence. A paper's architecture is not treated as proof that every named component works. Results are reported only for their model–harness–task–budget–evaluator setting.

## Reading map

1. [`methods.md`](methods.md) and append-only [`search-log.md`](search-log.md) — scope, retrospective search limits, screening/acquisition, extraction, second review, adjudication, absence claims, confidence, versions/retractions, and updates.
2. [`synthesis.md`](synthesis.md) — operational definitions, MC/ME-linked conclusions, three-layer design, defaults, and research agenda.
3. [`claims/`](claims/) — 44 stable `MC###` claim records with canonical type, polarity, status, confidence vectors/grades, evidence maps, and synthesis locations.
4. [`evidence/`](evidence/) and [`evidence-table.md`](evidence-table.md) — 54 exact `ME###` observations and the canonical row-level map, including qualifying, null, harmful, and threat evidence.
5. [`strategy-matrix.md`](strategy-matrix.md) — explicit verdict for all 19 requested strategies and its claim traceability map.
6. [`context-construction.md`](context-construction.md) and [`working-context-and-compaction.md`](working-context-and-compaction.md) — retrieval, timing, windows, masking, summaries, handles, and reader budgets.
7. [`long-term-memory.md`](long-term-memory.md), [`workflows-and-skills.md`](workflows-and-skills.md), and [`structured-state-and-updates.md`](structured-state-and-updates.md) — durable memory, reusable experience, event records, typed state, provenance, and lifecycle.
8. [`multi-agent-memory.md`](multi-agent-memory.md) and [`security-privacy.md`](security-privacy.md) — ownership/handoffs, compute-matched boundaries, poisoning, isolation, retention, and deletion.
9. [`evaluation.md`](evaluation.md) — evaluation protocol, confidence dimensions, and complete claim traceability map.
10. [`bibliography.md`](bibliography.md) and [`source-notes/`](source-notes/) — work metadata, reviewed versions/extent/use status, exact MC/ME backlinks, and numerical locators.
11. [`../REVIEW-2026-07-20.md`](../REVIEW-2026-07-20.md) — independent citation-integrity, method, and coverage audit.

## Research questions

1. Which retrieval, compaction, and memory strategies improve final agent performance with the model and budget held fixed?
2. When do added memories distract the reader, preserve stale state, or amplify a bad trajectory?
3. Which information should remain raw and authoritative, and which may safely become a derived summary, fact, episode, workflow, or skill?
4. How should writes, updates, conflicts, expiry, promotion, rollback, access control, and deletion be enforced?
5. How do reader capacity, task stage, store size, retrieval budget, and model/harness choice change the answer?
6. Which reported gains survive repeated runs, held-out transfer, and matching tokens, calls, latency, and evaluator?

## Bottom line

The best-supported default is **not one universal memory representation**. Preserve raw, attributable events; keep current operational state in typed external records updated by deterministic operations; and build provenance-linked derived views for retrieval. Retrieve selectively, preserve raw handles, size the context for the reader, and promote experience only after objective validation. Multi-key retrieval, time-aware query expansion, observation masking, validated success/workflow retrieval, and state-explicit evidence each help in bounded settings. Summaries-only stores, always-retrieve policies, random or unvalidated experience, reflections promoted as truth, and flat uncurated skill libraries have direct negative evidence. Long nominal context is not reliable memory. Canonical claims: [MC001](claims/MC001.md), [MC005](claims/MC005.md), [MC006](claims/MC006.md), [MC008](claims/MC008.md), [MC016](claims/MC016.md), [MC017](claims/MC017.md), [MC018](claims/MC018.md), [MC020](claims/MC020.md), [MC021](claims/MC021.md), [MC022](claims/MC022.md), [MC024](claims/MC024.md), [MC026](claims/MC026.md), [MC028](claims/MC028.md), [MC031](claims/MC031.md), [MC032](claims/MC032.md), and [MC034](claims/MC034.md); exact ME/source links are in those records and [`synthesis.md`](synthesis.md).

The evidence is still weaker than the design rhetoric: many memory papers are preprints, compare bundled systems to weak no-memory baselines, use one run or model-based judges, omit write/update accuracy and storage cost, and are not compute matched. [`synthesis.md`](synthesis.md) separates those results from engineering synthesis.

## Update log

- 2026-07-20 — Initial source-first review through the current-date cutoff; added source notes, explicit 19-strategy verdicts, negative/null findings, three-layer reference design, and mechanical citation/link checks.
- 2026-07-20 — Independent subagent audit corrected bundled-versus-isolated effects, baseline mismatches, locators, version metadata, and overextended shared-memory claims; added counterevidence where full context wins.
- 2026-07-20 — Completed topic-local structural migration: added methods and an explicitly retrospective append-only search log; assigned MC001–MC044; added ME001–ME054 records; separated type, polarity, and nine confidence dimensions; backlinked source notes/bibliography/synthesis; and ran mechanical completeness checks.
- 2026-07-20 — Reconciled all MC/ME records, evidence table, and strategy confidence cells to the canonical root schema. Historical `P/D/I/U/B/E/X/R/A` profiles mapped as `D→D`, `I→V`, `U→U`, `B→C`, `E→E`, `X→X`, replication `R→P`, and artifacts `A→R`; old publication `P` mapped `0→M0`, `1→M2`, `2→M3`, `3→M4` and was checked against each source record.
- 2026-07-20 — Completed canonical identity/metadata migration for all 34 M source notes and 54 ME observations: source headers now use the modern 17-field schema and exact registry W/alias sets, every ME field names registry-matched W/M pairs (including ME054's explicit 34-source corpus frame), and unavailable provenance/lifecycle details remain explicit unknowns rather than inferred values.
