# Working context and compaction

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC001](claims/MC001.md) ← [ME001](evidence/ME001.md); [MC002](claims/MC002.md) ← [ME002](evidence/ME002.md); [MC003](claims/MC003.md) ← [ME003](evidence/ME003.md); [MC004](claims/MC004.md) ← [ME004](evidence/ME004.md).
- [MC006](claims/MC006.md) ← [ME006](evidence/ME006.md), [ME007](evidence/ME007.md), [ME008](evidence/ME008.md); [MC016](claims/MC016.md) ← [ME021](evidence/ME021.md); [MC017](claims/MC017.md) ← [ME022](evidence/ME022.md); [MC018](claims/MC018.md) ← [ME023](evidence/ME023.md).
- [MC019](claims/MC019.md) ← [ME024](evidence/ME024.md).

## Default hierarchy

Use the cheapest reversible operation first:

1. remove exact duplicates and superseded renderings;
2. replace bulky, re-fetchable observations with typed handles/placeholders;
3. retain a tuned recent window in full;
4. pin plans, obligations, decisions, failures, and verifier feedback;
5. select older raw events by relevance/dependency;
6. summarize only when context must be bounded further;
7. retain every summary's source handles and an expansion path.

This is a policy for the harness. A model can help propose what is salient, but it should not be allowed to destroy the sole copy.

## Rolling windows and observation masking

A window is a strong baseline because it is deterministic, cheap, and preserves exact recent evidence. The risk is recency bias: early repository structure, constraints, or failed alternatives disappear.

The strongest controlled coding-agent comparison reviewed is The Complexity Trap. On 500 SWE-bench Verified instances per condition with SWE-agent and a 250-turn limit, old-observation masking substantially reduced cost across long-trajectory configurations. Qwen3-Coder-480B masking scored 54.8% at $0.61/instance versus raw 53.4% at $1.29; the paired success difference was not significant, while cost was. [M07, Tables 1, 4; §§3.2, 4.1] A fixed ten-turn masking window was best among the tested settings, but OpenHands required retuning to 58 turns, showing the parameter is scaffold specific. [M07, §5.1; Appendix D.1]

**Default:** mask the content of old tool observations while retaining action/result metadata and a content-addressed handle. Do not mask the latest failure, active diff, approvals, or unresolved verifier output.

## Summarization and recursive summarization

Summaries can provide a global map, but four distinct losses matter:

- **omission:** exact identifier, exception, qualifier, or obligation disappears;
- **mutation:** the summary states an inference as fact;
- **temporal collapse:** old and current state merge;
- **recursive drift:** each generation summarizes a previous lossy generation.

In M07, LLM summary never significantly and consistently outperformed masking across five model configurations. With Gemini-2.5-Flash-thinking, raw/masking/summary solve rates were 40.4%/36.4%/31.4%, and both compactors significantly hurt. [M07, Tables 3–4] Summary calls consumed up to 7.2% of instance cost, and summaries increased mean trajectory length by around 15% for two models. [M07, Figure 4; Table 2; §§4.4, 5.2]

LoCoMo found session-summary retrieval did not significantly improve QA despite high session recall, while observation retrieval improved GPT-3.5-Turbo-16K; the authors attribute the summary result to information loss. [M02, Table 3; §6.1] LongMemEval likewise found replacing raw session/round values with summaries or facts generally hurt. [M01, Figure 5; §5.2]

**Default:** a summary is a navigation index with provenance, never the only durable record. Recursive summaries should carry a change log, unresolved items, and direct source handles; periodically regenerate from raw sources rather than only the prior summary.

## Compaction with handles

Represent an omitted artifact as a typed capsule:

```text
handle: artifact://sha256/...
source_event: evt_...
type: test-output | file-span | web-page | api-result | diff
version/time: ...
status: current | superseded | failed | untrusted
one-line index: ...
size: ...
retrieval keys: [...]
```

