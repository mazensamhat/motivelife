package expo.modules.fusedlocation

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Isolated fused-location foreground service for MyMotiveFamily.
 *
 * Kept separate from Expo's TaskManager / WebView activity lifecycle so
 * Galaxy Z Fold does not hard-crash when permission sheets settle.
 */
class FamilyLocationService : Service() {
  companion object {
    const val ACTION_START = "expo.modules.fusedlocation.START"
    const val ACTION_STOP = "expo.modules.fusedlocation.STOP"
    const val ACTION_UPDATE = "expo.modules.fusedlocation.UPDATE"
    const val EXTRA_INTERVAL_MS = "intervalMs"
    const val EXTRA_FASTEST_MS = "fastestMs"
    const val EXTRA_PRIORITY = "priority"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    private const val CHANNEL_ID = "motivelife_family_location"
    private const val NOTIFICATION_ID = 73142
    private const val TAG = "FamilyLocationService"

    @Volatile
    var running: Boolean = false
      private set
  }

  private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }
  private var callback: LocationCallback? = null
  private var intervalMs: Long = 4_000L
  private var fastestMs: Long = 2_000L
  private var priority: Int = Priority.PRIORITY_HIGH_ACCURACY

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelfSafe()
        return START_NOT_STICKY
      }
      ACTION_UPDATE, ACTION_START, null -> {
        intervalMs = intent?.getLongExtra(EXTRA_INTERVAL_MS, intervalMs) ?: intervalMs
        fastestMs = intent?.getLongExtra(EXTRA_FASTEST_MS, fastestMs) ?: fastestMs
        priority = intent?.getIntExtra(EXTRA_PRIORITY, priority) ?: priority
        val title =
          intent?.getStringExtra(EXTRA_TITLE)
            ?: "MotiveLife KINZO AI"
        val body =
          intent?.getStringExtra(EXTRA_BODY)
            ?: "Sharing your live location with your household"
        try {
          startAsForeground(title, body)
          startFusedUpdates()
          running = true
        } catch (t: Throwable) {
          Log.e(TAG, "Failed to start fused location service", t)
          FusedLocationModule.emitError(t.message ?: "start failed")
          stopSelfSafe()
        }
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopFusedUpdates()
    running = false
    super.onDestroy()
  }

  private fun startAsForeground(title: String, body: String) {
    ensureChannel()
    val notification = buildNotification(title, body)
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
      )
    } else {
      @Suppress("DEPRECATION")
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val mgr = getSystemService(NotificationManager::class.java) ?: return
    val existing = mgr.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "KINZO AI location",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Keeps MyMotiveFamily sharing while the phone is locked"
        setShowBadge(false)
      }
    mgr.createNotificationChannel(channel)
  }

  private fun buildNotification(title: String, body: String): Notification {
    val launch =
      packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
        PendingIntent.getActivity(
          this,
          0,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(android.R.drawable.ic_menu_mylocation)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setContentIntent(launch)
      .build()
  }

  private fun startFusedUpdates() {
    stopFusedUpdates()
    val request =
      LocationRequest.Builder(priority, intervalMs)
        .setMinUpdateIntervalMillis(fastestMs)
        .setMinUpdateDistanceMeters(0f)
        .setWaitForAccurateLocation(false)
        .setMaxUpdates(Int.MAX_VALUE)
        .build()

    val cb =
      object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
          val loc = result.lastLocation ?: return
          FusedLocationModule.emitLocation(
            mapOf(
              "lat" to loc.latitude,
              "lng" to loc.longitude,
              "accuracyM" to loc.accuracy.toDouble(),
              "speedMps" to if (loc.hasSpeed()) loc.speed.toDouble() else null,
              "headingDeg" to if (loc.hasBearing()) loc.bearing.toDouble() else null,
              "altitudeM" to if (loc.hasAltitude()) loc.altitude else null,
              "recordedAtMs" to loc.time,
              "provider" to (loc.provider ?: "fused")
            )
          )
        }
      }
    callback = cb
    try {
      fused.requestLocationUpdates(request, cb, Looper.getMainLooper())
    } catch (se: SecurityException) {
      Log.e(TAG, "Missing location permission", se)
      FusedLocationModule.emitError("location permission missing")
      stopSelfSafe()
    }
  }

  private fun stopFusedUpdates() {
    val cb = callback ?: return
    try {
      fused.removeLocationUpdates(cb)
    } catch (_: Throwable) {
      // ignore
    }
    callback = null
  }

  private fun stopSelfSafe() {
    stopFusedUpdates()
    running = false
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Throwable) {
      // ignore
    }
    stopSelf()
  }
}

fun Context.fusedLocationServiceIntent(action: String): Intent =
  Intent(this, FamilyLocationService::class.java).setAction(action)
