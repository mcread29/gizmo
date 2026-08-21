# Shared confidence rubric

**Version:** 1.0  
**Effective:** 2026-07-20

Use this rubric for every evidence observation and synthesized claim in the corpus. It deliberately keeps **what a claim is**, **which direction it points**, **how strong its evidence is**, and **how mature its publication is** in separate fields. A label such as `negative`, `synthesis`, or `preprint` is never itself a confidence grade.

## 1. Required non-scoring descriptors

### Claim type

Choose exactly one primary type; add secondary tags separately.

| Value | Meaning |
|---|---|
| `descriptive` | Reports an observed property, frequency, result, or association. |
| `comparative` | Compares interventions, systems, or conditions. |
| `causal` | Attributes a change to an intervention. Requires a design capable of supporting that attribution. |
| `mechanistic` | Claims how or why an effect occurs. |
| `predictive` | Predicts an outcome on new cases or future conditions. |
| `normative` | States what should be done or valued. Empirical premises and value judgments must be separated. |
| `existence` | Claims that at least one instance, attack, failure, or capability exists. |
| `absence` | Claims no instance/evidence exists in a defined searched or tested universe. |
| `synthesis` | Integrates multiple observations or works. It is not a substitute for the underlying claim types. |

### Polarity

Choose one per observation relative to the bounded claim:

- `supports`: points in the claim’s stated direction;
- `against`: points against it;
- `null`: reports no detected/material difference under the study’s sensitivity;
- `qualifies`: narrows scope, reveals a tradeoff, or supplies a validity condition without directly reversing the claim;
- `mixed`: the same observation contains materially different directions across prespecified outcomes/subgroups;
- `not-applicable`: background, method, or identity metadata only.

Never encode polarity as “confidence.” Preserve adverse, null, and qualifying observations alongside supporting ones.

### Publication maturity

Record maturity independently for each reviewed artifact:

| Code | Maturity |
|---|---|
| `M0` | Unknown or not independently verified. |
| `M1` | Non-archival web/practitioner material, project page, or technical documentation. |
| `M2` | Preprint, technical report, thesis, or non-archival workshop manuscript; peer review not verified. |
| `M3` | Peer-reviewed workshop/short paper, or archival status uncertain in a way explicitly recorded. |
| `M4` | Verified archival peer-reviewed conference/journal/proceedings paper. |
| `M5` | M4 plus a verified correction/supersession history check at the review date. |

Publication maturity does **not** prove a result correct and does not enter the evidence grade arithmetically. Always display it beside the grade. If a published record exists but extracted claims came from an earlier preprint, record both (for example, `M4; evidence extracted from arXiv v1`).

## 2. Evidence-confidence dimensions

Score every dimension `0–3`. Use `0` for unknown/not recorded as well as for an established severe failure; explain which. Do not silently treat missing information as average quality.

| Dimension | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **D — directness** | Citation/identity unresolved, or only an unverified secondary assertion | Abstract, metadata, secondary corroboration, or indirect proxy supports the extraction | Primary full text directly reviewed with a usable section/page/table/figure locator, but some extraction detail is incomplete | Exact versioned primary artifact and exact row/figure/section/page locator directly reviewed; estimate and scope are unambiguous |
| **V — internal/construct validity** | Design cannot support the claim type, outcome is invalid for the construct, or validity is unknown | Major uncontrolled confounding, bundled intervention for an isolated/causal claim, severe leakage, or single weak proxy | Design supports a bounded descriptive/comparative claim with material limitations recorded | Design matches claim type; controls, sampling, task construction, and outcome operationalization address principal threats |
| **U — statistical and measurement uncertainty** | Denominator/runs/variance are unknown where needed, or reported value is internally disputed | One run/small sample, no dispersion, unstable estimate, or measurement error likely to alter the conclusion | Denominators and runs are known; uncertainty is partly quantified or effect is large relative to plausible noise | Appropriate uncertainty analysis for the sampling unit (for example CIs/paired tests), adequate repetitions/power, and no material unresolved multiplicity issue |
| **C — comparator and budget matching** | No meaningful comparator, or matching is unknown for a comparative/causal claim | Comparator differs on major model, data, tools, permissions, context, or compute dimensions; bundled comparison | Comparator is relevant and key dimensions are held fixed, but one material budget/system dimension remains unmatched or unreported | Intervention is isolated and comparator is matched on model, data/split, prompts/tools/permissions, and relevant token/call/step/time/compute budgets |
| **E — evaluator quality** | Evaluator/oracle is unknown or demonstrably invalid for the conclusion | Unvalidated LLM judge, generated tests, weak proxy, or low/unknown agreement with material false-accept/reject risk | Standard benchmark oracle or documented human/automatic evaluator with known limitations | Outcome is directly verifiable or evaluator is independently validated; version, agreement/error analysis, and adjudication are reported |
| **X — external validity** | Evaluated setting is unknown or unrelated to the claim’s scope | One model/task/benchmark or synthetic setting; narrow scope | Multiple tasks/models/environments cover important variation but not deployment | Prespecified diverse settings or representative field evidence support the exact population/system scope claimed |
| **P — independent replication/corroboration** | No replication information | Only same-team reruns, same artifact, or non-independent corroboration | At least one independent study/artifact finds a materially compatible result, with differences recorded | Multiple independent replications across teams/settings, or a high-quality registered multisite replication |
| **R — reproducibility and auditability** | Inputs/artifacts unavailable or provenance unknown | Partial method description; code/data/configs or exact versions missing | Sufficient code/data/configuration for substantial reproduction, but environment/commits/traces or licenses are incomplete | Versioned code, data, prompts/configs, environment/container, seeds, evaluator, and traces are available and the reported result has been reproduced from them |

