# [H46] FoundationDB: A Distributed Unbundled Transactional Key Value Store

- **Work ID / topic aliases:** W068 / H46
- **Authors:** Jingyu Zhou, Meng Xu, Alexander Shraer, Bala Namasivayam, Alex Miller, Evan Tschannen, Steve Atherton, Andrew J. Beamon, Rusty Sears, John Leach, Dave Rosenthal, Xin Dong, Will Wilson, Ben Collins, David Scherer, Alec Grieser, Young Liu, Alvin Moore, Bhaskar Muppana, Xiaoge Su, Vishesh Yadav
- **Year / venue:** 2021, ACM SIGMOD International Conference on Management of Data, pp. 2653–2666
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/3448016.3457559
- **Canonical URL:** <https://doi.org/10.1145/3448016.3457559>
- **Version reviewed / version date:** published SIGMOD 2021 proceedings paper
- **Published version / supersedes:** published proceedings artifact
- **Correction or retraction status:** Crossmark-linked record checked 2026-07-20; no separate lifecycle finding established
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** full primary PDF and DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://www.foundationdb.org/files/fdb-paper.pdf>; temporary download SHA-256 `ce786e9965dbc04f3e5ae1d57d6a895ee2dafb1b89f8f9c82355502895562b26`; local artifact not retained
- **Acquisition extent:** full paper; Section 4, pp. 2660–2661, and Section 6.2
- **Discovery:** identity check H-20260720-016
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

It supplies a mature implementation example of deterministic simulation, seeded fault injection, rare-path amplification, and invariant/eventual-recovery oracles.

## Methods and setting

The real database code runs in deterministic discrete-event simulation with abstracted network, disk, time, failures, partitions, corruptions, reconfiguration, and request errors.

## Findings used in this library

- [HE050](../evidence/HE050.md), supporting [HC033](../claims/HC033.md): Section 4 describes reproducible seeds, injected component/network/time faults, “buggification,” transaction invariants, and eventual-recovery checks.

## Limitations / validity threats

Simulation may miss third-party libraries, non-simulated code, performance faults, and mismodelled OS/filesystem behavior. This is not an LLM-agent experiment and presumes control over the simulated environment.

## Conflicts and lifecycle

No extraction dispute recorded. Static archival source.

## Links to synthesis claims

- [HC033](../claims/HC033.md), [HE050](../evidence/HE050.md); `distributed-state-and-transactions.md` — “Failure injection.”
