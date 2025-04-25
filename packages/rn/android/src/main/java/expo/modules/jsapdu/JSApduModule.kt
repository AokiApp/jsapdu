package expo.modules.jsapdu

import android.content.Context
import expo.modules.kotlin.modules.Module

/**
 * JSApdu Module
 * This is the main entry point for the JSApdu module
 */
class JSApduModule : Module() {
  // Use the module definition
  override fun definition() = JSApduModuleDefinition().definition()
}