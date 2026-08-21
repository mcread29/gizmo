# Review methods

**Protocol version:** H-METHODS-1.0  
**Protocol adopted:** 2026-07-20  
**Literature cutoff:** 2026-07-20  
**Reviewers:** initial multi-thread research review; structural migration and retrospective protocol documentation completed by the coding agent on 2026-07-20. Individual extractor names were not retained unless a source note says otherwise.

## Review question and scope

This review asks which runtime, interface, context, control, state, verification, security, orchestration, and evaluation choices are supported for foundation-model agent harnesses, under what model/task/budget/environment conditions, and with what limitations. The 2026-07-20 focused update explicitly includes mature distributed-systems, transaction-processing, RPC, lease/fencing, concurrency-control, recovery, and failure-injection sources when they supply premises for side-effecting agent tools; those premises are kept separate from direct LLM-agent experiments.

- **Population:** tool-using or stateful foundation-model agents, with emphasis on coding agents and machine-checkable interactive environments.
- **Interventions:** harness interfaces, context/retrieval policies, controllers, tools and permissions, persistent state, orchestration, verification, security controls, and harness evaluation/change processes.
- **Comparators:** fixed or simpler pipelines, alternative harnesses or releases, no-retrieval/full-context conditions, cost/budget-matched agents, undefended systems, and other controls reported by the primary work.
- **Outcomes:** success, reliability, retrieval/process quality, cost/tokens/latency, security and benign utility, evaluator adequacy, and reproducibility.
- **Included documents:** primary experiments, benchmark/system papers, directly relevant surveys, and proceedings/publication records needed to verify identity or maturity. Peer-reviewed work and preprints are both eligible, but maturity is recorded separately.
- **Excluded as direct empirical evidence:** unsourced claims, marketing pages, leaderboard values lacking a pinned configuration, secondary numerical reports when primary text was available, and papers whose intervention is outside the runtime-harness boundary. Non-English work was not intentionally excluded, but no reproducible language-wide search was retained.
- **Date coverage:** no lower date bound was retained. The effective corpus is concentrated in 2023–2026 and was frozen at the cutoff.

## Status of the initial search

The initial discovery and screening occurred before this protocol and search log were created. It is therefore **retrospectively documented** in [`search-log.md`](search-log.md). Exact original queries, result counts, screening counts, and some discovery paths were not retained and are marked `not retained`; they must not be reconstructed from memory or inferred from the included papers. Consequently, this is a structured evidence review, not a claim of exhaustive systematic coverage.

## Search and discovery procedure

All searches from protocol adoption onward must be appended to [`search-log.md`](search-log.md); prior rows are immutable. Each entry records a query ID, date, database/index, exact query, filters, returned count, screening disposition, and notes. Searches include, as separate rows:

1. database/index queries;
2. backward citation chaining from an included work;
3. forward citation searches;
4. author/project/proceedings-page checks;
5. benchmark or repository checks used only for discovery or version verification.

A survey may discover a primary work but does not substitute for that primary work when a quantitative claim is extracted. Duplicates are merged by work identity (DOI, versioned arXiv ID, OpenReview ID, RFC/standard number, ISBN plus title/authors, or title/authors when no stable identifier is available); topic-local H IDs remain aliases.

For the distributed-state update, exact queries and primary-record checks are H-20260720-001 through H-20260720-025. Eight broad SearXNG queries returned zero because every configured upstream engine was unavailable/rate-limited/challenged; those rows are recorded as failed searches and provide no absence evidence. Targeted DOI, arXiv, RFC, publisher, proceedings, and institution records then verified included source identities. [HC035](claims/HC035.md) is bounded to the included corpus and remains unsupported under the root absence-claim rules.

## Inclusion, exclusion, and screening

### Inclusion criteria

Include a work when it directly defines the harness boundary, evaluates a relevant harness intervention/configuration, characterizes a harness failure mode, or provides a benchmark/evaluation method needed for a major conclusion. It must have enough identity metadata to distinguish the work and enough acquisition detail to bound how it is used.

### Exclusion or restricted-use criteria

- Exclude an item from direct quantitative support when only metadata, an abstract, or an unlocated secondary quotation was acquired.
- Retain it as `background` or `discovery only` if it provides terminology, architecture context, or a path to primary evidence.
- Treat cross-system leaderboard comparisons as observational unless model, budget, environment, and evaluator are controlled.
- Do not generalize completion results to interactive issue repair, synthetic attacks to universal security, or one bundled system result to an isolated component effect.
- Keep superseded versions for audit history but do not silently combine their values with a later publication.

### Screening procedure

One reviewer screens title/abstract or available metadata, then full text where feasible. The decision and reason are recorded in the source note or future search-log disposition. Because original screening counts and exclusion reasons were not retained, no retrospective PRISMA-style counts are asserted. Future updates must record counts prospectively.

## Acquisition procedure

