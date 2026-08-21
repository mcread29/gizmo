# [M23] Defeating Prompt Injections by Design (CaMeL)

- **Work ID / topic aliases:** W027 / H27, M23
- **Authors:** Edoardo Debenedetti, Ilia Shumailov, Tianqi Fan, Jamie Hayes, Nicholas Carlini, Daniel Fabian, Christoph Kern, Chongyang Shi, Andreas Terzis, Florian Tramèr
- **Year / venue:** 2025, arXiv
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** preprint; no proceedings publication independently verified
- **Stable IDs:** arXiv:2503.18813v2
- **Canonical URL:** <https://arxiv.org/abs/2503.18813>
- **Version reviewed / version date:** v2
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by safety research threads
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://arxiv.org/abs/2503.18813v2>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** methods and the tables/figures/sections named below were reviewed; exact contiguous page range and complete local artifact extent were not retained
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence
- **Reviewers:** extractor / second reviewer unknown/not retained.

## Why it matters

Architecture-level separation of trusted control and untrusted data with source tracking and capability enforcement.

## Methods and setting

Privileged planner sees trusted user query, quarantined parser sees untrusted data, custom interpreter tracks dependencies and enforces capabilities at tool sinks. Updated evaluation uses 949 AgentDojo attacks across several model families. [architecture §§3–4; evaluation §6]

## Findings used in this library

- Native GPT-4o-mini was vulnerable in 276 cases while the tested CaMeL configuration had zero successful attacks; Claude utility was approximately 90.72→63.92%. [§6]
- Gemini-2.5-Pro successful attacks changed 163→0; Flash 297→1; Claude-3.5-Sonnet full CaMeL had zero versus 44 undefended. [§6.2; Appendix Tables 4,7]
- Median input/output tokens were 2.73×/2.82× native tool calling. [§6.1.3]

## Limitations / validity threats

Zero is only for tested attacks/policies. Delegated control-flow tasks, policy completeness, exceptions/timing/resource side channels, and user-visible misinformation remain. Utility/cost is substantial; preprint status.

## Exact claim/evidence links

- [MC042](../claims/MC042.md) ↔ [ME050](../evidence/ME050.md) — `synthesis.md §Strongest conclusions 8`
- [MC042](../claims/MC042.md) ↔ [ME051](../evidence/ME051.md) — `synthesis.md §Strongest conclusions 8`

The linked claim record is authoritative for all additional synthesis locations and confidence history. No unlisted numerical claim is implied by this backlink.
