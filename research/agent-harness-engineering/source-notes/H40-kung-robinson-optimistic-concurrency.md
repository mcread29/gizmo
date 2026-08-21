# [H40] On Optimistic Methods for Concurrency Control

- **Work ID / topic aliases:** W062 / H40
- **Authors:** H. T. Kung, John T. Robinson
- **Year / venue:** 1981, ACM Transactions on Database Systems 6(2), pp. 213–226
- **Document type:** experiment
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/319566.319567
- **Canonical URL:** <https://doi.org/10.1145/319566.319567>
- **Version reviewed / version date:** published ACM TODS article, June 1981
- **Published version / supersedes:** published journal artifact; supersedes relationship none identified
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** primary paper and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://dl.acm.org/doi/10.1145/319566.319567>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** abstract and pp. 213–226, especially validation/write phases and conflict discussion
- **Discovery:** identity check H-20260720-012
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

This is original optimistic-concurrency-control work: execute speculatively, validate against conflicts, then commit or restart.

## Methods and setting

The paper presents two non-locking concurrency-control families and analyzes when optimistic validation can outperform locking.

## Findings used in this library

- [HE043](../evidence/HE043.md), supporting [HC030](../claims/HC030.md): validation prevents conflicting speculative transactions from both committing; detected conflicts require backup/restart.
- The method is attractive when conflicts are rare, but repeated conflicts impose abort/retry cost.

## Limitations / validity threats

Database concurrency control does not automatically cover an effect already emitted to an external API. A validate-after-effect sequence can reject local commit after the external effect has happened.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC030](../claims/HC030.md), [HE043](../evidence/HE043.md); `distributed-state-and-transactions.md` — “Compare-and-swap and optimistic concurrency.”
