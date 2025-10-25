import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Alert,
} from "react-native";

import {
  SmartCardDevice,
  SmartCard,
  SmartCardError,
  CommandApdu,
  SmartCardDeviceInfo,
  SmartCardPlatform,
} from "@aokiapp/jsapdu-interface";

import { platformManager } from "@aokiapp/jsapdu-rn";
console.log("platformManager:", platformManager);

type PlatformEventPayload = {
  deviceHandle?: string;
  cardHandle?: string;
  details?: string;
};

interface PlatformEventEmitter {
  on?(evt: string, handler: (payload: PlatformEventPayload) => void): void;
  off?(evt: string, handler: (payload: PlatformEventPayload) => void): void;
}

interface TestState {
  initialized: boolean;
  devices: SmartCardDeviceInfo[];
  currentDevice: SmartCardDevice | null;
  currentCard: SmartCard | null;
  logs: string[];
  aidInput: string;
  rawApduInput: string;
}
let platform: SmartCardPlatform;

 // Event subscription management for native status updates
const eventUnsubscribers: Array<() => void> = [];

function attachPlatformEvents(logger: (message: string) => void): void {
  if (!platform) return;
  const p = platform as unknown as PlatformEventEmitter;

  const add = (evt: string) => {
    const handler = (payload: PlatformEventPayload) => {
      const dev = payload?.deviceHandle ?? "";
      const card = payload?.cardHandle ?? "";
      const det = payload?.details ?? "";
      logger(`📡 Event ${evt}: device=${dev} card=${card} details=${det}`);
    };
    p.on?.(evt, handler);
    eventUnsubscribers.push(() => p.off?.(evt, handler));
  };

  // Core lifecycle events
  add("DEVICE_ACQUIRED");
  add("DEVICE_RELEASED");
  add("CARD_FOUND");
  add("CARD_LOST");
  // Card session lifecycle
  add("CARD_SESSION_STARTED");
  add("CARD_SESSION_RESET");
  // Timing/power/NFC
  add("WAIT_TIMEOUT");
  add("POWER_STATE_CHANGED");
  add("NFC_STATE_CHANGED");
  // APDU diagnostics
  add("APDU_SENT");
  add("APDU_FAILED");
}

