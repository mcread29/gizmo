# Distributed state, transactions, and external side effects

**Focused review date:** 2026-07-20  
**Literature cutoff:** 2026-07-20  
**Scope:** side-effecting tool/API execution by agent harnesses; foundational systems results are separated from direct LLM-agent experiments

## Executive conclusion

A side-effecting agent run is a distributed workflow, not a sequence of reliable function calls. A timeout is an observation about communication, not proof that an effect failed. Retry can trade omission for duplication. A local checkpoint cannot roll back another provider. A lease can expire while its old worker remains alive. A log can replay controlled state while the outside world has changed. “Exactly once” is therefore a conditional protocol claim, not a property obtained by adding a retry loop or writing the phrase to an API schema. ([HC025](claims/HC025.md), [HC026](claims/HC026.md), [HC027](claims/HC027.md), [HC029](claims/HC029.md), [HC031](claims/HC031.md), [HC032](claims/HC032.md)) [H35–H48]

Three recent direct agent systems do study adjacent mechanisms. Atomix injects post-effect/pre-return failures, duplicates, timeouts, stale races, compensation failures, and irreversible effects. RAC evaluates dependency-aware compensation. Cordon stages mediated effects and validates a task-level transaction before commit. Their evidence is useful but bounded: two are preprints; the runtimes and effect adapters are bundled; workflows are constructed or adapted; and the papers retain partial-commit, missing-compensator, opaque-plugin, and single-process limits. ([HC034](claims/HC034.md)) [H49–H51]

## Evidence layers

### Established distributed-systems results

The RPC, transaction, lease, consensus, recovery, and concurrency sources establish protocol properties under explicit models. They are directly applicable only when an agent tool boundary satisfies those assumptions. Examples:

- Birrell–Nelson at-most-once RPC distinguishes successful return from a zero-or-one exception outcome [H36].
- RFC 9110 defines retry/idempotency and conditional HTTP semantics, not provider implementation correctness [H41].
- Sagas define semantic compensation for separately committed subtransactions, not invisible rollback [H35].
- Chubby demonstrates recipient-enforced fencing; Raft protects a replicated log, not an arbitrary external tool [H38, H42].
- ARIES safely replays database state because one subsystem controls the log and data pages [H45].

These are not experiments on LLM planning or prompting. This review uses them as engineering premises about the runtime beneath any model.

### Direct LLM-agent evidence

- **Atomix v2 [H49, preprint]:** direct failure injection at effect lifecycle cut points and explicit residue/partial-commit classification. ([HE051](evidence/HE051.md), [HE052](evidence/HE052.md))
- **RAC [H50, peer reviewed]:** persistent execution log and reverse dependency compensation; only three repetitions per problem and direct compensation failures remain. ([HE040](evidence/HE040.md), [HE053](evidence/HE053.md))
- **Cordon v1 [H51, preprint]:** shadow state and effect outbox; 45/45 constructed violations blocked before commit, but opaque/unobservable effects remain outside the boundary. ([HE038](evidence/HE038.md), [HE054](evidence/HE054.md))

No clause below treats a foundational systems result as an isolated agent-benchmark effect unless one of these direct observations actually tests it.

## Ambiguous outcomes, lost acknowledgements, and duplicates

Consider a payment call:

1. the harness sends `charge(intent=I)`;
2. the provider commits the charge;
3. the response is lost;
4. the harness times out.

The observable timeout is compatible with at least four states: request never arrived; request is delayed; effect committed but response was lost; or effect committed and a duplicate retry may also commit. Birrell and Nelson's protocol says a successful return establishes one invocation, while an exception reports zero or one without distinguishing them. RFC 9110 explicitly allows retry of an idempotent request after response loss even if the original succeeded. ([HC025](claims/HC025.md)) [H36, Section 3; H41, Section 9.2.2]

**Required state vocabulary:** `not-sent`, `sent`, `outcome-unknown`, `confirmed-applied`, `confirmed-not-applied`, `compensating`, `compensated`, `manual-reconciliation`, and `unresolved`. A timeout transitions to `outcome-unknown`, not `failed`.

**Lost acknowledgement counterexample:** transport says the server received bytes, but application processing later fails; conversely application processing succeeds and its reply disappears. Transport acknowledgement is not semantic settlement. [H44, pp. 281–282]

