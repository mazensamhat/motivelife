# Getting 12 Play Store testers (without a big network)

Google requires **12 opted-in testers on closed testing for 14 consecutive days** before production (personal accounts created after Nov 2023). You do **not** need 20 anymore (reduced to **12** in Dec 2024).

Firebase Test Lab does **not** replace this — testers must install from **Play Store closed testing**.

---

## Realistic ways to find 12 people

### People you already know (aim for 8–10)

- Partner, family, close friends
- Former colleagues or classmates
- Anyone who tried the web app already
- **You count** if you install from the Play beta link on your Z Fold (use your Google account)

Each person needs a **real Google account** and must **accept the invite** and **open the app**.

### Ask publicly (fill the rest)

Post a short message:

> I'm launching **MotiveLife** — an AI life coach app (voice → goals → daily plan). Looking for **12 Android beta testers** for 2 weeks. Free Pro trial inside. Reply or DM your Gmail and I'll send the Play Store beta link.

Good places:

- Your LinkedIn / Facebook / X
- WhatsApp groups you're already in
- Local entrepreneur or fitness groups
- [r/AndroidApps](https://reddit.com/r/AndroidApps) or [r/SideProject](https://reddit.com/r/SideProject) — follow each sub's promo rules

### Closed testing link (easiest for strangers)

Play Console → **Closed testing** → **Testers** → **Copy link**

Anyone with the link can opt in (if you allow link sharing). You still need **12 opted-in** at the same time for 14 days.

---

## What does NOT count

| Method | Counts toward 12? |
|--------|-------------------|
| Play closed testing (real install) | **Yes** |
| Firebase App Distribution | No |
| Firebase Test Lab | No |
| Internal testing only | No |
| Sideload / USB install only | No |
| Fake duplicate accounts you never use | No — Google checks engagement |

---

## Minimum viable plan

1. Upload AAB to **Closed testing** today
2. Add **6 emails** you know will say yes
3. Post once for **6 more** beta testers
4. Start the 14-day clock when you have **12 opted-in**
5. Remind testers once mid-week to open the app

---

## Paid tester services (last resort)

Some services provide professional closed-testers for a fee (~$15–50). Search "Google Play 12 testers closed testing" if you're stuck after trying friends + one public post. Read reviews before paying.

---

## Firebase Test Lab vs Play testing

| | Firebase Robo | Play closed testing |
|--|---------------|---------------------|
| Required for launch? | **No** | **Yes** |
| Works with WebView apps? | Often **fails** (your crash) | **Yes** (your Z Fold proves it) |

**You can launch without ever passing Firebase Test Lab.**

To retry Test Lab with less crashing, upload `apps/mobile/robo_script.json` when starting a Robo test (45-second wait, no random tapping). See `docs/FIREBASE_AND_PLAY_TESTING.md`.
