import {
  SmartCardPlatform,
  SmartCardPlatformManager,
} from "@aokiapp/interface";

import { PcscPlatform } from "./platform.js";

/**
 * Implementation of SmartCardPlatformManager for PC/SC
 */
export class PcscPlatformManager extends SmartCardPlatformManager {
  private static instance: PcscPlatformManager | null = null;
  private platform: PcscPlatform | null = null;

  /**
   * Creates a new PcscPlatformManager instance
   * This constructor is private to enforce the singleton pattern
   */
  private constructor() {
    super();
  }

  /**
   * Get the singleton instance of PcscPlatformManager
   */
  public static getInstance(): PcscPlatformManager {
    if (!PcscPlatformManager.instance) {
      PcscPlatformManager.instance = new PcscPlatformManager();
    }
    return PcscPlatformManager.instance;
  }

  /**
   * Get the PC/SC platform
   * This method creates a new PcscPlatform instance if one doesn't exist
   */
  public getPlatform(): SmartCardPlatform {
    if (!this.platform) {
      this.platform = new PcscPlatform();
    }
    return this.platform;
  }
}
