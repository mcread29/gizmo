# Review methods

**Protocol version:** 1.0 (structural migration, 2026-07-20)  
**Reviewers:** initial extraction by the research threads; independent audit described in `../REVIEW-2026-07-20.md`; named individual extractors and second reviewers were not retained  
**Review period / literature cutoff:** initial search dates were not retained; literature and access cutoff 2026-07-20

## Review question and scope

The review asks which retrieval, context-management, durable-memory, structured-state, workflow/skill, and shared-memory strategies improve LLM-agent outcomes, at what cost, and under which failure, security, privacy, and evaluator conditions. The population is model-plus-harness systems used for coding, browser/tool interaction, persistent assistance, long-context QA used as an agent-memory proxy, embodied agents, and multi-agent reasoning. Comparators include raw/full context, windows or observation masking, no retrieval, one-shot retrieval, alternative indexes, no memory, fixed policies, retries, and unmodified skill/workflow stores. Outcomes include task success, retrieval and evidence use, write/update quality, repeatability, token/call/latency/storage cost, and attack/defense behavior.

### Inclusion

Include primary experimental papers and benchmarks when they provide an inspectable method and at least one result relevant to harness-managed context, retrieval, memory, state, workflows/skills, multi-agent information sharing, or associated security/evaluation. Peer-reviewed and preprint works are eligible, but publication maturity is recorded separately. Static QA or completion studies are eligible only as bounded proxy evidence, with that external-validity limit preserved. Surveys and later papers may discover or corroborate a work but do not substitute for the primary source for a numerical claim.

### Exclusion

Exclude weight-only memorization; generic RAG surveys without directly used primary observations; vendor assertions without inspectable experiments; architecture descriptions treated as component-effect evidence; cross-benchmark leaderboards presented as causal comparisons; inaccessible numerical claims without an exact primary locator; and works outside the English-language universe actually reviewed. No complete language/date exclusion log survives from the initial search, so these criteria govern maintenance and should not be projected backward as exact original screening rules.

## Search provenance

The initial search is **retrospectively documented** in [`search-log.md`](search-log.md). Exact original search strings, dates, result counts, screening counts, and exclusion counts were not retained and are therefore marked `unknown—not retained`; they must not be reconstructed from memory or fabricated. The surviving corpus and source notes establish the included set, not a reproducible denominator.

Future searches must append one row per database/index/query, preserving the exact query, date, filters, result count, and operator. Backward and forward citation chaining, author-page searches, benchmark leaderboards, venue searches, and discovery through surveys must receive separate query IDs. Duplicate versions of one work are merged under one topic source ID; a materially changed version is re-reviewed and recorded rather than silently replacing the extraction.

## Screening and acquisition

For the retrospective search, stage counts are unknown. For future updates:

1. Deduplicate by DOI, versioned arXiv ID, OpenReview/forum ID, title/authors, and published-versus-preprint identity.
2. Screen title/abstract against scope; record one exclusion reason per excluded record.
3. Review full text for method relevance, comparator adequacy, and extractable locators.
4. Classify each work as `core evidence`, `background`, `discovery only`, `superseded`, or `excluded`.
5. Acquire the canonical proceedings/publisher artifact where possible; otherwise pin a versioned preprint. Record access date, tool/method, extent actually reviewed, and local artifact/hash only if actually retained or computed. Unknown hashes, page ranges, model snapshots, commits, or versions remain explicitly unknown.
6. Numerical evidence requires direct inspection of the primary table/figure/section. Abstract-only and metadata-only acquisition may support identity or background, not a direct quantitative observation.

## Extraction and claim model

Every evidence-table row has one stable `MC###` claim record. Claim type, claim polarity, status, and confidence are separate fields. Every primary observation has an `ME###` evidence record with its source ID, exact reviewed version, locator, canonical relationship polarity (`supports`, `qualifies`, `against`, `null`, `mixed`, or `not-applicable`), intervention/comparator, result, known confounders, caveats, and explicit unknown fields. Positive, harmful, null, and qualifying observations are not collapsed. Source notes link to exact MC/ME IDs, and claim records link back to every synthesis location that materially relies on the claim.

