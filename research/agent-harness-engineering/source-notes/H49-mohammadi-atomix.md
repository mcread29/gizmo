# [H49] Atomix: Timely, Transactional Tool Use for Reliable Agentic Workflows

- **Work ID / topic aliases:** W071 / H49
- **Authors:** Bardia Mohammadi, Nearchos Potamitis, Lars Klein, Akhil Arora, Laurent Bindschaedler
- **Year / venue:** 2026, arXiv preprint
- **Document type:** experiment
- **Publication status:** preprint
- **Stable IDs:** arXiv:2602.14849v2; DOI:10.48550/arXiv.2602.14849
- **Canonical URL:** <https://arxiv.org/abs/2602.14849v2>
- **Version reviewed / version date:** arXiv:2602.14849v2, 2026-05-29
- **Published version / supersedes:** supersedes arXiv v1; no archival venue verified
- **Correction or retraction status:** arXiv history checked 2026-07-20; no withdrawal/correction identified
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full primary paper, arXiv record, and artifact metadata reviewed
- **Artifact URI / SHA-256:** paper URI <https://arxiv.org/pdf/2602.14849v2>; local paper hash not computed; artifact commit <https://github.com/mpi-dsg/atomix/commit/61e411be662bb021634f0e84bc184bf6074905b4>
- **Acquisition extent:** full paper; Sections 2.3–2.5, 3.1–3.5, and 4
- **Discovery:** exact-version check H-20260720-023
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

Atomix is the closest direct LLM-agent experiment in this update: it injects post-effect/pre-return failure, duplicate delivery, timeout, stale races, compensation failure, and irreversible-effect ambiguity.

## Methods and setting

Authors' transactional runtime over representative agent workloads, including τ-bench retail and WebArena/OSWorld adapters plus controlled contention/speculation/irreversible-send workloads. Failure classes F1–F5 include post-effect/pre-return and duplicate delivery.

## Findings used in this library

- [HE051](../evidence/HE051.md), supporting [HC033](../claims/HC033.md): injected cut points and residue classifications demonstrate an agent-specific protocol for testing ambiguous side effects.
- [HE052](../evidence/HE052.md), supporting [HC034](../claims/HC034.md): the runtime records read/effect sets, delays settlement, compensates reversible effects, and explicitly classifies heterogeneous irreversible partial commit rather than claiming rollback.

## Limitations / validity threats

Preprint and authors' own runtime; single-process prototype; correct scope/effect classification/idempotency/compensator adapters are trusted. It does not establish distributed crash-safe exactly once or atomic release across heterogeneous irreversible endpoints.

## Conflicts and lifecycle

Generated results were not retained in the cited repository commit according to the reviewed artifact notes. Recheck by 2026-10-20.

## Links to synthesis claims

- [HC033](../claims/HC033.md) via [HE051](../evidence/HE051.md); [HC034](../claims/HC034.md) via [HE052](../evidence/HE052.md).
