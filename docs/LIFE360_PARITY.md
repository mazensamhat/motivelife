# Life360 parity roadmap (minus insurance)

**Goal:** MyMotiveFamily functions like Life360 for family location — then adds Motive intelligence on top.  
**Explicitly excluded forever:** insurance products, roadside dispatch networks, identity-theft reimbursement, towing marketplaces, hardware trackers (Tile), data-broker / ad products.

## Status legend

| Status | Meaning |
|--------|---------|
| Done | Ships in production |
| Foundation | Code landed this sprint — needs store rebuild / keys to go live |
| Partial | Works in-app; missing Always/push polish |
| Todo | Not started |

## Core Life360 surfaces

| Feature | Status | Notes |
|---------|--------|-------|
| Live map + speed (free) | Done | Freemium enforced |
| Always / background location | Foundation | Low-power Always: Balanced accuracy, pause-when-still, 80m / 90s gates, no AutomotiveNavigation; web stops polling when backgrounded |
| Day / week / month history | Foundation | Week range added |
| Place arrive/leave alerts | Partial → Foundation | Logic done; routes through push when tokens exist |
| No-show / school pickup | Partial → Foundation | Logic done; push wired |
| Drive Score + weekly report | Done | Open on Family plan |
| Phone distraction | Foundation | Foreground-active samples while driving ≥20 km/h → trip counter + UI tile |
| Crash / SOS (no insurance) | Foundation | Household SOS button + push; calm sudden-stop still separate |
| Battery + last updated | Foundation | Web Battery API + native `expo-battery` on BG posts |
| Circles + temporary | Done | Family + Friends + temp |
| Check-in / ping / SMS | Partial | SMS presets + location ping |
| Push notifications (APNs/FCM) | Foundation | Expo tokens + send on `createNotification`; needs EAS rebuild + credentials |
| Privacy levels | Foundation | precise / approximate / destination_only / eta_only / driving_status_only / off + settings UI |
| Kids / teen controls | Partial | Scaffold; privacy Off now meaningful |
| Satellite map | Done | |
| Member list presence/speed | Done | |

## Motive extras (beyond Life360)

| Feature | Status |
|---------|--------|
| Destination Prediction™ (continuous confidence) | Done |
| Normal Life / Something’s Different | Done |
| Family Flow (+ real conflict notes) | Foundation |
| Fuel / shopping / visits intel | Done |
| Digital Twin Life Impact | Done |
| On-device IndexedDB history | Done |

## Build order (remaining)

1. **EAS rebuild** with `expo-notifications` + `expo-battery` + low-power Always — ship store binary `1.0.18` (28)
2. **Configure Expo push credentials** (APNs key + FCM) in EAS
3. **Guardian ACL** for CHILD/TEEN (who can change sharing, leave household)
4. **Phone distraction v2** — motion / screen-on sensors beyond AppState
5. **Crash detection v2** — accelerometer spike + multi-sample confirm (still no dispatch)
6. **Split `family-map-panel.tsx`** for maintainability
7. **Replace request-path DDL** with proper migrations

## Product rule

If Life360 does it for location/safety/circles/driving (and it isn’t insurance/hardware/broker), we do it — then Motive intelligence layers sit on top without paywalling Drive Score inside Family.
