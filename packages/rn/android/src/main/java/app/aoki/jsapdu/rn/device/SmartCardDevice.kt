package app.aoki.jsapdu.rn.device

import android.app.Activity
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import app.aoki.jsapdu.rn.platform.NfcReaderController
import app.aoki.jsapdu.rn.SmartCardPlatform
import java.util.concurrent.atomic.AtomicBoolean

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

    /** Unique handle for this device instance */
    val handle: String = "handle-$id-${System.currentTimeMillis()}"

    /** Acquire the underlying NFC device: enable ReaderMode using current Activity */
    fun acquire() {
        val activity = parentPlatform.currentActivity()
            ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available for ReaderMode")
        val ctrl = NfcReaderController(adapter)
        ctrl.enable(activity, object : NfcReaderController.Listener {
            override fun onIsoDep(isoDep: IsoDep) {
                lastIsoDep = isoDep
                cardPresent.set(true)
                // Optionally notify parentPlatform here if needed (e.g., via a callback method)
            }
        })
        controller = ctrl
    }

    /** Release the underlying NFC device: disable ReaderMode using current Activity (best-effort) */
    fun release() {
        val ctrl = controller
        val activity = parentPlatform.currentActivity()
        if (ctrl != null && activity != null) {
            try {
                ctrl.disable(activity)
            } catch (_: Exception) {
                // ignore disable errors
            }
        }
        controller = null
        cardPresent.set(false)
        lastIsoDep = null
        parentPlatform.unregisterDevice(handle)
    }

    /** Whether device is available; for integrated NFC depends on system setting */
    fun isAvailable(): Boolean = adapter.isEnabled

    /** Whether an ISO-DEP card is detected in RF field */
    fun isCardPresent(): Boolean = cardPresent.get()

    /** Returns latest IsoDep when present, otherwise null */
    fun getIsoDep(): IsoDep? = lastIsoDep
}