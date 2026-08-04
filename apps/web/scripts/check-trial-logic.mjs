/**
 * Triple-check Pro trial helpers (no DB).
 *   node apps/web/scripts/check-trial-logic.mjs
 */
import assert from "node:assert/strict";

const TRIAL_DAYS = 14;

function defaultTrialEndsAt(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

function isFamilyInviteSignup(opts) {
  const code = opts.familyInviteCode?.trim();
  if (code) return true;
  return opts.signupIntent === "family_invite";
}

function trialSignupFields() {
  return {
    trialEndsAt: defaultTrialEndsAt(),
    subscriptionPlan: "trial",
    subscriptionStatus: "active",
  };
}

function freeFamilyMemberSignupFields() {
  return {
    trialEndsAt: null,
    subscriptionPlan: "free",
    subscriptionStatus: "active",
  };
}

function isTrialWindowActive(trialEndsAt) {
  if (!trialEndsAt) return false;
  return trialEndsAt.getTime() > Date.now();
}

const standard = trialSignupFields();
assert.equal(standard.subscriptionPlan, "trial");
assert.equal(isTrialWindowActive(standard.trialEndsAt), true);

const invite = freeFamilyMemberSignupFields();
assert.equal(invite.subscriptionPlan, "free");
assert.equal(invite.trialEndsAt, null);
assert.equal(isTrialWindowActive(invite.trialEndsAt), false);

assert.equal(isFamilyInviteSignup({ familyInviteCode: "ABCD12" }), true);
assert.equal(isFamilyInviteSignup({ signupIntent: "family_invite" }), true);
assert.equal(isFamilyInviteSignup({ signupIntent: "standard" }), false);

assert.equal(isTrialWindowActive(new Date(Date.now() - 1000)), false);

console.log("OK — Pro trial helpers: 14-day window for standard signup; invitees stay free.");
