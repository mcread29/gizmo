# [H44] End-to-End Arguments in System Design

- **Work ID / topic aliases:** W066 / H44
- **Authors:** Jerome H. Saltzer, David P. Reed, David D. Clark
- **Year / venue:** 1984, ACM Transactions on Computer Systems 2(4), pp. 277–288
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/357401.357402
- **Canonical URL:** <https://doi.org/10.1145/357401.357402>
- **Version reviewed / version date:** published ACM TOCS article, November 1984
- **Published version / supersedes:** published journal artifact
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** author-hosted primary PDF and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full paper; pp. 278–283, especially “Delivery guarantees” and “Duplicate message suppression”
- **Discovery:** identity check H-20260720-014
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It distinguishes transport receipt from application success and shows why logical duplicate suppression belongs at the endpoint that understands the effect.

## Methods and setting

Architecture analysis supported by system examples; not an LLM-agent experiment.

## Findings used in this library

- [HE034](../evidence/HE034.md), supporting [HC026](../claims/HC026.md): pp. 281–282 show that a host/network acknowledgement may precede application failure, and lost acknowledgement plus retry creates a duplicate logical transaction that lower layers cannot identify.

## Limitations / validity threats

Lower-layer reliability can still improve performance. The end-to-end argument does not prescribe one universal implementation; it says lower layers cannot by themselves satisfy a correctness property requiring application semantics.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC026](../claims/HC026.md), [HE034](../evidence/HE034.md); `distributed-state-and-transactions.md` — “End-to-end idempotency.”
