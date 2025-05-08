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
  
  /**
   * Called when the module is being destroyed
   * Ensures all resources are properly cleaned up
   */
  override fun onDestroy() {
    super.onDestroy()
    
    // Clear all registered objects to prevent memory leaks
    ObjectRegistry.clear()
  }
}