# Vitalu Master Plan

> **Status: LOCKED** — Product decisions consolidated 2026-08-17.  
> Companion: `docs/VITALU_SCREENS.md`.  
> Do not diverge from this document without an explicit product decision.

**Name:** Vitalu  
**Category:** Health Intelligence  
**Home:** MyMotiveLife  
**App:** `/vitalu`  
**Marketing:** `/wellness`

Vitalu is **not** a calorie counter, medical device, diagnosis engine, or MyFitnessPal clone.

---

## 1. Product thesis

**Core purpose**

> Your Health. Your Plan. Your Life.

**Central question**

> Given nutrition, body, movement, and recovery — what should I do today so my health plan still works this week?

That question is the foundation for the product, UI, intelligence engine, and marketing.

**Hero metric (counterpart to Kashu’s Safe to Spend)**

> **Vital Score** — a transparent 0–100 built from Nutrition, Movement, Recovery, and Consistency. Tap it and Vitalu explains the number. It is never an unexplained AI score.

**Differentiation**

Plenty of products can say: “You ate 1,420 of 2,100 calories.” Useful — but retrospective.

Vitalu’s opportunity:

> You slept 5h 51m. Yesterday was a heavy session. Today is a travel day. Vitalu recommends a recovery day: 20-minute walk, 10-minute mobility, maintenance calories, earlier bedtime. Your weight trend is still −1.8 lb/week.

That is a **Health Operating Engine**, not a food diary.

**Recurring user loop (the engine)**

```
GOAL → PLAN → DO → TRACK → FEEDBACK → ADAPT ↻
```

Those are not miscellaneous features. They **are** Vitalu.

Self-monitoring of diet and activity has evidence for supporting weight and activity outcomes. Behavioral-health apps that work tend to institutionalize goal setting, self-monitoring, feedback, instruction, planning, and personalization. Vitalu makes that loop first-class.

---

## 2. What Vitalu understands

Four signal domains. Calorie tracking is one capability inside Nutrition — not the product.

| Domain | What it holds |
|--------|----------------|
| **Nutrition** | Intake vs plan (kcal, protein, carbs, fat, fiber, water). Learned meals. |
| **Body** | Weight trend, optional waist / body-fat / muscle, optional photos. BMI informational only. |
| **Movement** | Steps, workouts the engine assembled, KINZO-derived movement where permitted. |
| **Recovery** | Sleep, rest days, “too easy / perfect / too hard” workout feedback. |

Then it turns those signals into:

**Plan → Action → Feedback → Adaptation**

---

## 3. Wellness boundary (non-negotiable)

Vitalu is **general health and wellness software**. It does not have a medical purpose.

Health Canada’s SaMD guidance treats software that tracks calorie intake and energy expenditure to help someone manage weight as **not** having a direct medical purpose when it stays in general wellness. FDA general-wellness policy similarly distinguishes lifestyle software from device functions intended to diagnose or treat disease.

### Vitalu DOES

- “Your average sleep decreased this week.”
- “Your calorie intake is trending above your target.”
- “You’ve completed 2 of 3 planned workouts.”
- “Your weight trend is decreasing.”
- “Consider a recovery day.”

### Vitalu DOES NOT

- “You have sleep apnea.”
- “You’re diabetic.”
- “You have hypertension.”
- “This workout will treat your back condition.”
- “Your symptoms indicate…”

**Website and in-app must say:** Vitalu is wellness software, not medical advice. It does not diagnose, treat, or manage medical conditions.

If MotiveLife ever enters regulated medical territory, that is a **separate product decision** — not a Vitalu V1 sneak-in.

---

## 4. Connections are optional (unlike Kashu)

Kashu’s “no bank connection” rule does **not** copy blindly into Vitalu.

Apple HealthKit and Android Health Connect are user-controlled health repositories. With **granular, explicit permission** they can supply steps, active energy, workouts, weight, heart rate, sleep, and distance.

### CONNECT HEALTH DATA — OPTIONAL

- Apple Health / HealthKit (iOS)
- Health Connect (Android)
- Existing Fitbit path remains a source into `HealthMetric`

**Manual Vitalu still works.** Connections reduce friction; they are never required to use the engine.

Do not require a paid fitness API for V1.

---

## 5. Privacy — Health Vault

Health data raises the bar.

**Vitalu Health Vault** (raw meals, weights, workouts, sleep, connected metrics) is **not** globally readable by every module.

