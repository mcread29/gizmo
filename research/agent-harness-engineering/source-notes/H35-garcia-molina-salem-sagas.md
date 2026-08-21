# [H35] Sagas

- **Work ID / topic aliases:** W057 / H35
- **Authors:** Hector Garcia-Molina, Kenneth Salem
- **Year / venue:** 1987, ACM SIGMOD International Conference on Management of Data, pp. 249–259
- **Document type:** system paper
- **Publication status:** peer reviewed
- **Stable IDs:** DOI:10.1145/38713.38742
- **Canonical URL:** <https://doi.org/10.1145/38713.38742>
- **Version reviewed / version date:** published SIGMOD 1987 proceedings paper
- **Published version / supersedes:** published proceedings artifact; supersedes relationship none identified
- **Correction or retraction status:** not independently verified beyond the DOI record on 2026-07-20
- **Accessed / last verified:** 2026-07-20
- **Acquisition:** PDF reviewed; DOI metadata reviewed
- **Artifact URI / SHA-256:** acquisition URI <https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf>; local artifact not retained; SHA-256 not computed
- **Acquisition extent:** full 11-page paper; pp. 249–259, especially pp. 250–257
- **Discovery:** seed source; identity check H-20260720-009
- **Use status:** core evidence
- **Reviewers:** focused-review research thread; second reviewer identity unknown/not retained

## Why it matters

This is the original saga model for long-lived activities whose committed subtransactions cannot remain locked inside one flat transaction.

## Methods and setting

The paper defines sagas as sequences of separately committed transactions with application-supplied compensating transactions and analyzes scheduling and recovery in a database setting. It is a systems model, not an LLM-agent experiment.

## Findings used in this library

- [HE039](../evidence/HE039.md), supporting [HC028](../claims/HC028.md): pp. 250–251 define semantic compensation and explain why restoring an old value would overwrite intervening work; a saga does not provide outer-level isolation/atomic rollback.
- The guarantee is conditional: either all forward transactions complete or a committed prefix is followed by compensators. Recovery needs durable saga state and compensator identity/parameters (pp. 252–256).
- Compensation can fail and some actions are irreparable; the missile/correction examples on p. 257 bound what “undo” can mean.

## Limitations / validity threats

The model assumes suitable compensators or forward recovery and principally treats database subtransactions. It does not prove atomicity across arbitrary SaaS APIs, physical actions, or adversarial tools. Compensation may be costly, visible, lossy, or manual.

## Conflicts and lifecycle

No extraction dispute recorded. Recheck on a reported correction or DOI lifecycle change.

## Links to synthesis claims

- [HC028](../claims/HC028.md), [HE039](../evidence/HE039.md); `distributed-state-and-transactions.md` — “Sagas and compensation.”
