package app.aoki.jsapdu.rn.nfc

import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import android.nfc.tech.NfcF
import android.nfc.tech.TagTechnology
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import app.aoki.jsapdu.rn.core.ICardSession
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import java.io.IOException
import java.util.Timer
import kotlin.concurrent.timer

/**
 * Unified NFC card session implementation bound to a discovered TagTechnology (IsoDep or NfcF).
 * Implements ICardSession for method-agnostic card communication with minimal branching.
 * - IsoDep: APDU-oriented communication (ISO-DEP)
 * - NfcF:  raw frame communication (FeliCa)
 */
class NfcCardSession(
  private val parent: NfcDevice,
  private val tech: TagTechnology
) : ICardSession {
  init {
    // TagTechnology MUST NOT already be connected at session start
    if (tech.isConnected) {
      throw IllegalStateException("SESSION_STATE_ERROR: Technology already connected before start")
    }
    // Connect and verify link state
    tech.connect()
    setTimeoutOrThrow(5000)
    watchCardPresenceStatus()
  }

  override val handle: String = "card-${System.currentTimeMillis()}"

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

  private fun platformError(message: String): Nothing = throw IllegalStateException("PLATFORM_ERROR: $message")

  private fun apduError(message: String?): Nothing = throw IllegalStateException("APDU_ERROR: $message")

  private fun ByteArray.toHex(): String = joinToString("") { "%02X".format(it) }

  private fun ensureConnected(orFailApdu: Boolean, lostDetails: String, apduFailDetails: String? = null) {
    if (!isCardPresent()) {
      onTagLost(lostDetails)
      if (orFailApdu && apduFailDetails != null) {
        safeEmit(StatusEventType.APDU_FAILED, apduFailDetails)
      }
      platformError("Card not connected")
    }
  }

  private fun setTimeoutOrThrow(millis: Int) {
    try {
      when (tech) {
        is IsoDep -> tech.timeout = millis
        is NfcF -> tech.timeout = millis
        else -> platformError("Unsupported TagTechnology type: ${tech.javaClass.name}")
      }
    } catch (e: Exception) {
      onTagLost("Error setting timeout: ${e.message}")
      throw IllegalStateException("PLATFORM_ERROR: Failed to set technology timeout: ${e.message}")
    }
  }

  // ---- Public API ---------------------------------------------------------------------------

  override fun getAtr(): ByteArray {
    synchronized(apduLock) {
      // Do NOT attempt to reconnect outside session start
      ensureConnected(
        orFailApdu = false,
        lostDetails = "Disconnected before ATR/ATS"
      )
      try {
        return when (val t = tech) {
          is IsoDep -> {
            val hist = t.historicalBytes
            val hi = t.hiLayerResponse
            when {
              hist != null -> hist
              hi != null -> hi
              else -> ByteArray(0)
            }
          }
          is NfcF -> {
            try {
              t.tag.id ?: ByteArray(0)
            } catch (_: Exception) {
              ByteArray(0)
            }
          }
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

  override fun transmit(apdu: ByteArray): ByteArray {
    synchronized(apduLock) {
      // Do NOT attempt to reconnect outside session start
      ensureConnected(
        orFailApdu = true,
        lostDetails = "Disconnected before transceive",
        apduFailDetails = "Not connected"
      )
      try {
        // Emit APDU_SENT prior to transmission (logs hex even for raw FeliCa frames)
        safeEmit(
          StatusEventType.APDU_SENT,
          "CommandHex=${apdu.toHex()}"
        )
        return when (val t = tech) {
          is IsoDep -> t.transceive(apdu)
          is NfcF -> t.transceive(apdu)
          else -> throw IllegalStateException("PLATFORM_ERROR: Unsupported technology")
        }
      } catch (e: TagLostException) {
        onTagLost("TagLost")
        platformError("Card removed during transmission")
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

  override fun reset() {
    synchronized(apduLock) {
      ensureConnected(
        orFailApdu = false,
        lostDetails = "Disconnected before reset"
      )
      try {
        try {
          if (tech.isConnected) {
            tech.close()
          }
        } catch (_: Exception) {
          // Ignore close errors; we'll try to reconnect below
        }

        tech.connect()
        setTimeoutOrThrow(5000)
        safeEmit(StatusEventType.CARD_SESSION_STARTED, "Session reset complete")
      } catch (e: TagLostException) {
        onTagLost("TagLost during reset")
        platformError("Card removed during session reset")
      } catch (e: IOException) {
        onTagLost("IO during reset: ${e.message}")
        platformError("NFC I/O error during session reset: ${e.message}")
      } catch (e: Exception) {
        onTagLost("Reset failed: ${e.message}")
        platformError("Failed to reset NFC session: ${e.message}")
      }
    }
  }

  override fun release() {
    synchronized(apduLock) {
      parent.unregisterCard(handle)
      watchTimer?.cancel()
      watchTimer = null
      try {
        if (isCardPresent()) {
          tech.close()
        }
      } catch (_: Exception) {
        // ignore cleanup errors
      }
      safeEmit(StatusEventType.CARD_SESSION_RESET, "Session reset")
    }
  }

  override fun isCardPresent(): Boolean {
    try {
      val connected = tech.isConnected
      return connected
    } catch (_: Exception) {
      onTagLost("Connection lost: Card lost after connection")
      return false
    }
  }

  private var watchTimer: Timer? = null
  private fun watchCardPresenceStatus() {
    watchTimer = timer(initialDelay = 0, period = 1000) {
      isCardPresent()
    }
  }
}
