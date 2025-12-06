package com.margelo.nitro.aokiapp.jsapdurn

import app.aoki.jsapdu.rn.FfiImpl
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise

@DoNotStrip
class JsapduRn : HybridJsapduRnSpec() {

  override fun initPlatform(force: Boolean?): Promise<Unit> = Promise.async { FfiImpl.initPlatform(force ?: false) }

  override fun releasePlatform(force: Boolean?): Promise<Unit> =
    Promise.async { FfiImpl.releasePlatform(force ?: false) }

  override fun isPlatformInitialized(): Promise<Boolean> = Promise.async { FfiImpl.isPlatformInitialized() }

  override fun getDeviceInfo(): Promise<Array<DeviceInfo>> = Promise.async { FfiImpl.getDeviceInfo() }

  override fun acquireDevice(deviceId: String): Promise<String> = Promise.async { FfiImpl.acquireDevice(deviceId) }

  override fun isDeviceAvailable(deviceHandle: String): Promise<Boolean> = Promise.async {
    FfiImpl.isDeviceAvailable(deviceHandle)
  }

  override fun isCardPresent(deviceHandle: String): Promise<Boolean> = Promise.async {
    FfiImpl.isCardPresent(deviceHandle)
  }

  override fun waitForCardPresence(deviceHandle: String, timeout: Double): Promise<Unit> = Promise.async {
    FfiImpl.waitForCardPresence(deviceHandle, timeout)
  }

  override fun startSession(deviceHandle: String): Promise<String> =
    Promise.async { FfiImpl.startSession(deviceHandle) }

  override fun releaseDevice(deviceHandle: String): Promise<Unit> =
    Promise.async { FfiImpl.releaseDevice(deviceHandle) }

  override fun getAtr(deviceHandle: String, cardHandle: String): Promise<ArrayBuffer> = Promise.async {
    FfiImpl.getAtr(deviceHandle, cardHandle)
  }

  override fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): Promise<ArrayBuffer> {
    val apduCopied = ArrayBuffer.copy(apdu)
    return Promise.async {
      FfiImpl.transmit(deviceHandle, cardHandle, apduCopied)
    }
  }

  override fun reset(deviceHandle: String, cardHandle: String): Promise<Unit> = Promise.async {
    FfiImpl.reset(deviceHandle, cardHandle)
  }

  override fun releaseCard(deviceHandle: String, cardHandle: String): Promise<Unit> = Promise.async {
    FfiImpl.releaseCard(deviceHandle, cardHandle)
  }

  override fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?) {
    FfiImpl.onStatusUpdate(callback)
  }
}
