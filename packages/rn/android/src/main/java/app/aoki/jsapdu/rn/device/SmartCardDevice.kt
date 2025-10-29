package app.aoki.jsapdu.rn.device

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
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

    /** Acquire the underlying NFC device: enable ReaderMode using current Activity */
    fun acquire() {
        val activity = parentPlatform.currentActivity()
            ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available for ReaderMode")
        enabled.set(true)
        val ctrl = NfcReaderController(adapter) { isoDep ->
            if (!enabled.get()) return@NfcReaderController
            lastIsoDep = isoDep
            cardPresent.set(true)
            // Emit CARD_FOUND when an ISO-DEP tag is discovered
            try {
                StatusEventDispatcher.emit(
                    StatusEventType.CARD_FOUND,
                    EventPayload(deviceHandle = handle, cardHandle = null, details = "ISO-DEP tag discovered")
                )
            } catch (_: Exception) { /* suppress */ }
        }
        ctrl.enable(activity)
        controller = ctrl
        // Emit ReaderMode enabled
        try {
            StatusEventDispatcher.emit(
                StatusEventType.READER_MODE_ENABLED,
                EventPayload(deviceHandle = handle, cardHandle = null, details = "ReaderMode enabled")
            )
        } catch (_: Exception) { /* suppress */ }
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
            try {
                StatusEventDispatcher.emit(
                    StatusEventType.CARD_LOST,
                    EventPayload(deviceHandle = handle, cardHandle = null, details = "ReaderMode disabled")
                )
            } catch (_: Exception) { /* suppress */ }
        }
        cardPresent.set(false)
        lastIsoDep = null

        // Cleanup all card sessions without coarse device lock
        val existingCards = cards.values.toList()
        cards.clear()
        existingCards.forEach {
            try { it.cleanup() } catch (_: Exception) {}
        }

        // Emit ReaderMode disabled and Device released
        try {
            StatusEventDispatcher.emit(
                StatusEventType.READER_MODE_DISABLED,
                EventPayload(deviceHandle = handle, cardHandle = null, details = "ReaderMode disabled")
            )
            StatusEventDispatcher.emit(
                StatusEventType.DEVICE_RELEASED,
                EventPayload(deviceHandle = handle, cardHandle = null, details = "Device released")
            )
        } catch (_: Exception) { /* suppress */ }

        parentPlatform.unregisterDevice(handle)
    }

    /** Whether device is available; for integrated NFC depends on system setting */
    fun isAvailable(): Boolean = adapter.isEnabled

    /** Whether an ISO-DEP card is detected in RF field */
    fun isCardPresent(): Boolean = cardPresent.get()

    /** Returns latest IsoDep when present, otherwise null */
    fun getIsoDep(): IsoDep? = lastIsoDep

    /** Internal: mark tag lost and clear state */
    internal fun onTagLost() {
        cardPresent.set(false)
        lastIsoDep = null
    }

    /** Start a card session and return a card handle */
    fun startSession(): String {
        val isoDep = lastIsoDep ?: throw IllegalStateException("CARD_NOT_PRESENT: No ISO-DEP card detected")
        val card = SmartCardSession(this, isoDep)
        cards[card.handle] = card
        try {
            StatusEventDispatcher.emit(
                StatusEventType.CARD_SESSION_STARTED,
                EventPayload(deviceHandle = handle, cardHandle = card.handle, details = "Session started")
            )
        } catch (_: Exception) { /* suppress */ }
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
        try {
            StatusEventDispatcher.emit(
                StatusEventType.WAIT_TIMEOUT,
                EventPayload(deviceHandle = handle, cardHandle = null, details = "timeout=${timeout}s")
            )
        } catch (_: Exception) { /* suppress */ }
        throw IllegalStateException("WAIT_TIMEOUT: Card not present within $timeout seconds")
    }

}