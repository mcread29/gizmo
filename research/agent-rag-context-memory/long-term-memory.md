# Long-term memory

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC001](claims/MC001.md) ← [ME001](evidence/ME001.md); [MC005](claims/MC005.md) ← [ME005](evidence/ME005.md); [MC006](claims/MC006.md) ← [ME006](evidence/ME006.md), [ME007](evidence/ME007.md), [ME008](evidence/ME008.md); [MC007](claims/MC007.md) ← [ME009](evidence/ME009.md).
- [MC020](claims/MC020.md) ← [ME025](evidence/ME025.md), [ME026](evidence/ME026.md); [MC021](claims/MC021.md) ← [ME027](evidence/ME027.md); [MC028](claims/MC028.md) ← [ME035](evidence/ME035.md); [MC029](claims/MC029.md) ← [ME036](evidence/ME036.md).
- [MC030](claims/MC030.md) ← [ME037](evidence/ME037.md); [MC031](claims/MC031.md) ← [ME038](evidence/ME038.md); [MC032](claims/MC032.md) ← [ME039](evidence/ME039.md), [ME040](evidence/ME040.md); [MC033](claims/MC033.md) ← [ME041](evidence/ME041.md).
- [MC034](claims/MC034.md) ← [ME042](evidence/ME042.md); [MC037](claims/MC037.md) ← [ME045](evidence/ME045.md); [MC038](claims/MC038.md) ← [ME046](evidence/ME046.md); [MC039](claims/MC039.md) ← [ME047](evidence/ME047.md).
- [MC040](claims/MC040.md) ← [ME048](evidence/ME048.md); [MC041](claims/MC041.md) ← [ME049](evidence/ME049.md); [MC044](claims/MC044.md) ← [ME054](evidence/ME054.md).

## Memory types are different products

| Type             | Typical contents                                          | Correct handling                                               |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| Working          | recent turns, active plan, current failures               | bounded context; pinned control state                          |
| Semantic/factual | names, preferences, constraints, learned facts            | source provenance, temporal scope, conflict/update operations  |
| Episodic         | task trajectories, outcomes, failures                     | objective outcome labels, applicability retrieval, raw handles |
| Procedural       | workflows, runbooks, executable skills                    | held-out promotion, versions/dependencies, sandbox, rollback   |
| Event/audit      | exact actions, observations, outputs, side effects        | append-only, integrity protected, access controlled            |
| Structured state | entities, counters, ledgers, obligations, temporal values | typed external authority and deterministic updates             |

One vector store should not silently implement all six.

## Semantic and factual memory

LongMemEval provides the clearest decomposition of value, key, query, and reader choices. Its 500 questions cover extraction, multi-session reasoning, temporal reasoning, updates, and abstention. [M01, §§3–4] Important findings:

- session→round decomposition helped GPT-4o but not the smaller reader uniformly;
- summaries/facts as replacement values generally lost information;
- extracted facts were useful as added keys and for multi-session normalization;
- the best retrieval budget changed by reader capacity;
- time-aware filtering helped only with a sufficiently reliable time parser. [M01, Figure 5; Tables 3–4; §§5.2–5.5]

A factual memory record should include `subject`, stable ID, predicate, value, units, `valid_from/to`, observed/recorded time, source events, confidence, authority, tenant/ACL, and conflict/supersession links. Free-form facts without identity and time cannot correctly support updates.

## Raw event retrieval versus compressed memory

LoCoMo's 50 human-edited conversations average 300 turns/9K tokens over up to 35 sessions and contain 7,512 QA questions. [M02, Table 5; §7] With GPT-3.5-Turbo-16K, retrieval over extracted observations improved QA over plain logs in a best tested setting, while session-summary retrieval did not significantly help despite high recall. Increasing retrieved observations eventually reduced performance. [M02, Table 3; §6.1]

LongMemEval independently favors original values plus derived keys. [M01, Table 3] These results converge on a raw+views architecture, though both are conversational and partly synthetic/human-edited benchmarks rather than production longitudinal users.

## Vector, multi-key, temporal, and hierarchical retrieval

- **Vector over raw events:** reasonable semantic baseline, but vulnerable to semantic collisions and exact-ID misses.
- **Multi-key:** several retrieval surfaces point to one raw value; LongMemEval's raw+fact result directly supports this. [M01]
- **Temporal:** filter or rerank by the query's requested time/state; preserve history rather than destructive overwrite. [M01, M16]
- **Hierarchical:** first select session/task/entity, then event/span; useful at scale, but every hierarchy can hide evidence and adds update cost.
- **Paging:** keep handles and let the harness expand exact source material; MemGPT is important architecture precedent but lacks an isolated equal-budget result sufficient for a general effectiveness verdict. [M08]

## Updates, stale facts, and “ghost memory”

