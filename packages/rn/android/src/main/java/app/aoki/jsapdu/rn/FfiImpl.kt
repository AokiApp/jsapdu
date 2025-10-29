package app.aoki.jsapdu.rn

import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.utils.ArrayBufferUtils

object FfiImpl {
    private var smartCardPlatform: SmartCardPlatform? = null

    private inline fun requirePlatformUninitialized() {
        if (smartCardPlatform != null && smartCardPlatform!!.isInitialized()) {
            throw IllegalStateException("FfiImpl: Platform already initialized")
        }
    }

    private inline fun requirePlatformInitialized() {
        if (smartCardPlatform == null || !smartCardPlatform!!.isInitialized()) {
            throw IllegalStateException("FfiImpl: Platform not initialized")
        }
    }

    fun initPlatform(): Unit {
        requirePlatformUninitialized()
        smartCardPlatform = SmartCardPlatform()
        smartCardPlatform!!.initialize()
    }

    fun releasePlatform(): Unit {
        requirePlatformInitialized()
        smartCardPlatform!!.release()
        smartCardPlatform = null
    }

    fun getDeviceInfo(): Array<DeviceInfo> {
        requirePlatformInitialized()
        return smartCardPlatform!!.getDeviceInfo()
    }

    fun acquireDevice(deviceId: String): String {
        requirePlatformInitialized()
        return smartCardPlatform!!.acquireDevice(deviceId)
    }

    fun isDeviceAvailable(deviceHandle: String): Boolean {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isAvailable()
    }

    fun isCardPresent(deviceHandle: String): Boolean {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isCardPresent()
    }

    fun waitForCardPresence(deviceHandle: String, timeout: Double): Unit {
        throw NotImplementedError("FfiImpl.waitForCardPresence not implemented")
    }

    fun startSession(deviceHandle: String): String {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.startSession()
    }

    fun releaseDevice(deviceHandle: String): Unit {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        device.release()
    }

    fun getAtr(deviceHandle: String, cardHandle: String): ArrayBuffer {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val atr = card.getAtr()
        return ArrayBufferUtils.fromByteArray(atr)
    }

    fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val apduBytes = ArrayBufferUtils.copyToByteArray(apdu)
        val response = card.transmit(apduBytes)
        return ArrayBufferUtils.fromByteArray(response)
    }

    fun reset(deviceHandle: String, cardHandle: String): Unit {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        card.reset()
    }

    fun releaseCard(deviceHandle: String, cardHandle: String): Unit {
        requirePlatformInitialized()
        val device = smartCardPlatform!!.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        device.releaseCard(cardHandle)
    }

    fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?): Unit {
        throw NotImplementedError("FfiImpl.onStatusUpdate not implemented")
    }
}