# [H09] ReAct: Synergizing Reasoning and Acting in Language Models

- **Work ID / topic aliases:** W009 / H09
- **Authors:** Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao
- **Year / venue:** 2023, ICLR 2023
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** arXiv:2210.03629v3
- **Canonical URL:** <https://openreview.net/forum?id=WE_vluYUL-X>
- **Version reviewed / version date:** arXiv:2210.03629v3 metadata and abstract only; full-text artifact not acquired in this thread.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** arXiv abstract page scraped with Crawl4AI; arXiv HTML conversion unavailable and OpenReview was blocked by browser verification
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2210.03629v3>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** arXiv abstract page scraped with Crawl4AI; arXiv HTML conversion unavailable and OpenReview was blocked by browser verification Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** background.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Why it matters

ReAct is the canonical formulation of interleaving model-generated reasoning with environment actions and feeding observations back into later decisions.

## Methods and setting

The paper evaluates interleaved reasoning/action trajectories on HotpotQA, FEVER, ALFWorld, and WebShop using few-shot prompting and external environment or Wikipedia interactions.

## Findings used in this library

Only the architectural pattern is used: observe–reason–act loops let fresh environment feedback update subsequent planning. The abstract reports absolute success-rate improvements of 34% on ALFWorld and 10% on WebShop over the paper's imitation/reinforcement-learning comparisons, but this synthesis does not treat those historical numbers as a general harness effect.

## Limitations / validity threats

The reviewed acquisition was the primary metadata/abstract page rather than full paper text. Models, prompts, baselines, and environments are from the 2022–2023 generation. ReAct establishes a control pattern, not the modern safety, state, recovery, or permission layers needed in production harnesses.

## Quotable passages

No exact quotation is used in the synthesis.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
