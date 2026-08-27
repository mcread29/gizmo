# Workflows, runbooks, and skills

## Claim traceability

Major evidence-bearing conclusions on this page use the following canonical records; each claim file lists its exact synthesis locations and confidence dimensions:

- [MC020](claims/MC020.md) ← [ME025](evidence/ME025.md), [ME026](evidence/ME026.md); [MC021](claims/MC021.md) ← [ME027](evidence/ME027.md); [MC022](claims/MC022.md) ← [ME028](evidence/ME028.md), [ME029](evidence/ME029.md); [MC023](claims/MC023.md) ← [ME030](evidence/ME030.md).
- [MC024](claims/MC024.md) ← [ME031](evidence/ME031.md); [MC025](claims/MC025.md) ← [ME032](evidence/ME032.md); [MC026](claims/MC026.md) ← [ME033](evidence/ME033.md); [MC027](claims/MC027.md) ← [ME034](evidence/ME034.md).

## Representation ladder

```text
raw successful episode
  → parameterized episode
  → natural-language lesson
  → workflow/runbook with pre/postconditions
  → executable skill with typed interface
```

Every upward step loses detail or gains authority. Promotion should therefore require stronger validation, not merely an LLM saying that the abstraction looks useful.

## Reflection and verbal lessons

Reflexion turns feedback from failed attempts into verbal memory for retries. The paper reported GPT-4 HumanEval 91.0% versus a cited 80.1% GPT-4 baseline, but it adds attempts, reflection calls, and generated tests and is not compute matched. Faulty generated tests made MBPP worse: 80.1%→77.1%. [M10, §4; Tables 1–3] A cost-oriented comparison later found simpler retry/warming/escalation could dominate reflection/tree-search methods on the HumanEval accuracy–cost frontier, with LATS reported at more than 50× one warming baseline's cost. [M25, Table A1; §§2.2–2.3]

ExpeL offers direct contamination evidence: including unvalidated Reflexion text during insight extraction reduced a HotPotQA result from 39% to 29%. [M11, Figure 5]

**Engineering rule:** a reflection is a diagnosis hypothesis linked to its failure and oracle. It may guide the next attempt; it cannot update authoritative facts or become a global lesson until validated elsewhere.

## Episodic experience

ExpeL reported same-family gains from selected experience and sharp losses from random retrieval:

- HotPotQA→FEVER transfer: ReAct 63% to ExpeL 70%. [M11, Tables 1–3]
- ALFWorld: ReAct 40.0% to ExpeL 59.0%. [M11, Tables 1–3]
- ALFWorld random experience: 42.5%. [M11, Table 3]

The experiment is peer reviewed and includes useful negative ablations, but is not token/call matched and uses modest stores. The key conclusion is not “store every trajectory”; it is that applicability selection is a first-class component.

Store the objective outcome, environment/version, trajectory/artifact handles, applicability features, and failures. Retrieval should be allowed to abstain.

## Workflow and runbook induction

Agent Workflow Memory induces abstract browser workflows from canonical or online episodes. With GPT-4-0613 at temperature 0 on WebArena, AWM scored 35.5% versus the in-paper accessibility-tree BrowserGym baseline of 15.0%; 23.5% is an external published BrowserGym result using HTML plus the accessibility tree. On a one-example-per-template cross-template subset, 20.5%→33.2%. [M12, Tables 1–2; §§3.1.1–3.1.3] On Mind2Web, abstract workflows beat retrieved concrete examples by 4.0 step-success points in one same-model comparison. [M12, Table 3; §3.2.1]

Caveats:

- workflow induction and injected tokens are not cost matched;
- online induction sees the test stream and uses a model-based binary evaluator;
- train/test templates can overlap;
- the paper states that incorrect predicted trajectories can induce bad workflows. [M12, §3.2.2]

A runbook should declare trigger, inputs, preconditions, permissions, steps, checkpoints, postconditions, expected side effects, failure/rollback path, source episodes, and version range.

## Executable skill libraries

