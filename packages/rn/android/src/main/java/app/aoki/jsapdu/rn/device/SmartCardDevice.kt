package app.aoki.jsapdu.rn.device

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import android.nfc.TagLostException
import java.io.IOException
import app.aoki.jsapdu.rn.platform.NfcReaderController
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.ConcurrentHashMap

/**
 * Android NFC device that controls RF (ReaderMode) and tracks card presence.
 * Low-level controls are segregated here; SmartCardPlatform orchestrates instances of this class.
 *
 * Constructor receives parent SmartCardPlatform to establish mutual relationship.
 * Centralized event emission and cleanup helpers for readability.
 */
class SmartCardDevice(
    private val parentPlatform: SmartCardPlatform,
    private val adapter: NfcAdapter,
    val id: String = "integrated-nfc-0"
) {

    private var controller: NfcReaderController? = null
    private val cardPresent = AtomicBoolean(false)
    @Volatile private var lastIsoDep: IsoDep? = null
    private val enabled = AtomicBoolean(false)

    private val cards = ConcurrentHashMap<String, SmartCardSession>()

    /** Unique handle for this device instance */
    val handle: String = "handle-$id-${System.currentTimeMillis()}"

    // ---- Helpers ---------------------------------------------------------------------------

    private fun safeEmit(type: StatusEventType, details: String, cardHandle: String? = null) {
        try {
            StatusEventDispatcher.emit(
                type,
                EventPayload(deviceHandle = handle, cardHandle = cardHandle, details = details)
            )
        } catch (_: Exception) { /* suppress */ }
    }

    private fun setTimeoutOrIgnore(isoDep: IsoDep, millis: Int) {
        try { isoDep.timeout = millis } catch (_: Exception) { /* ignore */ }
    }

    private fun closeIfConnected(isoDep: IsoDep?) {
        try {
            if (isoDep != null && isoDep.isConnected) {
                isoDep.close()
            }
        } catch (_: Exception) { /* ignore close errors */ }
    }

    /** Acquire the underlying NFC device: enable ReaderMode using current Activity */
    fun acquire() {
        val activity = parentPlatform.currentActivity()
            ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available for ReaderMode")
        enabled.set(true)
        val ctrl = NfcReaderController(adapter) { isoDep ->
            if (!enabled.get()) return@NfcReaderController
            setTimeoutOrIgnore(isoDep, 5000)
            lastIsoDep = isoDep
            cardPresent.set(true)
            safeEmit(StatusEventType.CARD_FOUND, "ISO-DEP tag discovered")
        }
        ctrl.enable(activity)
        controller = ctrl
        safeEmit(StatusEventType.READER_MODE_ENABLED, "ReaderMode enabled")
    }

    /** Release the underlying NFC device: disable ReaderMode using current Activity (best-effort) */
    fun release() {
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
        lastIsoDep = null

        // Cleanup all card sessions
        val existingCards = cards.values.toList()
        cards.clear()
        existingCards.forEach {
            try { it.cleanup() } catch (_: Exception) { /* suppress */ }
        }

        // Emit ReaderMode disabled and Device released
        safeEmit(StatusEventType.READER_MODE_DISABLED, "ReaderMode disabled")
        safeEmit(StatusEventType.DEVICE_RELEASED, "Device released")

        parentPlatform.unregisterDevice(handle)
    }

    /** Whether device is available; for integrated NFC depends on system setting */
    fun isAvailable(): Boolean = adapter.isEnabled

    /** Whether an ISO-DEP card is detected in RF field */
    fun isCardPresent(): Boolean = cardPresent.get() && (lastIsoDep?.isConnected == true)

    /** Returns latest IsoDep when present, otherwise null */
    fun getIsoDep(): IsoDep? = lastIsoDep

    /** Internal: mark tag lost, release card(s), and clear state */
    internal fun onTagLost() {
        // Mark no card present
        cardPresent.set(false)

        // Close and clear the last IsoDep reference (best-effort)
        val iso = lastIsoDep
        lastIsoDep = null
        closeIfConnected(iso)

        // Release all active card sessions to avoid stale handles
        val handles = cards.keys.toList()
        handles.forEach { h ->
            try {
                releaseCard(h)
            } catch (_: Exception) {
                // suppress cleanup errors
            }
        }
    }

    /** Start a card session and return a card handle */
    fun startSession(): String {
        val isoDep = lastIsoDep ?: throw IllegalStateException("CARD_NOT_PRESENT: No ISO-DEP card detected")
        try {
            // IsoDep MUST NOT already be connected at session start
            if (isoDep.isConnected) {
                throw IllegalStateException("SESSION_STATE_ERROR: IsoDep already connected before start")
            }
            // Connect and verify link state
            isoDep.connect()
            setTimeoutOrIgnore(isoDep, 5000)
            if (!isoDep.isConnected) {
                // Link did not come up — treat as loss
                onTagLost()
                safeEmit(StatusEventType.CARD_LOST, "isConnected=false after connect")
                throw IllegalStateException("PLATFORM_ERROR: IsoDep connection not established at session start")
            }
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
        val card = SmartCardSession(this, isoDep)
        cards[card.handle] = card
        safeEmit(StatusEventType.CARD_SESSION_STARTED, "Session started", cardHandle = card.handle)
        return card.handle
    }

    /** Get a card by handle */
    fun getTarget(cardHandle: String): SmartCardSession? = cards[cardHandle]

    /** Release a card session by handle */
    fun releaseCard(cardHandle: String) {
        val card = cards.remove(cardHandle) ?: return
        try {
            card.cleanup()
        } catch (_: Exception) {
            // ignore cleanup errors
        }
    }

    /** Wait for card presence with a timeout in seconds */
    fun waitForCardPresence(timeout: Double) {
        val deadline = System.currentTimeMillis() + (timeout * 1000.0).toLong()
        while (System.currentTimeMillis() < deadline) {
            if (isCardPresent()) return
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