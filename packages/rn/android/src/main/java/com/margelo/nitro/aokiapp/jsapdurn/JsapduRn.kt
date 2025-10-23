package com.margelo.nitro.aokiapp.jsapdurn

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.ArrayBuffer
import app.aoki.jsapdu.rn.platform.PlatformManager
import app.aoki.jsapdu.rn.device.SmartCardDeviceImpl
import app.aoki.jsapdu.rn.platform.ReactContextProvider

/**
 * React Native Nitro Modules delegator for Android NFC.
 * FFI-neutral: public methods use generic terms, internal managers handle Android specifics.
 * NOTE: initPlatform/releasePlatform will be wired to React Context/Activity in a subsequent step.
 */
@DoNotStrip
class JsapduRn : HybridJsapduRnSpec() {

  /**
   * Platform initialization (placeholder).
   * TODO: Wire to SmartCardPlatformImpl.initialize(reactContext) once context retrieval is added.
   */
  override fun initPlatform(): Promise<Unit> = Promise.async {
    val ctx = ReactContextProvider.getAppContextOrThrow()
    PlatformManager.initialize(ctx)
    Unit
  }

  /**
   * Platform release (placeholder).
   * TODO: Wire to SmartCardPlatformImpl.release() after initialization is implemented.
   */
  override fun releasePlatform(): Promise<Unit> = Promise.async {
    PlatformManager.release()
    Unit
  }

  /**
   * Enumerate device info via platform manager.
   * Acceptance: 0 or 1 device for integrated NFC; non-NFC returns 0 devices.
   */
  override fun getDeviceInfo(): Promise<Array<DeviceInfo>> = Promise.async {
    PlatformManager.getDeviceInfo()
  }

  /**
   * Acquire device and activate RF.
   * Returns an opaque device handle; also registers handle in device manager.
   */
  override fun acquireDevice(deviceId: String): Promise<String> = Promise.async {
    val handle = SmartCardPlatformImpl.acquireDevice(deviceId)
    handle
  }

  /**
   * Lightweight availability check (non-blocking).
   */
  override fun isDeviceAvailable(deviceHandle: String): Promise<Boolean> = Promise.async {
    SmartCardDeviceImpl.isDeviceAvailable(deviceHandle)
  }

  /**
   * Lightweight card presence check (non-blocking).
   */
  override fun isCardPresent(deviceHandle: String): Promise<Boolean> = Promise.async {
    SmartCardDeviceImpl.isCardPresent(deviceHandle)
  }

  /**
   * Blocking wait for ISO-DEP card presence (event-driven; timeout in ms).
   */
  override fun waitForCardPresence(deviceHandle: String, timeout: Double?): Promise<Unit> = Promise.async {
    SmartCardDeviceImpl.waitForCardPresence(deviceHandle, timeout)
    Unit
  }

  /**
   * Start ISO-DEP session and return card handle.
   */
  override fun startSession(deviceHandle: String): Promise<String> = Promise.async {
    SmartCardDeviceImpl.startSession(deviceHandle)
  }

  /**
   * Release device and deactivate RF.
   */
  override fun releaseDevice(deviceHandle: String): Promise<Unit> = Promise.async {
    SmartCardDeviceImpl.release(deviceHandle)
    Unit
  }

  /**
   * Get ATR/ATS raw bytes.
   */
  override fun getAtr(cardHandle: String): Promise<ArrayBuffer> = Promise.async {
    SmartCardDeviceImpl.getAtr(cardHandle)
  }

  /**
   * APDU transmit; returns ResponseApdu (data + SW1/SW2).
   */
  override fun transmit(cardHandle: String, apdu: ArrayBuffer): Promise<ArrayBuffer> = Promise.async {
    SmartCardDeviceImpl.transmit(cardHandle, apdu)
  }

  /**
   * Reset session (close/reconnect while keeping RF active).
   */
  override fun reset(cardHandle: String): Promise<Unit> = Promise.async {
    SmartCardDeviceImpl.reset(cardHandle)
    Unit
  }

  /**
   * Release card session.
   */
  override fun releaseCard(cardHandle: String): Promise<Unit> = Promise.async {
    SmartCardDeviceImpl.releaseCard(cardHandle)
    Unit
  }
}