| Gate | Default | What may flow |
|------|---------|----------------|
| **Vault → Life Graph** | Off until the user allows | Derived insights only (Vital Score, trend direction, plan adherence) |
| **Vault → VYRA** | Off until the user allows | Minimum necessary derived insight (“sleep down 18%”, not last night’s hypnogram) |
| **Vault → DayO / KINZO / Kashu / UPLIFT** | Same pattern | Specialist-to-specialist via derived insights, never raw dumps |
| Advertising / brokers | **Forbidden** | HealthKit-class data is never used for ads or sold |

Apple requires granular HealthKit permissions and prohibits using HealthKit data for advertising or selling to data brokers. MotiveLife matches that bar for **all** Vitalu sources, including manual entry.

On-device processing and minimizing collection are preferred where practical.

---

## 6. Onboarding

First experience framing:

### Let’s understand how your health actually works.

Not: “Set a calorie goal.”

### Step 1 — Intention

**What should Vitalu help you do?**

| Plan intent | Default emphasis |
|-------------|------------------|
| **Lose Weight** | Modest calorie deficit, protein, steps, 2–3 strength sessions |
| **Build Muscle** | Surplus or maintenance, higher protein, progressive strength |
| **Improve Fitness** | Aerobic + strength mix toward WHO activity ranges |
| **Maintain Weight** | Maintenance calories, consistency |
| **Get More Active** | Steps and short workouts first; calories secondary |
| **Improve Flexibility** | Mobility / yoga / stretching schedule |
| **Build Healthy Habits** | Sleep, water, walks — light structure |

### Step 2 — Body (optional but unlocks targets)

- Units: metric or imperial
- Height
- Current weight
- Goal weight (optional)
- Birth year (already on the MotiveLife account when present)
- Sex used **only** for a BMR estimate (Female / Male / Prefer not to say). Prefer-not uses a midpoint estimate and labels it as such.

BMI may be shown as **optional informational** (kg / m²). Never as a diagnosis. Never as a gate.

### Step 3 — Activity

How active is a normal week? Sedentary / Light / Moderate / Active / Very active.

### Step 4 — Connections (skip anytime)

Connect Apple Health / Health Connect / Fitbit — or continue manually.

### Step 5 — Confirm the plan

Vitalu shows proposed:

- Daily calorie target
- Protein / carb / fat targets
- Water target
- Steps target
- Workouts per week
- Weight trajectory (if a goal weight exists) as a **wellness estimate**, not a prescription

User confirms or adjusts. **You confirm before Vitalu commits** (same philosophy as Kashu bills).

---

## 7. Calorie and target math (V1)

All outputs are **estimates for general wellness**. Shown with that label.

### BMR — Mifflin–St Jeor

- Male: `10 × kg + 6.25 × cm − 5 × age + 5`
- Female: `10 × kg + 6.25 × cm − 5 × age − 161`
- Prefer not to say: average of the two, labeled “estimated without sex”

### TDEE

`BMR × activity factor`

| Level | Factor |
|-------|--------|
| Sedentary | 1.2 |
| Light | 1.375 |
| Moderate | 1.55 |
| Active | 1.725 |
| Very active | 1.9 |

### Daily calorie target

| Intent | Adjustment |
|--------|------------|
| Lose Weight | TDEE − 400 (clamped) |
| Build Muscle | TDEE + 250 (clamped) |
| Maintain / Habits / Flexibility | TDEE |
| Improve Fitness / Get More Active | TDEE (movement is the lever) |

**Safety rails (wellness, not medical):** never propose below 1,200 kcal (female or unspecified) or 1,500 kcal (male) without an explicit “I understand this is my own adjustment” override. Never propose above TDEE + 500.

### Macros (defaults)

- Protein: 1.6 g/kg current weight (lose / muscle) or 1.2 g/kg (maintain / active)
- Fat: 25–30% of calories
- Carbs: remainder
- Fiber: 14 g per 1,000 kcal (informational)
- Water: 30–35 ml/kg, min 2.0 L, max 3.5 L unless user sets otherwise
- Steps: 8,000 default; 10,000 if intent is Get More Active
- Workouts/week: 3 default; 2 if flexibility/habits; 4 if build muscle / fitness

User-editable. Vitalu does not invent medical meal plans (keto for epilepsy, renal protein limits, etc.).

### Weight trend

Never obsess over a single daily weigh-in.

- **Today** — last log
- **7-day average**
- **30-day change** (end 7-day avg − start 7-day avg)
- **Goal** — optional

