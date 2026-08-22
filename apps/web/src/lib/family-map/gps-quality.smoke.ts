/**
 * GPS quality gates — rejects trans-continental stale-cache teleports.
 */
import assert from "node:assert/strict";
import {
  displacementKmh,
  isStaleCacheTeleport,
  shouldAcceptPinMove,
} from "./gps-quality";

// SK teleport: ~7,000 km with a fresh heartbeat clock (dt ≈ 30s).
const seoulToTorontoM = 10_600_000;
assert.equal(
  shouldAcceptPinMove({
    movedM: seoulToTorontoM,
    dtSec: 30,
    accuracyM: 500,
    prevAccuracyM: 25,
    prevHeadingDeg: null,
    moveBearingDeg: null,
    sanitizedSpeedKmh: 0,
    presenceHint: "stationary",
    fixAgeMs: 12 * 60_000,
  }),
  false,
  "continent hop while holding phone must reject"
);

assert.equal(
  isStaleCacheTeleport({
    movedM: seoulToTorontoM,
    fixAgeMs: 12 * 60_000,
    accuracyM: 2_000,
  }),
  true
);

// Legit commute catch-up after frozen pin (~12 km in ~8 min).
assert.equal(
  shouldAcceptPinMove({
    movedM: 12_000,
    dtSec: 480,
    accuracyM: 45,
    prevAccuracyM: 30,
    prevHeadingDeg: 90,
    moveBearingDeg: 92,
    sanitizedSpeedKmh: 55,
    presenceHint: "driving",
    fixAgeMs: 2_000,
  }),
  true,
  "highway catch-up should still accept"
);

// Home-from-mall hop while walking band.
assert.equal(
  shouldAcceptPinMove({
    movedM: 220,
    dtSec: 600,
    accuracyM: 55,
    prevAccuracyM: 40,
    prevHeadingDeg: null,
    moveBearingDeg: null,
    sanitizedSpeedKmh: 4,
    presenceHint: "stationary",
    fixAgeMs: 1_500,
  }),
  true,
  "short shopping-to-home hop should accept"
);

// dt floor must not make impossible hops look like 170 km/h drives.
const implied = displacementKmh(seoulToTorontoM, 30);
assert.ok(implied > 1_000_000, "raw implied speed is absurd without floor");

assert.equal(
  shouldAcceptPinMove({
    movedM: seoulToTorontoM,
    dtSec: 3_600,
    accuracyM: 80,
    prevAccuracyM: 25,
    prevHeadingDeg: null,
    moveBearingDeg: null,
    sanitizedSpeedKmh: 0,
    presenceHint: "stationary",
    fixAgeMs: 45 * 60_000,
  }),
  false,
  "even with 1h gap, continent hop while stationary must reject"
);

console.log("gps-quality.smoke: ok");
