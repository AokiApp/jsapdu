package app.aoki.jsapdu.rn.platform

import android.app.Activity
import android.app.Application
import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext

/**
 * React context provider for Nitro Modules.
 * - Prefer ReactApplicationContext when available
 * - Fallback to Application via ActivityThread.currentApplication()
 * - Activity is optional (ReaderMode needs Activity; use getCurrentActivityOrNull())
 */
object ReactContextProvider {

  /**
   * Returns ReactApplicationContext if available, else Application context.
   * Throws if neither is obtainable.
   */
  fun getAppContextOrThrow(): Context {
    val app = getApplicationViaActivityThread()
    val reactContext = tryGetReactApplicationContext(app)
    return reactContext ?: app
      ?: throw IllegalStateException("Application context not available")
  }

  /**
   * Best-effort current Activity retrieval from React instance.
   * Might return null when app is backgrounded or not yet initialized.
   */
  fun getCurrentActivityOrNull(): Activity? {
    return try {
      val app = getApplicationViaActivityThread() as? ReactApplication ?: return null
      val instanceManager = app.reactNativeHost.reactInstanceManager
      val reactContext = instanceManager.currentReactContext as? ReactApplicationContext
      reactContext?.currentActivity
    } catch (_: Throwable) {
      // TODO: handle or log exception
      null
    }
  }

  /**
   * Reflection access to ActivityThread.currentApplication().
   */
  private fun getApplicationViaActivityThread(): Application? {
    return try {
      val cls = Class.forName("android.app.ActivityThread")
      val method = cls.getDeclaredMethod("currentApplication")
      method.isAccessible = true
      method.invoke(null) as? Application
    } catch (_: Throwable) {
      // TODO: handle or log exception
      null
    }
  }

  /**
   * ReactApplicationContext if RN host is set up.
   */
  private fun tryGetReactApplicationContext(app: Application?): ReactApplicationContext? {
    return try {
      val reactApp = app as? ReactApplication ?: return null
      val instanceManager = reactApp.reactNativeHost.reactInstanceManager
      instanceManager.currentReactContext as? ReactApplicationContext
    } catch (_: Throwable) {
      // TODO: handle or log exception
      null
    }
  }
}