A raw event or paper statement is evidence of what was observed or reported, not automatic ground truth. Bundled systems are described as bundled unless an isolated ablation exists. Values copied into narrative pages remain subordinate to the evidence record and must be changed together or replaced by a link.

## Second review and adjudication

Headline numerical claims, surprising null/harmful results, version-sensitive extractions, and disputed values require a second reviewer before their extraction status becomes `directly verified—second reviewed`. The second reviewer independently checks source identity/version, locator, row/cell interpretation, denominator, comparator, polarity, and whether the prose exceeds the experiment. The present migration does not invent reviewer identities or agreement: records remain `directly verified; second-review identity unknown/not retained` unless evidence of a second check survives.

Disagreements are recorded in the evidence record without overwriting either extraction. An adjudicator reopens the pinned artifact, records both candidate readings, selects `resolved`, `disputed`, or `pending`, explains the decision, and links any superseding ME ID. If the primary rendering is unavailable or inconsistent, the result stays disputed and is not used as headline quantitative support.

## Absence-claim procedure

An absence claim must define its searched universe: databases/indexes, exact queries, dates, filters, citation-chain rules, included versions, and screening outcomes. It is phrased as “no eligible study was found in that universe,” never as proof of impossibility. If any universe element is unknown, the claim is `unsupported` or at most narrowly qualifying and the unknown is stated. MC044 is intentionally bounded to the 34 included source records and the non-reproducible retrospective search; it does not claim that no such study exists globally. A future reproducible search may support, narrow, or supersede it.

## Version, correction, and retraction procedure

At extraction and every update, check the canonical venue/publisher record, versioned preprint history, DOI/OpenReview status, and any correction, expression-of-concern, withdrawal, or retraction notice. Record the exact artifact reviewed; never infer an arXiv version from an unversioned URL. Compare new versions at the cited locator and methods, not only title/abstract. If a result changes, preserve the old ME record, create a superseding ME record, update affected MC status/confidence, and append an update-log entry. Unknown correction/retraction status is explicit; silence is not treated as a guarantee.

## Confidence rubric

The sole authority is the root [`confidence-rubric.md`](../confidence-rubric.md). This topic does not define a local profile or grading grammar. Every migrated observation records one canonical claim type, relationship polarity, claim status, artifact-level maturity `M0–M5`, a `D/V/U/C/E/X/P/R` vector with values `0–3`, the deterministic observation grade, low-score reasons, and any cap. Claim records use the root claim-level procedure and list maturity separately for every linked evidence record.

For migration auditability only, the former memory profile mapped mechanically as old `D→D`, `I→V`, `U→U`, `B→C`, `E→E`, `X→X`, replication `R→P`, and artifacts `A→R`, retaining each `0–3` value. Former publication `P0/P1/P2/P3` mapped initially to `M0/M2/M3/M4`; each result was then checked against the source record, with no `M5` assigned because the retained notes do not establish the additional correction/supersession-history condition. Actual extraction, comparator, evaluator, scope, replication, artifact, and absence-search caveats were checked after conversion; scores and grades could only stay fixed or decrease. ME054 remains `M0`, grade D, qualifying evidence only, and MC044 remains unsupported because its original search universe and sensitivity are incomplete.

Historical `empirical` claims were frozen and classified by their actual statement as `comparative`, `descriptive`, or `existence`; `synthesis` and `absence` remained direct mappings. Historical semantic labels `positive`, `negative`, `threat`, and `absence` became `supports` only where the observation points in the frozen bounded claim's direction; `qualifying/qualify` became `qualifies`, while `mixed` and `null` remain canonical values. Claim type, polarity, maturity, score, grade, and status remain independent.

## Update process

- **Cadence:** quarterly for normal discovery; immediate for reported corrections/retractions or material version changes.
- **Stale threshold:** 12 months for mutable preprints, model/API-dependent cost claims, and security results; 24 months for stable archival background unless superseded sooner.
- **Next planned search:** 2026-10-20.
- **Update steps:** append searches; screen and acquire; check versions/retractions; extract ME records; second-review headline changes; adjudicate conflicts; update MC records, source-note links, bibliography backlinks, synthesis links, and README log; then run mechanical checks.
- **Change logs:** append-only [`search-log.md`](search-log.md), claim-record histories, and the topic README update log.
