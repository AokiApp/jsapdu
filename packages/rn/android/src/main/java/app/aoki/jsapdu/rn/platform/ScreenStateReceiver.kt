package app.aoki.jsapdu.rn.platform

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.PowerManager

/**
 * Screen/Doze state BroadcastReceiver.
 * - Listens to ACTION_SCREEN_OFF and ACTION_DEVICE_IDLE_MODE_CHANGED.
 * - Invokes provided callback to cancel waits and release NFC device resources.
 *
 * Register/unregister from SmartCardPlatformImpl.init()/release().
 */
object ScreenStateReceiver : BroadcastReceiver() {

  private var isRegistered = false
  private var onCancelAndRelease: (() -> Unit)? = null

  /**
   * Register receiver with a cancellation callback.
   * Safe to call multiple times (idempotent).
   */
  fun register(context: Context, callback: () -> Unit) {
    if (isRegistered) return
    onCancelAndRelease = callback

    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED)
    }

    context.registerReceiver(this, filter)
    isRegistered = true
  }

  /**
   * Unregister receiver.
   * Safe to call multiple times (idempotent).
   */
  fun unregister(context: Context) {
    if (!isRegistered) return
    try {
      context.unregisterReceiver(this)
    } catch (_: Throwable) {
      // TODO: handle or log exception (double-unregister)
    }
    isRegistered = false
    onCancelAndRelease = null
  }

  override fun onReceive(context: Context?, intent: Intent?) {
    val action = intent?.action ?: return
    when (action) {
      Intent.ACTION_SCREEN_OFF,
      PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED -> {
        // Cancel waits and release device/session resources
        try {
          onCancelAndRelease?.invoke()
        } catch (_: Throwable) {
          // TODO: handle or log exception (keep receiver resilient)
        }
      }
    }
  }
}