// Utility for Uint8Array <-> number[] conversion
// （index.tsのユーティリティ関数はindex.tsに残すのでここには不要）

/**
 * JavaScript side object registry
 * Similar to the native ObjectRegistry but for JavaScript objects
 */
export class ObjectRegistry {
  // Map of receiver IDs to objects
  private static objects = new Map<string, any>();

  /**
   * Get an object by its receiver ID
   * @param id The receiver ID
   * @returns The object
   * @throws Error if the object is not found
   */
  static getObject<T>(id: string): T {
    const obj = this.objects.get(id);
    if (!obj) {
      throw new Error(`Object with ID ${id} not found`);
    }
    return obj as T;
  }

  /**
   * Register an object with a specific receiver ID
   * @param id The receiver ID
   * @param obj The object to register
   */
  static registerWithId(id: string, obj: any): void {
    this.objects.set(id, obj);
  }

  /**
   * Unregister an object by its receiver ID
   * @param id The receiver ID
   */
  static unregister(id: string): void {
    this.objects.delete(id);
  }

  /**
   * Check if an object with the given ID is registered
   * @param id The receiver ID
   * @returns True if the object is registered, false otherwise
   */
  static isRegistered(id: string): boolean {
    return this.objects.has(id);
  }

  /**
   * Clear all registered objects
   * This should be called when the application is being destroyed
   * to prevent memory leaks
   */
  static clear(): void {
    // Release any resources that need explicit cleanup
    for (const [id, obj] of this.objects.entries()) {
      if (obj && typeof obj.release === "function") {
        try {
          obj.release();
        } catch (e) {
          console.error(`Error releasing object ${id}:`, e);
        }
      }
    }
    this.objects.clear();
  }

  /**
   * Get the number of registered objects
   * Useful for debugging memory leaks
   */
  static size(): number {
    return this.objects.size;
  }

  /**
   * Dump the registry contents for debugging
   */
  static dumpRegistry(): string {
    let result = "ObjectRegistry contents:\n";
    this.objects.forEach((obj, id) => {
      result += `  ${id}: ${obj.constructor?.name || "Unknown"}\n`;
    });
    return result;
  }
}
