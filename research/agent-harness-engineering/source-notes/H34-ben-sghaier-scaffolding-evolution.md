# [H34] Don’t Blame the Large Language Model: How Scaffolding Evolution Shapes Coding Agent Quality

- **Work ID / topic aliases:** W034 / H34
- **Authors:** Oussama Ben Sghaier, Hao Li, Bram Adams, Ahmed E. Hassan
- **Year / venue:** 2026, arXiv manuscript
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; the manuscript names ACM TOSEM, but no final volume, pages, or DOI were verified as of the cutoff
- **Stable IDs:** arXiv:2607.03691v1
- **Canonical URL:** <https://arxiv.org/abs/2607.03691>
- **Version reviewed / version date:** arXiv:2607.03691v1, submitted 2026-07-04.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2607.03691v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

This is a controlled longitudinal study of harness evolution: the model is fixed while 35 sequential coding-agent scaffold releases are varied. It directly tests whether newer scaffolding monotonically improves effectiveness or efficiency.

## Methods and setting

- Landscape analysis of release and repository activity for Codex, Qwen Code, Gemini CLI, OpenCode, and OpenHands CLI.
- Controlled study of 35 Qwen Code releases from v0.0.10 through v0.10.3.
- Fixed self-hosted Qwen3-Next-80B-A3B-Instruct via vLLM.
- Fifty stratified SWE-bench Verified tasks, two runs per version: 3,500 executions.
- Outcomes: resolve rate, input/output tokens, tool calls, and conversation turns. Patches were judged with the standard SWE-bench Docker harness. [Sections 3.1–3.4]

## Findings used in this library

- Resolve rate had no significant chronological trend: Spearman rho=0.208, p=0.231. The mean was 30.5%, with releases ranging from 23.0% to 39.0%. [Section 5.3, Finding 5; Figures 6–7]
- The first nine releases averaged about 391K tokens per task; the latest releases used about 668K, over 70% more, while resolve rate did not improve. Token use rose significantly with release order (rho=0.743, p<0.0001). [Section 5.3, Finding 6]
- Unresolved tasks averaged 697.7K tokens and 12.95 tool calls, versus 258.7K and 7.2 for resolved tasks. [Section 5.3, Finding 7]
- Initial prompt payload grew about 8%, later releases used 18% more LLM turns, and turns correlated strongly with token consumption (rho=0.941, p<0.0001). [Section 5.3, Finding 8; Figure 9]
- An individual release moved from 216.6K to 329.9K tokens (+52%) with the same 26.0% resolve rate after search-tool and tool-output changes. [Section 5.4]
- Context-management expansion was associated with lower token efficiency after controlling for release churn; large provider-layer transitions were associated with immediate effectiveness regressions. [Sections 7.3.1–7.3.2; Tables 10–11]

## Limitations / validity threats

The controlled study covers one open-source scaffold, one fixed model, 50 of 500 SWE-bench Verified tasks, and only two runs per task. Component-level mapping includes manual judgment, 35 releases limit statistical power, and correlations over releases do not establish causal effects of individual code changes. The broad “hyper-churn” analysis is observational. Resolve rate is binary and omits partial progress. Publication metadata should be rechecked because the reviewed v1 contains TOSEM manuscript markers but no verified final record.

## Quotable passages

> “Chronological iteration of agentic scaffolding releases does not guarantee improved quality.” [End of Section 5, RQ1 summary]

> “A release may therefore be functionally correct while becoming more expensive to operate or less effective at solving tasks.” [Section 8.3]

## Links to claims

- [HC023](../claims/HC023.md) via null observation [HE028](../evidence/HE028.md) and against observation [HE029](../evidence/HE029.md).
- [HC024](../claims/HC024.md) via [HE030](../evidence/HE030.md).
