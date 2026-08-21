# Security and privacy

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC037](claims/MC037.md) ← [ME045](evidence/ME045.md); [MC038](claims/MC038.md) ← [ME046](evidence/ME046.md); [MC039](claims/MC039.md) ← [ME047](evidence/ME047.md); [MC040](claims/MC040.md) ← [ME048](evidence/ME048.md).
- [MC041](claims/MC041.md) ← [ME049](evidence/ME049.md); [MC042](claims/MC042.md) ← [ME050](evidence/ME050.md), [ME051](evidence/ME051.md); [MC043](claims/MC043.md) ← [ME052](evidence/ME052.md), [ME053](evidence/ME053.md); [MC044](claims/MC044.md) ← [ME054](evidence/ME054.md).

## Threat model

Memory adds persistent, cross-request attack surfaces:

- retrieved documents/tool outputs contain indirect prompt injection;
- users poison memories through ordinary interactions;
- attackers insert adversarial records into RAG/experience stores;
- one agent or tenant contaminates shared memory;
- summaries hide provenance or launder taint;
- executable workflows/skills preserve malicious side effects;
- embeddings, traces, logs, caches, and derived views retain secrets/PII;
- deletion removes a visible record but leaves indexes or learned artifacts.

Treat all retrieved/model-generated content as data with source/taint. It cannot grant capabilities, change policy, approve side effects, or promote itself.

## Indirect prompt injection

AgentDojo contains 97 benign tasks, 27 injection targets, and 629 attack cases across four stateful application environments. [M22, §3] Against GPT-4o, one “important message” attack reached 57.69% targeted attack success while simpler attacks were around 4–6%, showing strong formulation/position dependence. A tool-filter defense reduced targeted success to 6.84% at 73.13% benign utility, but cannot help when legitimate and malicious goals require the same tools; a detector reduced benign utility to 41.49%. [M22, Tables 4–5; §4.3]

CaMeL v2 separates privileged and quarantined models and enforces data-flow/capability policies. On 949 AgentDojo cases, tested Claude-3.5-Sonnet and GPT-4o-mini CaMeL configurations had zero successful attacks, while native GPT-4o-mini was vulnerable in 276 cases. This cost utility (Claude about 90.72%→63.92%) and median 2.73× input/2.82× output tokens. [M23, §6] Zero is benchmark-specific, not a proof against adaptive attacks or policy errors.

**Default:** separate control instructions from untrusted evidence; authorize tools and data flows outside the model; minimize tool capabilities; require approval for high-risk side effects; test adaptive attacks.

## Persistent memory poisoning

AgentPoison poisons retrieval memory without model training. Across Agent-Driver, ReAct-StrategyQA, and EHRAgent combinations, it reported average malicious-retrieval success 81.2%, target action 59.4%, end-to-end impact 62.6%, and only 0.74% average benign-utility loss. [M21, Table 1; §4.2] It used fewer than 0.1% poisoned database entries; one poisoned instance still produced average 62.0% retrieval success in a sensitivity test. [M21, Figure 4; Appendix A.1]

The poisoning study used held-out test samples (250 Agent-Driver, 229 StrategyQA, 100 EHR) and is peer reviewed at NeurIPS 2024, but assumes white-box access to a surrogate embedder and optimized triggers; transfer is empirical, not guaranteed. [M21, Appendix A.1.3]

MINJA shows a different threat: an ordinary user induces writes through query-only interaction with a shared memory. Across nine victim/target pairs per configuration, injection success was 95.6%–100% and end-to-end attack success 57.0%–98.9% on tested EHR/WebShop/MMLU agents; benign-memory density reduced MIMIC ASR 68.9%→31.1% but left WebShop 98.9%→97.8%. [M34, Tables 1, 4] It is a 2025 preprint revised in 2026, relies on shared cross-user memory, and reports no dollar cost, but directly establishes delayed cross-session risk without backend access.

A later EHR preprint found pre-existing correct memory reduced GPT-4o-mini ASR from 62% to 6.67% and Llama-3.1-8B from 52.94% to 0% under top-3 retrieval, but retrieving 10 items raised ASR to 38% and 27.27% respectively. [M24, Tables 1–2] This is a useful counterexample to idealized attacks and also shows over-retrieval can resurface poison.

## Write validation and trust failure

