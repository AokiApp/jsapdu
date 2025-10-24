package app.aoki.jsapdu.rn.platform

import android.app.Activity
import android.app.Application
import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.lang.ref.WeakReference
import java.util.concurrent.ConcurrentHashMap

/**
 * Enhanced React context provider for Nitro Modules with improved reliability.
 *
 * Key improvements:
 * - Mutex protection for thread-safe context operations
 * - WeakReference caching to prevent memory leaks
 * - Enhanced error handling with specific exception messages
 * - Multiple fallback strategies for Activity retrieval
 * - Proper lifecycle tracking and cleanup
 *
 * Context retrieval strategy:
 * 1. ReactApplicationContext (preferred)
 * 2. Application context via ActivityThread reflection
 * 3. Cached context if previous methods fail
 *
 * Activity retrieval strategy:
 * 1. ReactApplicationContext.currentActivity (preferred)
 * 2. Cached Activity if React context unavailable
 * 3. null if no Activity available (caller must handle)
 *
 * Max: 350 lines per updated coding standards.
 */
object ReactContextProvider {

  private val contextMutex = Mutex()
  private var cachedAppContext: WeakReference<Context>? = null
  private var cachedActivity: WeakReference<Activity>? = null
  private var lastContextRetrievalTime: Long = 0
  private val CONTEXT_CACHE_TIMEOUT_MS = 5000L // 5 second cache timeout

  /**
   * Get Application context with multiple fallback strategies.
   *
   * @return Application context (never null)
   * @throws IllegalStateException if no context available
   */
  suspend fun getAppContextOrThrow(): Context = contextMutex.withLock {
    // Try cached context first (with timeout check)
    val currentTime = System.currentTimeMillis()
    if (currentTime - lastContextRetrievalTime < CONTEXT_CACHE_TIMEOUT_MS) {
      cachedAppContext?.get()?.let { context ->
        return@withLock context
      }
    }
    
    // Primary: Get Application via ActivityThread reflection
    val app = getApplicationViaActivityThread()
    
    // Secondary: Try ReactApplicationContext
    val reactContext = tryGetReactApplicationContext(app)
    
    // Determine best context to use
    val bestContext = reactContext ?: app
      ?: throw IllegalStateException("PLATFORM_ERROR: Application context not available - app may not be properly initialized")
    
    // Update cache
    cachedAppContext = WeakReference(bestContext)
    lastContextRetrievalTime = currentTime
    
    bestContext
  }

  /**
   * Best-effort current Activity retrieval with enhanced reliability.
   *
   * Uses multiple fallback strategies to maximize success rate.
   * Returns null if no Activity is available (backgrounded app, etc.).
   *
   * @return Current Activity or null if unavailable
   */
  suspend fun getCurrentActivityOrNull(): Activity? = contextMutex.withLock {
    try {
      // Primary: Get from ReactApplicationContext
      val app = getApplicationViaActivityThread() as? ReactApplication
      if (app != null) {
        val instanceManager = app.reactNativeHost.reactInstanceManager
        val reactContext = instanceManager.currentReactContext as? ReactApplicationContext
        val currentActivity = reactContext?.currentActivity
        
        if (currentActivity != null && !currentActivity.isDestroyed && !currentActivity.isFinishing) {
          // Update cache with valid Activity
          cachedActivity = WeakReference(currentActivity)
          return@withLock currentActivity
        }
      }
      
      // Fallback: Use cached Activity if still valid
      cachedActivity?.get()?.let { activity ->
        if (!activity.isDestroyed && !activity.isFinishing) {
          return@withLock activity
        } else {
          // Clear invalid cached Activity
          cachedActivity = null
        }
      }
      
      // No valid Activity available
      return@withLock null
      
    } catch (e: Exception) {
      // Clear potentially corrupted cache on exception
      cachedActivity = null
      return@withLock null
    }
  }

  /**
   * Get current Activity with validation and error handling.
   *
   * @return Current Activity
   * @throws IllegalStateException if no Activity available
   */
  suspend fun getCurrentActivityOrThrow(): Activity {
    return getCurrentActivityOrNull()
      ?: throw IllegalStateException("PLATFORM_ERROR: No foreground Activity available - app may be backgrounded")
  }

  /**
   * Enhanced reflection access to ActivityThread.currentApplication().
   *
   * @return Application instance or null if reflection fails
   */
  private fun getApplicationViaActivityThread(): Application? {
    return try {
      val activityThreadClass = Class.forName("android.app.ActivityThread")
      val currentApplicationMethod = activityThreadClass.getDeclaredMethod("currentApplication")
      currentApplicationMethod.isAccessible = true
      
      val application = currentApplicationMethod.invoke(null) as? Application
      
      if (application == null) {
        // Try alternative method if currentApplication returns null
        val currentActivityThreadMethod = activityThreadClass.getDeclaredMethod("currentActivityThread")
        currentActivityThreadMethod.isAccessible = true
        val activityThread = currentActivityThreadMethod.invoke(null)
        
        if (activityThread != null) {
          val applicationField = activityThreadClass.getDeclaredField("mApplication")
          applicationField.isAccessible = true
          applicationField.get(activityThread) as? Application
        } else {
          null
        }
      } else {
        application
      }
      
    } catch (e: ClassNotFoundException) {
      null // ActivityThread class not found - should not happen on Android
    } catch (e: NoSuchMethodException) {
      null // Method signature changed - handle gracefully
    } catch (e: SecurityException) {
      null // Reflection blocked by security policy
    } catch (e: Exception) {
      null // Any other reflection error
    }
  }

  /**
   * Get ReactApplicationContext if React Native is properly set up.
   *
   * @param app Application instance
   * @return ReactApplicationContext or null if not available
   */
  private fun tryGetReactApplicationContext(app: Application?): ReactApplicationContext? {
    if (app == null) return null
    
    return try {
      val reactApp = app as? ReactApplication ?: return null
      val reactNativeHost = reactApp.reactNativeHost
      val instanceManager = reactNativeHost.reactInstanceManager
      
      // Check if React context is ready
      val reactContext = instanceManager.currentReactContext as? ReactApplicationContext
      
      // Validate context is actually usable
      if (reactContext?.hasActiveReactInstance() == true) {
        reactContext
      } else {
        null
      }
      
    } catch (e: ClassCastException) {
      null // App is not ReactApplication
    } catch (e: UninitializedPropertyAccessException) {
      null // React Native not yet initialized
    } catch (e: Exception) {
      null // Any other React Native setup issue
    }
  }

  /**
   * Clear cached references (for cleanup or when contexts become invalid).
   * Should be called during platform release.
   */
  suspend fun clearCache() = contextMutex.withLock {
    cachedAppContext = null
    cachedActivity = null
    lastContextRetrievalTime = 0
  }

  /**
   * Validate cached Activity is still usable.
   *
   * @return true if cached Activity is valid and not finishing/destroyed
   */
  private fun isCachedActivityValid(): Boolean {
    return cachedActivity?.get()?.let { activity ->
      !activity.isDestroyed && !activity.isFinishing
    } ?: false
  }

  /**
   * Update cached Activity reference (called when new Activity becomes available).
   *
   * @param activity New Activity to cache
   */
  suspend fun updateCachedActivity(activity: Activity) = contextMutex.withLock {
    if (!activity.isDestroyed && !activity.isFinishing) {
      cachedActivity = WeakReference(activity)
    }
  }
}