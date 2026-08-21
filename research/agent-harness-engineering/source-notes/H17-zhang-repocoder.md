# [H17] RepoCoder

- **Work ID / topic aliases:** W017 / H17, M05
- **Authors:** Fengji Zhang et al.
- **Year / venue:** EMNLP 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.18653/v1/2023.emnlp-main.151
- **Canonical URL:** <https://aclanthology.org/2023.emnlp-main.151/>
- **Version reviewed / version date:** Published EMNLP 2023 paper; exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** ACL Anthology primary page scraped with Crawl4AI; PDF tables reviewed by the coding-context research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://aclanthology.org/2023.emnlp-main.151/>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** ACL Anthology primary page scraped with Crawl4AI; PDF tables reviewed by the coding-context research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

Iterative similarity retrieval and generation for repository-level line, API, and function-body completion on RepoEval. This is completion, not interactive issue repair.

## Findings used in this library

Across reported settings, iterative retrieval improved over in-file completion by more than 10 absolute exact-match points and eight edit-similarity points. GPT-3.5 Turbo line-completion exact match rose from 40.56% in-file to 56.81% after two iterations; function-completion pass rate rose from 23.32% to 42.63%. [PDF p. 6, Tables 2–3]

## Limitations / validity threats

The task, metrics, and static retrieval setting differ from long-horizon SWE-bench agents. Gains do not establish that adding the same retrieval loop helps issue resolution.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
