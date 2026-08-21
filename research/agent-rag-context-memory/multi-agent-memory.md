# Multi-agent memory

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC035](claims/MC035.md) ← [ME043](evidence/ME043.md); [MC036](claims/MC036.md) ← [ME044](evidence/ME044.md); [MC037](claims/MC037.md) ← [ME045](evidence/ME045.md); [MC038](claims/MC038.md) ← [ME046](evidence/ME046.md).
- [MC043](claims/MC043.md) ← [ME052](evidence/ME052.md), [ME053](evidence/ME053.md); [MC044](claims/MC044.md) ← [ME054](evidence/ME054.md).

## The default question is not “shared or private?”

A multi-agent harness normally needs all three:

1. **authoritative shared state** — environment-backed, typed, versioned;
2. **append-only shared events/messages** — attribution and replay;
3. **private scratch/working context** — bounded reasoning that cannot silently mutate shared truth.

A shared vector store or prose summary does not replace a consistency protocol.

## Equal-budget evidence is negative by default

M20 v2 compares single agents with sequential/debate extra-agent message passing under 1K/2K/5K/10K reasoning-token caps on FRAMES and MuSiQue with Qwen3, DeepSeek-R1-Distill-70B, and Gemini-2.5. Single-agent averages were .418/.421/.427/.426; sequential systems .379/.389/.386/.387; debate .388/.403/.420/.420. [M20, Table 1; §5.1] Sequential agents overtook only when the single agent suffered severe context masking/substitution. [M20, §5.3]

The caps omit prompts/final answers and do not match actual minimum compute perfectly; tasks are text-only and lack heterogeneous tools. Still, this directly challenges claims that more agents or message-passed intermediate text inherently improve performance. It does not evaluate durable shared-memory services, whose effectiveness remains largely unsupported. Any multi-agent benefit should come from real information partition, parallel latency, specialized capability, or independent verification.

## When shared memory can be justified

- Different agents observe genuinely private/masked information.
- Tools or permissions are partitioned and results must be integrated.
- Work can proceed in parallel on independent partitions.
- A separate verifier needs an immutable action/evidence trace.
- Ownership and handoff reduce one agent's effective context.

Tape/event architectures make each actor's steps attributable. [M14, §2] They are a good substrate for shared coordination, but not proof that adding agents improves task success.

## Consistency and ownership problems

Shared memory creates distributed-systems failures:

- two agents update the same entity from stale snapshots;
- a summary overwrites another agent's exact evidence;
- retries duplicate side effects;
- agents disagree on task completion or resource ownership;
- a poisoned memory propagates to every reader;
- one tenant/user's memory leaks through a global store;
- an agent holds a lease after failure;
- derived workflows are promoted before independent validation.

Natural-language consensus is not transaction isolation.

## Recommended ownership protocol

The detailed leases, fencing, compare-and-swap, and handoff rules below are normative distributed-systems synthesis, not designs directly validated by the cited agent experiments.

### Partition and lease

Assign a stable owner for each task/entity/artifact partition. Use a time-bounded lease with heartbeat and fencing token. A stale owner cannot write after a newer lease is issued.

### Compare-and-swap updates

Every state mutation specifies expected version and idempotency key. On conflict, re-read and reconcile; do not let the model “best effort” merge.

### Append-only communication

Agents publish typed events:

```text
proposal, evidence, claim, state-update-request,
verification-result, approval, rejection, handoff, completion
```

Each event carries actor, causal parents, namespace/ACL, environment version, and artifact hashes. Materialized state is derived by authorized handlers.

### Handoff contract

A handoff includes:

- task/partition and current state version;
- completed operations and side effects;
- active plan and obligations;
- unresolved failures/conflicts;
- permissions and remaining budget;
- raw artifact/evidence handles;
- acceptance criteria and required verifier.

The receiving agent acknowledges the version and lease. A prose summary may accompany this contract but cannot replace it.

## Retrieval from shared memory

Filter by tenant, task, role, owner, capability, time/version, and trust before semantic relevance. Prefer events produced by authoritative tools and independent verifiers over model reflections. Preserve source actor labels so one agent's hypothesis is not read as environment truth.

Deduplicate parallel findings by source artifact hash/span, not by deleting provenance. Conflicting findings remain separate until an oracle or owner resolves them.

## Poison and prompt infection

AgentPoison shows that tiny fractions of a retrieval store can produce high malicious retrieval and end-to-end attack success. [M21, Table 1; §4.2] AgentDojo shows retrieved/tool content can redirect tool agents; CaMeL v2 shows information-flow/capability separation can block tested attacks but with utility and token overhead. [M22, Tables 4–5; M23, §6] Shared memory increases the blast radius.

Controls:

- untrusted events cannot grant capabilities or change policy;
- taint labels propagate through summaries and handoffs;
- derived memories retain all source actors/tenants;
- writes require namespace authorization and objective verification;
- quarantined content is excluded from global skill/workflow promotion;
- one agent cannot approve its own privileged side effect or durable promotion.

## Shared workflows and skills

A skill learned by one agent is untrusted code/content for another until it passes central promotion tests. Assay's task-dependent skill effects show that even non-malicious skills can help some tasks and hurt others. [M18, Figure 3; §3.4] Store applicability and measured per-domain/model effects; route by current task and model, not global popularity.

## Evaluation protocol

Compare against a single-agent baseline under:

- equal total input/output/reasoning tokens;
- equal total model calls and tool actions;
- equal wall-clock or a separately reported parallel-latency objective;
- same model(s), permissions, evidence, and evaluator;
- same failure/retry limits.

Measure final success, partial progress, state conflicts, duplicate operations, stale writes, handoff loss, message/store tokens, critical-path latency, dollars, repeated-run reliability, poison propagation, and recovery after one agent crashes. Add a masked-information condition only when it models the real deployment.

## Verdict

The reviewed evidence does not establish durable shared-memory effectiveness and does not support extra-agent message passing as a general performance default. Use a single agent and one state service unless there is a defensible partition or independent-check role. When multiple agents are warranted, solve ownership and consistency mechanically; share typed evidence/state, not an undifferentiated collective transcript.