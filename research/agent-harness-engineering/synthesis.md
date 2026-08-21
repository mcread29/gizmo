# Synthesis: what research says about agent harness engineering

## Executive synthesis

An agent harness is best understood as the runtime control plane that couples a model to an environment. It decides what the model can observe, what enters its active context, how the execution loop advances, which actions are legal, what state persists, and how results are verified or governed. Recent surveys differ in labels, but converge on these responsibilities. The six-part decomposition used here is **observation, context, control, action, state/artifacts, and verification/governance**. It is a useful engineering lens, not an established scientific law. ([HC001](claims/HC001.md)) [H01, Sections 2.2–2.4; H02, Sections 2–4]

The following are the five best-supported conclusions in the reviewed corpus:

1. **The unit of performance is a configured system, not a model.** Scores depend on the model, harness, task distribution, tool privileges, inference budget, environment, and evaluator. Harness-Bench found a 23.8-point aggregate spread across six complete harness configurations over the same 106-task/eight-model pool, while a fixed-model longitudinal study found 23–39% resolve rates across 35 releases of one coding scaffold. These are configuration-level and release-level effects, not causal attribution to individual components. ([HC014](claims/HC014.md), [HC019](claims/HC019.md), [HC023](claims/HC023.md)) [H32, Sections 4.1–4.3; H34, Section 5.3]
2. **Interfaces are capability multipliers.** Concise, well-scoped observation and action interfaces can improve a fixed model; broad or noisy interfaces can waste context and cause invalid actions. SWE-agent established this as “agent-computer interface” design, while ContextBench shows that sophisticated retrieval scaffolds do not automatically improve retrieval. ([HC002](claims/HC002.md), [HC003](claims/HC003.md)) [H03; H05, Table 2]
3. **Executable feedback is valuable but only as good as its oracle.** Tests, parsers, type checkers, state assertions, and policy checks close the loop and enable repair. Yet generated or incomplete tests can falsely accept or reject behavior. In Agentless, only 94 of 213 generated tests that reproduced an issue also recognized the developer patch as resolved. ([HC008](claims/HC008.md)) [H04, Sections 5.1.3 and 5.2.3]
4. **More agency—and newer scaffolding—is not monotonically better.** Fixed pipelines and simple retry/escalation baselines can match or beat elaborate planning/reflection systems at lower cost. Across 35 Qwen Code releases with one fixed model, resolve rate had no significant chronological trend (rho=0.208, p=0.231), while average tokens rose from about 391K for the first nine releases to about 668K for the latest releases. Complex control and added middleware require measured justification. ([HC005](claims/HC005.md), [HC006](claims/HC006.md), [HC023](claims/HC023.md), [HC024](claims/HC024.md)) [H04, Table 1; H06, Sections 2–3; H34, Section 5.3]
5. **Important constraints must be mechanical.** Prompt instructions alone cannot reliably separate trusted instructions from untrusted tool data. Tool filtering substantially reduced prompt-injection success in AgentDojo, whereas detector-based filtering sacrificed utility through false positives. Sandboxes, least privilege, typed arguments, approval gates, and deterministic checks belong in the runtime. ([HC010](claims/HC010.md), [HC011](claims/HC011.md), [HC012](claims/HC012.md)) [H13, Section 4.3 and Table 5]

## What counts as the harness?

A practical boundary is: if a component changes the model's effective observations, actions, trajectory, persistent state, or acceptance criteria at run time, it is part of the harness. This includes:

- environment adapters and observation rendering;
- prompt assembly, retrieval, compaction, and tool-result filtering;
- the run loop, stopping rules, retries, routing, planning, and delegation;
- tool schemas, dispatch, permissions, sandboxing, and side-effect controls;
- checkpoints, artifact stores, traces, plans, diffs, and memory;
- tests, validators, policy checks, approval gates, rollback, and escalation.

The model remains the probabilistic decision engine. Training the model to use tools or recover from errors changes the division of labor, but does not remove the need for environment access, state, verification, and governance. ([HC001](claims/HC001.md)) [H01, Sections 2.2–2.5 and 4.4]

## The main engineering tradeoffs

### Legibility versus volume

Raw state is faithful but expensive and distracting; summaries are tractable but lossy. ContextBench found block-level F1 below 0.45 and line-level F1 below 0.35 for all four evaluated frontier models, plus meaningful “usage drop”: agents often viewed gold-relevant code and did not preserve it for patch generation. The implication is not “retrieve more.” It is to keep authoritative artifacts outside the prompt, retrieve at a decision-relevant granularity, record provenance, and test whether consolidation preserves evidence. ([HC004](claims/HC004.md), [HC015](claims/HC015.md), [HC016](claims/HC016.md)) [H05, Tables 3 and 5]

