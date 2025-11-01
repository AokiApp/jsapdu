package app.aoki.jsapdu.rn.omapi

import android.se.omapi.Session
import android.se.omapi.Channel
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import app.aoki.jsapdu.rn.core.ICardSession
import java.io.IOException

/**
 * OMAPI card session implementation bound to an SE session.
 * Implements ICardSession interface for method-agnostic card communication.
 * 
 * This class manages a basic logical channel to the secure element.
 */
class OmapiCardSession(
    private val parent: OmapiDevice,
    private val session: Session
) : ICardSession {
    
    private var emulator: OmapiApduEmulator? = null
    private val apduLock = Any()
    
    init {
        // Initialize APDU emulator (single-channel, SELECT-emulated)
        try {
            emulator = OmapiApduEmulator(session)
        } catch (e: Exception) {
            session.close()
            throw IllegalStateException("PLATFORM_ERROR: Failed to initialize APDU emulator: ${e.message}")
        }
    }

    override val handle: String = "card-omapi-${System.currentTimeMillis()}"

    // ---- Helpers ---------------------------------------------------------------------------

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

    private fun platformError(message: String): Nothing =
        throw IllegalStateException("PLATFORM_ERROR: $message")

    private fun apduError(message: String?): Nothing =
        throw IllegalStateException("APDU_ERROR: $message")

    private fun ByteArray.toHex(): String =
        joinToString("") { "%02X".format(it) }

    private fun ensureConnected() {
        if (!isCardPresent()) {
            platformError("Session not connected")
        }
    }

    // ---- Public API ---------------------------------------------------------------------------

    override fun getAtr(): ByteArray {
        synchronized(apduLock) {
            ensureConnected()
            try {
                // Get ATR from session
                val atr = session.atr ?: ByteArray(0)
                return atr
            } catch (e: Exception) {
                safeEmit(StatusEventType.CARD_LOST, "Error getting ATR: ${e.message}")
                platformError("Failed to get ATR: ${e.message}")
            }
        }
    }

    override fun transmit(apdu: ByteArray): ByteArray {
        synchronized(apduLock) {
            ensureConnected()
            
            val emu = emulator
                ?: platformError("Channel not available")
            
            try {
                // Emit APDU_SENT prior to transmission
                safeEmit(
                    StatusEventType.APDU_SENT,
                    "CommandHex=${apdu.toHex()}"
                )
                
                // Transmit via emulator (handles SELECT/CHANNEL emulation)
                val response = emu.transmit(apdu)
                return response
                
            } catch (e: IOException) {
                safeEmit(StatusEventType.APDU_FAILED, "IO: ${e.message}")
                platformError("OMAPI communication failed: ${e.message}")
            } catch (e: Exception) {
                safeEmit(StatusEventType.APDU_FAILED, e.message ?: "APDU error")
                apduError(e.message)
            }
        }
    }

    override fun reset() {
        synchronized(apduLock) {
            ensureConnected()
            
            try {
                emulator?.reset()
                safeEmit(StatusEventType.CARD_SESSION_RESET, "Channel reset")
            } catch (e: Exception) {
                safeEmit(StatusEventType.CARD_LOST, "Reset failed: ${e.message}")
                platformError("Failed to reset channel: ${e.message}")
            }
        }
    }

    override fun release() {
        synchronized(apduLock) {
            parent.unregisterCard(handle)
            
            try {
                emulator?.release()
            } catch (_: Exception) {
                // ignore cleanup errors
            }
            
            try {
                // Close session
                session.close()
            } catch (_: Exception) {
                // ignore cleanup errors
            }
            
            emulator = null
            safeEmit(StatusEventType.CARD_SESSION_RESET, "Session released")
        }
    }
    
    override fun isCardPresent(): Boolean {
        return try {
            // With lazy-open logical channel, presence equals an active (not closed) Session
            !session.isClosed
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Open a logical channel to a specific applet using its AID.
     * Returns a new channel that can be used for transmit operations.
     * 
     * @param aid Application Identifier (AID) bytes
     * @return Channel instance for the opened logical channel
     */
    fun openLogicalChannel(aid: ByteArray): Channel? {
        synchronized(apduLock) {
            ensureConnected()
            
            try {
                val channel = session.openLogicalChannel(aid)
                safeEmit(StatusEventType.DEBUG_INFO, "Logical channel opened for AID=${aid.toHex()}")
                return channel
            } catch (e: Exception) {
                safeEmit(StatusEventType.APDU_FAILED, "Failed to open logical channel: ${e.message}")
                throw IllegalStateException("PLATFORM_ERROR: Failed to open logical channel: ${e.message}")
            }
        }
    }
}