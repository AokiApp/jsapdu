package app.aoki.jsapdu.rn

import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.utils.ArrayBufferUtils

object FfiImpl {
    @Volatile private var smartCardPlatform: SmartCardPlatform? = null
    private val platformLock = Any()

    private inline fun ensureInitialized(): SmartCardPlatform {
        val platform = smartCardPlatform ?: throw IllegalStateException("FfiImpl: Platform not initialized")
        if (!platform.isInitialized()) {
            throw IllegalStateException("FfiImpl: Platform not initialized")
        }
        return platform
    }

    fun initPlatform(): Unit {
        synchronized(platformLock) {
            if (smartCardPlatform?.isInitialized() == true) {
                throw IllegalStateException("FfiImpl: Platform already initialized")
            }
            val platform = SmartCardPlatform()
            platform.initialize()
            smartCardPlatform = platform
        }
    }

    fun releasePlatform(): Unit {
        val platformToRelease: SmartCardPlatform = synchronized(platformLock) {
            val platform = smartCardPlatform ?: throw IllegalStateException("FfiImpl: Platform not initialized")
            smartCardPlatform = null
            platform
        }
        platformToRelease.release()
    }

    fun getDeviceInfo(): Array<DeviceInfo> {
        val platform = ensureInitialized()
        return platform.getDeviceInfo()
    }

    fun acquireDevice(deviceId: String): String {
        val platform = ensureInitialized()
        return platform.acquireDevice(deviceId)
    }

    fun isDeviceAvailable(deviceHandle: String): Boolean {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isAvailable()
    }

    fun isCardPresent(deviceHandle: String): Boolean {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isCardPresent()
    }

    fun waitForCardPresence(deviceHandle: String, timeout: Double): Unit {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        device.waitForCardPresence(timeout)
    }

    fun startSession(deviceHandle: String): String {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.startSession()
    }

    fun releaseDevice(deviceHandle: String): Unit {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        device.release()
    }

    fun getAtr(deviceHandle: String, cardHandle: String): ArrayBuffer {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val atr: ByteArray = card.getAtr()
        return ArrayBufferUtils.fromByteArray(atr)
    }

    fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val apduBytes: ByteArray = ArrayBufferUtils.copyToByteArray(apdu)
        val response: ByteArray = card.transmit(apduBytes)
        return ArrayBufferUtils.fromByteArray(response)
    }

    fun reset(deviceHandle: String, cardHandle: String): Unit {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        card.reset()
    }

    fun releaseCard(deviceHandle: String, cardHandle: String): Unit {
        val platform = ensureInitialized()
        val device = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        device.releaseCard(cardHandle)
    }

    fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?): Unit {
        if (callback == null) {
            StatusEventDispatcher.clear()
        } else {
            StatusEventDispatcher.setCallback(callback)
        }
    }
}