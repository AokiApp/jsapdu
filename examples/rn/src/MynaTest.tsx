import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import {
  SmartCardPlatform,
  SmartCardDevice,
  SmartCard,
  SmartCardDeviceInfo,
  SmartCardError,
  ResponseApdu,
} from "@aokiapp/jsapdu-interface";
import { platformManager } from "@aokiapp/jsapdu-rn";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";
import { SchemaParser, BasicTLVParser } from "@aokiapp/tlv/parser";

let platform: SmartCardPlatform;

interface MynaState {
  initialized: boolean;
  devices: SmartCardDeviceInfo[];
  currentDevice: SmartCardDevice | null;
  currentCard: SmartCard | null;
  logs: string[];
  pin: string;
  basicFour: string | null;
  myNumber: string | null;
}

const MynaTest: React.FC = () => {
  const [state, setState] = useState<MynaState>({
    initialized: false,
    devices: [],
    currentDevice: null,
    currentCard: null,
    logs: [],
    pin: "",
    basicFour: null,
    myNumber: null,
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, `[${timestamp}] ${message}`],
    }));
    console.log(`[MynaTest] ${message}`);
  };

  const handleError = (error: unknown, operation: string) => {
    const errorMessage =
      error instanceof SmartCardError
        ? `${error.code}: ${error.message}`
        : `Unknown error: ${String(error)}`;
    addLog(`❌ ${operation} failed: ${errorMessage}`);
    Alert.alert("Error", `${operation} failed:\n${errorMessage}`);
  };

  const bytesToHex = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .toUpperCase();

  const bytesToAscii = (bytes: Uint8Array): string =>
    Array.from(bytes)
      .map((b) => String.fromCharCode(b))
      .join("");

  const initPlatform = async () => {
    try {
      addLog("🚀 Initializing platform...");
      platform = platformManager.getPlatform() as unknown as SmartCardPlatform;
      await platform.init();
      setState((prev) => ({ ...prev, initialized: true }));
      addLog("✅ Platform initialized");
    } catch (error) {
      handleError(error, "Platform initialization");
    }
  };

  const getDevices = async () => {
    if (!state.initialized) {
      Alert.alert("Error", "Platform not initialized");
      return;
    }
    try {
      addLog("🔍 Getting devices...");
      const devices = await platform.getDeviceInfo();
      setState((prev) => ({ ...prev, devices }));
      if (devices.length === 0) {
        addLog("⚠️ No devices found");
      } else {
        addLog(`✅ Found ${devices.length} device(s)`);
        devices.forEach((d, i) =>
          addLog(
            `  Device ${i + 1}: ${d.id} (${d.friendlyName || "Unknown"}) APDU=${d.supportsApdu}`,
          ),
        );
      }
    } catch (error) {
      handleError(error, "Get devices");
    }
  };

  const acquireDevice = async () => {
    if (state.devices.length === 0) {
      Alert.alert("Error", "No devices available");
      return;
    }
    try {
      const deviceId = state.devices[0]!.id;
      addLog(`📡 Acquiring device: ${deviceId}...`);
      const device = await platform.acquireDevice(deviceId);
      setState((prev) => ({ ...prev, currentDevice: device }));
      addLog("✅ Device acquired (RF enabled)");
    } catch (error) {
      handleError(error, "Acquire device");
    }
  };

  const waitForCard = async () => {
    if (!state.currentDevice) {
      Alert.alert("Error", "No device acquired");
      return;
    }
    try {
      addLog("⏳ Waiting for card (10s)...");
      addLog("💡 Place your MynaCard on the reader");
      await state.currentDevice.waitForCardPresence(10000);
      addLog("✅ Card detected");
    } catch (error) {
      if (error instanceof SmartCardError && error.code === "TIMEOUT") {
        addLog("⏰ Card wait timed out");
      } else {
        handleError(error, "Wait for card");
      }
    }
  };

  const startSession = async () => {
    if (!state.currentDevice) {
      Alert.alert("Error", "No device acquired");
      return;
    }
    try {
      addLog("🔗 Starting card session...");
      const card = await state.currentDevice.startSession();
      setState((prev) => ({ ...prev, currentCard: card }));
      addLog("✅ Session started");
      const atr = await card.getAtr();
      addLog(`📜 ATR: ${bytesToHex(atr)}`);
    } catch (error) {
      handleError(error, "Start session");
    }
  };

  const selectKenhojo = async () => {
    if (!state.currentCard) {
      Alert.alert("Error", "No active card session");
      return false;
    }
    addLog("📁 Selecting DF: Kenhojo AP...");
    const res: ResponseApdu = await state.currentCard.transmit(
      selectDf(KENHOJO_AP),
    );
    const ok = res.sw === 0x9000;
    if (!ok) {
      const sw = res.sw;
      addLog(
        `❌ SELECT DF failed: SW=${sw.toString(16).padStart(4, "0").toUpperCase()}`,
      );
      throw new Error("Failed to select Kenhojo DF");
    }
    addLog("✅ Kenhojo DF selected");
    return true;
  };

  const verifyPin = async () => {
    if (!state.currentCard) {
      Alert.alert("Error", "No active card session");
      return false;
    }
    if (!state.pin.trim()) {
      Alert.alert("PIN Required", "Enter your PIN to proceed.");
      return false;
    }
    addLog("🔐 Verifying PIN...");
    const res: ResponseApdu = await state.currentCard.transmit(
      verify(state.pin.trim(), { ef: KENHOJO_AP_EF.PIN }),
    );
    const ok = res.sw === 0x9000;
    if (!ok) {
      const sw = res.sw;
      const retriesLeft = sw & 0x0f;
      addLog(
        `❌ PIN verification failed: SW=${sw.toString(16).padStart(4, "0").toUpperCase()} (${retriesLeft} retries left)`,
      );
      throw new Error("PIN verification failed");
    }
    addLog("✅ PIN verified");
    return true;
  };

  const readBasicFour = async () => {
    try {
      if (!(await selectKenhojo())) return;
      if (!(await verifyPin())) return;

      addLog("📖 Reading BASIC_FOUR...");
      const res: ResponseApdu = await state.currentCard!.transmit(
        readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
      );
      const ok = res.sw === 0x9000;
      if (!ok) {
        const sw = res.sw;
        addLog(
          `❌ Read BASIC_FOUR failed: SW=${sw.toString(16).padStart(4, "0").toUpperCase()}`,
        );
        return;
      }
      const buffer = res.arrayBuffer();
      const parser = new SchemaParser(schemaKenhojoBasicFour);
      const parsed = parser.parse(buffer);
      setState((prev) => ({
        ...prev,
        basicFour: JSON.stringify(parsed, null, 2),
      }));
      addLog("✅ BASIC_FOUR read and parsed");
    } catch (error) {
      handleError(error, "Read BASIC_FOUR");
    }
  };

  const readMyNumber = async () => {
    try {
      if (!(await selectKenhojo())) return;
      if (!(await verifyPin())) return;

      addLog("🧾 Reading MY_NUMBER...");
      const res: ResponseApdu = await state.currentCard!.transmit(
        readEfBinaryFull(KENHOJO_AP_EF.MY_NUMBER),
      );
      const ok = res.sw === 0x9000;
      if (!ok) {
        const sw = res.sw;
        addLog(
          `❌ Read MY_NUMBER failed: SW=${sw.toString(16).padStart(4, "0").toUpperCase()}`,
        );
        return;
      }
      const buffer = res.arrayBuffer();
      const tlv = BasicTLVParser.parse(buffer);
      const valueBytes = new Uint8Array(tlv.value);
      const valueText = bytesToAscii(valueBytes);
      setState((prev) => ({ ...prev, myNumber: valueText }));
      addLog(`✅ MY_NUMBER read: ${valueText}`);
    } catch (error) {
      handleError(error, "Read MY_NUMBER");
    }
  };

  const releaseCard = async () => {
    if (!state.currentCard) return;
    try {
      addLog("🔓 Releasing card...");
      await state.currentCard.release();
      setState((prev) => ({ ...prev, currentCard: null }));
      addLog("✅ Card released");
    } catch (error) {
      handleError(error, "Release card");
    }
  };

  const releaseDevice = async () => {
    if (!state.currentDevice) return;
    try {
      await releaseCard();
      addLog("📡 Releasing device...");
      await state.currentDevice.release();
      setState((prev) => ({ ...prev, currentDevice: null }));
      addLog("✅ Device released");
    } catch (error) {
      handleError(error, "Release device");
    }
  };

  const releasePlatform = async () => {
    try {
      await releaseDevice();
      addLog("🛑 Releasing platform...");
      if (platform) await platform.release();
      setState((prev) => ({
        ...prev,
        initialized: false,
        devices: [],
      }));
      addLog("✅ Platform released");
    } catch (error) {
      handleError(error, "Release platform");
    }
  };

  const clearLogs = () => {
    setState((prev) => ({ ...prev, logs: [] }));
  };

  useEffect(() => {
    return () => {
      releasePlatform().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>MynaCard Demo (Kenhojo AP)</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform & Device</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                state.initialized && styles.buttonDisabled,
              ]}
              onPress={initPlatform}
              disabled={state.initialized}
            >
              <Text style={styles.buttonText}>Initialize</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                !state.initialized && styles.buttonDisabled,
              ]}
              onPress={getDevices}
              disabled={!state.initialized}
            >
              <Text style={styles.buttonText}>Get Devices</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                (state.devices.length === 0 || state.currentDevice) &&
                  styles.buttonDisabled,
              ]}
              onPress={acquireDevice}
              disabled={state.devices.length === 0 || !!state.currentDevice}
            >
              <Text style={styles.buttonText}>Acquire Device</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                !state.currentDevice && styles.buttonDisabled,
              ]}
              onPress={waitForCard}
              disabled={!state.currentDevice}
            >
              <Text style={styles.buttonText}>Wait for Card</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              (!state.currentDevice || state.currentCard) &&
                styles.buttonDisabled,
            ]}
            onPress={startSession}
            disabled={!state.currentDevice || !!state.currentCard}
          >
            <Text style={styles.buttonText}>Start Session</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter PIN (e.g. 1234)"
            value={state.pin}
            onChangeText={(text) =>
              setState((prev) => ({ ...prev, pin: text }))
            }
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            secureTextEntry
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                !state.currentCard && styles.buttonDisabled,
              ]}
              onPress={selectKenhojo}
              disabled={!state.currentCard}
            >
              <Text style={styles.buttonText}>Select Kenhojo DF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentCard || !state.pin.trim()) &&
                  styles.buttonDisabled,
              ]}
              onPress={verifyPin}
              disabled={!state.currentCard || !state.pin.trim()}
            >
              <Text style={styles.buttonText}>Verify PIN</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MynaCard Operations</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentCard || !state.pin.trim()) &&
                  styles.buttonDisabled,
              ]}
              onPress={readBasicFour}
              disabled={!state.currentCard || !state.pin.trim()}
            >
              <Text style={styles.buttonText}>Read BASIC_FOUR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                (!state.currentCard || !state.pin.trim()) &&
                  styles.buttonDisabled,
              ]}
              onPress={readMyNumber}
              disabled={!state.currentCard || !state.pin.trim()}
            >
              <Text style={styles.buttonText}>Read MY_NUMBER</Text>
            </TouchableOpacity>
          </View>

          {state.basicFour && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionTitle}>Parsed BASIC_FOUR</Text>
              <View style={styles.logContainer}>
                <Text style={styles.logText}>{state.basicFour}</Text>
              </View>
            </View>
          )}

          {state.myNumber && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.sectionTitle}>My Number</Text>
              <View style={styles.logContainer}>
                <Text style={styles.logText}>{state.myNumber}</Text>
              </View>
            </View>
          )}
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
              <Text style={styles.emptyLogText}>No logs yet. Start demo!</Text>
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

export default MynaTest;
