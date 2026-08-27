# Context construction

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC004](claims/MC004.md) ← [ME004](evidence/ME004.md); [MC005](claims/MC005.md) ← [ME005](evidence/ME005.md); [MC007](claims/MC007.md) ← [ME009](evidence/ME009.md); [MC008](claims/MC008.md) ← [ME010](evidence/ME010.md), [ME011](evidence/ME011.md).
- [MC009](claims/MC009.md) ← [ME012](evidence/ME012.md); [MC010](claims/MC010.md) ← [ME013](evidence/ME013.md), [ME014](evidence/ME014.md); [MC011](claims/MC011.md) ← [ME015](evidence/ME015.md), [ME016](evidence/ME016.md); [MC012](claims/MC012.md) ← [ME017](evidence/ME017.md).
- [MC013](claims/MC013.md) ← [ME018](evidence/ME018.md); [MC014](claims/MC014.md) ← [ME019](evidence/ME019.md); [MC015](claims/MC015.md) ← [ME020](evidence/ME020.md); [MC019](claims/MC019.md) ← [ME024](evidence/ME024.md).

## The retrieval objective

For an agent, retrieval is not “find similar text.” It is to assemble the smallest trustworthy evidence set that lets a specific reader make the next correct decision. The unit of evaluation is therefore:

```text
(task, stage, reader model, harness, tools, evidence set, ordering, budget, evaluator)
```

Retrieval recall without final use can be misleading. ContextBench's GPT-5 coding agents had block F1 below 0.45 and line F1 below 0.35, while usage-drop—gold evidence observed but absent from later use—ranged 0.179–0.435. [M03, Tables 3, 5; RQ2–RQ3]

## Query and task reformulation

Build queries from typed signals rather than a free-form model rewrite alone:

- user goal and current subgoal;
- exact identifiers, entities, symbols, error strings, paths, and API names;
- active plan, obligations, failed checks, and changed assumptions;
- repository commit/tool/environment version;
- requested temporal view: current, historical, transition, or neutral;
- retrieval stage: explore, act, verify, or hand off.

Time-aware expansion is one of the clearest controlled examples. LongMemEval reported average recall gains of 11.3% for round values and 6.8% for session values when GPT-4o extracted a query time range; replacing the extractor with Llama-3.1-8B sometimes reduced recall (raw-round Recall@5 0.421 unfiltered, 0.451 with GPT-4o, 0.384 with Llama). [M01, Table 4; §5.4] Reformulation therefore needs a confidence/fallback path.

## Retrieval channels

### Lexical

Best for exact names, symbols, stack traces, IDs, quoted policy text, and rare tokens. RepoCoder uses lexical Jaccard retrieval—not dense/vector retrieval—and its iterative pipeline increased GPT-3.5-Turbo line exact match from 40.56% to 56.81% and function pass rate from 23.32% to 42.63%. It uses extra retrieval/generation and tests static completion rather than interactive repair. [M05, Tables 2–3; §§3–4; PDF p. 6]

### Dense/vector

Best for paraphrase and semantically related experiences. It should complement lexical retrieval when exact identifiers also matter; the reviewed evidence does not establish it as a universal primary channel.

### Hybrid and multi-key

Use several keys pointing to one raw value: raw text, extracted fact, entities/identifiers, structural path, and time interval. In LongMemEval, fact-only round keys reduced Recall@5 from 0.582 to 0.530, while `raw value + fact` increased it to 0.644; GPT-4o top-5 QA changed 0.615→0.588→0.657 for raw, fact-only, and raw+fact respectively. [M01, Table 3; §5.3] This supports expansion, not replacement.

### Structural and graph

Repository AST/import/call relationships and typed entity/temporal edges are useful when the question itself is relational. ContextWeaver's dependency graph helped cross-file tasks but hurt a localized fix in its paired case study. [M17, §4.3; Appendix C] Mem0's graph variant helped temporal QA but not single-hop or multi-hop QA. [M15, Table 1; §4.1] Make graph traversal an optional channel with bounded depth.

### Tool-mediated

When the environment can answer directly, query it: repository search, database/API reads, test collection, browser DOM/accessibility tree, artifact metadata. Treat the tool result as an event with a stable handle and version—not as trusted instructions.

## Hierarchical and iterative retrieval

Use hierarchy to narrow large stores (task/session → artifact/entity → span/event), then expand exact sources. RAPTOR recursively summarizes and clusters 100-token leaves; under the same UnifiedQA-3B reader and 400-token budget, adding the tree to SBERT changed QuALITY accuracy 54.9→56.6 and QASPER F1 36.23→36.70. About 4% of 150 sampled summary nodes had minor hallucinations, and index-build LLM cost was not matched. [M30, Tables 1–2; PDF pp. 7–8; error analysis]