## Retries and true end-to-end idempotency

A retry is safe only relative to a named semantic effect. “Same HTTP request” is weaker than “same customer charge,” because a harness can regenerate the logical charge under a new transport/request identifier.

A robust idempotency contract needs:

1. a stable **logical operation ID** generated before first dispatch and reused across retries/restarts;
2. a canonical request hash and explicit policy for mismatched key reuse;
3. durable provider-side duplicate/completion state;
4. atomic coupling of duplicate detection/result storage to the protected effect;
5. retention/reclamation rules longer than plausible delayed retries;
6. propagation of the same identity through every downstream effect, or an explicit boundary where the guarantee ends;
7. a query/reconciliation API returning authoritative status/result.

RIFL supplies this shape inside a participating storage system. End-to-end arguments explain why a lower transport layer cannot infer that two differently encoded requests mean the same application operation. RFC 9110 says non-idempotent methods should not be retried automatically without semantic knowledge or proof of non-application. ([HC026](claims/HC026.md)) [H41, H43–H44]

**Counterexample:** the harness stores `I` locally, but the provider does not. The provider commits, reply is lost, the harness restarts, and retrying `I` commits again. Local knowledge did not constrain provider behavior.

**Counterexample:** the primary provider deduplicates `I` but emits an email under a fresh ID on every duplicate request. The resource transition may be idempotent while the end-to-end workflow is not.

## Atomicity boundaries across tools

Strict atomic commit is available only across enlisted resource managers sharing a commit protocol. A harness-local database transaction cannot include a SaaS payment, email, shell job, and physical actuator merely by wrapping their calls in one function. Gray and Reuter's “real action” boundary and Gray–Lamport's prepared/in-doubt state make this explicit. Cordon supplies recent agent-specific evidence that ACID-like rollback applies to mediated shadow state, while released effects become idempotency, recovery, audit, or compensation cases. ([HC027](claims/HC027.md)) [H39, Sections 4.2.2 and 10.4; H47, Section 3.3; H51]

**Atomicity options, strongest first:**

| Mechanism | What can be atomic | Principal cost/limit |
|---|---|---|
| One local transaction | records in one transactional resource | does not include remote effects |
| Distributed commit / enlisted resources | participants implementing the protocol | stable logs, blocking/quorum cost, operational coupling |
| Transactional outbox | source state plus durable intent to publish | relay can duplicate; consumer needs dedup; remote effect not in source transaction |
| Try/confirm/cancel or reservation | providers exposing provisional state | reservation expiry, capacity lock, provider-specific protocol |
| Saga | committed steps plus semantic compensators | visible intermediate state; compensation can fail/be inexact |
| Best-effort orchestration | arbitrary tools | partial commit is an expected state, not rollback |

**Normative recommendation (premises: HC025–HC027):** before execution, classify every side effect as local-transactional, bufferable, reservable, naturally idempotent, key-idempotent, compensable, or irreversible. Reject a workflow whose required invariant exceeds the weakest provider protocol unless explicit partial-commit/manual-repair policy exists.

## Sagas and compensation versus rollback

A saga commits subtransactions separately. If a later step fails, compensators attempt semantic repair in reverse dependency order. It deliberately gives up outer-level isolation: another actor can observe an intermediate reservation and act on it before compensation. Restoring an old value can itself corrupt intervening work. Some actions—publication, an already-read message, a physical action—cannot be erased; a correction is a new effect. ([HC028](claims/HC028.md)) [H35, pp. 250–257]

RAC directly demonstrates that agent compensation can be orchestrated from a persistent dependency log, but also reports missing/failed compensator states and non-monotonic results: one dynamic rollback task succeeded 2/3 in one setting and 0/3 with the high-reasoning model. ([HE040](evidence/HE040.md), [HE053](evidence/HE053.md)) [H50]

A compensator record should contain:

- original operation ID, parameters, result, and external revision;
- preconditions under which compensation remains valid;
- compensator identity/version and required authority;
- expected repair invariant, not the fiction “restores history”;
- deadline/cost/visibility and escalation owner;
- compensation attempt IDs and their own ambiguous outcomes.

**Normative recommendation (premise: HC028):** reserve “rollback” for state inside a real transaction/snapshot. Call external repair “compensation,” state what it guarantees, and expose `partial-commit` or `manual-repair` as terminal states.

