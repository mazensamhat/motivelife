# Expert Brief: Family Intelligence UX & Presentation

**Audience:** Founder + product expert review  
**Date:** 2026-08-06  
**Context:** Live tracking / liveness is stabilizing. Next leverage is **how Family Intelligence looks, reads, and earns trust** — not more map chrome.

**Sources:** Code audit of `FamilyIntelPanel` + below-map stack, `FAMILY_MAP_EXPERT_REVIEW.md`, `MYMOTIVEFAMILY.md`, competitive framing vs Life360, household-use patterns (park liveness, drive follow).

---

## Executive verdict

Family Intelligence today is **credible but overcrowded**. We ship real engines (Flow, Something’s Different, Leave by, Family Time, Drive, Fuel, Places) into a scroll that treats every KPI as equal weight. That reads like a **dashboard of modules**, not a calm household brief — and it fights our anti-Life360 promise (“understand how they live,” not a warden’s console).

**Bottom line:** Keep the engines. Redesign the **hierarchy, copy, and empty states**. Cut duplication. Make one glance answer: *“Is everyone okay, and what should I do next?”*

Do **not** add more boxes before we fix presentation.

---

## What parents actually need (expert product lens)

| Moment | Question | Ideal signal |
|--------|----------|--------------|
| Glance (5 sec) | Is everyone okay? | One sentence + who’s moving / home |
| Plan (30 sec) | What should I do? | Leave by / conflict / one tip |
| Dig deeper | Why? | Expand one card — not eight always-open grids |
| Trust | Is this real? | Honest ages, no fake “Learning…”, no panic tone |

Park / school / pocket-phone days proved **liveness** matters. Intelligence should feel the same: quiet when life is normal, sharp when something useful changes.

---

## Current surface (honest inventory)

Below the map (overview), paid users get:

1. **Family Intelligence panel** — 4 chips + up to 8 insight bullets + **8 KPI cards** + expanders + footer notes  
2. **Weekly Driving Report** — telematics (brakes, accel, scores)  
3. **My Inbox** — alerts + static tips/offers  
4. **Temporary Circle**  
5. **Location history** again  

**Problems experts flag:**

1. **No hierarchy** — Flow, Fuel, Shopping, Leave by, and Drive Score compete equally.  
2. **Duplication** — Drive Score / events appear in chips, insights, KPIs, *and* Weekly Report.  
3. **“Weekly Family Intelligence” ≠ Weekly Driving Report** — product language promised a household life brief; we shipped telematics.  
4. **Empty / Learning… states** still feel stuck on sparse days (even when Family Time was hardened).  
5. **Locked tease** omits Leave by / Family Time vs live panel; sample data can look noisy (high brake counts).  
6. **Coming soon CTA** while public signup is gated — lock UX feels broken even when engines work.  
7. **Scroll tax** — map is the hero; intel should be a short brief, not a second app.

---

## Expert recommendations (ranked)

### P0 — Presentation & hierarchy (web only, no EAS)

**1. Collapse to a “Family Brief” (one composition)**  
First intel block should contain only:

- **One headline** (from life brief / Flow) — e.g. “Everyone’s settled” / “Zeinab is driving home · ETA 4 min”  
- **One supporting line** — leave-by or Something’s Different *only if useful*  
- **3 primary tiles max:** Flow · Leave by · Different (or All normal)  
- Secondary row (collapsed by default): Places · Drive · Fuel · Family time · Shopping  

Rule: if removing a tile doesn’t change the 5-second answer, it doesn’t belong in the first viewport.

**2. Kill duplicate Drive Score homes**  
Pick one:

- **Option A (preferred):** Brief shows “Drive · 82” as a quiet chip; Weekly Driving Report owns detail + event strip.  
- **Option B:** Fold Weekly Report *into* an expanded Drive tile; remove standalone card from overview.

**3. Something’s Different = calm exception, not a permanent box**  
- Hide or collapse to “All normal” when null.  
- When present: soft amber, never red SOS; show **confidence + last fix age**.  
- Matches expert anti-Life360 gate: *Unusual ≠ emergency*.

