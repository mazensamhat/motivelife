package expo.modules.fusedlocation

import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.atomic.AtomicReference

class StartOptions : Record {
  @Field
  var intervalMs: Double = 4000.0

  @Field
  var fastestIntervalMs: Double = 2000.0

  /** high | balanced | low */
  @Field
  var priority: String = "high"

  @Field
  var notificationTitle: String = "MotiveLife KINZO AI"

  @Field
  var notificationBody: String = "Sharing your live location with your household"
}

/**
 * JS bridge for [FamilyLocationService].
 * Emits `onLocation` / `onError` without going through expo-location TaskManager.
 */
class FusedLocationModule : Module() {
  companion object {
    private const val TAG = "FusedLocationModule"
    private val emitterRef = AtomicReference<((String, Map<String, Any?>) -> Unit)?>(null)

    fun emitLocation(payload: Map<String, Any?>) {
      try {
        val clean = HashMap<String, Any>()
        for ((k, v) in payload) {
          if (v != null) clean[k] = v
        }
        emitterRef.get()?.invoke("onLocation", clean)
      } catch (t: Throwable) {
        Log.w(TAG, "emitLocation failed", t)
      }
    }

    fun emitError(message: String) {
      try {
        emitterRef.get()?.invoke("onError", mapOf("message" to message))
      } catch (t: Throwable) {
        Log.w(TAG, "emitError failed", t)
      }
    }
  }

  private fun appContextOrNull(): Context? {
    return appContext.reactContext?.applicationContext
      ?: appContext.reactContext
  }

  private fun priorityOf(raw: String): Int =
    when (raw.lowercase()) {
      "balanced" -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      "low" -> Priority.PRIORITY_LOW_POWER
      else -> Priority.PRIORITY_HIGH_ACCURACY
    }

  override fun definition() = ModuleDefinition {
    Name("FusedLocation")
    Events("onLocation", "onError")

    OnCreate {
      emitterRef.set { event, body ->
        try {
          sendEvent(event, body)
        } catch (t: Throwable) {
          Log.w(TAG, "sendEvent($event) failed", t)
        }
      }
    }

    OnDestroy {
      emitterRef.set(null)
    }

    Function("isAvailable") {
      true
    }

    Function("isRunning") {
      FamilyLocationService.running
    }

    AsyncFunction("start") { options: StartOptions?, promise: Promise ->
      val context = appContextOrNull()
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "No Android context", null)
        return@AsyncFunction
      }
      val opts = options ?: StartOptions()
      try {
        val intent =
          context.fusedLocationServiceIntent(FamilyLocationService.ACTION_START).apply {
            putExtra(FamilyLocationService.EXTRA_INTERVAL_MS, opts.intervalMs.toLong().coerceAtLeast(1000L))
            putExtra(
              FamilyLocationService.EXTRA_FASTEST_MS,
              opts.fastestIntervalMs.toLong().coerceAtLeast(500L)
            )
            putExtra(FamilyLocationService.EXTRA_PRIORITY, priorityOf(opts.priority))
            putExtra(FamilyLocationService.EXTRA_TITLE, opts.notificationTitle)
            putExtra(FamilyLocationService.EXTRA_BODY, opts.notificationBody)
          }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        promise.resolve(true)
      } catch (t: Throwable) {
        Log.e(TAG, "start failed", t)
        promise.reject("E_START", t.message, t)
      }
    }

    AsyncFunction("update") { options: StartOptions?, promise: Promise ->
      val context = appContextOrNull()
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "No Android context", null)
        return@AsyncFunction
      }
      if (!FamilyLocationService.running) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val opts = options ?: StartOptions()
      try {
        val intent =
          context.fusedLocationServiceIntent(FamilyLocationService.ACTION_UPDATE).apply {
            putExtra(FamilyLocationService.EXTRA_INTERVAL_MS, opts.intervalMs.toLong().coerceAtLeast(1000L))
            putExtra(
              FamilyLocationService.EXTRA_FASTEST_MS,
              opts.fastestIntervalMs.toLong().coerceAtLeast(500L)
            )
            putExtra(FamilyLocationService.EXTRA_PRIORITY, priorityOf(opts.priority))
          }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
        promise.resolve(true)
      } catch (t: Throwable) {
        promise.reject("E_UPDATE", t.message, t)
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      val context = appContextOrNull()
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        context.startService(context.fusedLocationServiceIntent(FamilyLocationService.ACTION_STOP))
        promise.resolve(true)
      } catch (t: Throwable) {
        promise.reject("E_STOP", t.message, t)
      }
    }

    AsyncFunction("getCurrentPosition") { promise: Promise ->
      val context = appContextOrNull()
      if (context == null) {
        promise.reject("E_NO_CONTEXT", "No Android context", null)
        return@AsyncFunction
      }
      try {
        val fused = LocationServices.getFusedLocationProviderClient(context)
        fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
          .addOnSuccessListener { loc ->
            if (loc == null) {
              promise.resolve(null)
              return@addOnSuccessListener
            }
            promise.resolve(
              mapOf(
                "lat" to loc.latitude,
                "lng" to loc.longitude,
                "accuracyM" to loc.accuracy.toDouble(),
                "speedMps" to if (loc.hasSpeed()) loc.speed.toDouble() else null,
                "headingDeg" to if (loc.hasBearing()) loc.bearing.toDouble() else null,
                "recordedAtMs" to loc.time,
                "provider" to (loc.provider ?: "fused")
              )
            )
          }
          .addOnFailureListener { err ->
            promise.reject("E_CURRENT", err.message, err)
          }
      } catch (se: SecurityException) {
        promise.reject("E_PERMISSION", se.message, se)
      } catch (t: Throwable) {
        promise.reject("E_CURRENT", t.message, t)
      }
    }
  }
}