Same energy as Kashu’s predicted-vs-actual: the trend is the signal.

---

## 8. Vital Score (transparent)

```
Vital Score = weighted mean of components that have enough data
```

| Component | Weight | V1 inputs |
|-----------|--------|-----------|
| **Nutrition** | 0.30 | Intake vs calorie/protein targets when meals exist; otherwise omitted |
| **Movement** | 0.30 | Steps vs target; planned workouts completed this week; toward WHO adult activity (150–300 min moderate **or** 75–150 min vigorous weekly, plus muscle-strengthening ≥ 2×/week) as a rule underneath — not an AI invention |
| **Recovery** | 0.20 | Sleep last night vs 7–9 h target; rest-day adherence after hard sessions |
| **Consistency** | 0.20 | Days with any Vitalu signal in the last 7 / 7 |

**Not enough yet:** fewer than **two** components with data → show “—” and list what’s missing. Do not fabricate 78.

Tap the score → breakdown + one sentence why it moved.

Trend arrow vs prior 7 days.

---

## 9. Food data architecture

Do **not** start with an expensive commercial nutrition contract.

Layered catalog, cached into MotiveLife (Vitalu Food Vault — reference data, not user secrets):

| Layer | Role | Licence homework before commercial ship |
|-------|------|------------------------------------------|
| **Canadian Nutrient File (CNF)** | Authoritative Canadian generic foods. Health Canada API: `https://food-nutrition.canada.ca/api/canadian-nutrient-file/` | Confirm Open Government Licence — Canada / API terms; cache; do not hammer live API per keystroke |
| **USDA FoodData Central** | Expanded generic foods | US government public data; confirm current terms |
| **Open Food Facts** | Packaged / barcode foods | ODbL — share-alike obligations on the database extract; quality controls |
| **User foods / meals** | Personal layer | User’s vault |

Normalize to: kcal, protein, carbs, fat, fiber, serving grams, source id, locale (en-CA / fr-CA when CNF).

**V1 logging (required):** search, recent, favorites, saved meals, copy yesterday, meal slots (breakfast / lunch / dinner / snacks), serving size.

**V1 optional:** “Tell Vitalu” natural language → estimated meal → Confirm | Adjust.

**Not required for V1:** barcode, photo-assisted entry. Both are later. Photo calorie estimates must never be presented as exact.

**Learn meals:** after repeats, “Add usual breakfast →”. The goal is that users eventually enter **less**, not more.

---

## 10. Workout engine (not a YouTube library)

Do not scrape or link hundreds of random videos and call it intelligence.

### Exercise record

- muscle groups, movement pattern
- equipment, difficulty
- contraindication **flags** (wellness: “skip if this bothers your wrists” — not diagnoses)
- instructions, duration/reps
- alternatives, progression, regression

### Assembly

User (or DayO) says: hotel, no equipment, 18 minutes.

Vitalu returns a structured session: warm-up, main sets, cool-down — then **Too Easy | Perfect | Too Hard**. Tomorrow’s prescription changes.

### Sources (evaluate, then vendor)

| Source | Use | Constraint |
|--------|-----|------------|
| **wger** | Exercise/ingredient data exists under Creative Commons; project is open source with a REST API | Prefer **licensed data in our database** (or a MotiveLife-hosted instance) over depending on wger’s public hosted API |
| Other free exercise datasets | Fill gaps | Review licence **before** commercial ship |

WHO adult activity ranges are **rules under the engine**, not chat improvisation.

Filters: duration 5–60 min; Beginner / Intermediate / Advanced; equipment None / Dumbbells / Bands / Gym / Yoga mat; modalities bodyweight, strength, cardio, HIIT, yoga, pilates, mobility, walk/run, core, senior-friendly.

---

## 11. Today screen (one surface)

One **Today** — not disconnected health utilities.

```
VITAL SCORE    78 ↑
Nutrition 82 · Movement 74 · Recovery 68 · Consistency 87

1,420 / 2,100 kcal     680 remaining
Protein / Carbs / Fat
Water · Steps
Today’s workout
Weight (today · 7-day avg · trend)

Your health trend: Improving ↑
```

Underneath: the next action (log breakfast, start the 18-min session, recovery day, earlier bedtime).

---

## 12. Ask Vitalu

Specialist conversation grounded in **this person’s** model — same split as Ask Kashu vs VYRA.

Examples:

