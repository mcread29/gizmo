# [H37] Leases: An Efficient Fault-Tolerant Mechanism for Distributed File Cache Consistency

- **Work ID / topic aliases:** W059 / H37
- **Authors:** Cary G. Gray, David R. Cheriton
- **Year / venue:** 1989, Twelfth ACM Symposium on Operating Systems Principles, pp. 202–210
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/74850.74870
- **Canonical URL:** <https://doi.org/10.1145/74850.74870>
- **Version reviewed / version date:** published SOSP 1989 proceedings paper
- **Published version / supersedes:** published proceedings artifact; supersedes relationship none identified
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; correction/retraction status not otherwise verified
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full primary PDF and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://pdos.csail.mit.edu/6.824/papers/lease.pdf>; local artifact not retained; SHA-256 not retained in the corpus
- **Acquisition extent:** full paper; Sections 2, 3.1, and 5
- **Discovery:** named-source check H-20260720-006; identity check H-20260720-011
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

This is the original leases paper and makes timing and availability assumptions explicit.

## Methods and setting

The paper analyzes time-limited cache write authority, renewal traffic, failure recovery, partitions, and clock uncertainty in a server-mediated file-cache protocol.

## Findings used in this library

- [HE041](../evidence/HE041.md), qualifying [HC029](../claims/HC029.md): Sections 2 and 3.1 show that leases bound authority only under message-delay/clock-drift treatment; unreachable clients can delay writes until expiry.
- Shorter leases reduce recovery delay but increase renewal traffic; clock failures can threaten overlapping authority (Section 5).

## Limitations / validity threats

The protected server participates in the lease protocol. A lease record alone does not stop an expired process from writing through an external path that does not validate its epoch.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC029](../claims/HC029.md), [HE041](../evidence/HE041.md); `distributed-state-and-transactions.md` — “Leases and fencing.”
