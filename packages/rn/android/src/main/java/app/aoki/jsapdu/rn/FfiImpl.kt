package app.aoki.jsapdu.rn

import com.margelo.nitro.core.ArrayBuffer

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
        smartCardPlatform?.initialize()
    }

    fun releasePlatform(): Unit {
        requirePlatformInitialized()
        smartCardPlatform?.release()
        smartCardPlatform = null
    }

    fun getDeviceInfo(): Array<DeviceInfo> {
        requirePlatformInitialized()
        return smartCardPlatform!!.getDeviceInfo()
    }

    fun acquireDevice(): String {
        throw NotImplementedError("FfiImpl.acquireDevice not implemented")
    }

    fun isDeviceAvailable(deviceHandle: String): Boolean {
        throw NotImplementedError("FfiImpl.isDeviceAvailable not implemented")
    }

    fun isCardPresent(deviceHandle: String): Boolean {
        throw NotImplementedError("FfiImpl.isCardPresent not implemented")
    }

    fun waitForCardPresence(deviceHandle: String, timeout: Double): Unit {
        throw NotImplementedError("FfiImpl.waitForCardPresence not implemented")
    }

    fun startSession(deviceHandle: String): String {
        throw NotImplementedError("FfiImpl.startSession not implemented")
    }

    fun releaseDevice(deviceHandle: String): Unit {
        throw NotImplementedError("FfiImpl.releaseDevice not implemented")
    }

    fun getAtr(deviceHandle: String, cardHandle: String): ArrayBuffer {
        throw NotImplementedError("FfiImpl.getAtr not implemented")
    }

    fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
        throw NotImplementedError("FfiImpl.transmit not implemented")
    }

    fun reset(deviceHandle: String, cardHandle: String): Unit {
        throw NotImplementedError("FfiImpl.reset not implemented")
    }

    fun releaseCard(deviceHandle: String, cardHandle: String): Unit {
        throw NotImplementedError("FfiImpl.releaseCard not implemented")
    }

    fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?): Unit {
        throw NotImplementedError("FfiImpl.onStatusUpdate not implemented")
    }
}