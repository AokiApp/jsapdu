package app.aoki.jsapdu.rn.nfc

import android.nfc.NfcAdapter
import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import app.aoki.jsapdu.rn.core.ICardSession
import app.aoki.jsapdu.rn.core.IDevice
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Android NFC device implementation that controls RF (ReaderMode) and tracks card presence.
 * Implements IDevice interface for method-agnostic device management.
 *
 * Constructor receives parent SmartCardPlatform to establish mutual relationship.
 * Centralized event emission and cleanup helpers for readability.
 */
class NfcDevice(
  private val parentPlatform: SmartCardPlatform,
  private val adapter: NfcAdapter,
  override val id: String = "integrated-nfc-0"
) : IDevice {

  private var controller: NfcReaderController? = null
  private val cardPresent = AtomicBoolean(false)

  @Volatile private var awaitingTech: android.nfc.tech.TagTechnology? = null
  private val enabled = AtomicBoolean(false)

  private val cards = ConcurrentHashMap<String, ICardSession>()

  /** Unique handle for this device instance */
  override val handle: String = "handle-$id-${System.currentTimeMillis()}"

  // ---- Helpers ---------------------------------------------------------------------------

  private fun safeEmit(type: StatusEventType, details: String, cardHandle: String? = null) {
    try {
      StatusEventDispatcher.emit(
        type,
        EventPayload(deviceHandle = handle, cardHandle = cardHandle, details = details)
      )
    } catch (_: Exception) { /* suppress */ }
  }

  // removed: setTimeoutOrIgnore (timeout handled in session classes)

  private fun closeIfConnected(tech: android.nfc.tech.TagTechnology?) {
    try {
      if (tech != null && tech.isConnected) {
        tech.close()
      }
    } catch (_: Exception) { /* ignore close errors */ }
  }

  /** Acquire the underlying NFC device: enable ReaderMode using current Activity */
  override fun acquire() {
    val activity = parentPlatform.currentActivity()
      ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available for ReaderMode")
    enabled.set(true)
    val ctrl = NfcReaderController(adapter) { tag ->
      if (!enabled.get()) return@NfcReaderController
      val isoDep = IsoDep.get(tag)
      val details: String
      if (isoDep != null) {
        awaitingTech = isoDep
        details = "ISO-DEP tag discovered"
      } else {
        val nfcF = android.nfc.tech.NfcF.get(tag)
        if (nfcF != null) {
          awaitingTech = nfcF
          details = "NFC-F tag discovered"
        } else {
          // Unsupported tag type; ignore
          return@NfcReaderController
        }
      }
      cardPresent.set(true)
      safeEmit(StatusEventType.CARD_FOUND, details)
    }
    ctrl.enable(activity)
    controller = ctrl
    safeEmit(StatusEventType.READER_MODE_ENABLED, "ReaderMode enabled")
  }

  /** Release the underlying NFC device: disable ReaderMode using current Activity (best-effort) */
  override fun release() {
    val ctrl = controller
    val activity = parentPlatform.currentActivity()
    // Gate any late callbacks
    enabled.set(false)
    if (ctrl != null && activity != null) {
      try {
        ctrl.disable(activity)
      } catch (_: Exception) {
        // ignore disable errors
      }
    }
    controller = null
    // If a card was present, emit CARD_LOST
    if (cardPresent.get()) {
      safeEmit(StatusEventType.CARD_LOST, "ReaderMode disabled")
    }
    cardPresent.set(false)
    awaitingTech = null

    // Cleanup all card sessions
    val existingCards = cards.values.toList()
    existingCards.forEach {
      try {
        it.release()
      } catch (_: Exception) { /* suppress */ }
    }

    // Emit ReaderMode disabled and Device released
    safeEmit(StatusEventType.READER_MODE_DISABLED, "ReaderMode disabled")
    safeEmit(StatusEventType.DEVICE_RELEASED, "Device released")

    parentPlatform.unregisterDevice(handle)
  }

  /** Whether device is available; for integrated NFC depends on system setting */
  override fun isAvailable(): Boolean = adapter.isEnabled

  /** Whether an ISO-DEP card is detected in RF field */
  override fun isCardPresent(): Boolean = cardPresent.get()

  /** Whether a freshly detected TagTechnology (IsoDep or NfcF) is ready to start a session */
  private fun hasPendingTech(): Boolean = awaitingTech != null

  // getAwaitingIsoDep removed; awaitingTech holds IsoDep or NfcF

  /** Internal: mark tag lost, release card(s), and clear state */
  internal fun onTagLost() {
    // Mark no card present
    cardPresent.set(false)

    // Close and clear the last TagTechnology reference (best-effort)
    val tech = awaitingTech
    awaitingTech = null
    closeIfConnected(tech)

    // Release all active card sessions to avoid stale handles
    val handles = cards.keys.toList()
    handles.forEach { h ->
      try {
        cards[h]?.release()
      } catch (_: Exception) {
        // suppress cleanup errors
      }
    }
  }

  /** Start a card session and return a card handle */
  override fun startSession(): String {
    val tech = awaitingTech ?: throw IllegalStateException("CARD_NOT_PRESENT: No NFC card detected")
    try {
      val card = NfcCardSession(this, tech)
      awaitingTech = null

      cards[card.handle] = card
      safeEmit(StatusEventType.CARD_SESSION_STARTED, "Session started", cardHandle = card.handle)

      if (!card.isCardPresent()) {
        // Link did not come up — treat as loss
        onTagLost()
        safeEmit(StatusEventType.CARD_LOST, "isConnected=false after connect")
        throw IllegalStateException("PLATFORM_ERROR: Connection not established at session start")
      }
      return card.handle
    } catch (e: TagLostException) {
      // Card physically removed before session start
      onTagLost()
      safeEmit(StatusEventType.CARD_LOST, "TagLost during startSession")
      throw IllegalStateException("PLATFORM_ERROR: Card removed during session start")
    } catch (e: IOException) {
      onTagLost()
      safeEmit(StatusEventType.CARD_LOST, "IO during startSession: ${e.message}")
      throw IllegalStateException("PLATFORM_ERROR: Failed to start session: ${e.message}")
    }
  }

  /** Get a card by handle */
  override fun getTarget(cardHandle: String): ICardSession? = cards[cardHandle]

  /** Unregister card on release */
  override fun unregisterCard(cardHandle: String) {
    cards.remove(cardHandle)
  }

  /** Wait for card presence with a timeout in seconds */
  override fun waitForCardPresence(timeout: Double) {
    val deadline = System.currentTimeMillis() + (timeout * 1000.0).toLong()
    while (System.currentTimeMillis() < deadline) {
      if (hasPendingTech()) return
      try {
        Thread.sleep(50)
      } catch (_: InterruptedException) {
        break
      }
    }
    safeEmit(StatusEventType.WAIT_TIMEOUT, "timeout=${timeout}s")
    throw IllegalStateException("WAIT_TIMEOUT: Card not present within $timeout seconds")
  }
}