## Leases, fencing tokens, stale writers, and split brain

A lease controls what the coordinator recognizes; it does not stop an expired process from running. Chubby's counterexample is decisive: holder A sends request `R`, loses ownership, holder B acts, then delayed `R` arrives. Mutual exclusion at the lock service was correct, yet the resource can still accept stale work. Recipient-side fencing solves this by attaching a monotonically increasing acquisition generation and rejecting generations below the greatest durably accepted. ([HC029](claims/HC029.md)) [H37; H42, Section 2.4]

A correct fence requires:

- strictly increasing epoch for each ownership acquisition (a random UUID alone has no order);
- epoch on every direct, delegated, queued, and retried protected request;
- durable greatest-accepted epoch at the resource;
- atomic comparison, maximum-epoch update, and protected effect;
- rejection—not logging—of stale epochs;
- no bypass path;
- separate same-epoch duplicate suppression.

**Split-brain boundary:** in a five-node quorum system, a 3/2 partition lets the majority progress and denies the minority. If the minority's old leader can still call an unfenced external API, consensus protected only its log. Raft safety does not automatically propagate to the API. [H38]

**Operational costs:** renewal traffic, failover delay until expiry, quorum unavailability, per-effect token storage/checking, and integration across every protected endpoint. Clock assumptions matter for lease safety/liveness; fencing token order itself need not use wall time.

## Compare-and-swap and optimistic concurrency

Optimistic concurrency performs work speculatively, validates the read/write set, and commits only if versions still match. Conflicts require abort/retry; high contention can cause repeated failure. RFC `If-Match` and Chubby generation checks are concrete conditional-write forms. ([HC030](claims/HC030.md)) [H40–H42]

**CAS is not:**

- an eventually consistent `GET` followed by unconditional `PUT`;
- checking a version in the harness and then calling an unrelated effect;
- validation after sending an irreversible action;
- a transaction across two independent CAS resources.

**CAS-before-effect counterexample:** agent reads version 7, sends email, then `CAS(7→8)` fails because another writer committed 8. Local state rejects the workflow, but email already escaped. Reserve/commit state before effect, use an outbox, or bind an idempotent effect to the committed operation ID.

**ABA counterexample:** a task at generation 1 is deleted and recreated at generation 1; an old conditional write can match. Pair a never-reused object/incarnation ID with a monotonic generation.

## Event logs, replay, reconciliation, and changed external state

A durable log is necessary but not sufficient. Raft can provide one committed command order; ARIES can repeat database history because log records and data pages share one recovery manager. ([HC031](claims/HC031.md)) [H38, H45]

For an agent harness, separate three modes:

1. **Pure replay:** rebuild internal derived state from recorded events; never dispatch external effects.
2. **Resume:** continue from durable state after classifying every in-flight effect as confirmed, not-applied, or unknown.
3. **Reconciliation:** query authoritative external state using operation/business IDs, compare against intended invariants, and append a new adjudication/repair event.

Record external **observations** used by decisions, because replaying a query tomorrow can return a different inventory, exchange rate, authorization, schema, or object generation. Record effect intent before dispatch, attempt IDs, response/timeout, provider status checks, compensation, approvals, and final adjudication. A raw log is evidence of what was recorded—not proof that an external effect occurred exactly as logged.

**Normative recommendation (premises: HC025, HC031):** replay must run with an effect gate that rejects outbound mutations and substitutes recorded query results. Reconciliation is a new run against current state, not historical replay.

## Exactly-once claims and assumptions

Ask “exactly once **what**?”

| Claim object | Possible bounded meaning | Missing implication |
|---|---|---|
| delivery | broker exposes one delivery under stated protocol | consumer processed once |
| invocation | server procedure invoked at most/exactly once | downstream effect occurred once |
| local transition | database state committed once | messages/external effects committed once |
| logical business effect | provider deduplicated stable operation ID | unrelated downstream providers deduplicated |
| whole workflow | every required effect settled to one legal state | generally requires all endpoints to participate or explicit partial states |

RIFL shows exactly-once RPC completion inside a service with unique IDs, atomic completion records, migration, and reclamation. Helland shows that transactional source intent still feeds at-least-once messaging and recipient dedup. Therefore exactly-once is neither universally impossible nor a free transport property. It is conditional on the named effect, failure model, identity lifetime, durability, atomicity scope, ownership consistency, downstream participation, and retention. ([HC032](claims/HC032.md)) [H43, H48]

