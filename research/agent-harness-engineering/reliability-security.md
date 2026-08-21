# Reliability, security, and governance

## Reliability is trajectory-level

A long-horizon run can fail through a correctable local action, accumulated context drift, stale state, a broken environment, weak verification, or an evaluator bug. Final success alone hides these causes. In τ-bench, GPT-4o reached 61.2% retail success but below 25% `pass^8`: fewer than one quarter of tasks succeeded in all eight semantically equivalent reruns. One rollout is therefore not a reliability measurement. [H23, Table 2 and pass^k figure]

ToolSandbox further shows that many failures are silent or semantic rather than clean exceptions: fabricated arguments, premature disambiguation, lost dependencies, hallucinated tools, and dependent calls incorrectly issued in parallel. A harness needs typed failure classes and state assertions, not a generic “retry on error.” [H24, Section 4]

A reliable harness needs:

- explicit failure classes (model output, tool contract, environment, policy, verifier, budget);
- an `outcome-unknown` state for a side-effecting call that timed out after possible dispatch ([HC025](claims/HC025.md));
- bounded retries tied to verified end-to-end idempotency rather than blind repetition ([HC026](claims/HC026.md));
- known-good checkpoints for controlled local state and compensation/reconciliation—not fictional rollback—for escaped effects ([HC027](claims/HC027.md), [HC028](claims/HC028.md));
- loop/redundancy detection;
- independent completion checks, including authoritative external-state queries;
- escalation when the oracle is weak or the action irreversible.

[H01, Sections 5.6 and 7.2; H06, Section 6; H35–H51] The complete protocol and failure-injection matrix are in [`distributed-state-and-transactions.md`](distributed-state-and-transactions.md).

Reliability also has a release dimension. With the model fixed across 35 Qwen Code versions, resolve rates moved between 23% and 39% without a significant chronological trend, while token use increased strongly. One release increased mean tokens 52% with no resolve-rate change after modifications to search tools and tool-output presentation; conventional tests all passed. Pin harness versions and gate upgrades on behavioral task, cost, turn, and tool-call regressions—not package freshness alone. ([HC024](claims/HC024.md)) [H34, Sections 5.3–5.4]

## Prompt injection is an architectural problem

AgentDojo evaluates stateful tool use over untrusted data. In its GPT-4o experiments, attack phrasing dramatically changed targeted success: several simple attacks were around 4–6%, while the stronger “important message” formulation reached 57.69%. This is why prompt instructions alone are not a security boundary and a benchmark defense tested only against one static attack is not a security guarantee. ([HC010](claims/HC010.md)) [H13, Table 4]

The most useful defense in that experiment was capability reduction. Preselecting the tools needed for the legitimate task reduced targeted ASR to 6.84% with 73.13% benign utility. ([HC011](claims/HC011.md)) But it failed where the same tools could perform both legitimate and malicious goals or tool needs were not known in advance. A prompt-injection detector also reduced ASR to 7.95%, but benign utility fell to 41.49% because of false positives, demonstrating why controls must be evaluated for utility loss. ([HC012](claims/HC012.md)) [H13, Section 4.3 and Table 5]

Structured prompt/data channels plus adversarial training can reduce measured injection success, but do not create a universal boundary. StruQ reduced many tested attacks on 7B models to 0–1%, yet an adaptive TAP attack still reached 9% on Alpaca-7B and 36% on Mistral-7B. The setting did not cover arbitrary multi-turn tool agents. [H26, Section 5 and Tables 2–3]

Engineering implications:

1. treat all retrieved/tool data as untrusted unless provenance proves otherwise;
2. keep policy and authorization outside the model;
3. grant per-task, time-bounded capabilities;
4. mediate secrets through narrow brokers rather than model context;
5. require approval for external, destructive, financial, identity, credential, and publication actions;
6. inspect both the requested operation and arguments/environment state;
7. evaluate with adaptive attackers and utility–security Pareto curves.

## Sandbox and permission model

Isolation has encouraging but conditional evidence. IsolateGPT uses process isolation, mediated cross-app transfer, network restriction, and approvals; it matched a non-isolated baseline on four functionality benchmarks, but sampled cost was 1.85× and its security analysis assumed users reject warnings correctly. [H25, Sections 5 and 7] In CaMeL's 949-case AgentDojo defense comparison using Claude 3.5 Sonnet, its capability/data-flow design recorded zero successful attacks, while benign utility degraded and token overhead was approximately 2.7–2.8×; the source's token-ratio labels conflict. Zero under a benchmark threat model is not immunity. [H27, Section 5]

A useful tiering is:

- **Tier 0 — observe:** read repository and sanitized metadata; no secrets or network.
- **Tier 1 — reversible workspace:** edit and execute inside disposable isolation with quotas and snapshots.
- **Tier 2 — constrained external access:** allowlisted network/resources through audited proxies.
- **Tier 3 — consequential action:** deployment, payment, messaging, publishing, credential use, or destructive mutation; require explicit policy and usually human approval.

The sandbox is not the only boundary. It must pair with network egress controls, process/resource limits, secret isolation, filesystem mounts, and output sanitization. “Run in a container” is insufficient if credentials and unrestricted network access remain available.

## Verification and oracle adequacy

Tests prove only the properties they cover. A green test can coexist with an unsafe trajectory, policy violation, security regression, or wrong interpretation. The harness should attach an evidence bundle to completion:

- checks executed and versions;
- relevant outputs/artifact hashes;
- properties each check covers;
- skipped or unavailable checks;
- unresolved uncertainty;
- approvals and policy exceptions.

This turns completion from a model assertion into an auditable state transition. [H02, Sections 3.4 and 5.2.1–5.2.2]

## Human oversight

As engineering synthesis, human-in-the-loop control should be implemented as a state machine rather than an ad hoc chat interruption. An approval request should include the proposed side effect, diff or arguments, supporting evidence, risk classification, reversibility, and expiration, and should authorize exactly that action rather than a broad future capability. This detailed design guidance is not an empirical result of [H06] alone. [H06, Section 5.2] more narrowly supports counting human time and intervention rate because oversight can materially change utility.

The empirical gap is important: IsolateGPT assumes correct rejection of warned flows rather than measuring real user behavior, and much “AI control” work substitutes models for trusted human auditing. Approval fatigue and habituation in long-running agent systems remain under-studied. Human review should therefore be reserved for bounded, information-rich exceptions rather than used as a high-volume firewall. [H25]
