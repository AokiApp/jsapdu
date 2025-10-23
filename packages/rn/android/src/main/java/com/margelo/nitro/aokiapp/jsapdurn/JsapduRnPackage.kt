package com.margelo.nitro.aokiapp.jsapdurn

import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * ReactPackage scaffold for RN. Nitro Modules autolinking is handled by
 * generated gradle/cmake via nitrogen, so no classic NativeModule is exposed.
 * Kept to satisfy project docs and IDE discovery.
 */
@DoNotStrip
class JsapduRnPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    // Nitro-generated Hybrid spec handles the module; nothing to expose here.
    return emptyList()
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}