# [H48] Life beyond Distributed Transactions: an Apostate's Opinion

- **Work ID / topic aliases:** W070 / H48
- **Authors:** Pat Helland
- **Year / venue:** 2007, 3rd Biennial Conference on Innovative Data Systems Research, pp. 132–141; reprinted in ACM Queue 14(5), 2016
- **Document type:** position paper
- **Publication status:** practitioner source
- **Stable IDs:** DOI:10.1145/3012426.3025012 for the 2016 Queue reprint; original CIDR paper has no DOI
- **Canonical URL:** <https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf>
- **Version reviewed / version date:** original CIDR 2007 position paper
- **Published version / supersedes:** later ACM Queue reprint recorded; original extraction remains CIDR pages 132–141
- **Correction or retraction status:** not independently verified; CIDR and later DOI identities checked 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** official CIDR primary PDF reviewed
- **Artifact URI / SHA-256:** canonical CIDR PDF URI above; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; pp. 133–140
- **Discovery:** primary-record check H-20260720-022
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It describes the acknowledgement/update gap, transactionally recorded send intent, at-least-once delivery, and application-level duplicate handling when transaction scopes are disjoint.

## Methods and setting

Explicitly labelled position paper based on operational experience rather than a controlled experiment or impossibility proof.

## Findings used in this library

- [HE049](../evidence/HE049.md), qualifying [HC032](../claims/HC032.md): pp. 133–139 show failure after durable update but before acknowledgement causes redelivery; sender-side state and send intent should commit together, while recipients still need durable message identity/idempotence.

## Limitations / validity threats

An outbox closes the source-side dual-write gap but a relay may publish duplicates and downstream external effects remain outside the source transaction. Storage, relay lag, ordering, cleanup, and recipient deduplication are operational costs.

## Conflicts and lifecycle

The later Queue DOI is a reprint identifier, not evidence that the original 2007 paper had a DOI.

## Links to synthesis claims

- [HC032](../claims/HC032.md), [HE049](../evidence/HE049.md); `distributed-state-and-transactions.md` — “Exactly-once claims.”
