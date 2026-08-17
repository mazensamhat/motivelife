/**
 * Smoke checks for Family Map cluster label + orb layout helpers.
 * Run: node --experimental-strip-types apps/web/scripts/check-family-cluster-label.ts
 */
import {
  clusterOrbLayout,
  clusterStatusLabel,
} from "../src/lib/family-map/cluster-label.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(
  clusterStatusLabel([
    { placeName: "Home" },
    { placeName: "Home" },
    { placeName: "Home" },
    { placeName: "Home" },
  ]) === "4 at Home",
  "4 at Home for shared Home place"
);

assert(
  clusterStatusLabel([
    { placeName: "Parents" },
    { placeName: "Parents" },
    { placeCategory: "home" },
  ]) === "3 at Parents",
  "prefer shared place name over home category"
);

assert(
  clusterStatusLabel([{ placeCategory: "home" }, { placeCategory: "home" }]) ===
    "2 at Home",
  "home category fallback"
);

assert(
  clusterStatusLabel([{ placeName: null }, { placeName: "" }]) === "2 together",
  "together when no place"
);

const full = clusterOrbLayout({ memberCount: 4, tier: "full" });
assert(full.cols === 2, "4 members → 2 cols");
assert(full.orbSize === full.orbSize && full.orbSize > 0, "orb size positive");
assert(
  full.orbSize === 2 * full.cell + full.gap + 2 * full.orbPad,
  "orb is square around 2×2 grid"
);

const compact = clusterOrbLayout({ memberCount: 4, tier: "compact" });
assert(compact.orbSize < full.orbSize, "compact orb smaller than full");

const wide = clusterOrbLayout({ memberCount: 9, tier: "full" });
assert(wide.cols === 3, "9 members → 3 cols");

console.log("family-cluster-label checks passed");
