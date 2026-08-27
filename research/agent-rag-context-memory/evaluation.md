# Evaluation

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC001](claims/MC001.md) ← [ME001](evidence/ME001.md); [MC002](claims/MC002.md) ← [ME002](evidence/ME002.md); [MC003](claims/MC003.md) ← [ME003](evidence/ME003.md); [MC004](claims/MC004.md) ← [ME004](evidence/ME004.md).
- [MC005](claims/MC005.md) ← [ME005](evidence/ME005.md); [MC006](claims/MC006.md) ← [ME006](evidence/ME006.md), [ME007](evidence/ME007.md), [ME008](evidence/ME008.md); [MC007](claims/MC007.md) ← [ME009](evidence/ME009.md); [MC008](claims/MC008.md) ← [ME010](evidence/ME010.md), [ME011](evidence/ME011.md).
- [MC009](claims/MC009.md) ← [ME012](evidence/ME012.md); [MC010](claims/MC010.md) ← [ME013](evidence/ME013.md), [ME014](evidence/ME014.md); [MC011](claims/MC011.md) ← [ME015](evidence/ME015.md), [ME016](evidence/ME016.md); [MC012](claims/MC012.md) ← [ME017](evidence/ME017.md).
- [MC013](claims/MC013.md) ← [ME018](evidence/ME018.md); [MC014](claims/MC014.md) ← [ME019](evidence/ME019.md); [MC015](claims/MC015.md) ← [ME020](evidence/ME020.md); [MC016](claims/MC016.md) ← [ME021](evidence/ME021.md).
- [MC017](claims/MC017.md) ← [ME022](evidence/ME022.md); [MC018](claims/MC018.md) ← [ME023](evidence/ME023.md); [MC019](claims/MC019.md) ← [ME024](evidence/ME024.md); [MC020](claims/MC020.md) ← [ME025](evidence/ME025.md), [ME026](evidence/ME026.md).
- [MC021](claims/MC021.md) ← [ME027](evidence/ME027.md); [MC022](claims/MC022.md) ← [ME028](evidence/ME028.md), [ME029](evidence/ME029.md); [MC023](claims/MC023.md) ← [ME030](evidence/ME030.md); [MC024](claims/MC024.md) ← [ME031](evidence/ME031.md).
- [MC025](claims/MC025.md) ← [ME032](evidence/ME032.md); [MC026](claims/MC026.md) ← [ME033](evidence/ME033.md); [MC027](claims/MC027.md) ← [ME034](evidence/ME034.md); [MC028](claims/MC028.md) ← [ME035](evidence/ME035.md).
- [MC029](claims/MC029.md) ← [ME036](evidence/ME036.md); [MC030](claims/MC030.md) ← [ME037](evidence/ME037.md); [MC031](claims/MC031.md) ← [ME038](evidence/ME038.md); [MC032](claims/MC032.md) ← [ME039](evidence/ME039.md), [ME040](evidence/ME040.md).
- [MC033](claims/MC033.md) ← [ME041](evidence/ME041.md); [MC034](claims/MC034.md) ← [ME042](evidence/ME042.md); [MC035](claims/MC035.md) ← [ME043](evidence/ME043.md); [MC036](claims/MC036.md) ← [ME044](evidence/ME044.md).
- [MC037](claims/MC037.md) ← [ME045](evidence/ME045.md); [MC038](claims/MC038.md) ← [ME046](evidence/ME046.md); [MC039](claims/MC039.md) ← [ME047](evidence/ME047.md); [MC040](claims/MC040.md) ← [ME048](evidence/ME048.md).
- [MC041](claims/MC041.md) ← [ME049](evidence/ME049.md); [MC042](claims/MC042.md) ← [ME050](evidence/ME050.md), [ME051](evidence/ME051.md); [MC043](claims/MC043.md) ← [ME052](evidence/ME052.md), [ME053](evidence/ME053.md); [MC044](claims/MC044.md) ← [ME054](evidence/ME054.md).

