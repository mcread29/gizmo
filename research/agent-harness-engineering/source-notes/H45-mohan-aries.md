# [H45] ARIES

- **Work ID / topic aliases:** W067 / H45
- **Authors:** C. Mohan, Don Haderle, Bruce Lindsay, Hamid Pirahesh, Peter Schwarz
- **Year / venue:** 1992, ACM Transactions on Database Systems 17(1), pp. 94–162
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/128765.128770
- **Canonical URL:** <https://doi.org/10.1145/128765.128770>
- **Version reviewed / version date:** published ACM TODS article, March 1992
- **Published version / supersedes:** published article titled “ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging”
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** primary paper and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract, Sections 1.1 and 12–13, pp. 94–162
- **Discovery:** identity check H-20260720-015
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

ARIES is foundational evidence for write-ahead logs, idempotent redo, compensation log records, and repeated crash recovery.

## Methods and setting

Database recovery algorithm implemented in multiple systems; analysis/redo repeats history, then undo handles loser transactions.

## Findings used in this library

- [HE047](../evidence/HE047.md), qualifying [HC031](../claims/HC031.md): WAL and page/log sequence numbers make database-local redo auditable and idempotent; compensation records bound repeated recovery.

## Limitations / validity threats

ARIES assumes one recovery subsystem controls both log and data pages. It does not make replay of external API calls safe and does not reconstruct a third party’s changed current state.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC031](../claims/HC031.md), [HE047](../evidence/HE047.md); `distributed-state-and-transactions.md` — “Logs, replay, and reconciliation.”
