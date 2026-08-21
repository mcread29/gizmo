# Context and tool-interface engineering

## Context is a selection policy, not a window size

A harness continuously chooses what evidence to surface, at what granularity, in what order, and for how long. ContextBench's same-model comparison found that elaborate retrieval scaffolds did not consistently outperform a basic mini-SWE-agent shell workflow. With GPT-5, the five agents' Pass@1 ranged from 0.452 to 0.512, while retrieval precision/recall varied substantially; no architecture simply dominated. ([HC003](claims/HC003.md)) [H05, Table 2]

The paper also reports an evidence-consolidation problem. Agents often inspected gold-relevant regions but failed to include them in final patch context; usage drop ranged from 0.179 to 0.435 across four model pairings. ([HC004](claims/HC004.md)) This suggests separating:

1. **exploration state** — everything inspected;
2. **working set** — evidence currently relevant to the decision;
3. **authoritative artifacts** — full logs/files/checkpoints stored outside the prompt;
4. **decision record** — evidence actually used, with provenance.

[H05, Table 5 and Appendix H]

The same raw-versus-derived distinction matters when improving the harness. In Meta-Harness's classification ablation, a proposer with raw execution traces reached 50.0 median and 56.7 best search accuracy, versus 34.9/38.7 when given scores plus generated summaries. Preserve queryable full traces; use summaries as indexes, not replacements. ([HC021](claims/HC021.md)) [H33, Table 3]

## Retrieval patterns

- **Hierarchical narrowing:** repository tree → file skeleton → definitions → exact lines. Agentless's ablation found its compressed skeleton more accurate and cheaper than complete file content for related-element localization. [H04, Table 2]
- **Iterative search:** alternate search and inspection as hypotheses change. RepoCoder's two retrieval/generation iterations raised GPT-3.5 Turbo line-completion exact match from 40.56% to 56.81% and function-completion pass rate from 23.32% to 42.63%. This is completion evidence, not issue-repair evidence. [H17, Tables 2–3]
- **Selective retrieval:** Repoformer found cross-file retrieval helpful on roughly 20% of API-completion cases, neutral on over 60%, and harmful on roughly 20%. Accuracy-preserving selective-retrieval settings yielded roughly 27–33% serving speedups; the approximately 70% point incurred a small quality loss. Retrieval should be a decision, not an invariant step. ([HC015](claims/HC015.md)) [H18, Tables 2, 3, and 8]
- **Structural retrieval:** definitions, references, call graphs, ASTs, and parallel-module structure. AutoCodeRover demonstrates a bundled peer-reviewed system that uses AST-aware semantic APIs; it does not isolate their causal benefit. ContextBench separately documents cases where keyword search created “context tunneling.” [H20; H05, Appendix I]
- **Compaction with handles:** keep concise summaries in context and full artifacts in external storage. Every summary should link to immutable source ranges.

Compression is stage-specific. With oracle localization, [H22] found that full source answered 27/45 behavioral probes while two generated-summary conditions each answered 4/45. Yet retaining likely edited units verbatim while dropping other implementations resolved 25/70 tasks with 6,876 mean tokens, versus 19/70 with 25,426 tokens for whole changed files. This supports aggressive pruning around the edit site, not replacing the edit-site source with prose. ([HC016](claims/HC016.md)) On SWE-bench Verified, a separate preprint reports 23.1% and 38.3% token reductions across two configurations, with success increasing by 1.4 and 1.2 percentage points; its SWE-QA results are reported separately in Table 2. [H21, Tables 1–2; H22, Tables 2–4]

A practical context budget should reserve space for the task contract, current state, tool schemas, relevant evidence, and recent verifier feedback. Raw history should not consume the budget by default.

## Tool design

A tool is not merely a function the model can call; it defines the effective action and observation spaces.

Good tool surfaces are:

- **typed:** explicit schemas, enums, bounds, and structured errors;
- **small and orthogonal:** avoid many overlapping tools with ambiguous routing;
- **legible:** concise descriptions and bounded outputs;
- **least-privileged:** read, sandboxed write, network, secrets, and production actions are separate capabilities;
- **observable:** every call records arguments, result, duration, cost, policy decision, and artifact IDs;
- **reversible/idempotent where feasible:** support dry-run, snapshots, and deduplication;
- **trust-aware:** mark whether returned content is system data, user input, or untrusted third-party text.

SWE-agent's central contribution was to show that an intentionally designed agent–computer interface changes fixed-model performance. ([HC002](claims/HC002.md)) [H03] AgentDojo shows the security side: if untrusted tool output shares the model's instruction channel, the harness must not rely on delimiters or prompt obedience alone. Restricting the available tools before untrusted data was observed reduced targeted attack success markedly in its experiments. [H13, Section 4.3]

## Executable feedback

For coding, run cheap-to-expensive checks:

1. patch/schema parse and changed-file policy;
2. formatter/linter/type/static checks;
3. focused reproduction tests;
4. affected-module tests;
5. regression, security, and integration checks;
6. human review for semantic, product, or high-risk concerns.

Generated tests are hypotheses, not ground truth. Agentless generated 213 tests that reproduced original behavior, but only 94 recognized the developer patch as fixing it. Store test provenance and avoid letting a candidate patch and its only judge share an unchecked failure mode. ([HC008](claims/HC008.md)) [H04, Section 5.1.3]
