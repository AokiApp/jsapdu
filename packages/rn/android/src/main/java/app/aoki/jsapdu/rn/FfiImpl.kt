package app.aoki.jsapdu.rn

import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.aokiapp.jsapdurn.DeviceInfo
import com.margelo.nitro.aokiapp.jsapdurn.EventPayload
import app.aoki.jsapdu.rn.utils.ArrayBufferUtils
import app.aoki.jsapdu.rn.core.IDevice
import app.aoki.jsapdu.rn.core.ICardSession

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
    /**
     * Returns whether the SmartCardPlatform is initialized.
     * - true when an instance exists and reports initialized
     * - false when no instance exists or it is not initialized
     *
     * Safe to call from Kotlin at any time.
     */
    fun isPlatformInitialized(): Boolean {
        val platform = smartCardPlatform
        return platform?.isInitialized() == true
    }

    fun initPlatform(force: Boolean = false): Unit {
        var bypassedOnly = false
        synchronized(platformLock) {
            val existing = smartCardPlatform
            if (existing?.isInitialized() == true) {
                if (!force) {
                    throw IllegalStateException("FfiImpl: Platform already initialized")
                }
                // force=true: bypass precondition check only (no-op)
                bypassedOnly = true
            } else {
                val platform = existing ?: SmartCardPlatform().also { smartCardPlatform = it }
                platform.initialize(force)
            }
        }
        if (bypassedOnly) return
    }

    fun releasePlatform(force: Boolean = false): Unit {
        var platformToRelease: SmartCardPlatform? = null
        var bypassedOnly = false
        synchronized(platformLock) {
            val platform = smartCardPlatform
            if (platform == null) {
                if (!force) {
                    throw IllegalStateException("FfiImpl: Platform not initialized")
                }
                // force=true: bypass precondition check only (no-op)
                bypassedOnly = true
            } else {
                val isInit = platform.isInitialized()
                if (!isInit) {
                    if (!force) {
                        throw IllegalStateException("FfiImpl: Platform not initialized")
                    }
                    // force=true: bypass precondition check only (no-op)
                    bypassedOnly = true
                } else {
                    // Normal release path
                    smartCardPlatform = null
                    platformToRelease = platform
                }
            }
        }
        if (bypassedOnly) return
        platformToRelease?.release(force)
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
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isAvailable()
    }

    fun isCardPresent(deviceHandle: String): Boolean {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.isCardPresent()
    }

    fun waitForCardPresence(deviceHandle: String, timeout: Double): Unit {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        device.waitForCardPresence(timeout)
    }

    fun startSession(deviceHandle: String): String {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        return device.startSession()
    }

    fun releaseDevice(deviceHandle: String): Unit {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        device.release()
    }

    fun getAtr(deviceHandle: String, cardHandle: String): ArrayBuffer {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card: ICardSession = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val atr: ByteArray = card.getAtr()
        return ArrayBufferUtils.fromByteArray(atr)
    }

    fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): ArrayBuffer {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card: ICardSession = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        val apduBytes: ByteArray = ArrayBufferUtils.copyToByteArray(apdu)
        val response: ByteArray = card.transmit(apduBytes)
        return ArrayBufferUtils.fromByteArray(response)
    }

    fun reset(deviceHandle: String, cardHandle: String): Unit {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card: ICardSession = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        card.reset()
    }

    fun releaseCard(deviceHandle: String, cardHandle: String): Unit {
        val platform = ensureInitialized()
        val device: IDevice = platform.getTarget(deviceHandle)
            ?: throw IllegalArgumentException("INVALID_DEVICE_HANDLE: No such device '$deviceHandle'")
        val card: ICardSession = device.getTarget(cardHandle)
            ?: throw IllegalArgumentException("INVALID_CARD_HANDLE: No such card '$cardHandle'")
        card.release()
    }

    fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?): Unit {
        if (callback == null) {
            StatusEventDispatcher.clear()
        } else {
            StatusEventDispatcher.setCallback(callback)
        }
    }
}