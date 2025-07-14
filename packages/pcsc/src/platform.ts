import {
  SmartCardDevice,
  SmartCardDeviceInfo,
  SmartCardError,
  SmartCardPlatform,
} from "@aokiapp/interface";
import {
  PcscErrorCode,
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCardConnect,
  SCardDisconnect,
  SCardEstablishContext,
  SCardReleaseContext,
} from "@aokiapp/pcsc-ffi-node";

import { PcscDeviceInfo } from "./device-info.js";
import { PcscDevice } from "./device.js";
import {
  AsyncMutex,
  callSCardListReaders,
  ensureScardSuccess,
} from "./utils.js";

/**
 * Implementation of SmartCardPlatform for PC/SC
 */
export class PcscPlatform extends SmartCardPlatform {
  private context: number | null = null;
  private acquiredDevices: Map<string, PcscDevice> = new Map();
  private mutex = new AsyncMutex();

  /**
   * Creates a new PcscPlatform instance
   */
  constructor() {
    super();
  }

  /**
   * Initialize the platform
   * @throws {SmartCardError} If initialization fails or platform is already initialized
   */
  public async init(): Promise<void> {
    this.assertNotInitialized();

    try {
      // Establish PC/SC context
      const hContext = [0];
      const ret = SCardEstablishContext(
        SCARD_SCOPE_SYSTEM,
        null,
        null,
        hContext,
      );
      ensureScardSuccess(ret);

      this.context = hContext[0];
      this.initialized = true;
    } catch (error) {
      throw new SmartCardError(
        "PLATFORM_ERROR",
        "Failed to initialize PC/SC platform",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Release the platform and all acquired devices
   * @throws {SmartCardError} If release fails or platform is not initialized
   */
  public async release(): Promise<void> {
    await this.mutex.lock(async () => {
      this.assertInitialized();
      let deviceReleaseError: Error | undefined = undefined;
      try {
        // Release all acquired devices
        const releasePromises = Array.from(this.acquiredDevices.values()).map(
          (device) =>
            device.release().catch((e) => {
              deviceReleaseError = e;
            }),
        );
        await Promise.all(releasePromises);
        this.acquiredDevices.clear();
      } finally {
        // Release PC/SC context regardless of device release result
        try {
          if (this.context !== null) {
            const ret = SCardReleaseContext(this.context);
            ensureScardSuccess(ret);
            this.context = null;
          }
        } finally {
          this.initialized = false;
        }
      }
      if (deviceReleaseError) {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "Failed to release one or more devices during platform release",
          deviceReleaseError,
        );
      }
    });
  }

  /**
   * Get device information for all available readers
   * @throws {SmartCardError} If platform is not initialized or operation fails
   */
  public async getDeviceInfo(): Promise<SmartCardDeviceInfo[]> {
    this.assertInitialized();

    if (this.context === null) {
      throw new SmartCardError(
        "NOT_INITIALIZED",
        "PC/SC context is not initialized",
      );
    }

    try {
      // Get reader names using helper function
      const readers = await callSCardListReaders(this.context);

      // Create device info objects
      return readers.map((readerName) => new PcscDeviceInfo(readerName));
    } catch (error) {
      throw new SmartCardError(
        "PLATFORM_ERROR",
        "Failed to get device information",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Acquire a device by its ID
   * @param id - Device ID to acquire
   * @throws {SmartCardError} If platform is not initialized or device acquisition fails
   */
  public async acquireDevice(id: string): Promise<SmartCardDevice> {
    return this.mutex.lock(async () => {
      this.assertInitialized();

      if (this.context === null) {
        throw new SmartCardError(
          "NOT_INITIALIZED",
          "PC/SC context is not initialized",
        );
      }

      // Already acquired?
      if (this.acquiredDevices.has(id)) {
        throw new SmartCardError(
          "ALREADY_CONNECTED",
          "Device is already acquired",
        );
      }

      // Ensure the requested reader exists
      const readers = await callSCardListReaders(this.context);
      if (!readers.includes(id)) {
        throw new SmartCardError(
          "READER_ERROR",
          "Device with the given ID does not exist",
        );
      }

      // Try to open the reader to verify availability and, if possible, obtain a handle
      const hCard = [0];
      const activeProtocol = [0];
      const _ret = SCardConnect(
        this.context,
        id,
        SCARD_SHARE_SHARED,
        SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
        hCard,
        activeProtocol,
      );
      const ret = _ret < 0 ? _ret + 0x100000000 : _ret;

      let cardHandle: number | null = null;
      let protocol: number = 0;

      if (ret === PcscErrorCode.SCARD_S_SUCCESS) {
        // Reader and card accessible; disconnect immediately, we will open later in startSession
        SCardDisconnect(hCard[0], SCARD_LEAVE_CARD);
        cardHandle = null;
        protocol = 0;
      } else if (
        ret === PcscErrorCode.SCARD_E_NO_SMARTCARD ||
        ret === PcscErrorCode.SCARD_W_REMOVED_CARD
      ) {
        // Reader OK but no card
        cardHandle = null;
      } else if (ret === PcscErrorCode.SCARD_E_SHARING_VIOLATION) {
        throw new SmartCardError(
          "ALREADY_CONNECTED",
          "Device is currently in use",
        );
      } else {
        throw new SmartCardError(
          "PLATFORM_ERROR",
          "Failed to acquire device",
          new Error(`PC/SC return code: 0x${ret.toString(16)}`),
        );
      }

      const device = new PcscDevice(
        this,
        id,
        this.context,
        cardHandle,
        protocol,
        () => {
          this.acquiredDevices.delete(id);
        },
      );

      this.acquiredDevices.set(id, device);
      return device;
    });
  }
}