The model sees the capsule and can request expansion. The harness checks ACL and version before fetching. This preserves reversibility and lets the event log remain append only.

## Preserving plans, obligations, failures, and verifier feedback

Pin a small typed “control surface” independent of normal compaction:

- goal and acceptance criteria;
- active plan step and completed steps;
- obligations/owners/deadlines;
- assumptions and explicit invalidations;
- side effects pending approval or reconciliation;
- latest test/verifier result and unresolved failure IDs;
- artifact/environment version;
- remaining budget.

ContextWeaver's validation layer records `passed`, `failed`, `unknown`, and `superseded`, skips failed/superseded nodes as future parents, and prepends test status. [M17, §3.3; Appendix A] This is promising but not a direct deterministic-state ablation; the safe implementation is typed harness state, not an LLM-written paragraph.

## Dependency selection versus recency

ContextWeaver compares a five-pair sliding window with a dependency DAG under similar context budgets. With Claude-Sonnet-4 it reported 66.0% versus 63.2% on SWE-bench Verified. On a 100-instance, five-run subset, mean pass@1 was 68.0±1.55 versus 67.2±1.94, a small difference. [M17, Tables 1–2] Its case studies show the boundary: dependency context won 4/5 on a multi-file Django issue, while the window won 4/5 on a localized pytest issue. [M17, §4.3]

**Default:** recency for linear/local tasks; add dependency retrieval when early decisions feed distant actions. Do not force every history into a graph.

## Lost in the middle and distraction

Controlled long-context tests found performance highest when relevant evidence appeared near the beginning or end and lower in the middle, even for long-context models. [M04, Figures 5–7; pp. 157–173] On GSM-IC, adding one verified-irrelevant sentence reduced code-davinci-002 one-shot CoT from 95% clean accuracy to 72.4% micro accuracy and only 6% consistency across variants; 20-sample self-consistency recovered 93.4% micro but only 45% consistency. [M31, Tables 2–3; PDF pp. 3, 6] LongMemEval's ~115K-token histories caused 30.7%–66.3% loss against oracle evidence. [M01, Figure 3b] LoCoMo found that adding more retrieved observations eventually reduced QA and that long-context GPT-3.5 had only 2.1% adversarial-question accuracy in one setting. [M02, Tables 2–3; §6.1]

Implications:

- do not equate a nominal context window with effective access;
- order by decision utility and trust, not chronology alone;
- test evidence at different positions;
- stop retrieval when extra items lower held-out success;
- use smaller budgets for weaker readers.

## Stage-specific views

- **Explore:** map and breadth, hypotheses explicitly marked unverified.
- **Act:** exact local state and source evidence, smallest applicable procedure.
- **Verify:** raw outputs/diffs and acceptance criteria; exclude persuasive but irrelevant rationale.
- **Handoff:** typed state, provenance, owners, and source handles; regenerate prose summary from these records.

A context policy should record which source events were selected, masked, summarized, expanded, and used. Without that trace, a final failure cannot be assigned to retrieval, packing, reading, or action.

## Cost accounting

Report:

- total input/output tokens across every agent and compactor call;
- cache hit/miss tokens;
- number and model of summary/retrieval/controller calls;
- end-to-end latency and critical-path latency;
- per-task dollars under dated prices;
- bytes/records in raw and derived stores;
- successful-task cost, not only average trajectory cost.

A summary may reduce tokens per call while adding a call or encouraging a longer trajectory. M07's trajectory-elongation result demonstrates why only the final prompt size is insufficient. [M07, §4.4]

## Recommended compaction regression suite

For the same tasks and budgets, compare raw history, tuned recent window, observation masking, summary+tail, raw+derived selective retrieval, and oracle evidence. Measure success, partial progress, evidence recall/use/drop, stale evidence, unresolved obligation loss, tokens/calls/latency/dollars, repeated-run reliability, and recovery by expanding handles. Include long trajectories and future tasks not used to tune thresholds.