### Dimension-specific rules

- Score against the **exact bounded claim**, not the paper as a whole. The same work can yield different scores for different observations.
- For non-comparative claims, `C` scores budget/scope appropriateness: `3` only when no comparator is logically required and exposure/search/test budget fully matches the claim; otherwise explain the limitation. Do not award `3` merely because the field is inapplicable.
- For existence claims, one valid case can provide strong direct evidence of existence, but not prevalence or deployment frequency; score `X` against the existence scope.
- For absence claims, `V`, `U`, and `X` require a defined searched/tested universe, detection sensitivity, and stopping rule. “No study found” without a reproducible search cannot exceed `1` on those dimensions.
- For security claims, attack success and defense success must be separate observations. A defense tested against one attack family does not establish general safety.
- For normative claims, grade each empirical premise; keep the value judgment ungraded and explicit.

## 3. Deterministic observation grade

### Procedure

1. **Freeze the statement.** Record exact claim text, type, population/system, intervention, comparator, outcome, time/version, and boundary conditions.
2. **Create one observation per result.** Record W ID, source version, locator, estimate/units/denominator, and polarity. Split materially different outcomes or subgroups.
3. **Record maturity.** Assign `M0–M5` to the reviewed artifact, independently of confidence.
4. **Score all eight dimensions.** Assign `D,V,U,C,E,X,P,R` from the table. Every `0` or `1` needs a short reason; every unknown is `0 (unknown)`.
5. **Apply the grade table below exactly.** All listed conditions must hold. Test from A downward; the first matching row wins.
6. **Apply caps.** Caps can only lower a grade. Record each cap and reason.
7. **Publish the vector.** Never publish `A/B/C/D` alone: use, for example, `B [D3 V2 U2 C2 E3 X2 P1 R2]; M4`.

### Grade table

| Grade | Deterministic conditions |
|---|---|
| **A — strong, transferable** | `D,V,U,C,E ≥ 2`; at least four of those five are `3`; `X ≥ 2`, `P ≥ 2`, and `R ≥ 2`; no unresolved material contradiction or extraction dispute |
| **B — strong but bounded** | `D,V,U,C,E ≥ 2`; `X,P,R ≥ 1`; no unresolved material contradiction or extraction dispute |
| **C — suggestive / limited** | `D,V,U,C,E ≥ 1`; no more than one of `X,P,R` is `0`; extraction identity and direction are resolved |
| **D — weak / background only** | The observation is identifiable but fails the C threshold, or a cap requires D |
| **E — pending / unusable** | Work/version/locator is unresolved, extraction is disputed, or evidence cannot presently be used to assess the claim |

### Mandatory caps

- **Causal or mechanistic claim from an observational, bundled, or non-isolating comparison:** maximum `C`.
- **Comparative claim with no usable comparator (`C=0`):** maximum `D`.
- **Primary quantitative value obtained only from metadata, abstract, or a secondary source (`D≤1`):** maximum `D`.
- **Unresolved disagreement over the extracted value, denominator, direction, or table rendering:** `E` until adjudicated.
- **General safety/absence claim without a defined test/search universe and detection sensitivity:** maximum `D`.
- **Cross-system leaderboard used as an intervention ablation:** maximum `D` for the causal claim.
- **Single unvalidated LLM judge as the sole oracle for a claim sensitive to evaluator error (`E≤1`):** maximum `C`.

Publication maturity creates no automatic cap. A directly reviewed preprint can outrank a poorly extracted proceedings paper, but maturity must remain visible so readers can make lifecycle decisions.

## 4. Deterministic claim-level assessment

Do not average observations or dimension scores.

1. Partition relevant observations into `supports`, `against`, `null`, and `qualifies`; keep `mixed` observations split where possible.
2. Recompute `P` for the **set**, counting only independent teams/artifacts. Multiple tables or topic notes for one W ID are not replications.
3. Grade each observation with Section 3. The claim’s **support grade** is the highest grade achieved by a supporting observation after set-level `P` is applied. Report the strongest against/null grade separately.
4. Assign status:
   - `supported`: support grade A–C and no against observation of equal or better grade;
   - `mixed`: support and against observations both grade A–C, or prespecified settings materially differ;
   - `disputed`: an against observation has equal/better grade or extraction/adjudication is unresolved;
   - `unsupported`: no supporting observation reaches C;
   - `superseded`: a versioned later claim/observation replaces it.
5. The displayed **claim grade** equals the support grade, then is lowered one grade if an against or null observation is exactly one grade weaker. If an against observation is equal or stronger, report `disputed` and do not emit a single claim grade.
6. Scope claim text to the intersection of populations, systems, comparators, outcomes, and budgets actually supported. Never use a high grade to broaden scope.

## 5. Minimum reporting form

```text
Claim type: comparative
Polarity: supports
Claim status: supported
Observation grade: B [D3 V2 U2 C2 E3 X2 P1 R2]
Publication maturity: M4; extracted artifact: arXiv v2
Uncertainty: one run per condition; no CI
Comparator/budget: same model and token ceiling; latency unmatched
Evaluator: benchmark tests, version recorded; mutation sensitivity unknown
Scope: benchmark/model/version stated here
Caps applied: none
```

When a field cannot be established, write `unknown`; do not omit it and do not infer it from publication prestige.
