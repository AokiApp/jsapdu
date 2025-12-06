import { PcscPlatformManager } from "../src/index.js";

async function testPcscPlatform() {
  console.log("Testing PC/SC Platform...");

  // Get the PC/SC platform manager
  const platformManager = PcscPlatformManager.getInstance();
  console.log("Platform manager created");

  // Get the PC/SC platform
  const platform = platformManager.getPlatform();
  console.log("Platform obtained");

  try {
    // Initialize the platform
    await platform.init();
    console.log("Platform initialized");

    try {
      // Get available readers
      const deviceInfos = await platform.getDeviceInfo();
      console.log(`Found ${deviceInfos.length} readers:`);

      deviceInfos.forEach((info, index) => {
        console.log(`Reader ${index + 1}: ${info.friendlyName}`);
        console.log(`  ID: ${info.id}`);
        console.log(`  D2C Protocol: ${info.d2cProtocol}`);
        console.log(`  P2D Protocol: ${info.p2dProtocol}`);
        console.log(`  Supports APDU: ${info.supportsApdu}`);
        console.log(`  Supports HCE: ${info.supportsHce}`);
      });

      if (deviceInfos.length > 0) {
        // Acquire the first reader
        console.log(`Acquiring device: ${deviceInfos[0].id}`);
        const device = await platform.acquireDevice(deviceInfos[0].id);
        console.log("Device acquired");

        try {
          // Check if a card is present
          const isCardPresent = await device.isCardPresent();
          console.log(`Card present: ${isCardPresent}`);

          if (isCardPresent) {
            // Start a session with the card
            console.log("Starting card session...");
            const card = await device.startSession();
            console.log("Card session started");

            try {
              // Get the ATR
              const atr = await card.getAtr();
              console.log(
                "ATR:",
                Array.from(atr)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join(""),
              );
            } finally {
              // Release the card
              await card.release();
              console.log("Card released");
            }
          }
        } finally {
          // Release the device
          await device.release();
          console.log("Device released");
        }
      }
    } finally {
      // Release the platform
      await platform.release();
      console.log("Platform released");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testPcscPlatform().catch(console.error);
