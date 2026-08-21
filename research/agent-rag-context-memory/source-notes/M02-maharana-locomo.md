# [M02] Evaluating Very Long-Term Conversational Memory of LLM Agents (LoCoMo)

- **Work ID / topic aliases:** W035 / M02
- **Authors:** Adyasha Maharana, Dong-Ho Lee, Sergey Tulyakov, Mohit Bansal, Francesco Barbieri, Yuwei Fang
- **Year / venue:** 2024, ACL 2024
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2024.acl-long.747; arXiv:2402.17753v1
- **Canonical URL:** <https://aclanthology.org/2024.acl-long.747/>
- **Version reviewed / version date:** ACL paper / arXiv v1
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML and ACL metadata inspected
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2024.acl-long.747/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

A widely reused benchmark comparing truncated context, long context, and RAG over raw dialogue, extracted observations, and session summaries.

## Methods and setting

50 LLM-generated, human-edited conversations averaging 304.9 turns, 19.3 sessions, and 9,209 tokens. 7,512 QA pairs: 2,705 single-hop, 1,104 multi-hop, 1,547 temporal, 285 open-domain, 1,871 adversarial. Annotators edited ~15% of turns. One inference run/condition. [Table 5; §§3–5]

## Findings used in this library

- Human overall F1 87.9; GPT-4-Turbo with 4K truncation 32.1. [Table 2]
- GPT-3.5-16K rose from 24.1 overall at 4K to 37.8 at 16K, but adversarial F1 fell from 13.1 to 2.1. [Table 2; §6.1]
- Observation-level RAG top-5 reached 41.4 overall versus 31.7 for top-5 raw dialogue; top-50 observations fell to 37.8. [Table 3; §6.1]
- Session-summary RAG reached ~32.5 despite high session recall; authors attribute this to compression loss. [Table 3]
- Incremental event summarization helped some metrics, but long-context GPT-3.5-16K had lower factual precision/recall than 4K GPT-3.5. [Table 4; §6.2]

## Limitations / validity threats

Mostly synthetic conversations, short by newer long-memory standards, only 50 conversations, and one run. Exact-match/F1 penalize paraphrases and do not measure live write/update correctness. No dollar/storage cost.

## Exact claim/evidence links

- [MC006](../claims/MC006.md) ↔ [ME007](../evidence/ME007.md) — `synthesis.md §Strongest conclusions 2`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
