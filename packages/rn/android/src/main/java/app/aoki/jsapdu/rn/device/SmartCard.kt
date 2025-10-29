package app.aoki.jsapdu.rn.device

import android.nfc.tech.IsoDep
import android.nfc.TagLostException
import java.io.IOException
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType

/**
 * Card session bound to a discovered IsoDep.
 * Top-level class extracted from SmartCardDevice for clearer structure.
 * Simplified with centralized error/event handling for readability.
 */
class SmartCard(
    private val parent: SmartCardDevice,
    private val isoDep: IsoDep
) {
    val handle: String = "card-${System.currentTimeMillis()}"

    private val apduLock = Any()

    // ---- Small helpers to reduce repetition ---------------------------------------------------

    private fun safeEmit(type: StatusEventType, details: String) {
        try {
            StatusEventDispatcher.emit(
                type,
                EventPayload(
                    deviceHandle = parent.handle,
                    cardHandle = handle,
                    details = details
                )
            )
        } catch (_: Exception) { /* suppress */ }
    }

    private fun onTagLost(details: String) {
        try {
            parent.onTagLost()
        } catch (_: Exception) { /* suppress */ }
        safeEmit(StatusEventType.CARD_LOST, details)
    }

    private fun platformError(message: String): Nothing =
        throw IllegalStateException("PLATFORM_ERROR: $message")

    private fun apduError(message: String?): Nothing =
        throw IllegalStateException("APDU_ERROR: $message")

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02X".format(it) }

    private fun ensureConnected(
        orFailApdu: Boolean,
        lostDetails: String,
        apduFailDetails: String? = null
    ) {
        if (!isoDep.isConnected) {
            onTagLost(lostDetails)
            if (orFailApdu && apduFailDetails != null) {
                safeEmit(StatusEventType.APDU_FAILED, apduFailDetails)
            }
            platformError("Card not connected")
        }
    }

    // ---- Public API ---------------------------------------------------------------------------

    fun getAtr(): ByteArray {
        synchronized(apduLock) {
            // Do NOT attempt to reconnect outside session start
            ensureConnected(
                orFailApdu = false,
                lostDetails = "Disconnected before ATR/ATS"
            )
            try {
                val hist = isoDep.historicalBytes
                val hi = isoDep.hiLayerResponse
                return when {
                    hist != null -> hist
                    hi != null -> hi
                    else -> ByteArray(0)
                }
            } catch (e: TagLostException) {
                onTagLost("TagLost during ATR/ATS")
                platformError("Card removed during ATR/ATS retrieval")
            } catch (e: IOException) {
                onTagLost("IO during ATR/ATS: ${e.message}")
                platformError("NFC I/O error during ATR/ATS: ${e.message}")
            }
        }
    }

    fun transmit(apdu: ByteArray): ByteArray {
        synchronized(apduLock) {
            // Do NOT attempt to reconnect outside session start
            ensureConnected(
                orFailApdu = true,
                lostDetails = "Disconnected before transceive",
                apduFailDetails = "Not connected"
            )
            try {
                // Emit APDU_SENT prior to transmission
                safeEmit(
                    StatusEventType.APDU_SENT,
                    "CommandHex=${apdu.toHex()}"
                )
                val response = isoDep.transceive(apdu)
                return response
            } catch (e: TagLostException) {
                onTagLost("TagLost")
                platformError("Card removed during APDU transmission")
            } catch (e: IOException) {
                onTagLost("IO during transceive: ${e.message}")
                safeEmit(StatusEventType.APDU_FAILED, "IO: ${e.message}")
                platformError("NFC communication failed: ${e.message}")
            } catch (e: Exception) {
                safeEmit(StatusEventType.APDU_FAILED, e.message ?: "APDU error")
                apduError(e.message)
            }
        }
    }

    fun reset() {
        synchronized(apduLock) {
            try {
                if (isoDep.isConnected) {
                    isoDep.close()
                }
            } catch (_: Exception) {
                // ignore reset close errors
            }
            // Emit CARD_SESSION_RESET after closing
            safeEmit(StatusEventType.CARD_SESSION_RESET, "Session reset")
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