- What should I eat for dinner?
- Give me a 20-minute workout.
- Why hasn’t my weight moved this week?
- How many calories do I have left?
- I don’t feel like the gym — something at home.
- Beginner yoga.
- How am I doing this month?

VYRA remains above it and reasons across life. VYRA does not own health math.

---

## 13. Life OS — other products consult Vitalu

Once Vitalu exists, **Vitalu owns health.** Generic calorie / weight / workout / nutrition-plan features elsewhere must route here.

| Flow | Example |
|------|---------|
| **KINZO → Vitalu** | Walking / gym visit / routine movement (permissioned) → movement signals |
| **DayO → Vitalu** | Packed calendar → shorter session or move the workout |
| **Kashu → Vitalu** | Healthy-meal plan weekly cost; “can I afford a gym membership?” is Kashu (money) + DayO (time) + Vitalu (fitness value) → VYRA synthesizes |
| **UPLIFT → Vitalu** | Weight-loss / fitness **goals** live in UPLIFT; Vitalu supplies the health plan and progress |
| **LifeVue → Vitalu** | Thin **Health** card only |
| **VYRA → Vitalu** | Consults derived insights, not the raw vault |

### LifeVue card

```
HEALTH
Improving ↑
Weight trend · Workout consistency · Nutrition target · Sleep
Open Vitalu →
```

LifeVue answers: **How is my health life doing?**  
Vitalu answers: **Exactly what’s happening and what should I do today?**

---

## 14. Killer feature (not calories)

MotiveLife knows **why** a workout was missed.

DayO: calendar exploded.  
KINZO: 630 km driven.  
Vitalu: sleep −18%.  
Kashu: restaurant spend +$142.  
LifeVue: routine stability down.  
UPLIFT: weight-loss goal slipping.

VYRA:

> Your health goal didn’t stall because of motivation. Travel reduced sleep and displaced three workouts while restaurant meals increased. Switch next week to 20-minute travel workouts in the morning.

That is the product. Protect it.

---

## 15. Architecture rule

**Don’t build seven apps. Build one intelligence platform with seven specialist interfaces.**

| Product | Owns |
|---------|------|
| **DayO** | TIME — calendar, tasks, daily execution |
| **LifeVue** | THE PERSON — Digital Twin visibility |
| **UPLIFT** | GOALS — destination, missions, progress |
| **KINZO** | FAMILY & MOVEMENT — household location/routines |
| **Kashu** | MONEY — cash-flow intelligence |
| **Vitalu** | HEALTH — nutrition, body, movement, recovery |
| **VYRA** | RELATIONSHIPS BETWEEN THEM — Chief of Staff |

Underneath: **ONE DIGITAL TWIN · ONE LIFE GRAPH**

Vitalu does not build another identity system or another AI brain. It feeds the Life Graph with permissioned derived health insight.

Digital Twin node: **Health → Vitalu** (not a generic Health slider beside a second calorie model).

---

## 16. What migrates out of generic MotiveLife

| Today | After Vitalu |
|-------|----------------|
| `/health` Health Agent targets (sleep / fitness / nutrition / wellness counters) | Become Vitalu plan targets + logs; page **redirects to `/vitalu`** |
| LifeVue “Health Module” tile | Thin Health card + Open Vitalu |
| DayO health/workout copy that invents a session | Calls Vitalu’s workout engine / Today action |
| UPLIFT health goals | Stay as **goals**; execution + metrics from Vitalu |
| Habits titled workout/walk/steps | May still exist as habits; completion should sync to Vitalu movement when the user is on a Vitalu plan |
| Voice capture creating `HealthItem` rows | Create Vitalu actions / logs instead |
| `HealthMetric` (Health Connect / Fitbit) | **Keep as the connection sink**; Vitalu is the reader and interpreter |
| Health Connect / Fitbit UI | Lives in Vitalu (+ Connect), not a separate health product |
| Future Simulator health legs | Call Vitalu, same pattern as money → Kashu |
| Ask / VYRA inventing calorie or workout math | Must consult Vitalu |

Mindset journal stays out of Vitalu unless the user later asks for mood-as-recovery (not V1).

---

## 17. Database (V1)

Authoritative store in Postgres (user vault). Reference foods/exercises may start as cached tables.

