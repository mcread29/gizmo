# [H42] The Chubby Lock Service for Loosely-Coupled Distributed Systems

- **Work ID / topic aliases:** W064 / H42
- **Authors:** Mike Burrows
- **Year / venue:** 2006, 7th USENIX Symposium on Operating Systems Design and Implementation, pp. 335–350
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** USENIX OSDI 2006 proceedings record; no DOI assigned by the primary record
- **Canonical URL:** <https://research.google/pubs/the-chubby-lock-service-for-loosely-coupled-distributed-systems/>
- **Version reviewed / version date:** OSDI 2006 proceedings paper
- **Published version / supersedes:** published proceedings artifact
- **Correction or retraction status:** not independently verified; Google Research/USENIX identity checked 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** institution publication page and full primary PDF reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://storage.googleapis.com/gweb-research2023-media/pubtools/4444.pdf>; temporary download SHA-256 `9d7cbad0760cc95d03595eadc188dc828237ba5645bceb7a15b9248ee02821bd`; local artifact not retained
- **Acquisition extent:** full 16-page paper; Sections 2.1, 2.3, 2.4, and 2.6
- **Discovery:** primary-record check H-20260720-020
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

Chubby supplies the canonical stale-writer counterexample and resource-enforced fencing/sequencer design.

## Methods and setting

Operational system paper describing a replicated coarse-grained lock service and observed deployment use.

## Findings used in this library

- [HE042](../evidence/HE042.md), supporting [HC029](../claims/HC029.md): Section 2.4 shows a delayed request from a former lock holder can arrive after a successor acts; the recipient must validate a lock-generation sequencer/acquisition count.
- [HE045](../evidence/HE045.md), supporting [HC030](../claims/HC030.md): Section 2.6 provides generation-number conditional writes that simulate compare-and-swap.

## Limitations / validity threats

Fencing works only when every protected resource/path durably and atomically rejects stale generations. It does not stop an old process, cancel packets, or deduplicate retries carrying the same current token.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC029](../claims/HC029.md) via [HE042](../evidence/HE042.md); [HC030](../claims/HC030.md) via [HE045](../evidence/HE045.md).
