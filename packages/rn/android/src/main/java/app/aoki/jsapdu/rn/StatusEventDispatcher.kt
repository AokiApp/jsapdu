package app.aoki.jsapdu.rn


import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicReference
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload


/**
 * Status event dispatcher for JsapduRN.
 *
 * Provides a single callback registration point and ensures events are
 * invoked on the main thread to maintain RN bridge safety.
 *
 * Event types:
 * - DEVICE_ACQUIRED
 * - DEVICE_RELEASED
 * - CARD_FOUND
 * - CARD_LOST
 */
object StatusEventDispatcher {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val callbackRef: AtomicReference<((String, EventPayload) -> Unit)?> = AtomicReference(null)

  /**
   * Register callback to receive status events.
   */
  fun setCallback(callback: (eventType: String, payload: EventPayload) -> Unit) {
    callbackRef.set(callback)
  }

  /**
   * Clear registered callback.
   */
  fun clear() {
    callbackRef.set(null)
  }

  /**
   * Emit a status event to the registered callback.
   * Invokes on main thread and isolates callback exceptions.
   */
  fun emit(type: StatusEventType, payload: EventPayload) {
    val cb = callbackRef.get() ?: return
    if (Looper.myLooper() === Looper.getMainLooper()) {
      safeInvoke(cb, type.name, payload)
    } else {
      mainHandler.post { safeInvoke(cb, type.name, payload) }
    }
  }

  private fun safeInvoke(cb: (eventType: String, payload: EventPayload) -> Unit, typeName: String, payload: EventPayload) {
    try {
      cb(typeName, payload)
    } catch (_: Throwable) {
      // Suppress callback exceptions to prevent native crashes
    }
  }
}

/**
 * Supported status event types.
 */
enum class StatusEventType {
  PLATFORM_INITIALIZED,
  PLATFORM_RELEASED,
  DEVICE_ACQUIRED,
  DEVICE_RELEASED,
  CARD_FOUND, // When a card is found in the RF field
  CARD_LOST, // When a card is removed from the RF field
  CARD_SESSION_STARTED,
  CARD_SESSION_RESET,
  WAIT_TIMEOUT,
  POWER_STATE_CHANGED,
  NFC_STATE_CHANGED,
  APDU_SENT,
  APDU_FAILED,
  READER_MODE_ENABLED,
  READER_MODE_DISABLED
}