| Model | Purpose |
|-------|---------|
| **HealthProfile** | Plan intent, body basics, targets, units, vault share flags, onboarding JSON |
| **VitaluWeightLog** | Dated weight; source MANUAL / HEALTHKIT / HEALTH_CONNECT / FITBIT |
| **VitaluFoodLog** | Meal slot, food ref or custom, grams, macros, source |
| **VitaluSavedMeal** | Learned / favorite combos |
| **VitaluWorkout** | Assembled session + completion + difficulty feedback |
| **VitaluExercise** | Catalog (cached from licensed sources) |
| **HealthMetric** | Existing connection sink (do not duplicate) |
| **HealthItem** | Legacy targets; V1 may read them; new writes go to Vitalu |

`ensureVitaluSchema()` follows Kashu: `CREATE TABLE IF NOT EXISTS` so production does not wait on a manual `db:push`.

---

## 18. Development phases

| Phase | Scope |
|-------|--------|
| **0 — Identity** | Name, suite, nav, marketing, `/vitalu` shell, `/health` redirect, LifeVue card, wellness disclaimer, HealthProfile |
| **1 — Plan engine** | Onboarding, Mifflin–St Jeor targets, Vital Score with honest incompleteness, weight log + 7/30-day trend |
| **2 — Nutrition** | CNF-first catalog cache, search / recent / favorites / copy yesterday, Tell Vitalu parse |
| **3 — Workout engine** | Licensed exercise catalog, assembler, Too Easy / Perfect / Too Hard |
| **4 — Connections** | HealthKit / Health Connect / Fitbit as optional inputs into the same model |
| **5 — Ask Vitalu** | Conversational specialist grounded in the model |
| **6 — Life OS** | DayO / KINZO / Kashu / UPLIFT / VYRA / Future Simulator consult Vitalu; migrate remaining generic health writes |

---

## 19. Website

Hierarchy:

# SEVEN PRODUCTS. ONE LIFE OPERATING SYSTEM.

- DayO runs your day.
- LifeVue sees your life.
- KINZO understands your family.
- UPLIFT moves your goals forward.
- Kashu understands your money.
- **Vitalu understands your health.**
- VYRA connects the intelligence.

Vitalu card:

### YOUR HEALTH. YOUR PLAN. YOUR LIFE.

> Calorie apps count.  
> **Vitalu plans, tracks, and adapts — with your actual life.**

Must say: **Wellness software — not medical advice. Health connections optional.**

Included with MyMotiveLife Pro (not a separate SKU).

---

## 20. Locked decisions checklist

- [x] Name: **Vitalu** · Category: **Health Intelligence**
- [x] Health Operating Engine — not a calorie tracker
- [x] Four domains: Nutrition + Body + Movement + Recovery
- [x] Loop: GOAL → PLAN → DO → TRACK → FEEDBACK → ADAPT
- [x] Hero metric: **Vital Score** with transparent components
- [x] Workout **engine**, not a scraped library
- [x] CNF-first food layers; cache into our DB
- [x] wger/other exercise data: licence then vendor — no hosted-API dependency
- [x] Health connections **optional** (HealthKit / Health Connect / Fitbit)
- [x] Health Vault — derived insights only into the Life Graph / VYRA
- [x] Stay on the **wellness** side of SaMD / FDA general-wellness
- [x] Vitalu owns health; other products consult it
- [x] UPLIFT owns health *goals*; Vitalu owns the health *plan and execution*
- [x] VYRA does not ship a second health engine
- [x] Don’t build seven apps — seven specialist interfaces on one Life Graph

---

## Shipped in this revision

| Plan | Status |
|------|--------|
| **§18 Phase 0** | Suite identity, `/vitalu` Today shell, HealthProfile, `/health` redirect, LifeVue Health card, marketing `/wellness` |
| **§18 Phase 1** | Onboarding, Mifflin–St Jeor targets, Vital Score with honest incompleteness, weight log |
| **§18 Phase 2 (starter)** | Food search, Tell Vitalu, recent / favorites / usual / saved meals, copy yesterday, water |
| **§18 Phase 3 (starter)** | Workout assembler, recovery if sleep &lt; 6h, Too Easy / Perfect / Too Hard, packed-calendar 15-min |
| **§18 Phase 5 (starter)** | Ask Vitalu — calories, protein, water, steps, dinner, workout/yoga, noisy weight; refuses diagnosis |
| **§18 Phase 6 (partial)** | DayO next-action peek; VYRA consults derived Vitalu insights when the vault toggle is on |
| **Wearables** | Deferred — optional, at the end |
| **Screen spec** | `docs/VITALU_SCREENS.md` |
