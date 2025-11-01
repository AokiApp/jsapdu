// @eslint-disable react-hooks/exhaustive-deps
/**
 * Smart Card Test Screen
 *
 * This screen demonstrates smart card functionality using the jsapdu library.
 * It supports multiple device types (NFC, OMAPI, etc.) and allows low-level
 * smart card operations. Button status is controlled by events.
 * For usage of jsapdu library, see the codebase.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type { SmartCardDevice, SmartCard, DeviceInfo } from "@aokiapp/jsapdu-interface";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import HexTextInput from "./components/HexTextInput";

export default function SmartCardTestScreen() {
  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const deviceRef = useRef<SmartCardDevice | null>(null);
  const cardRef = useRef<SmartCard | null>(null);

  // Event unsubscription holders
  const platUnsubsRef = useRef<(() => void)[]>([]);
  const devUnsubsRef = useRef<(() => void)[]>([]);
  const cardUnsubsRef = useRef<(() => void)[]>([]);

  const [ui, setUi] = useState({
    platformInitialized: false,
    deviceAcquired: false,
    cardPresent: false,
    sessionActive: false,
  });
  const [availableDevices, setAvailableDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [waitingCard, setWaitingCard] = useState(false);
  const [apduHex, setApduHex] = useState("");

  const cleanedHex = useMemo(
    () => apduHex.replace(/\s+/g, "").toUpperCase(),
    [apduHex]
  );
  const apduReady = useMemo(() => {
    return (
      cleanedHex.length >= 8 &&
      cleanedHex.length % 2 === 0 &&
      /^[0-9A-F]+$/.test(cleanedHex)
    );
  }, [cleanedHex]);

  const canInit = useMemo(() => !ui.platformInitialized, [ui.platformInitialized]);
  const canReleasePlatform = ui.platformInitialized;
  const canAcquireDevice = ui.platformInitialized && !ui.deviceAcquired && selectedDeviceId !== null;
  const canWaitCard = ui.deviceAcquired && !ui.cardPresent;
  const canReleaseDevice = ui.deviceAcquired;
  const canStartSession = ui.deviceAcquired && ui.cardPresent && !ui.sessionActive;
  const canCardOps = ui.sessionActive;

  function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/\s+/g, "");
    if (clean.length % 2 !== 0) {
      throw new Error("Hex length must be even");
    }
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      const byte = parseInt(clean.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) {
        throw new Error(`Invalid hex at ${i}:${clean.slice(i, i + 2)}`);
      }
      out[i / 2] = byte;
    }
    return out;
  }

  const clearPlatformListeners = useCallback(() => {
    platUnsubsRef.current.forEach((off) => {
      try {
        off();
      } catch (err) {
        console.error("[Plat] clearPlatformListeners unsubscribe failed", err);
      }
    });
    platUnsubsRef.current = [];
  }, []);

  const clearDeviceListeners = useCallback(() => {
    devUnsubsRef.current.forEach((off) => {
      try {
        off();
      } catch (err) {
        console.error("[Dev] clearDeviceListeners unsubscribe failed", err);
      }
    });
    devUnsubsRef.current = [];
  }, []);

  const clearCardListeners = useCallback(() => {
    cardUnsubsRef.current.forEach((off) => {
      try {
        off();
      } catch (err) {
        console.error("[Card] clearCardListeners unsubscribe failed", err);
      }
    });
    cardUnsubsRef.current = [];
  }, []);

  const refreshDeviceList = useCallback(async () => {
    const plat = platformRef.current;
    if (!plat) return;
    
    try {
      const infos = await plat.getDeviceInfo();
      setAvailableDevices(infos);
      console.log(`[Plat] Found ${infos.length} device(s)`);
      
      // Auto-select first device if available
      if (infos.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(infos[0].id);
      }
    } catch (error) {
      console.error("[Plat] refreshDeviceList() failed", error);
    }
  }, [selectedDeviceId]);

  const handleInit = useCallback(async () => {
    console.log("[UI] Initialize pressed");
    if (!platformRef.current) {
      platformRef.current = new RnSmartCardPlatform();
    }
    const plat = platformRef.current;

    clearPlatformListeners();

    platUnsubsRef.current.push(
      plat.on("PLATFORM_INITIALIZED", (payload) => {
        console.log("[Plat] PLATFORM_INITIALIZED", payload);
        setUi((prev) => ({ ...prev, platformInitialized: true }));
      })
    );
    platUnsubsRef.current.push(
      plat.on("PLATFORM_RELEASED", (payload) => {
        console.log("[Plat] PLATFORM_RELEASED", payload);
        setUi({
          platformInitialized: false,
          deviceAcquired: false,
          cardPresent: false,
          sessionActive: false,
        });
        setAvailableDevices([]);
        setSelectedDeviceId(null);
      })
    );
    platUnsubsRef.current.push(
      plat.on("DEVICE_ACQUIRED", (payload) => {
        console.log("[Plat] DEVICE_ACQUIRED", payload);
        setUi((prev) => ({ ...prev, deviceAcquired: true }));
      })
    );
    platUnsubsRef.current.push(
      plat.on("DEBUG_INFO", (payload) => {
        console.debug("[Plat] DEBUG_INFO", payload);
      })
    );

    try {
      await plat.init();
      console.log("[Plat] init() completed");
      // Auto-refresh device list after initialization
      await refreshDeviceList();
    } catch (error) {
      console.error("[Plat] init() failed", error);
    }
  }, [clearPlatformListeners, refreshDeviceList]);

  const handleReleasePlatform = useCallback(async () => {
    console.log("[UI] Release Platform pressed");
    const plat = platformRef.current;
    if (!plat) {
      console.warn("[Plat] Not initialized");
      return;
    }
    try {
      // Best-effort cleanup of card/device before platform release
      if (cardRef.current) {
        try {
          await cardRef.current.release();
        } catch (e) {
          console.error("[Card] release during platform release failed", e);
        }
        cardRef.current = null;
      }
      if (deviceRef.current) {
        try {
          await deviceRef.current.release();
        } catch (e) {
          console.error("[Dev] release during platform release failed", e);
        }
        deviceRef.current = null;
      }

      await plat.release();
      clearPlatformListeners();
      clearDeviceListeners();
      clearCardListeners();
      platformRef.current = null;
      setUi({
        platformInitialized: false,
        deviceAcquired: false,
        cardPresent: false,
        sessionActive: false,
      });
      setAvailableDevices([]);
      setSelectedDeviceId(null);
      console.log("[Plat] release() completed");
    } catch (error) {
      console.error("[Plat] release() failed", error);
    }
  }, [clearPlatformListeners, clearDeviceListeners, clearCardListeners]);

  const handleGetDeviceInfo = useCallback(async () => {
    console.log("[UI] Get Device Info pressed");
    await refreshDeviceList();
    
    // Log detailed device info
    availableDevices.forEach((info, idx) => {
      const apduApi = (info as unknown as { apduApi?: string[] }).apduApi;
      console.log(`[Plat] Device[${idx}]`, {
        id: info.id,
        supportsApdu: info.supportsApdu,
        supportsHce: info.supportsHce,
        integrated: info.isIntegratedDevice,
        removable: info.isRemovableDevice,
        d2c: info.d2cProtocol,
        p2d: info.p2dProtocol,
        apduApi,
        friendlyName: info.friendlyName,
        description: info.description,
      });
    });
  }, [refreshDeviceList, availableDevices]);

  const handleAcquireDevice = useCallback(async () => {
    console.log("[UI] Acquire Device pressed");
    const plat = platformRef.current;
    if (!plat) {
      console.warn("[Plat] Not initialized");
      return;
    }
    if (!selectedDeviceId) {
      console.warn("[Plat] No device selected");
      return;
    }
    try {
      const dev = await plat.acquireDevice(selectedDeviceId);
      deviceRef.current = dev;
      setUi((prev) => ({ ...prev, deviceAcquired: true }));
      console.log("[Dev] acquired", selectedDeviceId);

      clearDeviceListeners();
      devUnsubsRef.current.push(
        dev.on("CARD_FOUND", (payload) => {
          console.log("[Dev] CARD_FOUND", payload);
          setUi((prev) => ({ ...prev, cardPresent: true }));
        })
      );
      devUnsubsRef.current.push(
        dev.on("CARD_LOST", (payload) => {
          console.warn("[Dev] CARD_LOST", payload);
          setUi((prev) => ({ ...prev, cardPresent: false, sessionActive: false }));
          cardRef.current = null;
        })
      );
      devUnsubsRef.current.push(
        dev.on("CARD_SESSION_STARTED", (payload) => {
          console.log("[Dev] CARD_SESSION_STARTED", payload);
          setUi((prev) => ({ ...prev, sessionActive: true }));
        })
      );
      devUnsubsRef.current.push(
        dev.on("CARD_SESSION_RESET", (payload) => {
          console.warn("[Dev] CARD_SESSION_RESET", payload);
          setUi((prev) => ({ ...prev, sessionActive: false }));
        })
      );
      devUnsubsRef.current.push(
        dev.on("DEVICE_RELEASED", (payload) => {
          console.warn("[Dev] DEVICE_RELEASED", payload);
          setUi((prev) => ({
            ...prev,
            deviceAcquired: false,
            cardPresent: false,
            sessionActive: false,
          }));
          deviceRef.current = null;
          cardRef.current = null;
        })
      );
      devUnsubsRef.current.push(
        dev.on("WAIT_TIMEOUT", (payload) => {
          console.warn("[Dev] WAIT_TIMEOUT", payload);
          setWaitingCard(false);
        })
      );
      devUnsubsRef.current.push(
        dev.on("DEBUG_INFO", (payload) => {
          console.debug("[Dev] DEBUG_INFO", payload);
        })
      );
    } catch (error) {
      console.error("[Dev] acquireDevice() failed", error);
    }
  }, [clearDeviceListeners, selectedDeviceId]);

  const handleWaitCard = useCallback(async () => {
    console.log("[UI] Wait Card pressed");
    const dev = deviceRef.current;
    if (!dev) {
      console.warn("[Dev] Not acquired");
      return;
    }
    setWaitingCard(true);
    try {
      await dev.waitForCardPresence(15000);
      console.log("[Dev] waitForCardPresence resolved");
    } catch (error) {
      console.error("[Dev] waitForCardPresence failed", error);
    } finally {
      setWaitingCard(false);
    }
  }, []);

  const handleStartSession = useCallback(async () => {
    console.log("[UI] Start Session pressed");
    const dev = deviceRef.current;
    if (!dev) {
      console.warn("[Dev] Not acquired");
      return;
    }
    try {
      const card = await dev.startSession();
      cardRef.current = card;
      setUi((prev) => ({ ...prev, sessionActive: true }));
      console.log("[Card] session started");

      clearCardListeners();
      cardUnsubsRef.current.push(
        card.on("CARD_LOST", (payload) => {
          console.warn("[Card] CARD_LOST", payload);
          setUi((prev) => ({ ...prev, cardPresent: false, sessionActive: false }));
          cardRef.current = null;
        })
      );
      cardUnsubsRef.current.push(
        card.on("APDU_SENT", (payload) => {
          console.log("[Card] APDU_SENT", payload);
        })
      );
      cardUnsubsRef.current.push(
        card.on("APDU_FAILED", (payload) => {
          console.error("[Card] APDU_FAILED", payload);
        })
      );
    } catch (error) {
      console.error("[Card] startSession() failed", error);
    }
  }, [clearCardListeners]);

  const handleGetAtr = useCallback(async () => {
    console.log("[UI] Get ATR pressed");
    const card = cardRef.current;
    if (!card) {
      console.warn("[Card] No active session");
      return;
    }
    try {
      const atr = await card.getAtr();
      const atrHex = Array.from(atr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      console.log("[Card] ATR:", atrHex);
    } catch (error) {
      console.error("[Card] getAtr() failed", error);
    }
  }, []);

  const handleReset = useCallback(async () => {
    console.log("[UI] Reset pressed");
    const card = cardRef.current;
    if (!card) {
      console.warn("[Card] No active session");
      return;
    }
   try {
     await card.reset();
     console.log("[Card] reset() completed");
   } catch (error) {
     console.error("[Card] reset() failed", error);
   }
  }, []);

  const handleReleaseCard = useCallback(async () => {
    console.log("[UI] Release Card pressed");
    const card = cardRef.current;
    if (!card) {
      console.warn("[Card] No active session");
      return;
    }
    try {
      await card.release();
      setUi((prev) => ({ ...prev, sessionActive: false }));
      cardRef.current = null;
      console.log("[Card] release() completed");
    } catch (error) {
      console.error("[Card] release() failed", error);
    }
  }, []);

  const handleReleaseDevice = useCallback(async () => {
    console.log("[UI] Release Device pressed");
    const dev = deviceRef.current;
    if (!dev) {
      console.warn("[Dev] Not acquired");
      return;
    }
    try {
      await dev.release();
      setUi((prev) => ({
        ...prev,
        deviceAcquired: false,
        cardPresent: false,
        sessionActive: false,
      }));
      deviceRef.current = null;
      cardRef.current = null;
      console.log("[Dev] release() completed");
    } catch (error) {
      console.error("[Dev] release() failed", error);
    }
  }, []);

  const handleTransmit = useCallback(async () => {
    console.log("[UI] Transmit pressed");
    const card = cardRef.current;
    if (!card) {
      console.warn("[Card] No active session");
      return;
    }
    if (!apduReady) {
      console.warn("[APDU] Hex invalid or incomplete");
      return;
    }
    try {
      const bytes = hexToBytes(cleanedHex);
      const cmd = CommandApdu.fromUint8Array(
        bytes as unknown as Uint8Array<ArrayBuffer>
      );
      console.log("[APDU] TX:", cmd.toHexString());
      const resp = await card.transmit(cmd);
      const respBytes = resp.toUint8Array();
      const respHex = Array.from(respBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      const sw1 = resp.sw1.toString(16).padStart(2, "0").toUpperCase();
      const sw2 = resp.sw2.toString(16).padStart(2, "0").toUpperCase();
      const sw = resp.sw.toString(16).toUpperCase();
      console.log(`[APDU] RX: ${respHex}  SW=${sw1} ${sw2} (0x${sw})`);
    } catch (error) {
      console.error("[APDU] transmit() failed", error);
    }
  }, [apduReady, cleanedHex]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Smart Card Test</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform</Text>
        <View style={styles.row}>
          <Button
            label="Initialize"
            onPress={() => {
              void handleInit();
            }}
            disabled={!canInit}
          />
          <Button
            label="Release"
            onPress={() => {
              void handleReleasePlatform();
            }}
            disabled={!canReleasePlatform}
          />
          <Button
            label="Refresh Devices"
            onPress={() => {
              void handleGetDeviceInfo();
            }}
            disabled={!canReleasePlatform}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Selection</Text>
        {availableDevices.length === 0 ? (
          <Text style={styles.infoText}>
            {ui.platformInitialized ? "No devices available" : "Initialize platform first"}
          </Text>
        ) : (
          <View style={styles.deviceList}>
            {availableDevices.map((device) => (
              <Pressable
                key={device.id}
                style={[
                  styles.deviceItem,
                  selectedDeviceId === device.id && styles.deviceItemSelected,
                ]}
                onPress={() => setSelectedDeviceId(device.id)}
                disabled={ui.deviceAcquired}
              >
                <Text style={styles.deviceName}>{device.friendlyName}</Text>
                <Text style={styles.deviceDesc}>{device.description}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.row}>
          <Button
            label="Acquire Selected"
            onPress={() => {
              void handleAcquireDevice();
            }}
            disabled={!canAcquireDevice}
          />
          <Button
            label="Wait Card"
            onPress={() => {
              void handleWaitCard();
            }}
            disabled={!canWaitCard || waitingCard}
          />
          <Button
            label="Release Device"
            onPress={() => {
              void handleReleaseDevice();
            }}
            disabled={!canReleaseDevice}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.row}>
          <Button
            label="Start Session"
            onPress={() => {
              void handleStartSession();
            }}
            disabled={!canStartSession}
          />
          <Button
            label="Get ATR"
            onPress={() => {
              void handleGetAtr();
            }}
            disabled={!canCardOps}
          />
          <Button
            label="Reset"
            onPress={() => {
              void handleReset();
            }}
            disabled={!canCardOps}
          />
          <Button
            label="Release Card"
            onPress={() => {
              void handleReleaseCard();
            }}
            disabled={!canCardOps}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>APDU</Text>
        <HexTextInput
          value={apduHex}
          onChangeText={setApduHex}
          placeholder="Command (HEX)"
        />
        {/* preview removed */}
        <View style={styles.row}>
          <Button
            label="Transmit"
            onPress={() => {
              void handleTransmit();
            }}
            disabled={!canCardOps || !apduReady}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusBox}>
          <View style={styles.flags}>
            <Flag label="Platform" active={ui.platformInitialized} />
            <Flag label="Device" active={ui.deviceAcquired} />
            <Flag label="Card" active={ui.cardPresent} />
            <Flag label="Session" active={ui.sessionActive} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.flag, active ? styles.flagOn : styles.flagOff]}>
      <Text style={styles.flagText}>
        {label}: {active ? "ON" : "OFF"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#4a90e2",
  },
  btnDisabled: { backgroundColor: "#9bbfe9" },
  btnText: { color: "#fff", fontWeight: "700" },
  infoText: { fontSize: 14, color: "#666", fontStyle: "italic" },
  deviceList: { gap: 8 },
  deviceItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  deviceItemSelected: {
    borderColor: "#4a90e2",
    borderWidth: 2,
    backgroundColor: "#e3f2fd",
  },
  deviceName: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  deviceDesc: { fontSize: 12, color: "#666" },
  statusBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  statusText: { fontFamily: "monospace" },
  flags: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  flagOn: {
    backgroundColor: "#e1f5e9",
    borderWidth: 1,
    borderColor: "#62c788",
  },
  flagOff: {
    backgroundColor: "#fdeaea",
    borderWidth: 1,
    borderColor: "#d9534f",
  },
  flagText: { fontSize: 12, fontWeight: "600" },
});