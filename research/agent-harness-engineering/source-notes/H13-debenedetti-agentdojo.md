# [H13] AgentDojo

- **Work ID / topic aliases:** W013 / H13, M22
- **Authors:** Edoardo Debenedetti, Jie Zhang, Mislav Balunovic, Luca Beurer-Kellner, Marc Fischer, Florian Tramèr
- **Year / venue:** NeurIPS 2024; reviewed text was arXiv v3
- **Document type:** benchmark
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.52202/079017-2636; arXiv:2406.13352v3; data DOI 10.5281/zenodo.12528188
- **Canonical URL:** <https://doi.org/10.52202/079017-2636>
- **Version reviewed / version date:** arXiv:2406.13352v3.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** full arXiv HTML scraped with Crawl4AI
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/html/2406.13352v3>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** full arXiv HTML scraped with Crawl4AI Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

A stateful benchmark with four simulated application environments, 97 user tasks, 70–74 tools (counts vary between paper passages), 27 injection targets, and 629 security cases. Utility and attacker success are checked against environment state by deterministic functions.

## Findings used in this library

- Baseline agents were weak even without attacks; the paper reports no model above roughly 78% benign utility in its full tables (Section 4; Table 3).
- Prompt injection effectiveness depended heavily on attack formulation and position. Against GPT-4o, the “important message” attack's targeted ASR was 57.69%, while several simpler attacks were near 4–6%; selecting the best tested attack increased untargeted success (Table 4; Appendix D).
- A tool-filter defense reduced GPT-4o targeted ASR to 6.84% while benign utility was 73.13%, but failed where benign and malicious goals needed the same tools or tools could not be selected in advance (Section 4.3; Table 5).
- A detector reduced attacks but also reduced benign utility to 41.49% because of false positives (Table 5).

## Limitations / validity threats

The environments and data are synthetic, attack/defense sets are necessarily incomplete, and the authors explicitly warn that robustness evaluation requires adaptive attacks rather than only benchmark defaults. Tool filtering is not a general solution: 17% of test cases exposed enough overlap for attack and legitimate task capabilities.

## Links to claims

- [HC010](../claims/HC010.md) via [HE013](../evidence/HE013.md).
- [HC011](../claims/HC011.md) via [HE014](../evidence/HE014.md).
- [HC012](../claims/HC012.md) via [HE015](../evidence/HE015.md).