## Unit of evaluation

Report results for the complete tuple:

```text
model(s) × harness/version × memory policy/store × task split
× tool/environment version × budget × evaluator × run protocol
```

Do not call a memory strategy effective because a bundled new system beats no memory. Prefer component ablations, oracle context, longer-context and retry baselines, and equal tokens/calls/latency.

## Required baselines

At minimum:

1. no durable memory + tuned recent window;
2. raw history within the same context cap;
3. observation masking/tool-output pruning;
4. summary + recent tail;
5. simple vector/BM25/hybrid retrieval over raw events;
6. raw + derived keys/views;
7. longer-context model or full-context reference where feasible;
8. simple retry at the same total call/token budget;
9. oracle evidence/context upper reference;
10. target component removed while everything else is fixed.

For workflows/skills, add random retrieval, nearest-neighbor retrieval, no-skill, and invalid/unverified experience controls. ExpeL's random-retrieval regression and Assay's uncurated-library regression show why these are necessary. [M11, Table 3; M18, Table 1]

## Metric families

### Outcome

- exact final environment/task success;
- partial progress and subgoals;
- policy/constraint compliance;
- unauthorized/irreversible side effects;
- recovery and rollback success;
- repeated-run `pass^k` or worst-run reliability.

τ-bench's GPT-4o function-calling scores were 61.2% retail and 35.2% airline, while retail `pass^8` fell below 25%. [M26, Table 2; `pass^k` figure] One pass@1 hides operational unreliability.

### Retrieval and packing

- Recall@k, precision@k, F1, NDCG/MRR;
- evidence-role/source coverage;
- duplicate and stale/conflicting item rate;
- current/historical/transition state-view accuracy;
- ACL/trust filter correctness;
- retrieved/included token count and ordering;
- retrieval abstention and re-retrieval rate.

### Evidence use

Track a chain:

```text
available → observed/indexed → retrieved → packed → cited/referenced
→ used in action → verified causal support
```

ContextBench operationalizes explored versus used context and reports usage drop up to 0.435. [M03, Table 5] Retrieval success alone is not agent success.

### Memory writes and updates

- write precision/recall against source-grounded labels;
- hallucinated/unsupported write rate;
- duplicate/merge correctness;
- update/supersession/state-role correctness;
- stale-memory and contradiction leakage;
- provenance completeness;
- promotion precision for workflows/skills;
- expiry/deletion propagation and resurrection rate;
- cross-tenant access violations.

A-TMA's bank/evidence/answer decomposition is a useful model for assigning failures to write, retrieval, or reading. [M16, §§4–5]

### Cost

- model calls by role/model;
- total input/output/reasoning/cache-hit/miss tokens;
- retrieval/reranking/index-build/update calls;
- wall-clock and critical-path latency, p50/p95;
- dated dollar pricing and self-hosted compute/GPU-hours;
- raw/derived/index storage bytes and growth;
- successful-task cost and energy where available.

M07 shows why tokens per final prompt are insufficient: summarization calls and longer trajectories change total cost. [M07, §§4.4, 5.2]

## Experimental design

### Hold the reader and harness fixed

For a memory component claim, use the same acting model, prompt/tool interface, permissions, evaluator, and maximum steps. If a stronger model builds memory, report it as a hybrid system and include its calls/cost, as ContextWeaver does. [M17, §4.2]

### Match more than nominal context

Run separate ceilings:

- equal total model input+output tokens;
- equal number of model and tool calls;
- equal wall-clock latency or critical path;
- equal dollars;
- equal maximum action steps.

One experiment rarely matches all. Report which is matched and which is not. Equal-token multi-agent work still excludes prompt/final tokens, so its claim must remain narrow. [M20]

### Repeated runs and uncertainty

