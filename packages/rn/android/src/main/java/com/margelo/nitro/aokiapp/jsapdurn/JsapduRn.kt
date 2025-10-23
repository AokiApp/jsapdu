package com.margelo.nitro.aokiapp.jsapdurn

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.aokiapp.jsapdurn.HybridJsapduRnSpec

@DoNotStrip
class JsapduRn : HybridJsapduRnSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
