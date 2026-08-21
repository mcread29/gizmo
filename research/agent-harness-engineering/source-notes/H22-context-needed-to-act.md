# [H22] What Context Does a Coding Agent Actually Need to Act?

- **Work ID / topic aliases:** W022 / H22
- **Authors:** Brian Sam-Bodden
- **Year / venue:** 2026, arXiv v1
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint
- **Stable IDs:** arXiv:2607.09691v1
- **Canonical URL:** <https://arxiv.org/abs/2607.09691>
- **Version reviewed / version date:** arXiv:2607.09691v1.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper PDF reviewed by the coding-context research thread; arXiv v1 metadata/abstract page scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2607.09691v1>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper PDF reviewed by the coding-context research thread; arXiv v1 metadata/abstract page scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

Oracle-localized, single-shot patch generation on 70 multi-file SWE-bench Verified tasks plus 45 behavioral probes. Compares full source, structured context, signatures/docstrings, and generated summaries.

## Findings used in this library

Full source answered 27/45 behavioral questions; Sonnet 4.6 and Qwen-3B summaries each answered 4/45; signatures/docstrings answered 6/45. On repair, keeping edited units and dropping other implementations resolved 25/70 with 6,876 mean context tokens, versus 19/70 with 25,426 tokens for whole changed files. Structured tiers resolved 23/70 and did not significantly beat simple keep/drop (exact McNemar p=0.754). An identical temperature-0 rerun flipped 6/70 task outcomes. [Tables 1–4, PDF pp. 3–6]

## Limitations / validity threats

Oracle localization removes exploration, so this is evidence about the act/edit stage only. The 70-task sample and six outcome flips counsel against treating small score deltas as robust.

## Links to claims

- [HC016](../claims/HC016.md) via [HE020](../evidence/HE020.md).
- [HC018](../claims/HC018.md) via [HE022](../evidence/HE022.md).
