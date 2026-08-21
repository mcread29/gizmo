# [H38] In Search of an Understandable Consensus Algorithm

- **Work ID / topic aliases:** W060 / H38
- **Authors:** Diego Ongaro, John Ousterhout
- **Year / venue:** 2014, USENIX Annual Technical Conference, pp. 305–319
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** USENIX record:184040; ISBN:978-1-931971-10-2
- **Canonical URL:** <https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro>
- **Version reviewed / version date:** USENIX ATC 2014 proceedings paper
- **Published version / supersedes:** published proceedings artifact; later dissertation treatment not substituted
- **Correction or retraction status:** not independently verified; USENIX record checked 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** proceedings page and paper reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://www.usenix.org/system/files/conference/atc14/atc14-paper-ongaro.pdf>; temporary download SHA-256 `e6345fcba31cbc747ab41755aa62654859c4403dbb687da0021079f78181a7b5`; local artifact not retained
- **Acquisition extent:** full proceedings paper; Sections 2, 5, and 8 of the extended treatment used for retry/read caveats
- **Discovery:** seed source; primary-record check H-20260720-018
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

Raft establishes the replicated-log and quorum assumptions behind one authoritative coordination history.

## Methods and setting

The protocol separates leader election, log replication, safety, and membership change under non-Byzantine crash/network faults. Safety does not depend on timing; availability requires a communicating majority.

## Findings used in this library

- [HE046](../evidence/HE046.md), supporting [HC031](../claims/HC031.md): committed commands form a replicated log; stale terms and majority rules protect the log, while client retry deduplication is additionally required for linearizable state-machine behavior.
- A five-node cluster needs three communicating members to progress. Consensus over the log does not itself fence an external tool that ignores the term/epoch.

## Limitations / validity threats

Crash faults, not Byzantine behavior; liveness depends on timing/majority availability. Deterministic log replay does not make arbitrary live external I/O deterministic or safe to repeat.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC031](../claims/HC031.md), [HE046](../evidence/HE046.md); `distributed-state-and-transactions.md` — “Logs, replay, and reconciliation.”
