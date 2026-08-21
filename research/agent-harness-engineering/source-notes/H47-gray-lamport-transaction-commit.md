# [H47] Consensus on Transaction Commit

- **Work ID / topic aliases:** W069 / H47
- **Authors:** Jim Gray, Leslie Lamport
- **Year / venue:** 2006, ACM Transactions on Database Systems 31(1), pp. 133–160
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/1132863.1132867; arXiv:cs/0408036
- **Canonical URL:** <https://doi.org/10.1145/1132863.1132867>
- **Version reviewed / version date:** published ACM TODS article, March 2006
- **Published version / supersedes:** published article; earlier MSR-TR-2003-96/arXiv version recorded
- **Correction or retraction status:** Crossmark-linked record and author page checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** author page, primary paper, and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://lamport.azurewebsites.net/video/consensus-on-transaction-commit.pdf>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; Sections 2, 3.3, 4.3, 5, and 6.4
- **Discovery:** title/DOI check H-20260720-017
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It precisely states the 2PC uncertainty/blocking boundary and the replication/availability cost of non-blocking Paxos Commit.

## Methods and setting

Formal protocol comparison under crash failures, non-corrupt messages, stable storage, and explicit progress assumptions.

## Findings used in this library

- [HE037](../evidence/HE037.md), supporting [HC027](../claims/HC027.md): Section 3.3 shows participants prepared under 2PC cannot determine commit/abort after coordinator failure; Paxos Commit adds `2F+1` acceptors and progresses with `F+1`, at more-message cost.

## Limitations / validity threats

“Non-blocking” is conditional on a working majority/timeliness assumptions and does not cover Byzantine APIs, semantic errors, or irreversible actions. A transaction manager can coordinate only enlisted participants.

## Conflicts and lifecycle

An initially tried neighboring DOI resolved to an unrelated paper; H-20260720-017 established the correct DOI above.

## Links to synthesis claims

- [HC027](../claims/HC027.md), [HE037](../evidence/HE037.md); `distributed-state-and-transactions.md` — “Atomicity boundaries.”
