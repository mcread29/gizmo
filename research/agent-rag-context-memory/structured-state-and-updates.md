# Structured state and updates

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC005](claims/MC005.md) ← [ME005](evidence/ME005.md); [MC006](claims/MC006.md) ← [ME006](evidence/ME006.md), [ME007](evidence/ME007.md), [ME008](evidence/ME008.md); [MC028](claims/MC028.md) ← [ME035](evidence/ME035.md); [MC029](claims/MC029.md) ← [ME036](evidence/ME036.md).
- [MC030](claims/MC030.md) ← [ME037](evidence/ME037.md); [MC031](claims/MC031.md) ← [ME038](evidence/ME038.md); [MC032](claims/MC032.md) ← [ME039](evidence/ME039.md), [ME040](evidence/ME040.md); [MC033](claims/MC033.md) ← [ME041](evidence/ME041.md).
- [MC034](claims/MC034.md) ← [ME042](evidence/ME042.md); [MC043](claims/MC043.md) ← [ME052](evidence/ME052.md), [ME053](evidence/ME053.md); [MC044](claims/MC044.md) ← [ME054](evidence/ME054.md).

## Why state must not be a transcript convention

Operational tasks require exact identity, counts, versions, temporal validity, obligations, approvals, and side effects. Natural-language history is ambiguous, lossy under compaction, hard to update atomically, and vulnerable to prompt injection. The harness should therefore separate:

- immutable evidence of what happened;
- current materialized state;
- derived model-generated memory.

This separation is an engineering synthesis supported indirectly by audit/replay architectures, state-conflict experiments, and deterministic stateful benchmarks—not by one complete factorial ablation. [M14, M16, M22, M26]

## Authoritative record of observations and attempts

As a normative engineering design, record every consequential observation/action as an immutable event. Such a record is authoritative about what was observed or attempted, not automatically about environment ground truth:

```yaml
event_id: evt_...
tenant: ...
task_id: ...
actor: model|user|tool|reviewer|policy
occurred_at: ...
causal_parents: [...]
environment_version: ...
model_harness_version: ...
operation: ...
normalized_arguments: ...
status: proposed|approved|started|succeeded|failed|reconciled
artifact_handles: [{ uri, sha256, media_type }]
side_effects: [...]
trust_taint: ...
retention_acl: ...
```

TapeAgents' “tape” demonstrates a structured append-only trace used for attribution, replay, resumption, and training. [M14, §2] Its economics bundle the tape with distillation, so audit benefits should not be misreported as an isolated success/cost ablation. Integrity protection, ACL enforcement, and immutability are requirements of this proposed design, not experimentally established TapeAgents findings.

Corrections append new events. A deletion request creates an auditable policy event but must also delete restricted payloads/indexes; append-only does not mean retaining personal data forever.

## Materialized current state

Derive or reconcile current state from the log and authoritative tools/databases:

- stable entities and aliases;
- current and historical values with valid time;
- plan and task graph;
- obligations, owners, deadlines, and approvals;
- resource/artifact handles and versions;
- counters/ledgers and invariants;
- pending/completed/reversed side effects;
- latest verifier/test status;
- unresolved conflicts.

The following deterministic update commands are normative systems synthesis, not a transactional design directly established by the cited agent experiments:

```text
Create(record, idempotency_key)
PatchIfVersion(id, expected_version, fields)
Supersede(old_id, new_id, reason)
Invalidate(id, source_change)
Merge(primary_id, duplicate_ids)
Tombstone(id, deletion_policy)
Reconcile(external_snapshot, expected_version)
```

Enforce JSON/schema types, required fields, stable IDs, referential integrity, uniqueness/cardinality, arithmetic/counts, valid-time ordering, optimistic concurrency, idempotency, ACL/capability, and invariants in code. An LLM returns a proposed operation plus cited evidence; the harness commits or rejects it.

## Temporal facts and updates

Maintain at least four times:

- event/observation time;
- ingestion time;
- valid-from;
- valid-to/superseded-at.

A-TMA's LTP makes state role observable. It replays old/current updates into one final bank and asks 400 historical plus 400 current-state questions. [M16, Appendix A.1–A.3] On Graphiti/Zep, state-aware bank/retrieval/QA labels improved conflict accuracy 0.480→0.720, but fact accuracy fell 0.568→0.550 and full LoCoMo results were mixed. [M16, Tables 2–4] This argues for explicit current/historical/transition views and against claiming a uniform gain.

A time-aware query should resolve to one of:

```text
CURRENT(as_of=t)
HISTORICAL(at=t or interval)
TRANSITION(from, to)
ALL_WITH_CONFLICTS
```

A newer timestamp alone is not enough: sources can have different authority, updates can be retroactive, and scope can differ.

## Derived views and provenance

A summary/fact/embedding/graph edge/workflow must carry source event IDs and artifact hashes. Maintain a dependency graph from source → derived item. When a source is superseded, deleted, or its environment version invalidates an episode:

1. mark dependents stale;
2. remove them from default retrieval;
3. rebuild/re-verify or expire them;
4. propagate deletion to indexes/caches;
5. retain rollback metadata permitted by policy.

