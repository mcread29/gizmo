# Architecture and control patterns

## Runtime responsibilities

The most defensible architecture is responsibility-based rather than framework-based. Harness-Bench defines the harness as the layer that conditions model calls and turns outputs into actions in an external workspace, while keeping the environment and evaluator conceptually external. Its compact decomposition is `Agent = Model + Harness`. ([HC001](claims/HC001.md)) [H32, Section 3] [H01] names six coupled runtime responsibilities:

| Responsibility          | Core question                                    | Typical mechanisms                                               | Common failure                                   |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------ |
| Observation             | What environment state is visible, and how?      | terminal output, diffs, DOM/accessibility state, structured logs | stale, noisy, or missing evidence                |
| Context                 | What enters this model call?                     | retrieval, ordering, compaction, tool descriptions, task state   | lost provenance, distraction, summary distortion |
| Control                 | What happens next and when does it stop?         | ReAct, plan/execute, retries, routing, delegation                | drift, loops, premature completion               |
| Action                  | What can the model do?                           | typed function calls, shell/editor, browser, subagent calls      | invalid arguments, excessive authority           |
| State/artifacts         | What persists beyond the active window?          | plans, checkpoints, files, traces, memory records                | stale or conflicting state                       |
| Verification/governance | What is accepted, denied, retried, or escalated? | tests, assertions, policy, sandbox, approval, rollback           | weak oracle, unenforced policy                   |

These parts should not be optimized independently. Aggressive compression may undermine verification; expressive tools raise the governance burden; richer state increases retrieval and staleness risk. [H01, Section 5.7]

## Control patterns and when they fit

### Fixed staged pipeline

Examples: localize → generate candidates → validate; retrieve → draft → judge.

Use when the task structure is stable, the oracle is strong, and reproducibility/cost matter. Agentless is evidence that a fixed pipeline can outperform more autonomous systems in repository repair; it also shows the weakness: if localization misses the right file, later stages cannot recover. ([HC005](claims/HC005.md)) [H04, Sections 3 and 6.2]

### Observe–reason–act loop

The model selects the next action from current observations, as popularized by ReAct. [H09] Use when the environment is partially observed and the next useful step depends on fresh feedback. Add hard budgets, action validation, loop detection, and explicit completion checks; otherwise early mistakes compound.

### Plan–execute–verify

Externalize a plan and its acceptance criteria; execute reversible steps; run independent checks; revise or stop. Code-as-harness research treats this as a cybernetic control loop. The plan is useful only when it is an inspectable artifact, not a hidden reasoning trace. [H02, Section 3.4]

Planning evidence is task-specific. CodePlan passed repository validity checks on 5/7 dependency-heavy migration/temporal-edit repositories, while same-context baselines without dependency-aware planning passed 0/7. Those edits spanned 2–97 files; the study does not establish that elaborate planning helps routine bug repair. ([HC017](claims/HC017.md)) [H19, Tables 2–4]

### Search / candidate selection

Generate branches, execute or score them, and retain promising candidates. This can improve the chance of success where cheap oracles exist, but the extra inference budget is itself a performance lever. Compare against cost-matched retry and sampling baselines. [H04, Sections 5.2.2–5.2.3; H06, Section 2]

### Planner–worker–verifier or multi-agent orchestration

Use separate roles when they need distinct context, permissions, model economics, parallelism, or independent judgment. Do not create roles merely to simulate an organization. Handoffs should be typed artifacts with versioned state and verifier obligations, not free-form summaries. [H02, Section 4]

### Outer-loop harness optimization

Treat harness source as a candidate program: propose a bounded change, validate that it runs, evaluate it on a search set, preserve code/scores/raw traces, and promote only on a multi-objective regression gate. Meta-Harness found better classification and math context policies through this loop ([HC022](claims/HC022.md)); access to raw traces substantially outperformed scores-only and generated-summary interfaces ([HC021](claims/HC021.md)). [H33, Section 3 and Tables 2–3] This is evidence that automated search can find useful harnesses, not permission for production self-modification. Its TerminalBench result was optimized and finally scored on the same 89 public tasks, so benchmark specialization remains. [H33, Section 4.3]

## Architecture rules supported by the evidence

1. **Start with the least agentic adequate controller.** Complexity has not shown monotonic gains and can be dominated by simple baselines. [H04; H06; H34]
2. **Separate proposal from authority.** The model proposes actions; the broker validates and executes them.
3. **Externalize authoritative state.** Plans, diffs, tests, budgets, and approvals belong in files/databases/trace state rather than only the transcript. [H02]
4. **Prefer reversible state transitions, but name the boundary.** Snapshot controlled local state; classify external effects; record timeout as `outcome-unknown`; and retry only under verified end-to-end idempotency. Sagas compensate rather than erase committed external effects. ([HC025](claims/HC025.md), [HC026](claims/HC026.md), [HC027](claims/HC027.md), [HC028](claims/HC028.md)) See [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md).
5. **Make termination machine-checkable.** Require an explicit completion artifact and verifier result; model confidence is not an oracle. Harness-Bench found recurring cases where plausible reasoning never became a valid required artifact. ([HC020](claims/HC020.md)) [H32, Section 5]
6. **Version the whole run.** Model snapshot, harness release, prompts, tools, environment, policies, budget, and evaluators all affect the result. Across 35 fixed-model Qwen Code releases, resolve rate ranged from 23% to 39% while later versions became substantially more expensive. ([HC023](claims/HC023.md)) [H06; H34, Section 5.3]
7. **Regression-test behavioral quality.** Functional unit tests can miss changes in success rate, token use, turns, or tool-call efficiency; [H34] demonstrates this for studied Qwen Code releases. Gate harness releases on representative trajectory-level tests and explicit resource budgets. ([HC024](claims/HC024.md)) [H34, Sections 5.4 and 8.2]
