# [H19] CodePlan

- **Work ID / topic aliases:** W019 / H19
- **Authors:** Ramakrishna Bairi et al.
- **Year / venue:** FSE 2024
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.1145/3643757
- **Canonical URL:** <https://doi.org/10.1145/3643757>
- **Version reviewed / version date:** Published FSE 2024 paper (DOI 10.1145/3643757); exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper PDF reviewed by the coding-context research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://doi.org/10.1145/3643757>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper PDF reviewed by the coding-context research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

Dependency-aware online planning with GPT-4-32k on C# package migrations and Python temporal edits spanning 2–97 files, across seven repositories.

## Findings used in this library

CodePlan passed repository validity checks on 5/7 repositories, while same-context baselines without dependency-aware planning passed 0/7. Checks included build/type checks and task-specific correct-edit criteria. [PDF pp. 14, 19, 23; Tables 2–4]

## Limitations / validity threats

Only seven repositories, two proprietary, with manual preprocessing. The evidence supports explicit dependency-chain tasks; it should not be generalized to ordinary bug repair or all forms of up-front planning.

## Links to claims

- [HC017](../claims/HC017.md) via [HE021](../evidence/HE021.md).