### Flexibility versus controllability

A shell is expressive but hazardous and difficult to search; narrow APIs are safer but can block unanticipated strategies. A good action surface is layered: read-only inspection, reversible sandboxed mutation, then separately approved external side effects. The harness should validate structured arguments, annotate trust and provenance on outputs, and expose concise error feedback. ([HC010](claims/HC010.md), [HC011](claims/HC011.md), [HC012](claims/HC012.md)) [H02, Sections 3.3–3.4; H13, Section 4.3]

### Adaptability versus stability

Open-ended ReAct-style loops can respond to new evidence, but also loop, drift, and compound early errors. Fixed localization–repair–validate pipelines are reproducible but less able to recover when their initial stage misses the relevant region. Agentless's analysis shows both sides: its simple pipeline was competitive and cheap, while issues with no location clue favored agents with exploratory search tools. ([HC005](claims/HC005.md)) [H04, Sections 5.1 and 6.2]

Adaptation also applies to the harness itself. Meta-Harness improved held-out classification and math results by searching executable context policies with selective access to prior code and traces. But its TerminalBench search reused the public 89-task benchmark for final scoring, illustrating how public benchmarks can reward specialization rather than untouched generalization ([HC009](claims/HC009.md)); the longitudinal Qwen study shows that ordinary release evolution can raise cost without raising success. Harness changes therefore need search/validation/test separation, explicit Pareto objectives, and rollback—not a presumption of improvement. ([HC022](claims/HC022.md), [HC023](claims/HC023.md), [HC024](claims/HC024.md)) [H33, Sections 3–4; H34, Sections 5 and 9]

### Verification strength versus cost and false confidence

Independent execution provides stronger evidence than self-critique, but tests may be weak and repeated execution consumes time. The harness should use a ladder of checks: cheap structural validation first, focused tests next, broad regression and security checks later, and human review where no adequate oracle exists. An acceptance record should state what was checked and what remains unverified. ([HC008](claims/HC008.md)) [H02, Sections 3.4 and 5.2.2; H04, Sections 5.1.3 and 5.2.3]

### Specialization versus coordination overhead

Multiple agents can isolate context and provide independent review, but every handoff adds compression loss, latency, disagreement, and state synchronization problems. Multi-agent structure is justified only when roles need distinct context, permissions, models, or independent evidence. Shared artifacts and a single authoritative state are safer than long conversational handoffs. ([HC013](claims/HC013.md)) [H02, Sections 4.2–4.4]

## A research-aligned reference design

The following is a synthesis, not a result from one paper:

1. **Immutable run specification:** task, policy, model/version, harness version, budgets, environment image, and evaluator version.
2. **Observation adapter:** converts environment state into bounded typed observations; preserves a link to full raw artifacts.
3. **Context manager:** selects instructions, current task state, relevant artifacts, tool schemas, and prior evidence; compacts with provenance.
4. **Controller:** defaults to the shortest adequate loop; has explicit step/time/token/cost limits, termination semantics, and escalation paths.
5. **Action broker:** typed tools, argument validation, capability grants, trust labels, idempotency metadata, and side-effect classification.
6. **Isolation layer:** disposable workspace, restricted filesystem/network/process access, secret brokerage, resource quotas, and snapshots.
7. **State/artifact store:** authoritative plan, work queue, diffs, test results, decisions, checkpoints, and append-only trace; the chat transcript is not the source of truth.
8. **Verification ladder:** schema checks → static checks → focused executable tests → regression/security checks → independent review or human approval.
9. **Recovery manager:** bounded retries by failure class, rollback to known-good checkpoints, deduplication/loop detection, and fail-closed escalation.
10. **Telemetry and evaluation:** per-step observations/actions, costs, latency, policy decisions, artifact hashes, and outcome/process metrics.
11. **Harness change control:** pin every release; replay representative traces; gate on held-out success, safety, token/tool/latency budgets, and evaluator sanity; canary and roll back regressions. ([HC022](claims/HC022.md), [HC023](claims/HC023.md), [HC024](claims/HC024.md)) [H33–H34]

