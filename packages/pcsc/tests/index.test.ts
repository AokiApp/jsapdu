import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PcscPlatform,
  PcscPlatformManager,
  PcscDeviceInfo,
  PcscDevice,
  Pcsc
} from "../src/index.js";
import { MockPCSCLite, MockCardReader } from "./mocks.js";
import { CommandApdu } from "@aokiapp/interface";
import { SmartCardError, ValidationError, TimeoutError } from "@aokiapp/interface/errors";

// Mock pcsclite module
vi.mock("pcsclite", () => ({
  default: vi.fn(() => new MockPCSCLite()),
}));

describe("PCSC Implementation", () => {
  describe("PcscPlatformManager", () => {
    it("should create a new platform instance", () => {
      const manager = new PcscPlatformManager();
      const platform = manager.getPlatform();
      expect(platform).toBeInstanceOf(PcscPlatform);
    });
  });

  describe("PcscPlatform", () => {
    let pcsc: MockPCSCLite;
    let platform: PcscPlatform;

    beforeEach(() => {
      pcsc = new MockPCSCLite(1);
      platform = new PcscPlatform(pcsc);
    });

    afterEach(async () => {
      if (platform.isInitialized()) {
        await platform.release();
      }
    });

    describe("initialization", () => {
      it("should initialize successfully", async () => {
        await platform.init();
        expect(platform.isInitialized()).toBe(true);
      });

      it("should fail initialization with timeout", async () => {
        // Create PCSC with no readers to trigger timeout
        pcsc = new MockPCSCLite(0);
        platform = new PcscPlatform(pcsc);
        
        await expect(platform.init({ timeout: 100 })).rejects.toThrow(TimeoutError);
        expect(platform.isInitialized()).toBe(false);
      });

      it("should validate timeout parameter", async () => {
        await expect(platform.init({ timeout: -1 })).rejects.toThrow(ValidationError);
        await expect(platform.init({ timeout: 0 })).rejects.toThrow(ValidationError);
      });

      it("should not allow double initialization", async () => {
        await platform.init();
        await expect(platform.init()).rejects.toThrow("already initialized");
      });
    });

    describe("device management", () => {
      beforeEach(async () => {
        await platform.init();
      });

      it("should detect available devices", async () => {
        const devices = await platform.getDevices();
        expect(devices).toHaveLength(1);
        expect(devices[0]).toBeInstanceOf(PcscDeviceInfo);
      });

      it("should enforce reader limit", async () => {
        // Create platform with too many readers
        pcsc = new MockPCSCLite(11); // Default limit is 10
        platform = new PcscPlatform(pcsc);
        await platform.init();

        await expect(platform.getDevices()).rejects.toThrow("Maximum number of readers");
      });

      it("should handle reader removal", async () => {
        const devices = await platform.getDevices();
        const reader = (pcsc as any).readers[0] as MockCardReader;
        reader.mockDisconnect();

        // Should now report no active readers
        await expect(platform.getDevices()).rejects.toThrow("No active readers found");
      });
    });

    describe("security capabilities", () => {
      let deviceInfo: PcscDeviceInfo;

      beforeEach(async () => {
        await platform.init();
        const devices = await platform.getDevices();
        deviceInfo = devices[0];
      });

      it("should detect reader security capabilities", () => {
        const capabilities = deviceInfo.getSecurityCapabilities();
        expect(capabilities).toBeDefined();
        expect(capabilities?.hardwareEncryption).toBe(true);
        expect(capabilities?.tamperDetection).toBe(true);
        expect(capabilities?.secureProtocols).toContain("scp02");
        expect(capabilities?.secureProtocols).toContain("scp03");
      });
    });

    describe("error handling", () => {
      beforeEach(async () => {
        await platform.init();
      });

      it("should handle reader errors", async () => {
        const reader = (pcsc as any).readers[0] as MockCardReader;
        reader.mockReaderError();
        
        // Next operation should fail
        await expect(platform.getDevices()).rejects.toThrow(SmartCardError);
      });

      it("should handle card removal", async () => {
        const devices = await platform.getDevices();
        const device = await devices[0].acquireDevice();
        const reader = (pcsc as any).readers[0] as MockCardReader;

        // Mock card removal
        reader.mockCardRemoval();
        
        await expect(device.isCardPresent()).resolves.toBe(false);
      });

      it("should handle card insertion", async () => {
        const devices = await platform.getDevices();
        const device = await devices[0].acquireDevice();
        const reader = (pcsc as any).readers[0] as MockCardReader;

        // Remove and reinsert card
        reader.mockCardRemoval();
        await expect(device.isCardPresent()).resolves.toBe(false);
        
        reader.mockCardInsertion();
        await expect(device.isCardPresent()).resolves.toBe(true);
      });
    });
  });

  describe("PcscDevice", () => {
    let pcsc: MockPCSCLite;
    let platform: PcscPlatform;
    let device: PcscDevice;

    beforeEach(async () => {
      pcsc = new MockPCSCLite(1);
      platform = new PcscPlatform(pcsc);
      await platform.init();
      const devices = await platform.getDevices();
      device = await devices[0].acquireDevice();
    });

    afterEach(async () => {
      if (device.isActive()) {
        await device.release();
      }
      if (platform.isInitialized()) {
        await platform.release();
      }
    });

    it("should start card session", async () => {
      const card = await device.startSession();
      expect(card).toBeInstanceOf(Pcsc);
      await card.release();
    });

    it("should handle APDU transmission", async () => {
      const card = await device.startSession();
      const command = new CommandApdu(0x00, 0x84, 0x00, 0x00); // GET CHALLENGE
      const response = await card.transmit(command);
      expect(response.sw1).toBe(0x90); // Success
      expect(response.sw2).toBe(0x00);
      await card.release();
    });

    it("should validate APDU commands", async () => {
      const card = await device.startSession();
      await expect(card.transmit(null as any)).rejects.toThrow(ValidationError);
      await expect(card.transmit({} as any)).rejects.toThrow(ValidationError);
      await card.release();
    });

    it("should handle connection state", async () => {
      const card = await device.startSession();
      expect(card.getAtr()).resolves.toBeInstanceOf(Uint8Array);
      await card.release();
      await expect(card.getAtr()).rejects.toThrow("not connected");
    });
  });
});