A claim should publish:

- effect and linearization point;
- crash, network, storage-loss, clock, and Byzantine assumptions;
- ID generation/non-reuse and canonical request equality;
- duplicate-result durability and retention horizon;
- atomic coupling and every participating resource;
- behavior after key expiry, migration, failover, and manual repair;
- availability/latency/storage costs;
- excluded incidental and irreversible effects.

## Agent-specific failure-injection matrix

The matrix is a **normative evaluation design** grounded in FoundationDB's deterministic fault simulation and Atomix's direct agent cut points; its complete protocol has not itself been validated as a benchmark. ([HC033](claims/HC033.md)) [H46, H49]

| Dimension | Required cells | Primary oracle |
|---|---|---|
| Topology | one call; serial chain; fan-out/fan-in; alternatives; speculation; concurrent agents | legal workflow states |
| Effect class | read-only; natural idempotent; keyed idempotent; bufferable; reservable; compensable; irreversible | semantic effect count/state |
| Cut point | before durable intent; after intent/before send; after send/before provider; after effect/before log; after effect/before reply; after reply/before durable receipt; during compensation; during release/recovery | durable/event/external-state agreement |
| Delivery | request loss; response loss; duplicate; delay; reorder; late success after timeout | operation-ID history |
| Concurrency | stale read; CAS conflict; lease expiry; old-owner delayed write; 3/2 partition; ABA recreation | version/fence invariant |
| External drift | inventory change; authorization change; schema version change; object delete/recreate; eventually visible settlement | current authoritative state plus recorded historical observation |
| Harness crash | process death; stale checkpoint; torn/missing event; duplicate/out-of-order event; crash during reconciliation | restart from durable state only |
| Compensation | success; timeout/unknown; precondition invalid; partial repair; compensator unavailable; compensation itself duplicated | repair invariant and residue class |
| Multi-effect outcome | none; prefix; arbitrary subset; all applied/reply lost; partial compensation | legal final-state set |
| Visibility | query by operation ID; query only by business key; eventually visible; non-queryable/irreversible | reconciliation coverage |
| Schedule | exhaustive single cut; pairwise/t-wise; seeded random; state-conditioned/adversarial | reproducible seed and minimized counterexample |

### Minimum protocol

1. Pin model, harness commit, prompt, tools, provider simulators, evaluator, simulated clock, and seed.
2. Define invariants before runs: at most one semantic effect per intent; stale epoch never mutates; irreversible effect never leaves before required commit/approval; abort leaves only classified residue.
3. Generate `run_id`, workflow ID, stable logical operation ID, attempt ID, canonical request hash, observed version, and fencing epoch separately.
4. Capture intent, dispatch, provider receipt, effect, response, timeout, reconciliation, compensation, and adjudication.
5. Run repeated healthy controls and report `pass^k`, variance, latency, calls, retries, and cost.
6. Exhaust every single cut point for every side-effecting tool; restart from durable state, not process memory.
7. Add duplicate, late reply, crash/restart, stale-writer, split-brain, CAS, ABA, and changed-external-state schedules.
8. Query external state independently; do not use the harness's final answer as the oracle.
9. Classify every run: `clean-commit`, `clean-abort`, `reconciled-commit`, `compensated`, `leaked`, `partial-commit`, `unresolved`, or `oracle-unknown`.
10. Report both safety and liveness: duplicate/leak/stale-write rate; unresolved rate/time; compensation success; recovery latency; manual intervention; availability loss; extra storage/calls/tokens/cost.
11. Publish minimized schedules and complete histories. A test that finds no violation is not a proof of correctness.

## Concrete design implications and limits

The following are **normative engineering recommendations**. Their empirical premises are the linked claims; value/cost choices remain deployment decisions.