Use paired tasks and multiple seeds/runs. Report mean, distribution, confidence interval, and per-task paired outcomes. ContextWeaver's five runs over 100 tasks (68.0±1.55 vs 67.2±1.94) is more informative than a single close pass@1. [M17, Table 2] M07's paired bootstrap estimates uncertainty over 500 instances but is not a substitute for stochastic reruns. [M07, Table 4]

### Holdouts

Separate:

- memory induction/training tasks;
- hyperparameter/development tasks;
- promotion tests;
- final private test tasks;
- future temporal test after store growth.

Hold out repositories, websites/templates, users, domains, and models when claiming those transfers. AWM's cross-template subset is stronger than its ordinary online stream but still not a private future set. [M12, Table 2] Assay has disjoint train/dev/test, yet uses only 15 development tasks/model and must be re-estimated per model. [M18, §3.1]

### Store-growth and update tests

Evaluate at realistic store sizes and conflict rates. Inject:

- exact and semantic duplicates;
- many similar skills/episodes;
- old/current/transition facts;
- identity collisions;
- repository/API version changes;
- poison and cross-tenant near-neighbors;
- deletion and expiry events.

Measure build/update latency and storage, not only read-time tokens.

## Evaluators

Prefer deterministic environment state, executable tests, exact database checks, policy checkers, and human review for ambiguous cases. AgentDojo's utility/attack functions and coding tests are stronger than free-form self-grading. [M22]

When using an LLM judge:

- identify exact model/version/prompt/temperature;
- blind method identity;
- report human agreement by category;
- run judge sensitivity or multiple judges;
- release outputs and criteria;
- do not use the same model to generate, promote, and evaluate memory without an independent check.

LongMemEval reports >97% aggregate human agreement for its GPT-4o judge, with some category-level results at 90% or higher. [M01, §3.3; Appendix A.4] A-TMA's human audit found 80% three-way agreement and κ=0.699 overall, with only 72% on LoCoMo. [M16, Appendix A.5] Judge quality is task dependent.

## Security and privacy evaluation

Measure both attack success and benign utility. Use adaptive attacks against the deployed policy, not only static known strings. Test query-only poisoning, corpus poisoning, indirect injection, taint laundering through summaries, skill code, shared-memory propagation, tenant isolation, secret extraction, and deletion.

The EHR defense that rejected every candidate illustrates why “0 poison accepted” without a useful benign store is not sufficient. [M24, §8.1]

## Evidence-quality rubric used in this review

Confidence follows the canonical [`../confidence-rubric.md`](../confidence-rubric.md). Every MC/ME record keeps claim type, relationship polarity, claim status, artifact maturity `M0–M5`, deterministic grade, and the `D/V/U/C/E/X/P/R` vector separate.

Claim type, polarity, and status are separate. `Synthesis` or `recommendation` is a type; `negative`, `null`, `threat`, and `qualifying` are polarities; `unsupported` is a claim status. None is used as a confidence score. Readers should inspect the dimension that matters to the decision rather than averaging the profile.

## Minimum result record

For every numerical claim record:

```yaml
strategy:
task_benchmark_split_n:
model_and_exact_version:
harness_and_tools:
baseline:
run_count_and_sampling:
metric_result_uncertainty:
budget_tokens_calls_steps_latency:
dollar_and_storage_cost:
compute_matched_what:
holdout_dimensions:
evaluator_and_agreement:
publication_status_and_version:
locator_table_figure_section_page:
failures_nulls:
supports:
does_not_support:
```

The [`strategy-matrix.md`](strategy-matrix.md) audit cards apply this template compactly to all 19 requested strategies.

## Release regression

Pin every component and run paired old/new releases on a private suite. Block release when success or reliability regresses beyond threshold, stale/contradiction/poison leakage rises, deletion fails, or cost exceeds budget. Keep trajectories and event/state diffs for diagnosis. Test rollback of derived memories and indexes separately from model rollback.