Voyager stores GPT-4-generated Mineflayer code only after execution feedback and self-verification, retrieving top-5 skills by description embedding. [M13, §§2.2–2.3] On four unseen tasks in a new Minecraft world, full Voyager completed all 12 trials (three/task); the no-skill variant completed 11/12 but generally required more prompting iterations, while ReAct/Reflexion/AutoGPT completed 0/12 within 50 iterations. [M13, Table 2] In tech-tree trials, only full Voyager reached diamond tools (1/3); no-skill reached 0/3. [M13, Table 1]

This supports executable reuse in an objective environment but does not isolate the skill library from curriculum, iterative prompting, and self-verification in every headline. The self-verifier can itself err, and GPT-4 was reported as 15× the GPT-3.5 API cost in that study. [M13, §§3.4, 4]

An executable skill should have:

```text
name/version, typed arguments/results
applicability predicate and required capabilities
tool/environment/API versions
source episode/artifact hashes
sandbox/static-analysis status
objective tests and held-out validation history
side effects, approvals, rollback
owner, ACL, expiry, deprecation/supersession
```

## Flat libraries and routing

Assay gives unusually direct evidence that skills are conditionally helpful. It uses randomized masking on 15 disjoint development tasks (12 masks × 15 = 180 agent rollouts/model) to estimate per-skill effects, then selects skills per test task. [M18, §§2–3.1]

On AppWorld challenge with GPT-5.1 [M18, Table 1; Figure 3]:

- bare ReAct: 52.5% task-goal completion; [M18, Table 1]
- uncurated skill library: 49.9%; [M18, Table 1; Figure 3]
- Assay-curated/masked: 66.4%. [M18, Table 1; Figure 3]

Over 90% of 103 GPT-5.1 skills had a per-task causal range above 0.40; reverse masking degraded performance by 4.7 points. [M18, Appendix A.1] On τ-bench, two strong models had null gains (GPT-5.1 62.6%→62.6%; Sonnet-4.5 73.0%→73.0%). [M18, Table 2; §3.2]

The paper is a July 2026 preprint and relies on small development coverage, but it strongly warns that semantic similarity and global average utility do not solve routing. Flat prompt injection becomes riskier as similar or conditional skills accumulate.

## Promotion gate

Promote an episode to workflow/skill only if all apply:

1. environment or independent oracle verifies success;
2. no policy/permission violation or hidden side effect;
3. raw trajectory, inputs, outputs, and artifact hashes are retained;
4. abstraction is parameterized and declares applicability/non-applicability;
5. dependencies and environment versions are explicit;
6. repeated runs establish reliability;
7. held-out tasks/templates/repositories test transfer;
8. no-workflow/no-skill and simple retry/retrieval baselines are compared under equal budgets;
9. executable content passes sandbox, static checks, and least-capability review;
10. canary, expiry, invalidation, rollback, and owner are configured.

Use failures to generate candidates and tests, not as direct promotion evidence. Require a successful replay after any repair.

## Retrieval policy

1. Filter by tenant/domain/tool/API/version and permissions.
2. Check preconditions against authoritative current state.
3. Rerank on measured task-conditioned effect/applicability, not description similarity alone.
4. Retrieve the smallest composable set; resolve overlap/conflict deterministically.
5. Present workflow separately from untrusted observations.
6. Verify postconditions and record whether the skill caused success.
7. Update utility estimates without letting the skill self-grade.

## Costs to report

- induction and validation rollouts;
- storage/index bytes and build latency;
- routing/controller calls and tokens;
- injected workflow/skill tokens per agent turn;
- execution/sandbox time;
- success per dollar and per wall-clock minute;
- regression frequency after environment/model change;
- library size, collision rate, abstention, and fallback rate.

## Verdict

Validated, applicable workflows and executable skills have some of the best bounded evidence for cross-task reuse. The evidence does **not** support automatically promoting every successful-looking trajectory, reflection, or generated routine. Treat libraries as versioned software products with empirical routing, tests, permissions, and rollback.
