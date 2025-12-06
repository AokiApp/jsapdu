package app.aoki.jsapdu.rn

import android.util.Log
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.aokiapp.jsapdurn.aokiapp_jsapdurnOnLoad

class JsapduRnPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    Log.d("JsapduRnPackage", "getReactModuleInfoProvider called")
    return ReactModuleInfoProvider { HashMap() }
  }

  companion object {
    init {
      aokiapp_jsapdurnOnLoad.initializeNative()
    }
  }
}