1. **Persist intent before dispatch.** Include stable logical ID, canonical arguments, expected version/fence, effect class, approval, and reconciliation method. Premises: [HC025](claims/HC025.md), [HC026](claims/HC026.md).
2. **Never blind-retry `outcome-unknown`.** First use provider status/dedup semantics; otherwise escalate or compensate under a recorded policy. Premise: [HC025](claims/HC025.md).
3. **Make provider idempotency explicit.** Verify key scope, parameter comparison, result replay, retention, concurrency, and downstream effects. Premise: [HC026](claims/HC026.md).
4. **Stage irreversible actions.** Prefer local outbox/reservation/approval; release only after prerequisite state commits. Limits: relay duplicates and endpoint nonparticipation. Premises: [HC027](claims/HC027.md), [HC032](claims/HC032.md).
5. **Use saga vocabulary honestly.** Compensation creates a new visible state and can fail; never render it as historical erasure. Premise: [HC028](claims/HC028.md).
6. **Fence every ownership-sensitive path.** Lease checks in the coordinator are insufficient; the resource atomically rejects stale epochs. Premise: [HC029](claims/HC029.md).
7. **Use CAS before escape.** Commit reservation/version state before nontransactional effects, not after. Premise: [HC030](claims/HC030.md).
8. **Separate replay, resume, and reconciliation.** Pure replay disables mutations and uses recorded observations; resume adjudicates in-flight effects; reconciliation observes current external state. Premise: [HC031](claims/HC031.md).
9. **Publish exactly-once assumptions.** If the provider cannot prove them, say `at-least-once + idempotent effect`, `at-most-once invocation`, or `best effort with reconciliation`. Premise: [HC032](claims/HC032.md).
10. **Gate releases on injected side-effect failures.** Include external-state invariants and unresolved/manual-repair cost, not only task success. Premise: [HC033](claims/HC033.md).

## Direct LLM-agent evidence: what it does and does not establish

The direct studies support a bounded proposition: harness-managed staging, effect classification, persistent logs, compensator dependencies, and deliberate post-effect fault injection are implementable and can improve measured workflows. They also provide counterevidence to simplistic claims: stronger reasoning did not guarantee better RAC rollback; Atomix retains partial commit; Cordon excludes opaque effects. ([HC034](claims/HC034.md)) [H49–H51]

They do **not** isolate model intelligence from runtime protocol correctness. A model may choose an operation, but stable IDs, WAL/outbox commits, CAS, fencing, provider dedup, and settlement oracles must be mechanical.

## What remains unproven for LLM agents

Within this 51-source harness corpus and the prospectively logged focused update, the following remain gaps. The search had upstream-engine failures and is not exhaustive; [HC035](claims/HC035.md) is deliberately unsupported and must not be read as global absence. ([HE055](evidence/HE055.md))

- crash-safe exactly-once **semantic** effects across arbitrary independently administered tools;
- atomic commit across heterogeneous irreversible endpoints without endpoint participation;
- independent replication of Atomix, RAC, or Cordon on a shared protocol and untouched test set;
- production evidence under real provider retention expiry, late settlement, webhook duplication, region failover, and operator repair;
- controlled agent experiments isolating lease-only versus fenced writes, CAS versus blind writes, and majority/minority split brain;
- validated compensator correctness after external state changes, including compensation's own ambiguous timeout;
- replay fidelity when tool schemas, policies, code, credentials, and external state have changed;
- human burden, approval fatigue, reconciliation time, financial residue, and long-term operational cost;
- Byzantine/dishonest tools that falsely report effect status or ignore idempotency/fencing contracts;
- benchmark oracle sensitivity for non-queryable or irreversible real-world effects.

## Counterexamples and impossibility boundaries to retain

- **Timeout ≠ failure.** It may be a completed effect with lost response.
- **Idempotent transport ≠ idempotent workflow.** A duplicate logical operation can get a new request ID.
- **Lease ≠ fence.** Old code can run after expiry.
- **Consensus ≠ external fencing.** A minority cannot commit the log but can still call an unfenced tool.
- **CAS ≠ transaction.** It protects one atomic resource; an earlier email remains sent.
- **Compensation ≠ rollback.** Observers may have acted and repair may be irreversible/inexact.
- **Log ≠ world state.** A faithful record can disagree with the provider or become stale.
- **Outbox ≠ exactly once.** It atomically records intent; relay/consumer duplication remains.
- **Exactly once is not absolutely impossible.** RIFL demonstrates it inside a defined participating boundary with durable state and reclamation assumptions.
- **Non-blocking is conditional.** Quorum commit loses availability without enough working participants; timeouts cannot manufacture outcome knowledge.