LongMemEval's best result combines derived fact keys with original values, while fact-only and summary-only representations lose information. [M01, Table 3; §§5.2–5.3] That is direct support for provenance-linked views over retained evidence.

## Conflict resolution

Use deterministic precedence only when defensible:

1. environment/database truth over model inference;
2. explicit authorized correction over older statement for current view;
3. source with higher declared authority for the same scope;
4. otherwise retain both as a conflict.

Never ask the model to silently merge incompatible facts. Present the competing sources, time/scope/authority, and request arbitration. Log the chosen rule or reviewer.

## Structured-memory benchmark evidence

StructMemEval requires incremental writes into trees, ledgers/counts, state transitions, and recommendation/index structures rather than passage retrieval alone. On its 51-scenario main test with Gemini-3.1-Pro, total accuracy was 0.060 for retrieval, 0.390 for Mem0, and 0.660 for Mem-agent; count tasks remained poor and model/framework rankings changed sharply across backbones. Explicit state-structure hints raised Gemini Mem-agent from 64% to 79% over 42 state-tracking cases. [M32, Table 1 and state-hint table; PDF pp. 4, 6, 33] As a 2026 preprint with generated scenarios and no equal-cost comparison, this supports measuring structure/update behavior, not a claim that model-managed structured writes are reliable.

MemoryAgentBench supplies another strong warning: on incremental memories up to ~1.44M tokens, retrieval systems were strongest for focused recall while long-context access dominated holistic understanding, and almost all systems failed multi-hop selective forgetting. A strict GPT-4.1-mini token-matched ablation showed BM25 beating full context at ~4K tokens on Banking77 (83 vs 74), but full context winning at ~104K (93 vs 88); book-summary differences likewise changed with budget. [M33, token-matched table and construction-cost appendix] This argues for task-specific state/retrieval evaluation rather than one aggregate score. It is also explicit counterevidence to any blanket retrieval-first rule: full context wins the ~104K Banking77 and ~113K book-summary settings, while BM25 or other systems win elsewhere.

## Write gate

| Check                 | Mechanical action                                   |
| --------------------- | --------------------------------------------------- |
| Identity/namespace    | Resolve stable ID; reject cross-tenant alias        |
| Authorization         | Verify actor's write capability and field-level ACL |
| Provenance            | Require source event/artifact IDs                   |
| Objective validity    | Run test/query/policy/oracle where available        |
| Schema/invariants     | Parse and validate before commit                    |
| Temporal/conflict     | Compare valid time, scope, and authority            |
| Safety/privacy        | Secret/PII classifier, taint, retention policy      |
| Duplicate/idempotency | Exact key and semantic duplicate check              |
| Promotion             | Quarantine uncertain derived memory                 |
| Audit/rollback        | Record decision and previous version                |

The EHR defense study illustrates why an LLM's confidence cannot be this gate: one configuration rejected all 23 candidates, while another accepted 54 poison entries with trust 1.0. [M24, §§8.1–8.2]

## External files and databases

For coding, the repository/worktree and test environment are authority; memory stores paths/spans/diffs keyed by commit hash. For browser/tool agents, API/database state is authority; the transcript records claims and tool responses but should be reconciled. For research, fetched source artifacts and hashes are authority; summaries are views. For long-running assistants, the user can authorize and correct personal records, while derived inferences remain lower trust.

AgentDojo evaluates utility and attacks through deterministic functions over simulated application state. [M22, §3] τ-bench likewise checks database state and shows low repeated-run reliability even when one-run scores seem useful. [M26, Table 2; `pass^k` figure] These benchmarks support state-based verification, though they do not directly ablate transcript state against an external database.

## Replay, idempotency, and recovery

- Every side-effecting tool call gets an idempotency key.
- Retry first queries authoritative state, then decides whether to resume, reconcile, or compensate.
- Replay uses pinned tool/environment/model/harness versions where possible.
- Non-deterministic/model steps record inputs, outputs, and sampling/model IDs; replay may verify rather than reproduce exactly.
- Checkpoints are pointers into event log + materialized-state version, not copied prose.
- Recovery never assumes a timed-out call failed; it reconciles external state.

## Retention and garbage collection

Raw evidence needs risk-tiered retention, encryption, ACLs, and deletion. Derived views can expire aggressively because they are rebuildable. Garbage collection must preserve referential integrity: no live memory may point to a deleted artifact without a restricted tombstone explaining unavailability. Storage budgets should be per namespace and type, with quota/eviction decisions logged.

## What remains evidence-light

- isolated comparisons of deterministic versus LLM-applied updates;
- exact write precision/recall and referential-integrity failure rates;
- concurrent multi-agent update benchmarks;
- end-to-end deletion guarantees across vector/graph indexes and backups;
- long-term event-log storage and replay economics.

These controls—including the detailed transactional commands, concurrency rules, integrity protections, ACLs, and immutability properties—are normative systems synthesis recommended because they make correctness mechanically testable, not findings directly established by the cited agent experiments.
