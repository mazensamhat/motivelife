# MyMotiveFamily™

## Family Intelligence, powered by MyMotiveLife

> **Know where your family is. Understand how they move. Learn what's normal. See what's changing. Predict what's next.**

The map is the foundation. **AI intelligence is the product.**

Internal principle:

> Life360 maps where your family goes.  
> MyMotiveFamily understands how your family lives.

Do **not** publicly position as “the smarter Life360.” Create the category: **Family Intelligence**.

---

## Product structure

| Product | Price (CAD) | Who |
|---------|-------------|-----|
| **MyMotiveLife Pro** | $14.99/mo | Individual — full Digital Twin / Life OS |
| **MyMotiveFamily** | $19.99/mo | Household — owner gets Life Pro + Family platform |
| **Family Member Pro upgrade** | +$5/mo/member | Invited member upgrades private Digital Twin to Pro |

- Family members are invited at **no extra charge** for the core Family experience.
- Start household size around **6** members.
- Every member gets Family functionality + a **Basic** personal Digital Twin.
- Adult members’ personal MyMotiveLife data stays private unless they explicitly share.
- The Family Owner **does not own** another adult’s Digital Twin.

### Household economics (example)

Owner $19.99 + three Pro upgrades $5 × 3 = **$34.99** household MRR — but the owner only made a $19.99 decision; others made $5 decisions.

---

## Positioning

**Hero**

# Your Family.  
# Connected. Understood. One Step Ahead.

**Supporting**

See where your family is, understand how they move, discover the patterns shaping their lives, and let AI help everyone stay one step ahead.

Opening the app should feel like a **live family command center**, not a tracking app.

---

## Core engines

| Engine | Role |
|--------|------|
| **Location Engine™** | Where people are and have been |
| **Place Intelligence™** | What locations mean and how they’re used |
| **Drive Intelligence™** | Movement and driving behavior |
| **Destination Prediction™** | Where someone is likely heading |
| **Normal Life Model™** | Ordinary behavior baseline |
| **Pattern Intelligence™** | Meaningful changes and relationships |
| **Family Flow™** | Household as a coordinated system |
| **Life Impact Engine™** | Location/movement → individual Digital Twin |

That last engine is the moat vs. a sophisticated GPS tracker.

---

## Signature experiences (MVP → Phase 3)

### MVP (Version 1)

1. **Intelligent Family Map™** — avatars, status; detail on tap  
2. Live location, history, places, arrival/departure, speed  
3. Trip history + **Drive Score**  
4. **Place Intelligence™** + **Who’s Going There?™**  
5. **Family Flow™** + household ETA / conflict hints  
6. **Destination Prediction™**  
7. **Normal Life Model™** + **Something’s Different™** (unusual ≠ emergency)  
8. **Smart Departure™**  
9. Weekly Family Intelligence  
10. MyMotiveLife Digital Twin integration (permissioned)

### Phase 2

Family Future™, schedule optimization, advanced patterns, Family Time Intelligence™, deeper Life Impact, household spend/location correlations, shared shopping intelligence, trip consolidation, predictive traffic, advanced driving intelligence.

### Phase 3

Natural-language family stories (“What did my family do last month?”), narrative recaps, deeper predictive logistics.

---

## Privacy architecture

Per-member location sharing levels:

- Precise · Approximate · Destination Only · ETA Only · Driving Status Only · Off  

Separate toggles:

- Driving Data · Place History · Routine Learning · Family Insights · Digital Twin Integration  

Children: age-appropriate controls must comply with Canadian/U.S. privacy and child-data requirements before launch.

Tone for anomalies: **“This is unusual”** — never default to **EMERGENCY!**

---

## What we do **not** build initially

Roadside assistance, insurance products, identity-theft reimbursement, towing, emergency dispatch, hardware trackers, travel insurance, stolen-phone reimbursement.

We build **intelligence**.

---

## Growth flywheel

MyMotiveLife user → upgrades to Family → invites household → Basic twins form → some upgrade at $5 → retention + acquisition engine for Life.

---

## Implementation notes (this repo)

- Canonical product types/pricing: `packages/shared/src/family-intelligence.ts`
- Circles model (Family / Friends / Custom): `packages/shared/src/location-circles.ts`
- Expert review vs Life360 faults: `docs/FAMILY_MAP_EXPERT_REVIEW.md`
- Marketing: `/family` — product-facing copy only
- Product: authenticated Family Map at `/family-map`
- Schema auto-bootstraps missing tables on first request (also `family-map.sql` / `db:push`)
- Stripe Family checkout: `POST /api/subscription/checkout` with `{ plan: "family" }` — set `STRIPE_FAMILY_PRICE_ID` in Vercel
- Place stays + arrival/departure in-app alerts ship with Family Map location ingest
- Friends Circles are next — do not jam buddies into `FamilyHousehold`
