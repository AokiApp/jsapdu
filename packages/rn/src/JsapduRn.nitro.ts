import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Device-to-Card protocol types
 */
export type D2CProtocol = 'iso7816' | 'nfc' | 'other' | 'unknown';

/**
 * Platform-to-Device protocol types
 */
export type P2DProtocol = 'usb' | 'ble' | 'nfc' | 'other' | 'unknown';

/**
 * Device information structure for NFC devices
 */
export interface DeviceInfo {
  id: string;
  devicePath?: string;
  friendlyName?: string;
  description?: string;
  supportsApdu: boolean;
  supportsHce: boolean;
  isIntegratedDevice: boolean;
  isRemovableDevice: boolean;
  d2cProtocol: D2CProtocol;
  p2dProtocol: P2DProtocol;
  apduApi: string[];
}

/**
 * Event payload structure for status updates
 */
export interface EventPayload {
  deviceHandle?: string;
  cardHandle?: string;
  details?: string;
}

/**
 * React Native Nitro Module interface for Android NFC APDU communication
 *
 * This interface provides FFI-neutral methods for SmartCard operations
 * following the platform-device-card hierarchy defined in the abstracts.
 */
export interface JsapduRn
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // ============================================================================
  // Platform Management Methods
  // ============================================================================

  /**
   * Initialize the NFC platform
   * Precondition: Platform not initialized
   * Postcondition: Platform initialized, ReaderMode preparation complete
   * @throws SmartCardError with code "ALREADY_INITIALIZED" | "PLATFORM_ERROR"
   */
  initPlatform(): Promise<void>;

  /**
   * Release the NFC platform and all acquired devices
   * Precondition: Platform initialized
   * Postcondition: All devices released, platform uninitialized
   * @throws SmartCardError with code "NOT_INITIALIZED" | "PLATFORM_ERROR"
   */
  releasePlatform(): Promise<void>;

  /**
   * Get available NFC device information
   * Precondition: Platform initialized
   * @returns Array of device info (0 or 1 for integrated NFC, 0 for non-NFC devices)
   * @throws SmartCardError with code "NOT_INITIALIZED" | "PLATFORM_ERROR"
   */
  getDeviceInfo(): Promise<DeviceInfo[]>;

  /**
   * Acquire a device by its ID and activate RF
   * Precondition: Platform initialized, device ID exists in getDeviceInfo()
   * Postcondition: ReaderMode enabled, device acquired
   * @param deviceId Device identifier from getDeviceInfo()
   * @returns Device handle for subsequent operations
   * @throws SmartCardError with code "NOT_INITIALIZED" | "ALREADY_CONNECTED" | "READER_ERROR" | "PLATFORM_ERROR"
   */
  acquireDevice(deviceId: string): Promise<string>;

  // ============================================================================
  // Device Management Methods
  // ============================================================================

  /**
   * Check if device is available (non-blocking)
   * @param deviceHandle Device handle from acquireDevice()
   * @returns true if device is available, false otherwise
   * @throws SmartCardError with code "PLATFORM_ERROR"
   */
  isDeviceAvailable(deviceHandle: string): Promise<boolean>;

  /**
   * Check if card is present (non-blocking, lightweight)
   * @param deviceHandle Device handle from acquireDevice()
   * @returns true if card is present, false otherwise
   * @throws SmartCardError with code "PLATFORM_ERROR"
   */
  isCardPresent(deviceHandle: string): Promise<boolean>;

  /**
   * Wait for card presence (blocking, event-driven)
   * Precondition: Device acquired, ReaderMode enabled
   * Postcondition: ISO-DEP tag detected or timeout
   * @param deviceHandle Device handle from acquireDevice()
   * @param timeout Optional timeout in milliseconds (default: 30000ms)
   * @throws SmartCardError with code "CARD_NOT_PRESENT" | "TIMEOUT" | "PLATFORM_ERROR"
   */
  waitForCardPresence(deviceHandle: string, timeout: number): Promise<void>;

  /**
   * Start communication session with detected card
   * Precondition: Card present
   * Postcondition: ISO-DEP session established
   * @param deviceHandle Device handle from acquireDevice()
   * @returns Card handle for APDU operations
   * @throws SmartCardError with code "CARD_NOT_PRESENT" | "PLATFORM_ERROR"
   */
  startSession(deviceHandle: string): Promise<string>;

  /**
   * Release device and deactivate RF
   * Postcondition: Device released, ReaderMode stopped
   * @param deviceHandle Device handle from acquireDevice()
   * @throws SmartCardError with code "PLATFORM_ERROR"
   */
  releaseDevice(deviceHandle: string): Promise<void>;

  // ============================================================================
  // Card Communication Methods
  // ============================================================================

  /**
   * Get ATR (Answer To Reset) or ATS (Answer To Select)
   * Preference order: Historical Bytes -> HiLayerResponse(ATS) -> PROTOCOL_ERROR
   * @param deviceHandle Device handle from acquireDevice()
   * @param cardHandle Card handle from startSession()
   * @returns ATR/ATS bytes
   * @throws SmartCardError with code "PROTOCOL_ERROR" | "PLATFORM_ERROR"
   */
  getAtr(deviceHandle: string, cardHandle: string): Promise<ArrayBuffer>;

  /**
   * Transmit APDU command to card
   * Precondition: Active session
   * @param deviceHandle Device handle from acquireDevice()
   * @param cardHandle Card handle from startSession()
   * @param apdu APDU command bytes
   * @returns Response with data and status words (SW1, SW2)
   * @throws SmartCardError with code "INVALID_PARAMETER" | "PLATFORM_ERROR" | "PROTOCOL_ERROR"
   */
  transmit(deviceHandle: string, cardHandle: string, apdu: ArrayBuffer): Promise<ArrayBuffer>;

  /**
   * Reset card (re-establish ISO-DEP session)
   * @param deviceHandle Device handle from acquireDevice()
   * @param cardHandle Card handle from startSession()
   * @throws SmartCardError with code "CARD_NOT_PRESENT" | "PLATFORM_ERROR"
   */
  reset(deviceHandle: string, cardHandle: string): Promise<void>;

  /**
   * Release card session
   * Postcondition: Card session inactive
   * @param deviceHandle Device handle from acquireDevice()
   * @param cardHandle Card handle from startSession()
   * @throws SmartCardError with code "PLATFORM_ERROR"
   */
  releaseCard(deviceHandle: string, cardHandle: string): Promise<void>;

  /**
   * Event callback for status updates (e.g., card removed)
   * @param callback Possible values: "DEVICE_ACQUIRED", "DEVICE_RELEASED", "CARD_FOUND", "CARD_LOST"
   * @param payload Event payload with deviceHandle, cardHandle, and details
   */
  onStatusUpdate(
    callback: undefined | ((eventType: string, payload: EventPayload) => void)
  ): void;
}
