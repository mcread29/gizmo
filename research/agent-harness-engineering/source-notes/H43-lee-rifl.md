# [H43] Implementing Linearizability at Large Scale and Low Latency

- **Work ID / topic aliases:** W065 / H43
- **Authors:** Collin Lee, Seo Jin Park, Ankita Kejriwal, Satoshi Matsushita, John Ousterhout
- **Year / venue:** 2015, 25th ACM Symposium on Operating Systems Principles, pp. 71–86
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/2815400.2815416
- **Canonical URL:** <https://doi.org/10.1145/2815400.2815416>
- **Version reviewed / version date:** published SOSP 2015 proceedings paper
- **Published version / supersedes:** published proceedings artifact
- **Correction or retraction status:** not independently verified beyond DOI record on 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** primary paper and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://web.stanford.edu/~ouster/cgi-bin/papers/rifl.pdf>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; Sections 2–5 and failure/reclamation discussion
- **Discovery:** identity check H-20260720-013
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

RIFL is a concrete crash/retry design for exactly-once RPC completion, including duplicate-result persistence and migration/reclamation assumptions.

## Methods and setting

The system assigns unique request IDs, stores completion records atomically with service state, returns prior results for duplicates, and manages record migration/reclamation.

## Findings used in this library

- [HE033](../evidence/HE033.md), supporting [HC026](../claims/HC026.md): retry safety requires stable request identity plus durable completion state coupled to the effect, not only a client retry loop.
- [HE048](../evidence/HE048.md), supporting [HC032](../claims/HC032.md): the “exactly once” result depends on unique IDs, linearizable completion records, atomic coupling, recovery/migration, and safe reclamation.

## Limitations / validity threats

The guarantee covers participating storage-server operations. It does not encompass an email/payment/SaaS effect outside the same atomic authority. Retention and migration add storage, coordination, and garbage-collection cost.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC026](../claims/HC026.md) via [HE033](../evidence/HE033.md); [HC032](../claims/HC032.md) via [HE048](../evidence/HE048.md).
