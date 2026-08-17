# Kashu Master Plan

> **Status: LOCKED** — Product decisions consolidated 2026-08-17.  
> Next: screen-by-screen UX and development specifications.  
> Do not diverge from this document without an explicit product decision.

**Name:** Kashu  
**Category:** Cash-Flow Intelligence  
**Home:** MyMotiveLife

Kashu is **not** a budgeting app, bank account, payment service, or traditional expense tracker.

---

## 1. Product thesis

**Core purpose**

> Know what's coming. Protect what matters. Know what you can safely spend.

**Central question**

> How much can I safely spend right now without causing a cash-flow problem before my next payday?

That question is the foundation for the product, UI, intelligence engine, and marketing.

**Differentiation**

Plenty of products can say: “You spent $847 eating out last month.” Useful — but retrospective.

Kashu’s opportunity:

> You have $4,821 in your account, but only $1,217 is actually safe to use. Your lowest projected balance is $684 on Thursday. Spending $500 today is safe, but moving your $715 phone payment to the 23rd would increase your cash-flow buffer by $1,424.

That is **cash-flow intelligence**.

**Recurring user loop**

```
UPLOAD → UNDERSTAND → CONFIRM → PREDICT → ACT → UPDATE → LEARN
```

---

## 2. No bank connection

Kashu will **not** require users to connect their bank accounts.

It operates from information the user deliberately provides.

This is not a limitation to hide — it is positioning:

> Your bank account isn't an open book.  
> Kashu doesn't need permanent access to your bank account to understand your money.  
> Upload what you choose. Tell Kashu what matters. Stay in control.

**Website must explicitly say:** NO BANK CONNECTION REQUIRED

---

## 3. Onboarding

First experience framing:

### Let's understand how your money moves.

### Step 1 — Income

Ask: **How does money come in?**

Capture:

- Salary / hourly income
- Pay frequency
- Next payday
- Typical net paycheck
- Bonus, commission, overtime
- Pension, benefits
- Side income / other household income
- Fixed vs variable income

Kashu must distinguish **guaranteed income from variable income**.

For variable income, create three forecasts:

| Forecast | Use |
|----------|-----|
| **Conservative** | Funds mandatory obligations until actual deposit arrives |
| **Expected** | Default planning view |
| **High** | Upside scenario |

---

## 4. Upload statements

### Let Kashu learn your money.

Recommended messaging:

| History | Message |
|---------|---------|
| **1 month** | Enough to start |
| **3 months** | Recommended |
| **6 months** | Better predictions |
| **12 months** | Seasonal intelligence |

**Primary format:** PDF bank statements  
**Also supported:** CSV

Extract:

- Transaction date, merchant/payee, debit, credit
- Running balance, description, account, transaction type

Kashu does **not** blindly accept what it sees. It creates hypotheses and asks the user to confirm important patterns.

---

## 5. Financial Fingerprint

Kashu analyzes statement history and separates money into:

| Layer | Examples |
|-------|----------|
| **Income** | Payroll, bonus, commission, overtime, benefits, side income |
| **Fixed bills** | Mortgage/rent, insurance, utilities, subscriptions, property taxes |
| **Recurring obligations** | Vehicle payments, family transfers, child support, debt payments |
| **Variable necessities** | Fuel, groceries, transportation |
| **Lifestyle patterns** | Coffee, restaurants, shopping, entertainment |
| **Flexible / discretionary** | Purchases that can be delayed without obligation failure |
| **Transfers** | Own-account transfers, reimbursements, refunds, emergency injections |

**Critical:** A $500 credit is **not** automatically income.

Kashu must understand:

**Payroll ≠ Refund ≠ Transfer ≠ Emergency Fund ≠ Reimbursement.**

---

## 6. Recurring-payment detection

Kashu looks for repeating patterns.

Example:

**Lincoln AFS** — $380 — Every 14 days — Confidence: 99%

Prompt: **Is this correct?** → Yes | Edit | Not Recurring

Engine signals:

- Merchant similarity, amount consistency, interval, date drift
- Weekend/holiday movement, historical frequency, user confirmations

### Biweekly means biweekly

Kashu must **not** convert a 14-day obligation into a simplistic monthly bill.

---

## 7. User confirmation

After analysis:

### Here's what Kashu found.

Present the financial model for confirmation (mortgage, insurance, car payment, family obligation, etc.).

User can: **Confirm / Change / Delete / Reclassify**

User can also add bills or obligations that did not appear in the statement period.

---

## 8. Emergency money vs Safe to Spend

User enters **Emergency Reserve** (example: $3,000).

- Kashu knows it exists.
- It is **excluded from Safe to Spend**.
- The normal forecast must work **without** emergency funds.

If Kashu predicts a shortfall, it can say:

