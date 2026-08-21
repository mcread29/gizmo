# [H04] Agentless

- **Work ID / topic aliases:** W004 / H04
- **Authors:** Chunqiu Steven Xia, Yinlin Deng, Soren Dunn, Lingming Zhang
- **Year / venue:** 2025, FSE / Proceedings of the ACM on Software Engineering; reviewed text was arXiv v2
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.1145/3715754; arXiv:2407.01489v2
- **Canonical URL:** <https://doi.org/10.1145/3715754>
- **Version reviewed / version date:** arXiv:2407.01489v2 for extracted text; publication record DOI 10.1145/3715754 cross-checked.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI; publication DOI/status cross-checked
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2407.01489v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI; publication DOI/status cross-checked Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

A fixed three-stage pipeline—hierarchical localization, candidate repair, and patch validation—evaluated primarily on 300 SWE-bench Lite tasks using GPT-4o. It deliberately removes open-ended LLM control over tools and next actions.

## Findings used in this library

- Agentless resolved 96/300 SWE-bench Lite tasks (32.0%) at a reported average API cost of $0.70, outperforming the open-source systems compared at that time (Abstract; Table 1; Section 5.1).
- On SWE-bench Verified it reported 194/500 (38.8%) with GPT-4o (Table 6).
- Hierarchical, compressed localization beat supplying complete files in the reported ablation; combining prompting and embeddings located the ground-truth file for 81.67% of Lite tasks (Table 2).
- Reproduction-test filtering increased reported fixes from 81 to 96, but only 94 of 213 tests that reproduced the original issue also recognized the developer patch as resolved (Sections 5.1.3 and 5.2.3). This is evidence both for executable feedback and for oracle weakness.
- Manual audit found 10.0% of Lite issues lacked enough information, 4.3% included the exact patch, and 5.0% contained misleading solution information (Section 6.1).

## Limitations / validity threats

Comparisons combine different systems, models, and disclosure levels. Costs are historical API prices. Candidate sampling (40 patches and 40 reproduction-test samples per issue) is substantial inference-time compute. The authors explicitly flag possible GPT-4o training-data leakage and limited external validity (Section 7).

## Links to claims

- [HC005](../claims/HC005.md) via [HE008](../evidence/HE008.md).
- [HC008](../claims/HC008.md) via [HE011](../evidence/HE011.md).
