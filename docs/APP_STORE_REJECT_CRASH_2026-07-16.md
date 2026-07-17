# App Store rejection — crash on launch (Jul 16, 2026)

## What Apple said

- **1.5.0 Safety: Developer Information**
- **2.1.0 Performance: App Completeness** (with crash logs)

Rejected binary: MotiveLife **1.0.3 (7)** — Expo shell `apps/mobile-eas`.

## Crash cause (2.1)

Both `.ips` logs show the same pattern:

- Device: iPad (iPad15,3), iOS 26.5
- Crash ~75ms after launch (`SIGABRT`)
- React Native fatal: `RCTExceptionsManager reportFatal` on `com.meta.react.turbomodulemanager.queue`

Root cause in that binary: `AppShell.tsx` used `WEB_URL` **without importing it** from `./config`, so JS threw `ReferenceError` immediately and the app aborted.

Fixed on `main` by importing `WEB_URL` from `./config` (default `https://www.mymotivelife.com`). Follow-up hardening:

- Lazy-load Health Connect only on Android (never touch that native module on iOS)
- Exclude Health Connect packages from iOS autolinking
- Error boundary around the shell so a JS error shows Retry instead of a hard crash
- Bump app version to **1.0.5** / build **8+**

## Developer information (1.5)

In App Store Connect, these must be set and must load in Safari:

| Field | Value |
|-------|--------|
| Privacy Policy URL | `https://www.mymotivelife.com/privacy` |
| Support URL | `https://www.mymotivelife.com/support` |
| Marketing URL (optional) | `https://www.mymotivelife.com` |

Also confirm Apple Developer → Membership / Account Holder contact email is valid.