> $217 shortfall predicted.  
> Your emergency reserve could cover this, but your reserve would fall from $3,000 to $2,783.

The user decides whether to use it.

---

## 9. Safety Floor

Separate from emergency money.

Ask:

> How much do you always want left untouched in your operating account?

Suggested: **$250 | $500 | $1,000 | Custom**

If the account has $2,000 and the floor is $500, Kashu never treats the full $2,000 as spendable.

Later: recommend increasing the floor toward an entire pay-cycle buffer.

---

## 10. Home screen

Radically simpler than a traditional financial dashboard.

**Dominant number:** Safe to Spend

```
Account Balance          $3,412
Already Spoken For      −$2,185
Safety Floor              −$500
───────────────────────────────
SAFE TO SPEND              $727
```

Then: **Safe through next payday ✓**

### Formula (fundamental)

```
ACCOUNT BALANCE
− RESERVED OBLIGATIONS
− SAFETY FLOOR
= SAFE TO SPEND
```

The bank balance is secondary.

---

## 11. Cash-Flow Radar

Under Safe to Spend:

### YOUR NEXT 14 DAYS

Visual timeline of upcoming events (payday, obligations, expected living spend, mortgage, etc.). Each event changes the projected balance.

Look-ahead: **14 / 30 / 60 / 90 days**

| Color | Meaning |
|-------|---------|
| Green | Healthy |
| Yellow | Approaching safety floor |
| Red | Projected collision |

---

## 12. Projected Low

**PROJECTED LOW** — lowest expected balance before the next meaningful income event.

Often more useful than today’s balance. Kashu sees collisions **before** they occur.

---

## 13. Payday Mode

Payday is an event. When the user confirms pay (or updates balance/statement), Kashu recalculates.

Instead of “I got $3,700,” the user understands: **“$960 isn't already spoken for.”**

That is one of Kashu’s strongest behavioral benefits.

---

## 14. Bill Waves

Obligations often cluster around particular income periods.

Examples:

- **BIG-PAY WAVE** — mortgage, insurance, property tax, vehicle, family obligation, beginning-of-month bills
- **REGULAR-PAY WAVE** — phone, home insurance, subscriptions, vehicle, family obligation, living expenses

Kashu identifies **which paycheck should fund which obligation** — smarter than dividing monthly bills by two.

---

## 15. Cash-Flow Collision Detection

Continuously detect timing collisions, e.g.:

> Your income is sufficient for the month, but your payment timing creates a $740 shortage between September 4–9.

Identify the cause (mortgage + insurance + phone, etc.).

Not: “You're overspending.”  
Instead: **Your bills are colliding with your income timing.**

---

## 16. Bill Timing Optimizer

Simulate moving controllable payments. Recommend a date that improves Projected Low.

Kashu does **not** change the payment — it tells the user what to request from the provider.

---

## 17. What-If Simulator

Specialized financial simulator:

Spend $500? Buy a $2,000 TV? Lose bonus? Raise? New car payment? Pay off debt? Move mortgage? Change jobs? Cut restaurants? Increase savings?

Recalculate: Current Projected Low → After Change → Difference.

---

## 18. “Can I afford it?”

Signature Kashu functionality.

User: **Can I spend $600 today?**

Kashu does **not** only compare $600 to today’s balance — it simulates the future and reports whether obligations stay covered and what happens to Projected Low.

---

## 19. Ask Kashu

Conversational interface grounded entirely in the user’s Kashu model (not generic advice).

Examples: weekend spend, why short before payday, pay Dad today or Friday, which bill is the problem, bonus scenarios, move insurance, how much to leave untouched.

---

## 20. Updating without bank connections

### UPDATE KASHU

Three primary options:

1. **Enter Current Balance**
2. **Upload New Statement**
3. **Add Transaction / Change**

Example: expected $2,921 vs actual $2,814 → difference −$107 → ask what changed, or reconcile via new statement.

---

## 21. Learning loop

Predicted vs actual builds forecast confidence over time (illustrative until methodology is defined).

Every statement teaches: actual spending, bill drift, amount changes, new subscriptions, income changes, lifestyle/seasonal patterns, missing transactions, forecast error.

---

## 22. Bank Switching Mode

Keep this feature.

User: **I'm switching banks.**

Track which payees/payroll have successfully moved. Warn before closing the old account if expected payments have not cleared the new account. Eventually: **SAFE TO CLOSE OLD ACCOUNT ✓**

No bank connection required — user confirms migrations or uploads statements showing clearance.

---

## 23. Module ownership — Kashu owns money

Now that Kashu exists: **KASHU OWNS MONEY.**

Not pieces of money scattered across modules.

Kashu owns:

- Safe to Spend, cash-flow trajectory, income model
- Statement analysis, bills, obligations, financial patterns
- Projected balance, cash-flow alerts
- Financial What-If, bill timing, financial recommendations
- Ask Kashu, emergency/safety reserves