This design follows the recurring empirical lesson: make state and feedback legible, constrain the effective action space, and keep safety/correctness controls outside model discretion. ([HC001](claims/HC001.md), [HC008](claims/HC008.md), [HC010](claims/HC010.md), [HC011](claims/HC011.md), [HC020](claims/HC020.md)) [H01–H06; H13; H23–H34]

## External side effects are distributed transactions

The focused review [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md) adds mature distributed-systems evidence and three direct agent studies. A tool timeout is an ambiguous outcome, not proof of non-execution; a blind retry can convert omission risk into duplicate-effect risk. End-to-end retry safety requires stable logical identity and durable provider-side completion/deduplication state atomically coupled to the effect. ([HC025](claims/HC025.md), [HC026](claims/HC026.md)) [H36, H41, H43–H44]

Atomicity stops at participating resource boundaries. Transactional staging, reservations, and outboxes can move an effect behind a commit gate, but unrelated APIs are not enrolled by a harness-local transaction. Sagas offer visible semantic compensation rather than isolation-preserving rollback, and compensation can fail or be impossible. ([HC027](claims/HC027.md), [HC028](claims/HC028.md)) [H35, H39, H47–H48, H50–H51]

Concurrent workers need more than a coordinator lease. A stale holder can resume after expiry and issue a delayed write; every protected resource must atomically enforce a monotonic fencing epoch. CAS/strong preconditions prevent stale updates only at their own resource boundary and impose abort/retry under conflict. ([HC029](claims/HC029.md), [HC030](claims/HC030.md)) [H37, H40–H42]

Logs make controlled state recoverable, not the outside world replayable. Pure replay must suppress mutations and use recorded observations; resume must adjudicate in-flight effects; reconciliation compares durable intent with current provider state. Exactly-once claims must name the semantic effect and publish identity, durability, atomicity, ownership, failure, retention, and downstream-participation assumptions. ([HC031](claims/HC031.md), [HC032](claims/HC032.md)) [H38, H43, H45, H48]

FoundationDB and Atomix support deliberate cut-point failure injection and invariant checking as a stronger evaluation method than healthy-run task success alone. Atomix, RAC, and Cordon provide direct but bounded agent evidence for staging, compensation, and failure handling; partial commit, failed compensation, trusted adapters, and opaque effects remain. ([HC033](claims/HC033.md), [HC034](claims/HC034.md)) [H46, H49–H51]

## What is not established

- There is no universally accepted harness taxonomy or optimal agent loop. ([HC001](claims/HC001.md))
- Current results do not establish that multi-agent systems are generally superior to single agents; the migrated claim is narrower and concerns coordination state. ([HC013](claims/HC013.md))
- Reflection or planning is not reliably beneficial after controlling for extra calls and test-time compute; benefits are task dependent. ([HC006](claims/HC006.md), [HC017](claims/HC017.md)) [H06]
- Longer context is not equivalent to better context. ([HC003](claims/HC003.md), [HC004](claims/HC004.md), [HC015](claims/HC015.md), [HC016](claims/HC016.md)) [H05]
- Passing tests is not semantic correctness, safety, maintainability, or user acceptance. ([HC008](claims/HC008.md), [HC024](claims/HC024.md)) [H04; H02, Section 5.2.2]
- Prompt-injection defenses evaluated against fixed attacks are not security guarantees; adaptive attacks are required. ([HC010](claims/HC010.md), [HC011](claims/HC011.md), [HC012](claims/HC012.md)) [H13, Sections 3.3 and 5]
- Automated harness optimization has promising held-out results, but safe production self-modification, broad transfer, and resistance to benchmark overfitting are not established. ([HC021](claims/HC021.md), [HC022](claims/HC022.md)) [H33]
- The bounded 51-source harness corpus does not establish crash-safe exactly-once semantic effects across arbitrary independent tools or irreversible actions; the search is not exhaustive, so this is an unsupported gap statement rather than global absence. ([HC035](claims/HC035.md))
- 2026 “harness engineering” literature is dominated by preprints and fast-moving benchmarks. Conclusions should be versioned and rechecked.

## Research agenda

The most useful next studies would hold model and inference budget fixed while varying one harness component; report repeated trials, trajectory artifacts, cost, latency, and safety; test held-out tasks, repositories, tools, and environments; measure oracle false acceptance; and evaluate recovery under injected failures. Context retrieval needs process-level metrics; multi-agent systems need state-divergence and handoff-loss metrics; self-modifying harnesses need separate search/validation/test sets, safety and cost invariants, and rollback. Longitudinal work should replicate [H34] across additional models and harnesses. [H05; H06; H02, Section 5.2; H33–H34]
