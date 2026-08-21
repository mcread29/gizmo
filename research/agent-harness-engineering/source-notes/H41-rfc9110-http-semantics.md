# [H41] HTTP Semantics

- **Work ID / topic aliases:** W063 / H41
- **Authors:** Roy T. Fielding (editor), Mark Nottingham (editor), Julian Reschke (editor)
- **Year / venue:** 2022, IETF Internet Standard STD 97 / RFC 9110
- **Document type:** standard
- **Publication status:** practitioner source
- **Stable IDs:** DOI:10.17487/RFC9110; RFC:9110; STD:97
- **Canonical URL:** <https://www.rfc-editor.org/rfc/rfc9110.html>
- **Version reviewed / version date:** RFC 9110, June 2022
- **Published version / supersedes:** Internet Standard; obsoletes RFCs listed by the canonical record
- **Correction or retraction status:** RFC Editor errata link checked 2026-07-20; errata exist and were not adjudicated as changing the cited clauses
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full canonical RFC HTML scraped
- **Artifact URI / SHA-256:** canonical HTML URI above; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full RFC; Sections 9.2.2, 13, and 13.1.1 directly reviewed
- **Discovery:** primary standards check H-20260720-019
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It defines current HTTP idempotency and conditional-request semantics and explicitly addresses response loss and retries.

## Methods and setting

Normative Internet Standard produced through IETF consensus/public review; not an empirical agent study.

## Findings used in this library

- [HE032](../evidence/HE032.md), supporting [HC025](../claims/HC025.md): Section 9.2.2 says an idempotent request may be retried after the connection closes before a response even if the original succeeded.
- [HE035](../evidence/HE035.md), supporting [HC026](../claims/HC026.md): automatic retry of non-idempotent methods requires knowledge of actual idempotent semantics or proof the original was not applied.
- [HE044](../evidence/HE044.md), supporting [HC030](../claims/HC030.md): Sections 13 and 13.1.1 define strong-validator preconditions/`If-Match` to prevent lost updates.

## Limitations / validity threats

HTTP idempotency concerns intended server effect; per-request logs or downstream incidental effects may still repeat. `If-Match` protects one participating resource and does not compose a transaction across tools.

## Conflicts and lifecycle

Errata exist; none was identified in this review as changing the cited provisions. Recheck on RFC status/errata change.

## Links to synthesis claims

- [HC025](../claims/HC025.md) via [HE032](../evidence/HE032.md); [HC026](../claims/HC026.md) via [HE035](../evidence/HE035.md); [HC030](../claims/HC030.md) via [HE044](../evidence/HE044.md).
