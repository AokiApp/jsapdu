package app.aoki.jsapdu.rn.device

import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.ResponseApdu
import android.nfc.tech.IsoDep
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeoutException

/**
 * FFI-neutral device/card manager for Android NFC (skeleton).
 * Responsibilities:
 * - Device handle lifecycle
 * - Card presence cache (ISO-DEP only)
 * - Session start/reset/release placeholders
 *
 * NOTE: No Android-specific terms exposed externally; internal wiring only.
 * ReaderMode/IsoDep details will be added in subsequent iterations.
 */
object SmartCardDeviceImpl {

  private data class DeviceState(
    var isAcquired: Boolean = false,
    var isCardPresent: Boolean = false,
    var activeCardHandle: String? = null
  )

  private val devices: MutableMap<String, DeviceState> = ConcurrentHashMap()
  private val cards: MutableMap<String, String> = ConcurrentHashMap() // cardHandle -> deviceHandle
  private val isoDepByDevice: MutableMap<String, IsoDep> = ConcurrentHashMap()
  private val waitLatchByDevice: MutableMap<String, CountDownLatch> = ConcurrentHashMap()

  // Device lifecycle

  fun acquire(deviceHandle: String) {
    val state = devices.getOrPut(deviceHandle) { DeviceState() }
    state.isAcquired = true
    state.isCardPresent = false
    state.activeCardHandle = null
  }

  fun release(deviceHandle: String) {
    val state = devices[deviceHandle] ?: return
    // Release active card if any
    state.activeCardHandle?.let { releaseCard(it) }
    // Close and clear IsoDep
    isoDepByDevice.remove(deviceHandle)?.let {
      try {
        it.close()
      } catch (_: Throwable) {
        // todo: implement
      }
    }
    // Clear wait latch (if any)
    waitLatchByDevice.remove(deviceHandle)
    state.isAcquired = false
    state.isCardPresent = false
    state.activeCardHandle = null
    devices.remove(deviceHandle)
  }

  // Presence management

  fun isDeviceAvailable(deviceHandle: String): Boolean {
    val state = devices[deviceHandle] ?: return false
    return state.isAcquired
  }

  fun isCardPresent(deviceHandle: String): Boolean {
    val state = devices[deviceHandle] ?: return false
    return state.isCardPresent
  }

  fun markCardPresent(deviceHandle: String, isoDep: IsoDep) {
    val state = devices.getOrPut(deviceHandle) { DeviceState() }
    state.isCardPresent = true
    isoDepByDevice[deviceHandle] = isoDep
    waitLatchByDevice.remove(deviceHandle)?.countDown()
  }

  fun markTagLost(deviceHandle: String) {
    val state = devices[deviceHandle] ?: return
    state.isCardPresent = false
    state.activeCardHandle = null
    isoDepByDevice.remove(deviceHandle)?.let {
      try {
        it.close()
      } catch (_: Throwable) {
        // TODO: handle or log exception
      }
    }
  }

  // Blocking wait (placeholder throws TIMEOUT)

  @Throws(TimeoutException::class)
  fun waitForCardPresence(deviceHandle: String, timeoutMs: Double) {
    val state = devices[deviceHandle] ?: throw IllegalStateException("device not acquired")
    if (state.isCardPresent) return
    val latch = CountDownLatch(1)
    waitLatchByDevice[deviceHandle] = latch
    val ok = latch.await(timeoutMs.toLong(), java.util.concurrent.TimeUnit.MILLISECONDS)
    waitLatchByDevice.remove(deviceHandle)
    if (!ok) throw TimeoutException("Card presence wait timed out ($timeoutMs ms)")
  }

  // Session management (placeholders)

  fun startSession(deviceHandle: String): String {
    val state = devices[deviceHandle] ?: throw IllegalStateException("device not acquired")
    if (!state.isCardPresent) throw IllegalStateException("card not present")
    val cardHandle = "card-$deviceHandle"
    state.activeCardHandle = cardHandle
    cards[cardHandle] = deviceHandle
    return cardHandle
  }

  fun reset(cardHandle: String) {
    throw UnsupportedOperationException("reset not implemented")
  }

  fun releaseCard(cardHandle: String) {
    val deviceHandle = cards.remove(cardHandle) ?: return
    val state = devices[deviceHandle] ?: return
    state.activeCardHandle = null
    state.isCardPresent = false
  }

  // APDU/ATR (placeholders)

  fun getAtr(cardHandle: String): ArrayBuffer {
    throw UnsupportedOperationException("getAtr not implemented")
  }

  fun transmit(cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
    // Placeholder success: SW1=0x90, SW2=0x00, empty data
    // todo: implement actual APDU transmit
    throw IllegalStateException("APDU transmit not implemented")
  }

  fun cancelAllWaitsAndRelease() {
    // Unblock any waiters
    waitLatchByDevice.values.forEach {
      try {
        it.countDown()
      } catch (_: Throwable) {
        // todo: implement
      }
    }
    // Close any active IsoDep sessions
    isoDepByDevice.values.forEach {
      try {
        it.close()
      } catch (_: Throwable) {
        // todo: implement
      }
    }
    // Clear caches and maps
    waitLatchByDevice.clear()
    isoDepByDevice.clear()
    cards.clear()
    devices.clear()
  }
}