Do not use model confidence as the primary write gate. In M24's defense experiment:

- GPT-4o-mini rejected all 23 candidate memories, leaving an empty store. [M24, §8.1]
- Gemini-2.0-Flash accepted 82 records at trust 1.0, of which 54 were malicious. [M24, §8.2]
- Retrieval-time thresholding could not remove those high-confidence poison records. [M24, §8.2]

The experiment is small and incomplete as a utility evaluation, but directly demonstrates both extremes: a security gate that destroys usefulness and one that confidently approves attacks.

Require source identity, authorization, independent objective verification, schema checks, effect simulation/sandbox, contradiction detection, and quarantine. For a claimed patient-ID change, verify against the authoritative identity database; linguistic plausibility is irrelevant.

## Provenance and taint

Every raw and derived memory should carry:

```text
origin tenant/user/agent/tool/document
ingestion path and timestamp
source event/artifact hash
trust/taint and authority class
derivation chain and generator version
ACL/purpose/retention class
validation result and validator
```

Taint propagates through summaries, facts, graph edges, workflows, and handoffs. A derived item cannot acquire higher authority than its strongest independent validation. Preserve raw evidence because summary-only memory can hide injection text and make forensic rollback impossible.

## Tenant and user isolation

- separate physical/logical namespaces and encryption keys;
- enforce ACL before retrieval, not after ranking;
- include tenant in cache and idempotency keys;
- prohibit global nearest-neighbor search over private stores;
- scope workflows/skills separately from user facts;
- audit cross-namespace attempted reads/writes;
- test with canary secrets and adversarial near-duplicate identities;
- use a central policy service for multi-agent reads/writes.

The reviewed literature contains attack benchmarks but little controlled evidence establishing production-grade cross-user isolation. Treat isolation as an unproven claim until mechanically tested.

## Secret retention and minimization

Avoid storing secrets in transcripts, embeddings, summaries, or general experience. Redact at ingestion, store a capability/secret handle in a dedicated vault, and reveal the value only to the authorized tool at execution. Tool output masking reduces repeated exposure in model context but does not delete the source log. [M07]

A vector embedding is not anonymization. Access, retention, and deletion policy applies to embeddings and graph indexes as well as plaintext.

## Deletion and expiration

A deletion operation must cover:

1. authoritative record/payload;
2. raw event artifacts where policy permits deletion;
3. summaries, facts, episodes, reflections, workflows, and skills derived from it;
4. vector indexes, graph nodes/edges, caches, replicas, snapshots/backups under policy;
5. model-training/export queues and optimizer state;
6. future retrieval by aliases/near-duplicates.

Provenance enables cascading deletion. Keep only a non-reconstructive tombstone when required for referential integrity/audit. Test seeded canaries before and after deletion via exact, semantic, graph, temporal, and cross-tenant queries.

No reviewed source establishes end-to-end deletion or machine-unlearning guarantees for agent memory. Claims that a UI delete or vector deletion “forgets” the user are unsupported.

## Executable memory

Workflow and skill code requires static analysis, dependency pinning, signed artifacts, sandboxing, least privilege, explicit side-effect declaration, human approval for dangerous operations, timeouts/quotas, postcondition checks, and rollback. Voyager's self-verification can err; objective environment checks should supersede self-judgment. [M13, §4]

## Security regression suite

For every memory-policy release:

- indirect injection in documents, tool output, image/OCR, and retrieved episodes;
- persistent query-only poisoning and optimized retrieval triggers;
- stale/current conflict poisoning;
- malicious workflow/skill and dependency substitution;
- cross-user/tenant leakage and cache-key confusion;
- secret canary write/retrieve/extract;
- deletion propagation and resurrection;
- policy/tool capability escalation;
- adaptive attacks against the actual defense;
- benign utility, false rejection, token/call/latency cost.

Pin the model, embedder, reranker, policy, store, tool schema, and attack set. A defense that blocks attacks by emptying memory is not successful unless the intended utility requirement is also met.

## Recommended security default

Read path: ACL/time/version filter → trust/taint policy → retrieval/rerank → quarantine boundary → capability-controlled action.  
Write path: authenticate/authorize → ground in raw source → objective validate → schema/conflict/privacy checks → quarantine or commit → audit.  
Promotion path: independent held-out tests → signed versioned artifact → canary → rollback.