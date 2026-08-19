# PM Intel — local dealer engagement assistant

**Open the dashboard by double-clicking this file. No localhost. No pnpm.**

`apps/pm-intel/Mazen_PM_Intelligence.html`

It is a single HTML file with Mazen’s Salesforce recap, scoring, temperature, Ask-the-book, and the director team view baked in. Copy it to the desktop and open it in Chrome or Edge.

Rebuild after engine changes:

```bash
node apps/pm-intel/scripts/build-html.mjs
```

Local-first dashboard for vAuto / Cox Automotive performance managers. It answers questions about a book of stores (last engagement, temperature, cadence) and rolls those scores up from rooftop → PM → director team.

Dealer recaps stay in the browser. There is no cloud LLM call.

## Why this exists

The first POP dashboard scored accounts with a single heuristic that mixed activity volume, recency, and comment sentiment. That punished older Salesforce rows where comments were never required.

This app treats engagement as three separate facts:

1. **Missing notes are not a bad visit.** Customer Impression notes begin March 2026. Blank comments before that date are `legacy_unscored`. Temperature is omitted from the health formula instead of scored as cold.
2. **Type matters.** Quarterly Business Reviews and Performance Reviews outweigh General / Unspecified tasks.
3. **Cadence matters.** Health uses recency plus 90/180-day frequency (target: ~3 touches / 90 days).

Those store scores roll to a PM score, then to a director **team versus team** view.

## How to open it

Double-click `Mazen_PM_Intelligence.html` (in this folder). Chrome or Edge. No install.

Director view → **Load illustration peer team** fills Team Canada B with labeled SAMPLE rows so the comparison layout is visible before a second live recap is pasted into a future export.

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
