# [H39] Transaction Processing: Concepts and Techniques

- **Work ID / topic aliases:** W061 / H39
- **Authors:** Jim Gray, Andreas Reuter
- **Year / venue:** 1992, Morgan Kaufmann, first edition
- **Document type:** authoritative technical book
- **Publication status:** published book
- **Stable IDs:** ISBN:978-1-55860-190-1; eBook ISBN:978-0-08-051955-5
- **Canonical URL:** <https://www.elsevier.com/books/transaction-processing/gray/978-1-55860-190-1>
- **Version reviewed / version date:** published first edition; publisher date September 1992
- **Published version / supersedes:** first-edition publisher artifact; some catalogs label the physical edition 1993
- **Correction or retraction status:** not independently verified; publisher record checked 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** publisher catalog/contents and cited primary pages reviewed
- **Artifact URI / SHA-256:** acquisition URI is the canonical publisher page above; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** Sections 4.2.2, 4.8–4.11, 10.4, and 12.3; cited pages 163–219, 562–573, 638–640
- **Discovery:** seed source; ISBN check H-20260720-021
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

This authoritative reference distinguishes protected transactional actions from unprotected “real actions,” and records the costs and uncertainty states of distributed commit.

## Methods and setting

Book-length synthesis of transaction processing theory, algorithms, and operational systems. It is authoritative background, not an LLM-agent experiment.

## Findings used in this library

- [HE036](../evidence/HE036.md), supporting [HC027](../claims/HC027.md): atomicity ends at enlisted transactional resources; unprotected physical/external actions may need deferral, containment, or semantic repair (Section 4.2.2).
- Sections 10.4 and 12.3 describe prepared/in-doubt state, stable logs, blocking, and heuristic decisions that can create outcome mismatch.

## Limitations / validity threats

The work predates web APIs and LLM agents. Applying it requires mapping each tool to a real resource-manager/transaction boundary; terminology alone does not create that boundary.

## Conflicts and lifecycle

Publisher dates the edition 1992; some catalog citations use 1993. This library records the publisher date and exact ISBN.

## Links to synthesis claims

- [HC027](../claims/HC027.md), [HE036](../evidence/HE036.md); `distributed-state-and-transactions.md` — “Atomicity boundaries.”
