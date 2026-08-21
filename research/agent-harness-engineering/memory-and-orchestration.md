# Memory, state, and orchestration

## Memory is governed state management

“Memory” covers different jobs that should not share one undifferentiated store:

- **working state:** current hypothesis, subgoal, open failures, next decision;
- **semantic evidence:** repository/document facts retrieved for this task;
- **episodic experience:** prior trajectories and outcomes;
- **procedural skills:** reusable, versioned workflows or executable artifacts;
- **authoritative artifacts:** source files, patches, logs, test reports, approvals;
- **coordination state:** task ownership, versions, dependencies, and handoffs.

The key decisions are what to write, validate, retrieve, compact, expire, and invalidate. More storage is not automatically more memory quality. [H02, Section 3.2]

## State rules

LongMemEval provides direct evidence that nominal context capacity is not reliable memory: around 115K tokens, long-context models lost 30–66% versus oracle-evidence contexts. It also found that indexing original records alongside extracted facts improved average recall 9.4% and downstream accuracy 5.4%; condensed keys alone usually underperformed original content. Keep raw evidence and derived views together. [H28, Figure 3 and Tables 3–4]

1. **One authoritative state per artifact.** Chat summaries are views, not sources of truth.
2. **Version and provenance every write.** Record producer, source run, validation, timestamp, and superseded version.
3. **Gate long-term writes.** Promote only evidence or procedures with successful verification; retain failures separately for diagnosis.
4. **Invalidate dependent summaries after mutation.** A code summary tied to an old commit must not appear current.
5. **Separate raw evidence from compression.** Preserve immutable full-fidelity artifacts and link summaries to them.
6. **Make rollback first-class.** Store checkpoints and the state transitions between them.

ContextBench's usage-drop results show why this matters: finding evidence and retaining it for the final decision are separate capabilities. [H05, Table 5]

## When to delegate

Delegate only when at least one condition holds:

- a subtask has a clean contract and independently checkable result;
- the worker needs a different tool/permission boundary;
- parallel work is actually independent;
- a cheaper/specialist model is adequate;
- independent review reduces correlated failure;
- isolating context prevents the main loop from being flooded.

Do not delegate merely because a task has several steps. Every subagent adds setup context, handoff loss, latency, cost, and coordination state.

## Multi-agent state protocol

A robust handoff should include:

- task ID, parent run, and immutable objective;
- input artifact versions and read set;
- allowed tools and budget;
- expected output schema and verifier;
- produced artifacts and write set;
- assumptions, unresolved risks, and evidence;
- status: completed, blocked, failed, or needs review.

Concurrent mutations should use linearizable version checks or isolated branches/worktrees and merge through verification. A coordinator lease alone is not enough for external writes: resource-enforced monotonic fencing rejects a resumed stale worker, while CAS/optimistic validation protects only its participating resource and can abort under conflict. ([HC029](claims/HC029.md), [HC030](claims/HC030.md)) Free-form conversation is inadequate for resolving stale assumptions or conflicting writes; delegation creates a distributed-state problem. ([HC013](claims/HC013.md)) [H02, Sections 4.2–4.4 and 5.2.4; H37, H40–H42] See [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md).

## Independent verification versus “more agents”

A second agent is useful as a verifier only if its evidence or failure modes are meaningfully independent. Giving two instances the same context and asking for consensus may amplify a shared misconception. Prefer deterministic execution, diverse test generation, separate permissions, or blinded review over role-play alone.

Compute-normalized evidence argues strongly against “more agents by default.” Across FRAMES and MuSiQue with three model families, a 2026 study found single-agent averages generally matched or exceeded sequential and debate architectures at 1K–10K matched reasoning-token caps. Sequential MAS did become better under severe context masking/substitution, suggesting a narrower case for context partitioning. [H30, Table 1 and Sections 5.1–5.3]

MAST's 1,642-trace analysis found repeated steps, history loss, unknown/premature termination, information withholding, and incomplete or incorrect verification. Prompt and topology fixes helped some ChatDev settings but did not transfer uniformly to another model/framework. [H12, Tables 1, 2, and 5] Evaluate every multi-agent topology against a single agent with the same tools and total budget, independent best-of-n, and—where possible—a skill-compiled serial workflow.

## Self-improving harnesses

Treat a harness mutation like a safety-critical code change:

1. telemetry identifies a concrete failure class;
2. a proposed change states its causal hypothesis and affected component;
3. replay and held-out suites test expected gains and regressions;
4. safety and cost invariants gate promotion;
5. canary deployment and rollback limit impact;
6. versions keep historical runs reproducible.

Meta-Harness supplies direct but preliminary evidence for this loop. It stores every candidate's source, scores, and raw traces in a filesystem and lets a coding-agent proposer selectively inspect that history. Its discovered classifier reached 48.6% versus 40.9% for ACE while using 11.4K versus 50.8K added context tokens, showing that automated code-space search can discover a better context policy in this setting ([HC022](claims/HC022.md)); a trace-access ablation substantially outperformed scores or generated summaries ([HC021](claims/HC021.md)). [H33, Tables 2–3] The evidence is not a blanket endorsement of self-modification: one proprietary proposer drove the search, and TerminalBench-2 search and final scoring used the same 89 public tasks. Keep search, promotion, and untouched testing distinct.

Ordinary release evolution is not self-improvement either. With one model fixed across 35 Qwen Code releases, resolve rate showed no significant chronological trend, while token use increased strongly. This makes rollback and resource-regression gates as important as task-success gates. ([HC023](claims/HC023.md)) [H34, Section 5.3]

Experience promotion specifically needs a gate. ExpeL improved ALFWorld over ReAct (59.0% versus 40.0%), but adding Reflexion text to insight extraction hurt HotPotQA (39%→29%), and random experience retrieval cut ALFWorld to 42.5%. Store successful evidence, applicability conditions, and validation history rather than treating all reflection as useful learning. [H31, Figure 5 and Tables 1–3]
