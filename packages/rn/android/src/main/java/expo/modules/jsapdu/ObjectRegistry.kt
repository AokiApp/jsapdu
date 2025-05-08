package expo.modules.jsapdu

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Registry for managing objects and their receiver IDs
 * This class is used to maintain the mapping between JavaScript objects and their JVM counterparts
 */
object ObjectRegistry {
  // Map of receiver IDs to objects
  private val objects = ConcurrentHashMap<String, Any>()
  
  // Map of objects to receiver IDs (reverse lookup)
  private val objectIds = ConcurrentHashMap<Any, String>()
  
  /**
   * Register an object and get its receiver ID
   * If the object is already registered, return its existing ID
   * @param obj The object to register
   * @return The receiver ID for the object
   */
  fun <T : Any> register(obj: T): String {
    // Check if the object is already registered
    val existingId = objectIds[obj]
    if (existingId != null) {
      return existingId
    }
    
    // Generate a new ID
    val id = UUID.randomUUID().toString()
    
    // Register the object
    objects[id] = obj
    objectIds[obj] = id
    
    return id
  }
  
  /**
   * Get an object by its receiver ID
   * @param id The receiver ID
   * @return The object
   * @throws IllegalArgumentException if the object is not found
   */
  @Suppress("UNCHECKED_CAST")
  fun <T : Any> getObject(id: String): T {
    val obj = objects[id] ?: throw IllegalArgumentException("Object with ID $id not found")
    return obj as T
  }
  
  /**
   * Get the receiver ID for an object
   * @param obj The object
   * @return The receiver ID
   * @throws IllegalArgumentException if the object is not registered
   */
  fun getObjectId(obj: Any): String {
    return objectIds[obj] ?: throw IllegalArgumentException("Object not registered")
  }
  
  /**
   * Unregister an object
   * @param id The receiver ID
   * @return The unregistered object, or null if not found
   */
  @Suppress("UNCHECKED_CAST")
  fun <T : Any> unregister(id: String): T? {
    val obj = objects.remove(id) ?: return null
    objectIds.remove(obj)
    return obj as T
  }
  
  /**
   * Unregister an object
   * @param obj The object
   * @return The receiver ID, or null if not found
   */
  fun unregister(obj: Any): String? {
    val id = objectIds.remove(obj) ?: return null
    objects.remove(id)
    return id
  }
  
  /**
   * Check if an object is registered
   * @param id The receiver ID
   * @return True if the object is registered, false otherwise
   */
  fun isRegistered(id: String): Boolean {
    return objects.containsKey(id)
  }
  
  /**
   * Check if an object is registered
   * @param obj The object
   * @return True if the object is registered, false otherwise
   */
  fun isRegistered(obj: Any): Boolean {
    return objectIds.containsKey(obj)
  }
  
  /**
   * Clear all registered objects
   * This should be called when the application is being destroyed
   * to prevent memory leaks
   */
  fun clear() {
    // Make a copy of the keys to avoid ConcurrentModificationException
    val keys = objects.keys().toList()
    for (id in keys) {
      try {
        val obj = objects[id]
        if (obj is AutoCloseable) {
          try {
            obj.close()
          } catch (e: Exception) {
            e.printStackTrace()
          }
        }
        objects.remove(id)
        if (obj != null) {
          objectIds.remove(obj)
        }
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }
    
    // Final cleanup in case any objects remain
    objects.clear()
    objectIds.clear()
  }
  
  /**
   * Get the number of registered objects
   * Useful for debugging memory leaks
   */
  fun size(): Int {
    return objects.size
  }
  
  /**
   * Dump the registry contents for debugging
   */
  fun dumpRegistry(): String {
    val sb = StringBuilder()
    sb.append("ObjectRegistry contents:\n")
    objects.forEach { (id, obj) ->
      sb.append("  $id: ${obj.javaClass.simpleName}\n")
    }
    return sb.toString()
  }
}

/**
 * Base class for objects that can be registered in the ObjectRegistry
 */
abstract class Registrable {
  /**
   * The receiver ID for this object
   */
  val receiverId: String by lazy {
    ObjectRegistry.register(this)
  }
  
  /**
   * Unregister this object
   */
  fun unregister() {
    ObjectRegistry.unregister(this)
  }
  
  /**
   * Finalizer method to ensure cleanup if object is not properly released
   * This is a last resort and should not be relied upon for normal cleanup
   */
  protected fun finalize() {
    try {
      if (ObjectRegistry.isRegistered(this)) {
        println("WARNING: Object was not properly released before garbage collection: ${this.javaClass.simpleName}")
        try {
          unregister()
        } catch (e: Exception) {
          // Ignore exceptions in finalizer
        }
      }
    } catch (e: Throwable) {
      // Never throw exceptions from finalizers
    }
  }
}