1. Prefer a versioned primary HTML/PDF or archival proceedings copy.
2. Record exact version only when the reviewed artifact or retained metadata proves it; otherwise write `not retained/unverified`.
3. Record acquisition extent (`full HTML`, PDF pages/tables, abstract, or metadata only), access date, and tool when retained.
4. Record an artifact URI and SHA-256 only if actually retained and computed; otherwise mark both unknown/not retained.
5. Quantitative evidence requires a section/page/table/figure/row locator. If a locator cannot be verified, the observation is `pending`, `secondary corroboration`, or excluded from direct support.
6. Preserve corrected values and keep version-specific results separate.

## Extraction and evidence records

Each evidence-table row has a stable `HC###` claim record. Each primary work/observation is represented, where practical, by a separate `HE###` evidence record. Records separate:

- one canonical claim type (`descriptive`, `comparative`, `causal`, `mechanistic`, `predictive`, `normative`, `existence`, `absence`, or `synthesis`);
- canonical relationship polarity (`supports`, `against`, `null`, `qualifies`, `mixed`, or `not-applicable`);
- extraction status;
- intervention/comparator and controlled/confounded dimensions;
- metric, denominator, repeated runs and uncertainty;
- evaluator, holdout, validity, maturity, replication, reproducibility, and independence;
- what the result supports and explicitly does not support.

Unknown fields are stated as `unknown/not retained`, not guessed. Source notes link back to exact HC/HE records, and claim records link to synthesis locations.

## Second review and adjudication

- **Mandatory second review:** headline numerical claims, disputed extractions, values copied between versions, and any conclusion that would materially change if the number or locator were wrong.
- **Second-review steps:** independently open the pinned artifact; verify identity/version, locator, numerator/denominator/units, comparator, budget, and caveats; then initial/date the evidence record. A reviewer must not merely compare copied prose.
- **Current migration status:** unless a source/evidence record explicitly names a second reviewer, second review is `unknown/not retained` and must not be implied.
- **Disagreement:** mark the evidence `disputed`, preserve both readings and their locators, and keep it out of unqualified synthesis. An adjudicator rechecks the artifact and, if needed, publication supplements/authors' correction. The resolution, rationale, date, and superseded value remain in the record's history.

## Absence-claim procedure

An absence claim is permitted only when its searched universe is defined by databases/indexes, exact queries, dates, filters, and citation-chain rules. The claim record must state the universe and cutoff and use bounded wording such as “no eligible study was identified in this search,” never “no study exists.” If exact searches or result counts were not retained, the statement is labeled a review gap or informal observation, not evidence of absence. Every update reruns the defined search and checks newly citing work.

## Confidence rubric

The sole authority is the root [`confidence-rubric.md`](../confidence-rubric.md). This topic does not define a local grading grammar. Every migrated observation records one canonical claim type, relationship polarity, claim status, artifact-level maturity `M0–M5`, a `D/V/U/C/E/X/P/R` vector with values `0–3`, the deterministic observation grade, low-score reasons, and any cap. Claim records use the root claim-level procedure and list maturity separately for every linked evidence record.

For migration auditability only, the former harness dimensions mapped mechanically as `DR→D`, `IV→V`, `UR→U`, `CM→C`, `EO→E`, `EV→X`, `IR→P`, and `RP→R`; former `H/M/L/U/NA` values became `3/2/1/0/0`. The old aggregate `PM` field was not carried into the vector: maturity was re-derived from each source record (`preprint/report→M2`, `verified archival peer review→M4`, and no `M5` without a verified correction/supersession-history check). After conversion, actual extraction, comparator, evaluator, scope, replication, and artifact caveats were checked; scores and grades could only stay fixed or decrease. HE004 was lowered because only secondary corroboration and no exact table, controls, uncertainty, or matched budget were retained.

Historical `empirical` records were frozen and classified by their actual statement as `comparative`, `descriptive`, or `existence`; `synthesis` and `absence` remained direct mappings. Historical `support/qualify` became `supports/qualifies`. HE029 is `supports` because its rising-token observation supports HC023's bounded claim; its former `against` label was relative to the opposite premise (“monotonic efficiency improvement”), not to HC023. Claim type, polarity, maturity, score, grade, and status remain independent.

## Version, correction, and retraction procedure

At acquisition and every scheduled update, check the canonical arXiv/DOI/OpenReview/proceedings record for newer versions, publication status, errata, expressions of concern, withdrawal, or retraction. Compare the exact sections/tables used rather than assuming unchanged content. Never replace an old value silently: create or update evidence history, mark supersession, and revise every affected HC/synthesis/source-note link. If status cannot be verified, write `not verified as of YYYY-MM-DD`.

## Update process

- **Cadence:** quarterly for active 2026 preprints; at least annually for the full topic; immediate review after a reported correction/retraction or material benchmark/evaluator change.
- **Stale threshold:** 90 days for active preprints and mutable benchmarks; 365 days for peer-reviewed static works unless a correction is reported.
- **Next planned broad search:** 2026-10-20.
- **Change control:** append searches to `search-log.md`; append the topic update log; preserve claim/evidence IDs; document changed wording or values in claim/evidence history.
- **Adjudication trigger:** contradictory values, version drift, missing locator, source withdrawal, evaluator defects, or a new controlled result that materially qualifies a major claim.
