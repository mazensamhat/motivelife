/**
 * Family drive telematics policy.
 *
 * Phone GPS is too noisy for hard-brake / rapid-accel / sudden-stop counts on
 * real family phones — those false positives wrecked Drive Score trust.
 * Keep top speed + distance, and prefer on-device phone-in-use for distraction.
 *
 * Flip COUNT_AGGRESSIVE_GPS_EVENTS to true only after a future sensor pass
 * (IMU / better motion fusion) lands.
 */

/** When false, hard brake / rapid accel / unusual GPS events are not counted. */
export const COUNT_AGGRESSIVE_GPS_EVENTS = false;

/** Min speed (km/h) before "phone in use while driving" can count. */
export const PHONE_USE_MIN_SPEED_KMH = 25;

/** Don't stack phone-use ticks more than once per this window. */
export const PHONE_USE_COOLDOWN_MS = 45_000;