A-TMA defines the failure where old, current, and transition facts coexist but retrieval/answering does not preserve their roles. Its LTP benchmark contains 10 profiles, 400 mutable state units, and 800 probes (400 historical, 400 current/conflict). [M16, Appendix A.1–A.3] With a Qwen2.5-3B answerer, top-5 retrieval, and Llama-3.3-70B judge, adding the state-aware overlay to Graphiti/Zep raised conflict accuracy 0.480→0.720 and QA accuracy 0.524→0.635. [M16, Table 2] On full LoCoMo, temporal F1 improved 0.0295→0.1705, but single-hop/open-domain and other host metrics were mixed. [M16, Tables 3–4]

The appropriate conclusion is narrow: explicit state role from bank through retrieval to answer helps conflict-heavy temporal queries. It does not prove this overlay or graph is best universally.

Lifecycle operations should be explicit:

```text
append raw event
propose fact/state mutation
validate identity, authority, time, schema, conflict
create/supersede/merge/invalidate/tombstone
invalidate dependent views
reindex
re-verify or expire
retain rollback and audit pointer
```

## Graph memory

Graph memory is justified when queries need relation traversal, identity resolution, or state transitions. Mem0's graph variant raised temporal judge score from 55.51 to 58.13 on LoCoMo but did not improve single-hop or multi-hop results. It doubled the reported stored-memory footprint from ~7K to ~14K tokens per conversation; another graph baseline reportedly exceeded 600K. Full context scored roughly 73% overall versus about 67% for base Mem0 and 68.44% for graph Mem0, explicit counterevidence against assuming retrieval or graphs always win when full context is feasible. [M15, Tables 1–2; §§4.1, 4.3, 4.5] The evaluation used ten conversations, LLM judging, and a vendor-authored preprint, so confidence is moderate only for the observed boundary.

Store authoritative entities/relations in typed records. Build embeddings, community summaries, or traversal indexes as disposable derived structures. A graph edge generated by a model remains a claim with provenance, not a fact.

## Episodic success and failure

ExpeL retrieves successful trajectories and derives natural-language insights from experience. It reported ALFWorld 59.0% versus ReAct 40.0%, but random experience retrieval dropped to 42.5%; unvalidated Reflexion text also reduced HotPotQA insight performance 39%→29%. [M11, Tables 1–3] The evidence supports applicable, selected experience and warns against indiscriminate injection.

Retain failures with:

- exact attempted actions and environment version;
- objective failed oracle/side effect;
- diagnosed cause explicitly marked as hypothesis;
- later resolution link if one exists;
- prohibition on direct executable promotion.

Failure retrieval is useful for contrasting during diagnosis and induction, but the reviewed evidence does not show that copying failed trajectories into the acting prompt is generally beneficial.

## Learned managers and automatic policies

MemCon learns retrieve/plan/re-retrieve/consolidate/forget/no-op choices with a tabular UCB controller. On GPT-4.1-mini Lobster ALFWorld, the isolated learned-controller comparison is 59.7%→64.9% (+5.2); the full bundled system reaches 67.9%. The reported 5–20% token savings belong to full MemCon, not the isolated controller. [M19, Table 2; §4.2] Yet each configuration is a single online deployment run, the policy learns on the evaluation stream, and 30 ALFWorld tasks tune hyperparameters. [M19, §4.1; Appendix A.4] Treat this as promising preprint evidence, not a settled default.

Automatic optimization should have deterministic fallback, shadow evaluation, bounded exploration, private temporal holdout, drift alarms, and rollback. Optimizer state itself is sensitive memory and must be namespaced/versioned.

## Forgetting, expiration, and garbage collection

Forgetting is not only vector deletion:

- expire derived views when source/version/applicability expires;
- retain minimal audit data only under an explicit policy;
- delete embeddings, graph edges, caches, replicas, and optimizer/skill indexes;
- tombstone IDs to prevent accidental resurrection without retaining reconstructive content;
- compact duplicate raw artifacts by hash, not by losing event references;
- test post-delete retrieval and extraction with seeded canaries.

There is little controlled agent-memory evidence on deletion completeness, retention economics, or useful learned forgetting. MemoryBank-style decay and MemCon's forget action are mechanisms, not proof of privacy or optimal retention. [M19]

## Across sessions, users, repositories, and domains

Use independent namespaces and applicability scopes. A repository episode binds to repository identity and commit range; a user fact binds to user/tenant and time; a workflow binds to environment/tool schema and permission class. Cross-domain transfer requires a held-out test: ExpeL's HotPotQA→FEVER gain is useful but modest evidence; Voyager's new-world tasks are stronger for its Minecraft domain. [M11, M13]

Never pool user memory into a global experience store without explicit consent, de-identification analysis, access policy, provenance, and deletion propagation.

## Evidence gaps

- Few papers measure write precision/recall, update correctness, stale-memory rate, or contradiction leakage.
- Storage/build/reindex cost is usually missing.
- Many system gains bundle extraction, retrieval, reader prompting, and extra calls.
- Conversational benchmarks have few synthetic/human-edited users and model-based judges.
- Long-term means thousands of tokens or tens of sessions in most studies, not years of changing real state.
