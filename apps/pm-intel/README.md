# PM Intel — local dealer engagement assistant

Local-first dashboard for vAuto / Cox Automotive performance managers. It answers questions about a book of stores (last engagement, temperature, cadence) and rolls those scores up from rooftop → PM → director team.

Dealer recaps stay in the browser. There is no cloud LLM call.

## Why this exists

The first POP dashboard scored accounts with a single heuristic that mixed activity volume, recency, and comment sentiment. That punished older Salesforce rows where comments were never required.

This app treats engagement as three separate facts:

1. **Missing notes are not a bad visit.** Customer Impression notes begin March 2026. Blank comments before that date are `legacy_unscored`. Temperature is omitted from the health formula instead of scored as cold.
2. **Type matters.** Quarterly Business Reviews and Performance Reviews outweigh General / Unspecified tasks.
3. **Cadence matters.** Health uses recency plus 90/180-day frequency (target: ~3 touches / 90 days).

Those store scores roll to a PM score, then to a director **team versus team** view.

## Run locally

From the repo root:

```bash
pnpm install
pnpm --filter @forward/pm-intel dev
```

Open http://localhost:3020

```bash
pnpm --filter @forward/pm-intel test
pnpm --filter @forward/pm-intel build
```

## Seed data

`public/data/mazen-recap.json` is Mazen Samhat’s 24-month Salesforce recap (1,225 completed activities, export `Mazen PM Dealer Recap-2026-08-18-14-31-30.xlsx`).

This is client account activity. Do not deploy it to a public URL without access control.

## Import other PMs

Director view → **Import recap**. Drop another PM’s Salesforce xlsx, name the PM, assign Team Canada A or B. Imports persist in `localStorage` on that browser only.

**Load illustration peer team** fills Team Canada B with labeled `SAMPLE` rows so the comparison layout is visible before a second live recap exists.

## Ask the book

The assistant is a local retrieval + intent engine. Example questions:

- When was the last engagement with Ajax Nissan?
- What is the temperature at Steele Subaru?
- Which stores are at risk?
- Who should I call this week?
- Compare Team Canada A vs Team Canada B

## Scoring (short)

| Layer | Formula |
| --- | --- |
| Store | Recency 30 + cadence 30 + type mix 25 + temperature 15 **only if scored notes exist** (otherwise rescale over 85) |
| PM | 45% avg store health + 25% 90-day coverage + 15% 30-day coverage + 15% mix quality |
| Team | Average of PM scores |
| Temperature | Customer Impression lexicon; `null` when notes are missing |