const NfcTestScreen: React.FC = () => {
  const [state, setState] = useState<TestState>({
    initialized: false,
    devices: [],
    currentDevice: null,
    currentCard: null,
    logs: [],
    aidInput: "",
    rawApduInput: "",
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${timestamp}] ${message}`],
    }));
    console.log(`[NFC Test] ${message}`);
  };

  const handleError = (error: unknown, operation: string) => {
    const errorMessage =
      error instanceof SmartCardError
        ? `${error.code}: ${error.message}`
        : `Unknown error: ${String(error)}`;

    addLog(`❌ ${operation} failed: ${errorMessage}`);
    Alert.alert("Error", `${operation} failed:\n${errorMessage}`);
  };

  const hexToBytes = (hex: string): Uint8Array => {
    const clean = hex.replace(/[^0-9a-fA-F]/g, "");
    if (clean.length % 2 !== 0) {
      throw new Error("Hex must have even length");
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return bytes;
  };

  const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .toUpperCase();

  // Test 1: Platform Initialization
  const testInitialization = async () => {
    try {
      addLog("🚀 Initializing NFC platform...");
      platform = platformManager.getPlatform() as unknown as SmartCardPlatform;
      await platform.init();
      setState((prev) => ({ ...prev, initialized: true }));
      addLog("✅ Platform initialized successfully");
      attachPlatformEvents(addLog);
    } catch (error) {
      handleError(error, "Platform initialization");
    }
  };

  // Test 2: Device Detection
  const testDeviceDetection = async () => {
    if (!state.initialized) {
      Alert.alert("Error", "Platform not initialized");
      return;
    }

    try {
      addLog("🔍 Getting device information...");
      const devices = await platform.getDeviceInfo();
      setState((prev) => ({ ...prev, devices }));

      if (devices.length === 0) {
        addLog("⚠️ No NFC devices found (this is expected on non-NFC devices)");
      } else {
        addLog(`✅ Found ${devices.length} NFC device(s):`);
        devices.forEach((device, index) => {
          addLog(
            `  Device ${index + 1}: ${device.id} (${device.friendlyName || "Unknown"})`,
          );
          addLog(`    - Supports APDU: ${device.supportsApdu}`);
          addLog(`    - API: ${device.apduApi.join(", ")}`);
          addLog(`    - Integrated: ${device.isIntegratedDevice}`);
        });
      }
    } catch (error) {
      handleError(error, "Device detection");
    }
  };

  // Test 3: Device Acquisition
  const testDeviceAcquisition = async () => {
    if (state.devices.length === 0) {
      Alert.alert("Error", "No devices available to acquire");
      return;
    }

    try {
      const deviceId = state.devices[0]!.id;
      addLog(`📡 Acquiring device: ${deviceId}...`);

      const device = await platform.acquireDevice(deviceId);
      setState((prev) => ({ ...prev, currentDevice: device }));
      addLog("✅ Device acquired successfully (RF enabled)");

      // Test device availability
      const isAvailable = await device.isDeviceAvailable();
      addLog(`📊 Device available: ${isAvailable}`);
    } catch (error) {
      handleError(error, "Device acquisition");
    }
  };

  // Test 4: Card Presence Check
  const testCardPresence = async () => {
    if (!state.currentDevice) {
      Alert.alert("Error", "No device acquired");
      return;
    }

    try {
      addLog("🔍 Checking card presence...");
      const isPresent = await state.currentDevice.isCardPresent();
      addLog(`📋 Card present: ${isPresent}`);
    } catch (error) {
      handleError(error, "Card presence check");
    }
  };

  // Test 5: Wait for Card (with timeout)
  const testWaitForCard = async () => {
    if (!state.currentDevice) {
      Alert.alert("Error", "No device acquired");
      return;
    }

    try {
      addLog("⏳ Waiting for card (10 seconds timeout)...");
      addLog("💡 Please place an NFC card on the device");

      await state.currentDevice.waitForCardPresence(10000);
      addLog("✅ Card detected!");
    } catch (error) {
      if (error instanceof SmartCardError && error.code === "TIMEOUT") {
        addLog("⏰ Card wait timed out");
      } else {
        handleError(error, "Card wait");
      }
    }
  };

  // Test 6: Start Session and Get ATR
  const testSessionAndAtr = async () => {
    if (!state.currentDevice) {
      Alert.alert("Error", "No device acquired");
      return;
    }

    try {
      addLog("🔗 Starting card session...");
      const card = await state.currentDevice.startSession();
      setState((prev) => ({ ...prev, currentCard: card }));
      addLog("✅ Session started successfully");

      addLog("📜 Getting ATR...");
      const atr = await card.getAtr();
      const atrHex = Array.from(atr)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      addLog(`✅ ATR: ${atrHex}`);
    } catch (error) {
      handleError(error, "Session start / ATR retrieval");
    }
  };

  // Test 7: APDU Transmission
  const testApduTransmission = async () => {
    if (!state.currentCard) {
      Alert.alert("Error", "No active card session");
      return;
    }

    try {
      addLog("📤 Sending test APDU (SELECT command with no data)...");
      const selectCmd = new CommandApdu(0x00, 0xa4, 0x04, 0x00, null, 256);
      addLog(`📝 Command: ${selectCmd.toHexString()}`);

      const response = await state.currentCard.transmit(selectCmd);
      addLog(`📥 Response: ${response.arrayBuffer().byteLength}`);
      addLog(
        `📊 Status: SW=${response.sw.toString(16).padStart(4, "0").toUpperCase()} `,
      );
    } catch (error) {
      handleError(error, "APDU transmission");
    }
  };

  // Send SELECT by AID (from input)
  const sendSelectByAid = async () => {
    if (!state.currentCard) {
      Alert.alert("Error", "No active card session");
      return;
    }
    try {
      if (!state.aidInput.trim()) {
        Alert.alert("Input Required", "Enter AID hex to send SELECT by AID.");
        return;
      }
      const aid = hexToBytes(state.aidInput.trim());
      addLog(`📤 Sending SELECT by AID (${bytesToHex(aid)})...`);
      const cmd = new CommandApdu(0x00, 0xa4, 0x04, 0x0c, aid as unknown as Uint8Array<ArrayBuffer>);
      addLog(`📝 Command: ${cmd.toHexString()}`);
      const res = await state.currentCard.transmit(cmd);
      addLog(`📥 Response: ${bytesToHex(res.data)}`);
      addLog(
        `📊 Status: SW=${res.sw.toString(16).padStart(4, "0").toUpperCase()}`,
      );
    } catch (error) {
      handleError(error, "SELECT by AID");
    }
  };

  // Send raw APDU (from input)
  const sendRawApdu = async () => {
    if (!state.currentCard) {
      Alert.alert("Error", "No active card session");
      return;
    }
    try {
      if (!state.rawApduInput.trim()) {
        Alert.alert("Input Required", "Enter raw APDU hex (e.g. 00A40400...)");
        return;
      }
      const apduBytes = hexToBytes(state.rawApduInput.trim());
      if (apduBytes.length < 4) {
        Alert.alert(
          "Invalid APDU",
          "APDU must be at least 4 bytes (CLA INS P1 P2).",
        );
        return;
      }
      const cla = apduBytes[0]!;
      const ins = apduBytes[1]!;
      const p1 = apduBytes[2]!;
      const p2 = apduBytes[3]!;

      let data: Uint8Array | null = null;
      let le: number = 256;

      if (apduBytes.length === 5) {
        const leByte = apduBytes[4]!;
        le = leByte === 0 ? 256 : leByte;
      } else if (apduBytes.length >= 5) {
        const lc = apduBytes[4]!;
        if (apduBytes.length < 5 + lc) {
          throw new Error("APDU length inconsistent with Lc");
        }
        data = lc > 0 ? apduBytes.slice(5, 5 + lc) : null;
        const remaining = apduBytes.length - (5 + lc);
        if (remaining === 1) {
          const leByte = apduBytes[5 + lc]!;
          le = leByte === 0 ? 256 : leByte;
        } else if (remaining > 1) {
          throw new Error(
            "Unsupported APDU format (only short-length supported)",
          );
        }
      }

      addLog(
        `📤 Sending raw APDU: CLA=${cla.toString(16).padStart(2, "0").toUpperCase()} INS=${ins
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()} P1=${p1.toString(16).padStart(2, "0").toUpperCase()} P2=${p2
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()} Lc=${data ? data.length : 0} Le=${le}`,
      );

      const typedData: Uint8Array<ArrayBuffer> | null = data ? (data as unknown as Uint8Array<ArrayBuffer>) : null;
      const cmd = new CommandApdu(cla, ins, p1, p2, typedData ?? null, le);
      addLog(`📝 Command: ${cmd.toHexString()}`);

      const res = await state.currentCard.transmit(cmd);
      addLog(`📥 Response: ${bytesToHex(res.data)}`);
      addLog(
        `📊 Status: SW=${res.sw.toString(16).padStart(4, "0").toUpperCase()}`,
      );
    } catch (error) {
      handleError(error, "Raw APDU transmission");
    }
  };

  // Cleanup functions
  const releaseCard = async () => {
    if (!state.currentCard) return;

    try {
      addLog("🔓 Releasing card...");
      await state.currentCard.release();
      setState((prev) => ({ ...prev, currentCard: null }));
      addLog("✅ Card released");
    } catch (error) {
      handleError(error, "Card release");
    }
  };

  const releaseDevice = async () => {
    if (!state.currentDevice) return;

    try {
      await releaseCard(); // Release card first

      addLog("📡 Releasing device...");
      await state.currentDevice.release();
      setState((prev) => ({ ...prev, currentDevice: null }));
      addLog("✅ Device released (RF disabled)");
    } catch (error) {
      handleError(error, "Device release");
    }
  };

  const releasePlatform = async () => {
    try {
      await releaseDevice(); // Release device first

      addLog("🛑 Releasing platform...");
      if (platform) {
        await platform.release();
      }
      // Detach platform event listeners
      try {
        for (const unsub of eventUnsubscribers) {
          unsub();
        }
      } catch (e) {
        console.warn('[NFC Test] detach listeners failed', e);
      }
      eventUnsubscribers.length = 0;
      setState((prev) => ({ ...prev, initialized: false, devices: [] }));
      addLog("✅ Platform released");
    } catch (error) {
      handleError(error, "Platform release");
    }
  };

  const clearLogs = () => {
    setState((prev) => ({ ...prev, logs: [] }));
  };

  useEffect(() => {
    return () => {
      // ensure platform and underlying resources are released
      releasePlatform().catch(() => {});
    };
  }, [releasePlatform]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>NFC APDU Library Test</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Management</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                state.initialized && styles.buttonDisabled,
              ]}
              onPress={testInitialization}
              disabled={state.initialized}
            >
              <Text style={styles.buttonText}>1. Initialize</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                !state.initialized && styles.buttonDisabled,
              ]}
              onPress={testDeviceDetection}
              disabled={!state.initialized}
            >
              <Text style={styles.buttonText}>2. Get Devices</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device Management</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                (state.devices.length === 0 || state.currentDevice) &&
                  styles.buttonDisabled,
              ]}
              onPress={testDeviceAcquisition}
              disabled={state.devices.length === 0 || !!state.currentDevice}
            >
              <Text style={styles.buttonText}>3. Acquire Device</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                !state.currentDevice && styles.buttonDisabled,
              ]}
              onPress={testCardPresence}
              disabled={!state.currentDevice}
            >
              <Text style={styles.buttonText}>4. Check Presence</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              !state.currentDevice && styles.buttonDisabled,
            ]}
            onPress={testWaitForCard}
            disabled={!state.currentDevice}
          >
            <Text style={styles.buttonText}>5. Wait for Card</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Communication</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentDevice || state.currentCard) &&
                  styles.buttonDisabled,
              ]}
              onPress={testSessionAndAtr}
              disabled={!state.currentDevice || !!state.currentCard}
            >
              <Text style={styles.buttonText}>6. Session & ATR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                !state.currentCard && styles.buttonDisabled,
              ]}
              onPress={testApduTransmission}
              disabled={!state.currentCard}
            >
              <Text style={styles.buttonText}>7. Send APDU</Text>
            </TouchableOpacity>
          </View>

          <View>
            <TextInput
              style={styles.input}
              placeholder="AID hex (e.g. A000000003000000)"
              autoCapitalize="none"
              autoCorrect={false}
              value={state.aidInput}
              onChangeText={(text) =>
                setState((prev) => ({ ...prev, aidInput: text }))
              }
            />
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentCard || !state.aidInput.trim()) &&
                  styles.buttonDisabled,
              ]}
              onPress={sendSelectByAid}
              disabled={!state.currentCard || !state.aidInput.trim()}
            >
              <Text style={styles.buttonText}>Send SELECT by AID</Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="Raw APDU hex (e.g. 00A40400...)"
              autoCapitalize="none"
              autoCorrect={false}
              value={state.rawApduInput}
              onChangeText={(text) =>
                setState((prev) => ({ ...prev, rawApduInput: text }))
              }
            />
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentCard || state.rawApduInput.trim().length < 8) &&
                  styles.buttonDisabled,
              ]}
              onPress={sendRawApdu}
              disabled={
                !state.currentCard || state.rawApduInput.trim().length < 8
              }
            >
              <Text style={styles.buttonText}>Send Raw APDU</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cleanup</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.releaseButton,
                !state.currentCard && styles.buttonDisabled,
              ]}
              onPress={releaseCard}
              disabled={!state.currentCard}
            >
              <Text style={[styles.buttonText, styles.releaseButtonText]}>
                Release Card
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.releaseButton,
                !state.currentDevice && styles.buttonDisabled,
              ]}
              onPress={releaseDevice}
              disabled={!state.currentDevice}
            >
              <Text style={[styles.buttonText, styles.releaseButtonText]}>
                Release Device
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              styles.releaseButton,
              !state.initialized && styles.buttonDisabled,
            ]}
            onPress={releasePlatform}
            disabled={!state.initialized}
          >
            <Text style={[styles.buttonText, styles.releaseButtonText]}>
              Release Platform
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Logs</Text>
            <TouchableOpacity style={styles.clearButton} onPress={clearLogs}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.logContainer} nestedScrollEnabled>
            {state.logs.map((log, index) => (
              <Text key={index} style={styles.logText}>
                {log}
              </Text>
            ))}
            {state.logs.length === 0 && (
              <Text style={styles.emptyLogText}>
                No logs yet. Start testing!
              </Text>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#333",
  },
  section: {
    backgroundColor: "white",
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  releaseButton: {
    backgroundColor: "#FF3B30",
  },
  releaseButtonText: {
    color: "white",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  logContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 4,
    padding: 8,
    maxHeight: 300,
  },
  logText: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 2,
    color: "#333",
  },
  emptyLogText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#666",
    textAlign: "center",
    paddingVertical: 20,
  },
});

export default NfcTestScreen;