**4. Empty states that teach, not stall**  
Replace “Learning…” with actionable honesty:

| Instead of | Use |
|------------|-----|
| Learning… | “Needs a few Home arrivals” / “Save Home to unlock” |
| No trip yet | “Drive Score appears after the next trip” |
| $0 fuel | “Add vehicle for fuel estimates” |
| None yet (shopping) | Hide Shopping until ≥1 shop place *or* visit |

**5. De-clutter the overview stack**  
Recommended order:

```
Map (hero)
└─ Family Brief (collapsed hierarchy)
└─ Inbox (alerts only — tips behind “Ideas”)
└─ History (collapsed “Today” or only when following)
```

Move Temporary Circle into Tools/settings. Don’t auto-expand full history on overview.

### P1 — Data quality & trust (still mostly web/server)

**6. Prefer fewer, truer insights**  
Cap insight bullets at **3**, ranked:

1. Action (Leave by / conflict)  
2. Exception (Something’s Different)  
3. Pattern (Family Time / fuel trend)  

Drop rest into “More insights”.

**7. Shopping is too heuristic**  
Either: require saved Shop places, or demote Shopping out of the primary grid until confidence is high. Bad shopping counts destroy trust faster than omitting the tile.

**8. Align lock tease with live product**  
Locked preview must show the same 3 primary tiles + quieter sample numbers. CTA must match reality (`Coming soon` vs real upgrade path).

**9. Weekly Family Intelligence (real product gap)**  
Ship a true weekly household brief (not only driving):

- Days home together / Family Time  
- Places that mattered  
- One logistics win (on-time leave-bys)  
- Optional drive health as a footnote  

Until then: rename UI to **Weekly Driving** so marketing doesn’t overclaim.

### P2 — Layout craft (visual, still web-only)

**10. One composition under the map**  
Avoid equal white cards stacked forever. Use:

- Brief as a single band (no card farm)  
- Soft section labels, not eight bordered KPI buttons  
- Expand-in-place for one story at a time  

**11. Brand test for intel**  
If you blur the word “Family Intelligence,” the brief should still feel like *your* household’s life — names, places, calm tone — not a generic telematics dashboard.

**12. Motion**  
Subtle: brief headline cross-fade when presence changes; Leave by pulse only when within 30 min. No badge spam.

---

## What experts say *not* to do

- Don’t add more KPI boxes “because we have engines.”  
- Don’t copy Life360’s panic / always-on surveillance feel into intel.  
- Don’t claim Weekly Family Intelligence until the weekly *life* brief exists.  
- Don’t spend EAS on intel presentation — this is 100% web.  
- Don’t Google-Maps the intel problem; it’s hierarchy and honesty.

---

## Proposed experiment plan (after kids’ iOS 1.0.50 drive test)

| Step | Change | Success signal |
|------|--------|----------------|
| 1 | Family Brief hierarchy (3 tiles + collapsed rest) | Parents find Leave by / status without scrolling past Drive/Fuel/Shopping |
| 2 | Dedupe Weekly Driving vs Drive KPI | One clear home for score/events |
| 3 | Empty-state copy pass | Zero stuck “Learning…” on real household days |
| 4 | Rename or ship real Weekly Family Intelligence | Marketing matches UI |
| 5 | Inbox = alerts first | Tips don’t compete with real household signals |

---

## Expert sign-off questions for founder

1. Is the **5-second job** of intel “everyone okay?” or “coach my week?” (We recommend okay-first, coach second.)  
2. Should **Weekly Driving** stay as its own card or fold into Drive?  
3. When public Family signup opens, should the lock CTA go straight to upgrade — and should the tease match the 3-tile brief?  
4. Priority after drive retest: **Brief redesign** or **real Weekly Family Intelligence**?

---

## Positioning reminder (unchanged)

> Life360 maps where your family goes. MyMotiveFamily understands how your family lives.

Presentation must pass the anti-warden test: calm, useful, honest — never a wall of metrics.
