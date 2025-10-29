package app.aoki.jsapdu.rn.device

import android.nfc.tech.IsoDep
import android.nfc.TagLostException
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType

/**
 * Card session bound to a discovered IsoDep.
 * Top-level class extracted from SmartCardDevice for clearer structure.
 */
class SmartCard(
    private val parent: SmartCardDevice,
    private val isoDep: IsoDep
) {
    val handle: String = "card-${System.currentTimeMillis()}"

    fun getAtr(): ByteArray {
        val hist = isoDep.getHistoricalBytes()
        val hi = isoDep.getHiLayerResponse()
        return when {
            hist != null -> hist
            hi != null -> hi
            else -> ByteArray(0)
        }
    }

    private val apduLock = Any()

    fun transmit(apdu: ByteArray): ByteArray {
        synchronized(apduLock) {
            try {
                if (!isoDep.isConnected) {
                    isoDep.connect()
                    isoDep.timeout = 5000
                }
                // Emit APDU_SENT prior to transmission
                try {
                    StatusEventDispatcher.emit(
                        StatusEventType.APDU_SENT,
                        EventPayload(
                            deviceHandle = parent.handle,
                            cardHandle = handle,
                            details = "CommandHex=${apdu.joinToString("") { "%02X".format(it) }}"
                        )
                    )
                } catch (_: Exception) { /* suppress */ }
                return isoDep.transceive(apdu)
            } catch (e: TagLostException) {
                // Card physically removed
                try {
                    parent.onTagLost()
                    StatusEventDispatcher.emit(
                        StatusEventType.CARD_LOST,
                        EventPayload(
                            deviceHandle = parent.handle,
                            cardHandle = handle,
                            details = "TagLost"
                        )
                    )
                } catch (_: Exception) { /* suppress */ }
                throw IllegalStateException("PLATFORM_ERROR: Card removed during APDU transmission")
            } catch (e: Exception) {
                try {
                    StatusEventDispatcher.emit(
                        StatusEventType.APDU_FAILED,
                        EventPayload(
                            deviceHandle = parent.handle,
                            cardHandle = handle,
                            details = e.message ?: "APDU error"
                        )
                    )
                } catch (_: Exception) { /* suppress */ }
                throw IllegalStateException("APDU_ERROR: ${e.message}")
            }
        }
    }

    fun reset() {
        synchronized(apduLock) {
            try {
                if (isoDep.isConnected) {
                    isoDep.close()
                }
                // Emit CARD_SESSION_RESET after closing
                try {
                    StatusEventDispatcher.emit(
                        StatusEventType.CARD_SESSION_RESET,
                        EventPayload(
                            deviceHandle = parent.handle,
                            cardHandle = handle,
                            details = "Session reset"
                        )
                    )
                } catch (_: Exception) { /* suppress */ }
            } catch (_: Exception) {
                // ignore reset errors
            }
        }
    }

    internal fun cleanup() {
        synchronized(apduLock) {
            try {
                if (isoDep.isConnected) {
                    isoDep.close()
                }
            } catch (_: Exception) {
                // ignore cleanup errors
            }
        }
    }
}

typealias SmartCardSession = SmartCard