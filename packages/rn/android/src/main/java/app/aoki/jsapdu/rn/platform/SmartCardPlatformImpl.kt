package app.aoki.jsapdu.rn.platform

import android.content.Context
import android.nfc.NfcAdapter
import android.nfc.tech.IsoDep
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.D2CProtocol
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.P2DProtocol
import com.margelo.nitro.aokiapp.jsapdurn.ResponseApdu
import app.aoki.jsapdu.rn.device.SmartCardDeviceImpl
import java.util.concurrent.TimeoutException

/**
 * FFI-neutral platform manager for Android NFC (skeleton).
 * Notes:
 * - No Android-specific terms in external APIs; internal use only.
 * - This class provides minimal, build-unblocking behavior.
 * - JsapduRn.kt will delegate into this singleton.
 */
object PlatformManager {

  private const val DEFAULT_TIMEOUT_MS = 30000.0

  private var appContext: Context? = null
  private var nfcAdapter: NfcAdapter? = null
  private var initialized: Boolean = false

  fun initialize(context: Context) {
    if (initialized) throw IllegalStateException("already initialized")
    appContext = context.applicationContext
    nfcAdapter = NfcAdapter.getDefaultAdapter(appContext)
    if (nfcAdapter == null) {
      throw UnsupportedOperationException("NFC not supported")
    }
    // Register screen-off/idle receivers to cancel waits and release resources
    val ctx = appContext
    if (ctx != null) {
      ScreenStateReceiver.register(ctx) {
        SmartCardDeviceImpl.cancelAllWaitsAndRelease()
        val activity = ReactContextProvider.getCurrentActivityOrNull()
        if (activity != null) {
          NfcReaderController.disable(activity)
        }
      }
    }
    initialized = true
  }

  fun release() {
    if (!initialized) throw IllegalStateException("not initialized")
    val ctx = appContext
    if (ctx != null) {
      ScreenStateReceiver.unregister(ctx)
    }
    val activity = ReactContextProvider.getCurrentActivityOrNull()
    if (activity != null) {
      NfcReaderController.disable(activity)
    }
    SmartCardDeviceImpl.cancelAllWaitsAndRelease()
    initialized = false
  }

  fun getDeviceInfo(): Array<DeviceInfo> {
    ensureInitialized()
    val adapter = nfcAdapter ?: return emptyArray()
    if (!adapter.isEnabled) return emptyArray()
    return arrayOf(
      DeviceInfo(
        id = "integrated-nfc-0",
        devicePath = null,
        friendlyName = "Integrated NFC Reader",
        description = null,
        supportsApdu = true,
        supportsHce = false,
        isIntegratedDevice = true,
        isRemovableDevice = false,
        d2cProtocol = D2CProtocol.NFC,
        p2dProtocol = P2DProtocol.NFC,
        apduApi = arrayOf("nfc", "androidnfc")
      )
    )
  }

  fun acquireDevice(deviceId: String): String {
    ensureInitialized()
    val adapter = nfcAdapter ?: throw UnsupportedOperationException("NFC not supported")
    if (!adapter.isEnabled) throw SecurityException("NFC is disabled")
    val handle = "handle-$deviceId"
    val activity = ReactContextProvider.getCurrentActivityOrNull()
        ?: throw IllegalStateException("No foreground Activity to enable ReaderMode")
    NfcReaderController.enable(activity, handle, object : NfcReaderController.Listener {
      override fun onIsoDep(deviceHandle: String, isoDep: IsoDep) {
        SmartCardDeviceImpl.markCardPresent(deviceHandle, isoDep)
      }
      override fun onTagLost(deviceHandle: String) {
        SmartCardDeviceImpl.markTagLost(deviceHandle)
      }
    })
    return handle
  }

  fun isDeviceAvailable(deviceHandle: String): Boolean {
    if (!initialized) return false
    val adapter = nfcAdapter ?: return false
    return adapter.isEnabled
  }

  fun isCardPresent(deviceHandle: String): Boolean {
    ensureInitialized()
    return SmartCardDeviceImpl.isCardPresent(deviceHandle)
  }

  @Throws(TimeoutException::class)
  fun waitForCardPresence(deviceHandle: String, timeout: Double?) {
    ensureInitialized()
    val t = timeout ?: DEFAULT_TIMEOUT_MS
    SmartCardDeviceImpl.waitForCardPresence(deviceHandle, t)
  }

  fun startSession(deviceHandle: String): String {
    ensureInitialized()
    // TODO: Connect IsoDep and return opaque card handle when a card is present.
    throw IllegalStateException("Card not present")
  }

  fun releaseDevice(deviceHandle: String) {
    ensureInitialized()
    val activity = ReactContextProvider.getCurrentActivityOrNull()
    if (activity != null) {
      NfcReaderController.disable(activity)
    }
  }

  fun getAtr(cardHandle: String): ArrayBuffer {
    ensureInitialized()
    throw UnsupportedOperationException("getAtr not implemented")
  }

  fun transmit(cardHandle: String, apdu: ArrayBuffer): ResponseApdu {
    ensureInitialized()
    throw UnsupportedOperationException("transmit not implemented")
  }

  fun reset(cardHandle: String) {
    ensureInitialized()
    throw UnsupportedOperationException("reset not implemented")
  }

  fun releaseCard(cardHandle: String) {
    ensureInitialized()
    throw UnsupportedOperationException("releaseCard not implemented")
  }

  private fun ensureInitialized() {
    if (!initialized) throw IllegalStateException("not initialized")
  }
}