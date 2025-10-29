package app.aoki.jsapdu.rn.device

import android.nfc.tech.IsoDep

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

    fun transmit(apdu: ByteArray): ByteArray {
        try {
            if (!isoDep.isConnected) {
                isoDep.connect()
                isoDep.timeout = 5000
            }
            return isoDep.transceive(apdu)
        } catch (e: Exception) {
            throw IllegalStateException("APDU_ERROR: ${e.message}")
        }
    }

    fun reset() {
        try {
            if (isoDep.isConnected) {
                isoDep.close()
            }
        } catch (_: Exception) {
            // ignore reset errors
        }
    }

    internal fun cleanup() {
        try {
            if (isoDep.isConnected) {
                isoDep.close()
            }
        } catch (_: Exception) {
            // ignore cleanup errors
        }
    }
}