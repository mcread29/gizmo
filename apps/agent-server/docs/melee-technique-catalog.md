# Melee technique catalog and player profiles

## Scope

This research pack describes a broad competitive repertoire for NTSC Melee Marth and Falco, rather than claiming to enumerate every named variation, stage trick, or discovered combo. It is a design reference, not implemented bot functionality. Exact timing and valid conversions must be checked against the running game version, frame data, stage, opponent, percent, DI, and observed state.

- [Marth techniques, strategies, and two player profiles](marth-techniques-and-profiles.md)
- [Falco techniques, strategies, and two player profiles](falco-techniques-and-profiles.md)

The character documents cite mechanics references and distinguish evidence about real players from proposed bot behaviors. A player-inspired profile is not a simulation of that person or a claim to reproduce their skill. Historical champions are useful models even when they are not current ranking leaders.

## Terminology

“Shuffle” in this context is usually **SHFFL**, short hop, fast fall, L-cancel, with an aerial inserted. It is an execution family, not one attack. `SHFFL bair approach` specifies both the movement technique and attack. Hitlag changes landing timing, so rehearsed waits alone are insufficient. Some early aerials can autocancel instead. See [SmashWiki's SHFFL explanation](https://www.ssbwiki.com/Short_hop_fast_fall_L-cancel).

- **Technique:** an executable movement or attack sequence, such as a turnaround short-hop bair.
- **Ability:** the bot's competence at executing or recognizing something, such as landing timing or DI-dependent reachability.
- **Strategy:** a conditional plan over techniques, such as using lasers to provoke a jump and intercepting it.
- **Play style:** preferences among viable plans, such as favoring positional control over a risky extension.

These definitions are proposed project vocabulary, not claims of universal community terminology.

## Proposed division of control

| Layer                   | Responsibilities                                                                                                  | Must not do                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Jev                     | Choose technique family, spacing goal, aerial timing intent, combo route, risk budget, and conditional follow-ups | Send individual frame inputs or assume an unconfirmed hit |
| Local tactical selector | Check legality, remaining vulnerability, geometry, observed contact, recovery resources, and safe alternatives    | Follow a stale plan into a missed combo or death          |
| Technique executor      | Perform state-gated jump, turn, aerial, drift, fast-fall, landing, and cancel inputs                              | Treat a button press as proof the move happened           |
| Player profile          | Set strategic preferences and a separate execution-capability configuration                                       | Invent “measured” player reaction times or error rates    |

Jev can request a route before an opening. Tight follow-ups must branch locally using that route, rather than wait for another network response. Defensive reactions and recovery overrides remain local.

## Technique contract

Every catalog entry should eventually become a technique with:

1. Preconditions: character, facing, ground/air state, available jumps, position, opponent state, and supported execution capability.
2. Parameters: attack, target spacing, early/late contact, jump height, drift, landing location, and allowed risk.
3. State transitions: observed jump squat, airborne state, attack startup, contact, descent, landing, and actionable state.
4. Bounded waits: character-specific timing windows relative to observed transitions, with hitlag and interruptions accounted for.
5. Outcomes: hit, shield contact, whiff, interrupted, invalidated, or execution failure.
6. Conditional exits: continue the planned route, cover a landing, reset neutral, defend, or recover.
7. Measurements: observed execution rate, spacing error, conversion reward, escape rate, and self-destruct rate.

Example request, proposed rather than an existing API:

```text
technique: aerial_approach
attack: bair
jump: short
contact: late
spacing: outside_shield_grab_range
on_hit: follow_if_reachable_else_cover_landing
on_shield: retreat
on_whiff: reset
```

“Outside shield-grab range” is a goal for the local geometry check, not an unconditional promise that the approach is safe.

## Abilities shared by both characters

These are proposed bot competencies. The character documents supply the move-specific mechanics and applications.

| Ability                | What the bot must recognize or execute                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Action-state literacy  | Startup, active frames, endlag, hitstun, shieldstun, landing lag, invulnerability, and actionable transitions        |
| Movement control       | Dash versus run, turnaround, jump height, drift, wavedash distance, and platform landing                             |
| Spacing                | Effective hitbox reach rather than center-to-center distance alone; opponent counterattack range                     |
| Aerial timing          | Rising versus late aerial, fast-fall eligibility, hitlag-adjusted landing and L-cancel timing                        |
| Contact recognition    | Distinguish hit, shield, clank, and whiff before choosing a continuation                                             |
| Combo recognition      | Reachability under current percent, knockback, DI, stage geometry, and available resources                           |
| Defense                | Shield options, DI, SDI, ASDI, crouch cancel, tech choices, and escape routes where applicable                       |
| Recovery planning      | Jump conservation, ledge occupancy, recovery move reach, wall geometry, and landing exposure                         |
| Opponent modeling      | Habits in shield, DI, tech direction, recovery, jumps, and responses to pressure                                     |
| Adaptation             | Update plans when evidence contradicts the expected response; do not label every escape an execution failure         |
| Risk management        | Prefer guaranteed damage, position, or a kill according to stocks, clock, and recovery cost                          |
| Information discipline | Use an explicitly chosen observation/reaction-delay model; never inspect future frames or opponent controller intent |

## Style and ability are independent

Style settings should include approach mix, preferred spacing, pressure duration, overshoot frequency, laser use where applicable, platform preference, grab preference, punish-route priority, edgeguard commitment, recovery mix, and adaptation rate.

Ability settings should include supported techniques, timing tolerance, observation delay, reaction delay, spacing precision, and recovery-planning competence. Start with dependable execution. Introduce bounded imperfections only when explicitly requested, with seeded reproducibility and separately reported failures.

A patient profile should still capitalize on a confirmed punish. An aggressive profile should still retreat when the local safety checks fail. Neither should be implemented as “always do this move.”

## Suggested implementation order

1. Shared movement, contact detection, defensive interrupts, and recovery checks.
2. Parameterized SHFFL aerial approaches, including facing-aware bair and early/late aerial variants.
3. Falco laser approaches and shine conversions; Marth dash-dance grabs, spaced fair, and throw follow-ups.
4. Conditional punish routes with tech, DI, and platform branches.
5. Edgeguard and ledge technique families, guarded by explicit return-to-stage checks.
6. Player-style preferences over tested techniques, followed by held-out matchup evaluation.
7. Rare or high-risk techniques only after the core repertoire is reliable.

Do not train a profile to compensate for a broken executor. Use isolated scenarios to verify each technique against hits, shields, whiffs, platforms, interruptions, and both facing directions before comparing full-match strength.
