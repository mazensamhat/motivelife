package expo.modules.phoneusage

import android.app.KeyguardManager
import android.content.Context
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Distracted-driving signal for MyMotiveFamily:
 * screen is on AND the lock screen is not showing.
 *
 * Does not require PACKAGE_USAGE_STATS — safe for Play, low battery cost
 * (called only when we already post a location fix).
 */
class PhoneUsageModule : Module() {
  private fun appContextOrNull(): Context? {
    return appContext.reactContext?.applicationContext
      ?: appContext.reactContext
  }

  override fun definition() = ModuleDefinition {
    Name("PhoneUsage")

    Function("isPhoneInUse") {
      val context = appContextOrNull() ?: return@Function false
      val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        ?: return@Function false
      val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        ?: return@Function false

      val interactive = try {
        power.isInteractive
      } catch (_: Throwable) {
        @Suppress("DEPRECATION")
        power.isScreenOn
      }
      if (!interactive) return@Function false

      // Lock screen / AOD with notifications is not "using the phone".
      val locked = try {
        keyguard.isKeyguardLocked
      } catch (_: Throwable) {
        false
      }
      !locked
    }
  }
}
