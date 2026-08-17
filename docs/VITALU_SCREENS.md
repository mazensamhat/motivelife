# Vitalu screens

Locked product: `docs/VITALU_MASTER_PLAN.md`. Wellness only. Vitalu owns health.

## App chrome

- Route `/vitalu` (auth). `/health` redirects here.
- Nav label **Vitalu** · subtitle “Health intelligence”.
- Mobile: LifeVue tab still matches `/vitalu` (same pattern as other life areas). Desktop Main Apps includes Vitalu beside Kashu.
- Always-visible wellness line: *Vitalu is general wellness software. It does not diagnose, treat, or manage medical conditions.*

## Today

Hero: **Vital Score** or “—” with missing-data list. Tap opens breakdown (Nutrition / Movement / Recovery / Consistency).

Then the unified day:

- kcal consumed / target · remaining
- Protein / carbs / fat
- Water · steps
- Today’s workout (or Recovery day)
- Weight: today · 7-day average · 30-day change · goal

Footer: **Your health trend** (Improving / Steady / Slipping) from 7-day vs prior 7-day score or weight trend if score is incomplete.

Primary CTA: next action (finish onboarding, log a meal, start workout, log weight, connect health).

V1: food logging, the workout assembler, and Ask Vitalu are live on Today. Food values are starter-catalog estimates (not CNF). Weight, steps (from `HealthMetric`), and sleep still populate Movement / Recovery / Consistency.

## Onboarding

1. Plan intent  
2. Body (skip-able fields)  
3. Activity level  
4. Optional Health Connect / Fitbit  
5. Confirm targets (editable)

Confirm writes `HealthProfile`. Recalc on weight or intent change.

## Log weight

Single number + unit. Stores kg internally. Shows trend, not a lecture.

## Food (Phase 2 — starter live)

Search / Copy yesterday / meal slot / serving. Tell Vitalu → Confirm. Starter catalog estimates until CNF cache. Barcode and photo are **not** V1.

## Workout (Phase 3 — starter live)

Constraints (minutes, equipment) → assembled session → Too Easy | Perfect | Too Hard. Sleep under 6h forces recovery.

## Ask Vitalu (Phase 5 — starter live)

Specialist box on Today. Does not replace VYRA. Refuses diagnosis language.

## Vault & connections

Toggles: share derived insights with Life Graph / VYRA. Connection card (existing Health Connect / Fitbit) lives here.

## Other products

| Surface | What they show |
|---------|----------------|
| LifeVue | Health card → Open Vitalu |
| DayO | Today’s Vitalu action / shorter workout when the calendar is packed |
| UPLIFT | Health **goals**; Vitalu execution |
| KINZO | Permissioned movement hints |
| Kashu | Meal-plan cost / gym affordability (money only) |
| VYRA | Consults Vitalu derived insights |
| Future Simulator | Health legs call Vitalu |
| Connect | Health integrations remain; Vitalu is the interpreter |

## Copy rules

- No disease names, no “treats”, no “symptoms indicate”.
- BMI: informational, optional, dismissible.
- Targets: “estimate for general wellness”.
- Connections: optional.