Iteration is warranted when a tool result changes the entity/subgoal, a test fails, or evidence coverage remains incomplete. IRCoT retrieves after each reasoning sentence. Across three independently sampled prompt sets of 500 test items/dataset, Flan-T5-XXL improved one-shot-retrieval QA F1 by 9.4/15.3/5.0/2.5 points on HotpotQA/2Wiki/MuSiQue/IIRC; GPT-3 had no QA gain on IIRC despite +21.2 retrieval-recall points. [M27, Figures 3–4; §§4–5] FLARE's forward-looking active retrieval raised 2Wiki EM from 39.4 single-retrieval to 51.0, but single retrieval hurt StrategyQA relative to no retrieval (68.6 vs 72.9), and two other tasks had no significant gain. [M28, Tables 1, 3; §6.2]

Iteration is therefore not automatically beneficial: every extra retrieval adds calls and latency. Repoformer's finding that retrieval was helpful on only about one fifth of cases argues for an explicit stop/no-retrieval decision. [M06, Figure 3; §5.1]

A safe loop:

1. retrieve broad candidates with strict ACL/time/version filters;
2. rerank and pack a small evidence set;
3. act or reason;
4. inspect new state/verification result;
5. re-query only on changed information need;
6. stop when required evidence roles are covered or marginal utility is negative.

## Query rewriting

A rewriter can improve web retrieval, but the naive pipeline itself may hurt. With a fixed ChatGPT reader and Bing retriever, HotpotQA exact match was 32.36 without retrieval, 30.47 with retrieve-then-read, 32.80 with frozen ChatGPT rewriting, and 34.38 with a PPO-trained T5 rewriter. On MMLU Social Science, rewriting scored 76.4 versus retrieve-then-read 78.2. [M29, Tables 2, 4; pp. 5309–5310] The Bing index/date was not pinned, and runs/uncertainty were absent. Use task/entity/time fields and preserve the original query; fall back when rewrite confidence is low.

## Reranking, deduplication, diversity, and gates

Reranking features should include:

- topical relevance;
- exact entity/version/time match;
- evidence role coverage (definition, implementation, failure, policy, current state);
- source authority and trust/taint;
- applicability of an episode/workflow/skill;
- novelty relative to already packed evidence;
- stale/conflict status;
- predicted marginal success for this reader.

Deduplicate repeated spans, summaries of the same event, and graph paths that lead to the same raw source. Diversity should cover evidence roles and independent sources, not merely embedding distance.

The gate may return `NO_RETRIEVAL`. Repoformer reported retrieval helpful on ~20%, neutral on >60%, and harmful on ~20% of RepoEval cases. [M06, Figure 3; §5.1] Accuracy-preserving operating points yielded roughly 27–33% online-serving speedup; the main roughly 71% point incurred a small quality loss. [M06, Table 3; Appendix E.3, Table 8] Assay shows the same principle for skills: context that helps one task can hurt another, while global effects cancel. [M18, Figure 3; §3.4]

## Timing and stage-specific context

| Stage        | Prefer                                                                                        | Avoid                                          |
| ------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Exploration  | broad structural map, exact search hits, diverse hypotheses, prior known failures             | verbose full artifacts and premature workflows |
| Action       | current typed state, exact local source/API contract, selected applicable workflow, approvals | speculative reflections and stale variants     |
| Verification | acceptance criteria, diff/side effects, raw test output handles, unresolved failures          | action rationale replacing executable evidence |
| Handoff      | versioned state snapshot, owners/obligations, decisions with provenance, open conflicts       | prose-only transcript dump                     |

ContextBench found agents often encountered relevant evidence but failed to carry it forward. [M03, Table 5] Protected stage slots for plans, obligations, failures, and verifier feedback are therefore more defensible than one uniform top-k.

## Ordering, provenance, and trust labels

1. Keep system policy and tool schemas separate from retrieved data.
2. Place a compact typed state/active plan before evidence.
3. Group evidence by role and source; label current/historical/transition state.
4. Include source ID, timestamp/version, trust/taint, and a raw handle.
5. Put high-value evidence near positions empirically usable by the reader; do not bury it in the middle. [M04]
6. Delimit untrusted content and prohibit it from granting capabilities; enforcement must be outside the prompt. [M22, M23]

## Token allocation is reader specific

LongMemEval found Llama-3.1-8B performance fell sharply beyond roughly 3K retrieved tokens, whereas GPT-4o improved beyond 20K. [M01, §5.2] Calibrate a curve per model and stage. Reserve fixed capacity for instructions/state/plan/failures, then allocate evidence by marginal utility. Report both retrieved tokens and total repeatedly processed input tokens; a small final context can still be expensive if rebuilt on every turn.

## What evidence does not establish

- No reviewed study proves one lexical/dense/hybrid/graph mixture wins across agent domains.
- Retrieval completion gains do not automatically transfer to issue resolution.
- Gold context in ContextBench is sufficient and compact, not globally minimal, and is partly model-mediated. [M03, Appendix D]
- Better recall does not prove evidence use or final success.
- Extra query/retrieval/reranking calls are often not compute matched.
