package app.aoki.jsapdu.rn.omapi

import android.content.Context
import android.se.omapi.Reader
import android.se.omapi.SEService
import app.aoki.jsapdu.rn.SmartCardPlatform
import app.aoki.jsapdu.rn.StatusEventDispatcher
import app.aoki.jsapdu.rn.StatusEventType
import app.aoki.jsapdu.rn.core.ICardSession
import app.aoki.jsapdu.rn.core.IDevice
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.*

/**
 * Android OMAPI device implementation that provides access to secure elements.
 * Implements IDevice interface for method-agnostic device management.
 *
 * OMAPI provides access to various secure elements:
 * - eSE (embedded Secure Element)
 * - SIM (SIM card secure element)
 * - SD (SD card secure element - rare)
 *
 * Constructor receives parent SmartCardPlatform to establish mutual relationship.
 */
@androidx.annotation.RequiresApi(android.os.Build.VERSION_CODES.P)
class OmapiDevice(
  private val parentPlatform: SmartCardPlatform,
  private val context: Context,
  override val id: String,
  private val readerName: String
) : IDevice {

  private var seService: SEService? = null
  private var reader: Reader? = null
  private val serviceConnected = AtomicBoolean(false)
  private val serviceLatch = CountDownLatch(1)
  private val cards = ConcurrentHashMap<String, ICardSession>()
  private val enabled = AtomicBoolean(false)

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

  /** Acquire the OMAPI device: connect to SEService and get reader */
  override fun acquire() {
    if (enabled.get()) {
      throw IllegalStateException("ALREADY_ACQUIRED: Device already acquired")
    }

    enabled.set(true)

    // Connect to SEService. Provide an Executor to match SEService constructor.
    val seExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    val service = SEService(
      context,
      seExecutor,
      SEService.OnConnectedListener {
        serviceConnected.set(true)
        serviceLatch.countDown()
      }
    )

    seService = service

    // Wait for service connection (max 5 seconds)
    if (!serviceLatch.await(5, TimeUnit.SECONDS)) {
      enabled.set(false)
      throw IllegalStateException("PLATFORM_ERROR: Failed to connect to SEService within timeout")
    }

    if (!serviceConnected.get()) {
      enabled.set(false)
      throw IllegalStateException("PLATFORM_ERROR: SEService connection failed")
    }

    // Get the specific reader
    val readers = service.readers
    val foundReader = readers.firstOrNull { it.name == readerName }
      ?: throw IllegalStateException("PLATFORM_ERROR: Reader '$readerName' not found")

    reader = foundReader
    safeEmit(StatusEventType.DEVICE_ACQUIRED, "OMAPI reader '$readerName' acquired")

    // If a secure element is present on this reader, emit CARD_FOUND to mirror NFC behavior.
    try {
      if (reader?.isSecureElementPresent == true) {
        // Emit CARD_FOUND so higher layers can treat OMAPI devices like card-present readers, with delay, so that JS side can set up listeners.

        GlobalScope.launch(Dispatchers.Default) {
          try {
            delay(50)
            safeEmit(StatusEventType.CARD_FOUND, "Secure element present on reader '$readerName'")
          } catch (_: Exception) { /* suppress */ }
        }
      }
    } catch (_: Exception) {
      // ignore inspection errors
    }
  }

  /** Release the OMAPI device: close all sessions and disconnect from SEService */
  override fun release() {
    if (!enabled.get()) {
      return // Already released
    }

    enabled.set(false)

    // Cleanup all card sessions
    val existingCards = cards.values.toList()
    existingCards.forEach {
      try {
        it.release()
      } catch (_: Exception) { /* suppress */ }
    }
    cards.clear()

    // Close reader
    reader = null

    // Shutdown SEService
    try {
      seService?.shutdown()
    } catch (_: Exception) { /* ignore shutdown errors */ }
    seService = null

    safeEmit(StatusEventType.DEVICE_RELEASED, "OMAPI device released")
    parentPlatform.unregisterDevice(handle)
  }

  /** Check if the OMAPI device is available */
  override fun isAvailable(): Boolean {
    return enabled.get() && serviceConnected.get() && reader != null
  }

  /** Check if a secure element is present (for OMAPI, it's typically always present if available) */
  override fun isCardPresent(): Boolean {
    val r = reader ?: return false
    return try {
      r.isSecureElementPresent
    } catch (_: Exception) {
      false
    }
  }

  /** Wait for card presence with a timeout in seconds */
  override fun waitForCardPresence(timeout: Double) {
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
    throw IllegalStateException("WAIT_TIMEOUT: Secure element not present within $timeout seconds")
  }

  /** Start a card session and return a card handle */
  override fun startSession(): String {
    if (!isCardPresent()) {
      throw IllegalStateException("CARD_NOT_PRESENT: No secure element detected")
    }

    val r = reader ?: throw IllegalStateException("PLATFORM_ERROR: Reader not available")

    try {
      // Open a session with the secure element
      val session = r.openSession()
        ?: throw IllegalStateException("PLATFORM_ERROR: Failed to open SE session")

      val card = OmapiCardSession(this, session)
      cards[card.handle] = card

      safeEmit(StatusEventType.CARD_SESSION_STARTED, "OMAPI session started", cardHandle = card.handle)
      return card.handle
    } catch (e: Exception) {
      safeEmit(StatusEventType.CARD_LOST, "Failed to start session: ${e.message}")
      throw IllegalStateException("PLATFORM_ERROR: Failed to start OMAPI session: ${e.message}")
    }
  }

  /** Get a card by handle */
  override fun getTarget(cardHandle: String): ICardSession? = cards[cardHandle]

  /** Unregister card on release */
  override fun unregisterCard(cardHandle: String) {
    cards.remove(cardHandle)
  }

  /** Get the reader name */
  fun getReaderName(): String = readerName
}
