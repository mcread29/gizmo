# Claim register

Stable claims corresponding one-to-one with the rows in [`../evidence-table.md`](../evidence-table.md).

- [HC001](HC001.md) — A deployed LLM agent is meaningfully analyzed as model plus execution harness.
- [HC002](HC002.md) — Interface design can change performance with the model fixed.
- [HC003](HC003.md) — More elaborate scaffolding does not guarantee better context retrieval.
- [HC004](HC004.md) — Models tend to over-retrieve and then lose useful evidence.
- [HC005](HC005.md) — Fixed pipelines can be competitive with open-ended agents.
- [HC006](HC006.md) — Complex reflection/search systems can be dominated by simple cost-matched baselines.
- [HC007](HC007.md) — Jointly optimizing quality and cost can retain quality at lower variable cost.
- [HC008](HC008.md) — Executable tests improve candidate selection, but generated tests are weak oracles.
- [HC009](HC009.md) — Public agent benchmarks can reward shortcuts and suffer evaluator drift.
- [HC010](HC010.md) — Prompt injection cannot be handled by prompt instructions alone.
- [HC011](HC011.md) — Least-privilege tool restriction can reduce attack success.
- [HC012](HC012.md) — Security controls must be evaluated for utility loss.
- [HC013](HC013.md) — Multi-agent delegation introduces a distributed-state problem.
- [HC014](HC014.md) — Leaderboard scores should be treated as model–harness–budget–environment outcomes.
- [HC015](HC015.md) — Retrieval should be selective rather than automatic.
- [HC016](HC016.md) — Preserve verbatim edit-site source while pruning surrounding code.
- [HC017](HC017.md) — Dependency-aware planning can help explicit multi-file change chains.
- [HC018](HC018.md) — Temperature zero does not make task outcomes deterministic.
- [HC019](HC019.md) — Whole harness configurations can produce large performance spreads over a shared model/task pool.
- [HC020](HC020.md) — Plausible reasoning is not sufficient unless it becomes validator-readable state.
- [HC021](HC021.md) — Raw execution traces can be more useful than scalar scores or generated summaries for harness optimization.
- [HC022](HC022.md) — Automated code-space search can discover better context policies.
- [HC023](HC023.md) — Newer harness releases do not monotonically improve success and may regress efficiency.
- [HC024](HC024.md) — Functional tests can miss behavioral harness regressions.
- [HC025](HC025.md) — A timeout can leave a side-effecting tool call with an unknown outcome.
- [HC026](HC026.md) — Retry safety requires end-to-end operation identity and effect-coupled duplicate state.
- [HC027](HC027.md) — Atomicity stops at the boundary of enlisted transactional resources.
- [HC028](HC028.md) — Saga compensation is semantic repair, not isolation-preserving rollback.
- [HC029](HC029.md) — Leases require resource-enforced fencing to reject stale writers.
- [HC030](HC030.md) — Conditional writes prevent stale commits only at their atomic resource boundary.
- [HC031](HC031.md) — Replay is safe only within its recorded deterministic boundary.
- [HC032](HC032.md) — Exactly-once claims are conditional on a named effect and failure model.
- [HC033](HC033.md) — Side-effect recovery needs cut-point fault injection and external-state oracles.
- [HC034](HC034.md) — Direct agent experiments support only bounded transaction and compensation mechanisms.
- [HC035](HC035.md) — Production-grade exactly-once external effects remain unproven in the bounded agent corpus.
