# [H50] Robust Agent Compensation (RAC): Teaching AI Agents to Compensate

- **Work ID / topic aliases:** W072 / H50
- **Authors:** Srinath Perera, Kaviru Hapuarachchi, Frank Leymann, Rania Khalaf
- **Year / venue:** 2026, ACM Conference on AI and Agentic Systems, pp. 253–262
- **Document type:** experiment
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/3786335.3813141; arXiv:2605.03409v2
- **Canonical URL:** <https://doi.org/10.1145/3786335.3813141>
- **Version reviewed / version date:** published CAIS 2026 proceedings article, 2026-05-26; open arXiv v2 used for text
- **Published version / supersedes:** published proceedings artifact; arXiv relationship recorded
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** proceedings metadata and full open paper reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://arxiv.org/abs/2605.03409v2>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; Sections 3, 5, and 6; Algorithms 1–3 and Tables 1–3
- **Discovery:** DOI check H-20260720-024
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

RAC is direct peer-reviewed evidence on persistent tool-call logs, dependency-aware reverse-order compensation, and compensation failure in agent workflows.

## Methods and setting

RAC is compared with an authors-modified SagaLLM baseline on selected/extended τ²-bench and REALM-Bench tasks, generally with three repetitions per problem.

## Findings used in this library

- [HE040](../evidence/HE040.md), qualifying [HC028](../claims/HC028.md): RAC can invoke mapped compensating tools in dependency-aware reverse order, but unresolved mappings and failed compensators remain failure states.
- [HE053](../evidence/HE053.md), qualifying [HC034](../claims/HC034.md): direct agent evidence is bounded and non-monotonic; the dynamic Grand Rollback case succeeded 2/3 in one setting and 0/3 with the high-reasoning model.

## Limitations / validity threats

Three repetitions, selected tasks, modified baseline, and framework-provided/inferred compensators. Compensation is not restoration proof; current behavior can assume no side effect when no compensator is found and reports an error when compensation fails.

## Conflicts and lifecycle

No numerical extraction dispute recorded. Recheck by 2026-10-20 or on a correction.

## Links to synthesis claims

- [HC028](../claims/HC028.md) via [HE040](../evidence/HE040.md); [HC034](../claims/HC034.md) via [HE053](../evidence/HE053.md).