One authoritative financial engine.

---

## 24. LifeVue’s financial role

Do not remove financial info from LifeVue — **simplify** it.

LifeVue may show a compact **Financial Future** card (health signal, Safe to Spend, 30-day outlook, next risk) with **Open Kashu →**.

| Module | Answers |
|--------|---------|
| **LifeVue** | How is my financial life doing? |
| **Kashu** | Exactly what's happening with my money and what should I do? |

---

## 25. Future Simulator (global)

Keep the global MyMotiveLife Future Simulator.

Do **not** duplicate Kashu’s financial simulator. When money is involved, the global simulator **calls Kashu’s engine**. Other modules calculate their respective effects.

---

## 26. VYRA vs Ask Kashu

| Surface | Role |
|---------|------|
| **Ask Kashu** | Financial specialist — “Can I afford this?” |
| **VYRA** | Life intelligence — “Should I take this job?” |

VYRA may consult Kashu (money), KINZO (family/commute), DayO (schedule), UPLIFT (goals), LifeVue (overall life), then synthesize. Prevents duplicate AI doing the same job.

---

## 27. Digital Twin — Money → Kashu

Rather than a generic **Money** input floating in the Life Graph:

### Money → Kashu

Kashu is the user’s **financial Digital Twin**.

Behind that node: income, statements, bills, obligations, spending patterns, current balance, safety floor, emergency reserve, forecast, trajectory.

Other modules access financial intelligence **through Kashu**, not parallel models.

---

## 28. Final MyMotiveLife architecture

| Product | Role |
|---------|------|
| **DayO** | TODAY — calendar, tasks, daily execution |
| **LifeVue** | ME — Digital Twin and cross-life visibility |
| **UPLIFT** | GOALS — milestones, progress, direction |
| **KINZO** | FAMILY — location, movement, routines, driving |
| **Kashu** | MONEY — cash-flow intelligence and prediction |
| **VYRA** | INTELLIGENCE — AI reasoning across the ecosystem |

Underneath: **ONE DIGITAL TWIN · ONE LIFE GRAPH**

Modules specialize. Data is not duplicated.

---

## 29. Cross-module intelligence (later)

| Flow | Example |
|------|---------|
| KINZO → Kashu | Extra km driven → extra fuel spend prediction |
| DayO → Kashu | Out-of-town meetings → travel spend adjustment |
| UPLIFT → Kashu | Vacation goal needs $300/mo — does cash flow support it? |
| Kashu → LifeVue | Financial trajectory improved three months |
| VYRA → all | “Should I change jobs?” — query specialists and synthesize |

---

## 30. Website

Hierarchy:

# SIX PRODUCTS. ONE LIFE OPERATING SYSTEM.

- DayO runs your day.
- LifeVue sees your life.
- KINZO understands your family.
- UPLIFT moves your goals forward.
- **Kashu understands your money.**
- VYRA connects the intelligence.

Kashu product card / showcase:

### KNOW BEFORE YOU SPEND

Safe to Spend breakdown → **Safe through next payday ✓**

> Your bank tells you what you have.  
> **Kashu tells you what you can actually use.**

---

## 31. Development phases

| Phase | Scope |
|-------|--------|
| **1 — Foundation** | Income entry, bill/obligation entry, statement upload/parser, current balance, classification, recurring detection |
| **2 — Intelligence** | Safe to Spend, projected balances, Projected Low, payday modeling, bill waves, Cash-Flow Radar, safety floor |
| **3 — Prediction** | Collision detection, bill timing optimizer, variable-income modeling, emergency-fund intelligence, forecast confidence |
| **4 — Simulation** | What-If and Can-I-Afford-It |
| **5 — Ask Kashu** | Conversational financial intelligence grounded in the user’s model |
| **6 — Life OS** | Kashu as the financial intelligence service for LifeVue, VYRA, DayO, UPLIFT, and KINZO where appropriate |

---

## Locked decisions checklist

- [x] Name: **Kashu** · Category: **Cash-Flow Intelligence**
- [x] No bank connection required — upload / enter / confirm
- [x] Safe to Spend = Balance − Reserved obligations − Safety floor
- [x] Emergency reserve exists but is excluded from Safe to Spend
- [x] Biweekly stays biweekly (no false monthly conversion)
- [x] Credits are classified (payroll ≠ refund ≠ transfer ≠ emergency)
- [x] Kashu owns all money intelligence in MyMotiveLife
- [x] LifeVue shows a thin financial summary → Open Kashu
- [x] Ask Kashu ≠ VYRA (specialist vs life OS)
- [x] Global Future Simulator calls Kashu for money effects
- [x] Bank Switching Mode retained

**Next document:** screen-by-screen UX + Phase 1 technical specs.
