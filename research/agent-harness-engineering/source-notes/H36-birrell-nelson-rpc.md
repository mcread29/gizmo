# [H36] Implementing Remote Procedure Calls

- **Work ID / topic aliases:** W058 / H36
- **Authors:** Andrew D. Birrell, Bruce Jay Nelson
- **Year / venue:** 1984, ACM Transactions on Computer Systems 2(1), pp. 39–59
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/2080.357392
- **Canonical URL:** <https://doi.org/10.1145/2080.357392>
- **Version reviewed / version date:** published ACM TOCS paper, February 1984
- **Published version / supersedes:** published article; Xerox CSL-83-7 is the reviewed report copy
- **Correction or retraction status:** Crossmark-linked publisher record checked 2026-07-20; no correction status independently established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full primary report scan and Crossref/DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://bitsavers.org/pdf/xerox/parc/techReports/CSL-83-7_Implementing_Remote_Procedure_Calls.pdf>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full article/report; TOCS pp. 49–51
- **Discovery:** named-source check H-20260720-005; identity check H-20260720-010
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It gives a concrete at-most-once RPC implementation and states the information available after success versus exception.

## Methods and setting

Xerox Cedar RPC uses retransmission, call identifiers, caller incarnation/process identity, sequence numbers, and server-side duplicate state.

## Findings used in this library

- [HE031](../evidence/HE031.md), supporting [HC025](../claims/HC025.md): Section 3 states that return implies precisely one server invocation, while an exception means the procedure was invoked once or not at all and does not tell the caller which.
- Retransmitted calls are rejected using identifiers; correctness depends on non-reused caller incarnation/sequence numbers and retaining duplicate state long enough (TOCS pp. 50–51).

## Limitations / validity threats

This is at-most-once procedure invocation, not guaranteed completion or exactly-once downstream business effect. Identifier reuse or premature duplicate-state deletion violates the assumptions.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source; recheck on correction notice.

## Links to synthesis claims

- [HC025](../claims/HC025.md), [HE031](../evidence/HE031.md); `distributed-state-and-transactions.md` — “Ambiguous outcomes.”
