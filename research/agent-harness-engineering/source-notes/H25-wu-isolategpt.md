# [H25] IsolateGPT

- **Work ID / topic aliases:** W025 / H25
- **Authors:** Yuhao Wu, Franziska Roesner, Tadayoshi Kohno, Ning Zhang, Umar Iqbal
- **Year / venue:** NDSS 2025
- **Document type:** unknown — document type was not separately classified in retained metadata.
- **Publication status:** peer reviewed
- **Stable IDs:** DOI 10.14722/ndss.2025.241131; arXiv:2403.04960
- **Canonical URL:** <https://doi.org/10.14722/ndss.2025.241131>
- **Version reviewed / version date:** Published NDSS 2025 paper; exact PDF artifact version/hash not retained.
- **Published version / supersedes:** Published-artifact status is recorded in Publication status and Version reviewed; supersedes relationship unknown/not retained.
- **Correction or retraction status:** not independently verified — no retained correction/retraction check.
- **Accessed / last verified:** Accessed 2026-07-20; last verified not separately retained.
- **Acquisition:** primary paper reviewed by the safety research thread
- **Artifact URI / SHA-256:** Reviewed/acquisition URI: <https://doi.org/10.14722/ndss.2025.241131>; local artifact URI not retained; SHA-256 not computed.
- **Acquisition extent:** primary paper reviewed by the safety research thread Exact available pages/sections beyond those named below are unknown/not retained.
- **Discovery:** unknown — original database/query, citation-chain parent, or discovery source was not retained.
- **Use status:** core evidence.
- **Reviewers:** extractor identity and second reviewer not retained unless explicitly stated below.

## Methods and setting

The acquisition record did not retain a fuller study-design extraction for this note. Exact sample, model/harness version, runs/seeds, budgets, evaluator version, and holdouts are unknown/not retained except where stated in the findings below.

## Findings used in this library

Isolates applications in processes, mediates cross-app communication, restricts network access, and requests permission for data transfer or irreversible actions. On 1,598 extended InjecAgent attacks, the shared baseline had 20.2% mean attack success; IsolateGPT surfaced permission dialogs for 7.6% of cases. It matched the baseline on four functionality benchmarks. For 75.73% of queries latency overhead was below 30%; sampled cost was 1.85×. [§§5,7; Table 1]

## Limitations / validity threats

Security interpretation assumes users reject warned malicious flows; no user study tested comprehension, fatigue, or approval errors. The permission model was preliminary.

## Links to claims

- No HC/HE evidence-table record currently links this source. Its use is contextual or confined to focused narrative sections; this is not an absence claim.
