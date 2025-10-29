package com.margelo.nitro.aokiapp.jsapdurn

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.ArrayBuffer
import app.aoki.jsapdu.rn.FfiImpl

@DoNotStrip
class JsapduRn : HybridJsapduRnSpec() {

  override fun initPlatform(): Promise<Unit> = Promise.async { FfiImpl.initPlatform() }

  override fun releasePlatform(): Promise<Unit> = Promise.async { FfiImpl.releasePlatform() }

  override fun getDeviceInfo(): Promise<Array<DeviceInfo>> = Promise.async { FfiImpl.getDeviceInfo() }

  override fun acquireDevice(deviceId: String): Promise<String> = Promise.async { FfiImpl.acquireDevice(deviceId) }

  override fun isDeviceAvailable(deviceHandle: String): Promise<Boolean> = Promise.async { FfiImpl.isDeviceAvailable(deviceHandle) }

  override fun isCardPresent(deviceHandle: String): Promise<Boolean> = Promise.async { FfiImpl.isCardPresent(deviceHandle) }

  override fun waitForCardPresence(deviceHandle: String, timeout: Double): Promise<Unit> = Promise.async { FfiImpl.waitForCardPresence(deviceHandle, timeout) }

  override fun startSession(deviceHandle: String): Promise<String> = Promise.async { FfiImpl.startSession(deviceHandle) }

  override fun releaseDevice(deviceHandle: String): Promise<Unit> = Promise.async { FfiImpl.releaseDevice(deviceHandle) }

  override fun getAtr(deviceHandle: String, cardHandle: String): Promise<ArrayBuffer> = Promise.async { FfiImpl.getAtr(deviceHandle, cardHandle) }

  override fun transmit(deviceHandle: String, cardHandle: String, apdu: ArrayBuffer): Promise<ArrayBuffer> = Promise.async { FfiImpl.transmit(deviceHandle, cardHandle, apdu) }

  override fun reset(deviceHandle: String, cardHandle: String): Promise<Unit> = Promise.async { FfiImpl.reset(deviceHandle, cardHandle) }

  override fun releaseCard(deviceHandle: String, cardHandle: String): Promise<Unit> = Promise.async { FfiImpl.releaseCard(deviceHandle, cardHandle) }

  override fun onStatusUpdate(callback: ((eventType: String, payload: EventPayload) -> Unit)?): Unit {
    FfiImpl.onStatusUpdate(callback)
  }
}