# Evaluating agent harnesses

## The object under test

Report a result as:

> model version × harness version × task split × inference budget × tool/permission profile × environment version × evaluator version

A bare model name or agent name is insufficient: results are model–harness–budget–environment outcomes. ([HC014](claims/HC014.md)) Report the exact harness release or commit: with one model fixed, 35 Qwen Code releases ranged from 23% to 39% resolve rate and showed a strong upward token-cost trend. ([HC023](claims/HC023.md)) [H01, Section 7; H06, Section 6; H34, Section 5.3]

## Minimum metric set

| Dimension      | Measures                                                                        |
| -------------- | ------------------------------------------------------------------------------- |
| Outcome        | task success, partial credit, pass@k/pass^k where appropriate                   |
| Reliability    | repeated-run variance, worst-case/stress success, recovery rate                 |
| Efficiency     | input/output tokens, tool calls, retries, API/compute cost                      |
| Latency        | wall time, model time, tool/environment time, timeouts                          |
| Process        | invalid actions, loops, context redundancy/drop, rollback, trace completeness   |
| Safety         | policy violations, harmful side effects, attack success, false-positive denials |
| Oversight      | intervention/approval rate and human time                                       |
| Generalization | held-out tasks, repositories, tools, environments, and distribution shifts      |

## Experimental design

1. **Fix the model and budget** when testing a harness component.
2. **Use a simple baseline:** direct call, fixed pipeline, retry, and model escalation where applicable.
3. **Ablate one component at a time** and retain full trajectory artifacts.
4. **Run repeated trials** and report uncertainty; stochastic systems need more than one rollout. Temperature zero does not remove this requirement: an identical rerun in [H22] flipped six of 70 task outcomes. ([HC018](claims/HC018.md))
5. **Pin the environment** with images/lockfiles, deterministic reset, seeds, and evaluator tests.
6. **Use hidden or rolling holdouts** aligned with the claimed generality.
7. **Audit the oracle** for false acceptance and false rejection.
8. **Publish costs and raw token counts** so economics can be recalculated. Joint quality-and-cost optimization has retained measured quality at lower variable cost in a bounded evaluation. ([HC007](claims/HC007.md)) [H06, Section 3.2]
9. **Test failures deliberately:** inject pre-send, post-effect/pre-response, duplicate, timeout, stale-version, lease-expiry, compensation, and restart cut points; restart from durable state and check independent external-state invariants. ([HC033](claims/HC033.md)) See the agent-specific matrix in [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md).
10. **Separate search, validation, and final test sets** when optimizing prompts or harness code; public-benchmark optimization is specialization, not untouched generalization. [H33, Sections 3 and 4.3]
11. **Regression-test releases longitudinally:** compare success, tokens, turns, tool calls, safety, and evaluator behavior against the pinned predecessor, with rollback thresholds. [H34, Sections 5 and 8.2]

## Why accuracy-only leaderboards mislead

[H06] reproduced HumanEval agents and found that simple baselines could match complex systems while costs differed by nearly two orders of magnitude. ([HC006](claims/HC006.md)) It also found seven of 17 surveyed agent benchmarks lacked any holdout or plan for one, and documented evaluator/subset inconsistencies. ([HC009](claims/HC009.md)) The correct presentation is a Pareto surface across utility, cost, latency, and risk—not one maximum score. [H06, Sections 2, 5, and 6]

This does not prove reflection or search is useless. It shows that extra calls, sampling, and access to checkable feedback are confounders. On harder interactive tasks those methods may help, but experiments must cost-match and ablate them.

Harness-Bench illustrates both the value and limit of configuration-level comparison. It fixed 106 tasks, external environments, budgets, timeouts, and evaluators while crossing six native harnesses with eight models. Aggregate harness scores ranged from 52.4 to 76.2. ([HC019](claims/HC019.md)) Because prompts, action formats, context policies, and recovery remained bundled within each native harness, this diagnoses whole configurations but does not estimate any component's causal effect. Its process score also partly depends on one fixed LLM judge. [H32, Sections 3.1–4.3]

## Process evaluation

ContextBench illustrates how to inspect a harness rather than only its patch:

- recall/precision/F1 at file, definition-block, and line levels;
- time/steps to reach relevant evidence;
- repeated retrieval of already-seen evidence;
- evidence found during exploration but dropped before the final decision.

Its gold contexts are compact and verified, not globally minimal, and its instrumentation can influence the agent. Those caveats should accompany metrics for over-retrieval and dropped evidence. ([HC004](claims/HC004.md)) [H05, Appendix D and Appendix H]

## Security evaluation

Security needs both benign utility and attack success. Test adaptive attacks, because defenses can overfit a static prompt. AgentDojo also demonstrates the need to inspect utility loss: a detector that blocks most attacks but rejects many benign tasks may not dominate a capability-restricted design. ([HC012](claims/HC012.md)) [H13, Sections 3.3–4.3]

## Suggested harness regression suite

Maintain small, deterministic tests for:

- observation truncation and provenance;
- tool-schema validation and unknown arguments;
- permission denial and approval scope;
- secret redaction and network egress;
- idempotency and duplicate action handling;
- timeout/retry policy by failure class;
- checkpoint/rollback correctness;
- context compaction fidelity;
- stale-memory invalidation;
- evaluator sanity, including known positive and negative cases;
- trace completeness and replay;
- behavioral release regressions in success, tokens, turns, and tool calls;
- search/validation/test leakage in automatically optimized harnesses.

The harness itself is software. It needs unit, integration, adversarial, and behavioral regression tests in addition to end-to-end agent benchmarks. Traditional functional checks can all pass while agent effectiveness or resource use regresses. ([HC024](claims/HC024.md)) [H34, Sections 5.4 and 8.2]
