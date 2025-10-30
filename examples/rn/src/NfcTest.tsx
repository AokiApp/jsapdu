/**
 * NFC Test Screen
 *
 * This screen demonstrates NFC functionality using the jsapdu library.
 * It allows low-level NFC operations and displays relevant information.
 * Button status is controlled by events. You need to watch events
 * For usage of jsapdu library, see the codebase
 * It only has control buttons or Hex input field.
 * For hex input field, it must not be os-native keyboard input, but a original hex input keyboard. You should need to implement it by yourself (with new file, not a same file)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type {
  PlatformEventType,
  PlatformEventPayload,
} from "@aokiapp/jsapdu-rn";
import type { SmartCardDevice, SmartCard } from "@aokiapp/jsapdu-interface";
import { CommandApdu } from "@aokiapp/jsapdu-interface";
import HexTextInput from "./components/HexTextInput";

/**
 * Utilities
 */
function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function sanitizeHex(src: string): string {
  return src.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
}

// splitHexPairs removed — preview UI deleted

function buildBytesFromHex(hex: string): Uint8Array<ArrayBuffer> {
  const clean = sanitizeHex(hex);
  if (clean.length % 2 !== 0) {
    throw new Error("Hex length must be even");
  }
  const ab = new ArrayBuffer(clean.length / 2);
  const out: Uint8Array<ArrayBuffer> = new Uint8Array(ab);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Minimal event-driven state derived only from platform events.
 * We do not flip enable flags directly in command handlers; we rely on events.
 */
type UiState = {
  platformInitialized: boolean;
  deviceAcquired: boolean;
  cardPresent: boolean;
  sessionActive: boolean;
};

export default function NfcTestScreen() {
  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const deviceRef = useRef<SmartCardDevice | null>(null);
  const cardRef = useRef<SmartCard | null>(null);

  const [ui, setUi] = useState<UiState>({
    platformInitialized: false,
    deviceAcquired: false,
    cardPresent: false,
    sessionActive: false,
  });

  const [apduHex, setApduHex] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  // kbVisible removed; HexTextInput manages visibility internally
  const [logs, setLogs] = useState<string[]>([]);
  const [waitingCard, setWaitingCard] = useState<boolean>(false);

  const appendLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const line = `${timestamp} ${msg}`;
    setLogs((prev) => [line, ...prev].slice(0, 200));
    setStatus(msg);
    console.log(line);
  }, []);

  const setUiByEvent = useCallback(
    (evt: PlatformEventType, details?: string) => {
      setUi((prev) => {
        switch (evt) {
          case "PLATFORM_INITIALIZED":
            return {
              platformInitialized: true,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "PLATFORM_RELEASED":
            return {
              platformInitialized: false,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "DEVICE_ACQUIRED":
            return { ...prev, deviceAcquired: true };
          case "DEVICE_RELEASED":
            return {
              platformInitialized: prev.platformInitialized,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "CARD_FOUND":
            return { ...prev, cardPresent: true };
          case "CARD_LOST":
            return { ...prev, cardPresent: false, sessionActive: false };
          case "CARD_SESSION_STARTED":
            return { ...prev, sessionActive: true };
          case "CARD_SESSION_RESET":
            return { ...prev, sessionActive: false };
          case "WAIT_TIMEOUT":
            // timeout doesn't flip flags; only log it
            return prev;
          default:
            return prev;
        }
      });
      const msg = details ? `${evt}: ${details}` : evt;
      appendLog(msg);
    },
    [appendLog],
  );

  const attachEventHandlers = useCallback(() => {
    const platform = platformRef.current;
    if (!platform) {
      console.log("[NFC] attachEventHandlers: no platformRef.current");
      return [];
    }
    console.log(
      "[NFC] attachEventHandlers: platformRef.current is set, subscribing...",
    );
    const unsubs: Array<() => void> = [];

    const onEvt =
      (evt: PlatformEventType) => (payload: PlatformEventPayload) => {
        const details = payload?.details;
        setUiByEvent(evt, details);
        const dh = payload?.deviceHandle ? `dev=${payload.deviceHandle}` : "";
        const ch = payload?.cardHandle ? `card=${payload.cardHandle}` : "";
        appendLog(
          `${evt}${details ? `: ${details}` : ""}${dh || ch ? ` (${[dh, ch].filter(Boolean).join(", ")})` : ""}`,
        );
      };

    const events: PlatformEventType[] = [
      "PLATFORM_INITIALIZED",
      "PLATFORM_RELEASED",
      "DEVICE_ACQUIRED",
      "DEVICE_RELEASED",
      "CARD_FOUND",
      "CARD_LOST",
      "CARD_SESSION_STARTED",
      "CARD_SESSION_RESET",
      "WAIT_TIMEOUT",
      "POWER_STATE_CHANGED",
      "NFC_STATE_CHANGED",
      "APDU_SENT",
      "APDU_FAILED",
      "READER_MODE_ENABLED" as PlatformEventType,
      "READER_MODE_DISABLED" as PlatformEventType,
      "DEBUG_INFO" as PlatformEventType,
    ];
    events.forEach((evt) => {
      appendLog(`subscribe: ${evt}`);
      unsubs.push(platform.on(evt, onEvt(evt)));
    });
    console.log("[NFC] attachEventHandlers: subscriptions complete", {
      count: unsubs.length,
    });
    appendLog(`attachEventHandlers: ${unsubs.length} subscriptions`);
    return unsubs;
  }, [setUiByEvent, appendLog]);

  useEffect(() => {
    return () => {
      const platform = platformRef.current;
      if (platform && platform.isInitialized()) {
        platform.release().catch(() => {});
      }
      platformRef.current = null;
      deviceRef.current = null;
      cardRef.current = null;
      const unsubs = unsubsRef.current;
      unsubs.forEach((u) => u());
      unsubsRef.current = [];
    };
  }, []);

  // keyboard visibility effect removed; managed by HexTextInput

  const canInit = !ui.platformInitialized;
  const canReleasePlatform = ui.platformInitialized;
  const canAcquireDevice = ui.platformInitialized && !ui.deviceAcquired;
  const canReleaseDevice = ui.deviceAcquired;
  const canWaitCard = ui.deviceAcquired;
  const canStartSession =
    ui.deviceAcquired && ui.cardPresent && !ui.sessionActive;
  const canCardOps = ui.sessionActive;

  const handleInit = useCallback(async () => {
    if (platformRef.current) {
      console.log(
        "[NFC] init: platformRef.current already set, skipping new init",
      );
      appendLog("init: platform already created, skipping");
      return;
    }
    console.log("[NFC] init: creating platform");
    const platform = new RnSmartCardPlatform();
    platformRef.current = platform;
    const unsubs = attachEventHandlers();
    try {
      console.log("[NFC] init: calling platform.init()");
      await platform.init();
      const isInit =
        typeof platform.isInitialized === "function"
          ? platform.isInitialized()
          : undefined;
      console.log(
        "[NFC] init: platform.init() resolved, isInitialized=",
        isInit,
      );
      appendLog("initPlatform(): requested");
      if (isInit === true) {
        // manual fallback in case event emission is delayed or missing
        setUiByEvent("PLATFORM_INITIALIZED", "post-init fallback");
      }
    } catch (e: unknown) {
      console.log("[NFC] init: error", e);
      const msg = `initPlatform() error: ${stringifyError(e)}`;
      appendLog(msg);
    }
    unsubsRef.current = unsubs;
  }, [attachEventHandlers, setUiByEvent, appendLog]);

  const handleReleasePlatform = useCallback(async () => {
    const platform = platformRef.current;
    if (!platform) return;
    try {
      await platform.release();
      appendLog("releasePlatform(): requested");
      setUiByEvent("PLATFORM_RELEASED", "post-release fallback");
    } catch (e: unknown) {
      appendLog(`releasePlatform() error: ${stringifyError(e)}`);
    } finally {
      const unsubs = unsubsRef.current;
      unsubs.forEach((u) => u());
      unsubsRef.current = [];
      deviceRef.current = null;
      cardRef.current = null;
      platformRef.current = null;
    }
  }, []);

  const handleGetDeviceInfo = useCallback(async () => {
    const platform = platformRef.current;
    if (!platform) return;
    try {
      const infos = await platform.getDeviceInfo();
      appendLog(`getDeviceInfo(): ${infos.length} device(s)`);
    } catch (e: unknown) {
      appendLog(`getDeviceInfo() error: ${stringifyError(e)}`);
    }
  }, []);

  const handleAcquireDevice = useCallback(async () => {
    const platform = platformRef.current;
    if (!platform) return;
    try {
      const infos = await platform.getDeviceInfo();
      if (infos.length === 0) {
        appendLog("No NFC device available");
        return;
      }
      const first = infos[0]!;
      const dev = await platform.acquireDevice(first.id);
      deviceRef.current = dev;
      appendLog(`acquireDevice(): ${first.id}`);
      // Fallback in case native doesn't emit DEVICE_ACQUIRED
      setUiByEvent("DEVICE_ACQUIRED", `fallback: ${first.id}`);
    } catch (e: unknown) {
      appendLog(`acquireDevice() error: ${stringifyError(e)}`);
    }
  }, []);

  const handleReleaseDevice = useCallback(async () => {
    const dev = deviceRef.current;
    if (!dev) return;
    try {
      await dev.release();
      appendLog("releaseDevice(): requested");
      // Fallback in case native doesn't emit DEVICE_RELEASED
      setUiByEvent("DEVICE_RELEASED", "post-release fallback");
    } catch (e: unknown) {
      appendLog(`releaseDevice() error: ${stringifyError(e)}`);
    } finally {
      deviceRef.current = null;
      cardRef.current = null;
    }
  }, []);

  const handleWaitCard = useCallback(async () => {
    const dev = deviceRef.current;
    if (!dev) return;
    setWaitingCard(true);
    try {
      await dev.waitForCardPresence(15);
      appendLog("waitForCardPresence(15): resolved");
      // Fallback in case native doesn't emit CARD_FOUND
      setUiByEvent("CARD_FOUND", "post-wait fallback");
    } catch (e: unknown) {
      const msg = stringifyError(e);
      appendLog(`waitForCardPresence() error: ${msg}`);
      setUiByEvent("WAIT_TIMEOUT", msg);
    } finally {
      setWaitingCard(false);
    }
  }, []);

  const handleStartSession = useCallback(async () => {
    const dev = deviceRef.current;
    if (!dev) return;
    try {
      const card = await dev.startSession();
      cardRef.current = card;
      appendLog("startSession(): requested");
      // Fallback in case native doesn't emit CARD_SESSION_STARTED
      setUiByEvent("CARD_SESSION_STARTED", "post-start fallback");
    } catch (e: unknown) {
      appendLog(`startSession() error: ${stringifyError(e)}`);
    }
  }, []);

  const handleGetAtr = useCallback(async () => {
    const card = cardRef.current;
    if (!card) return;
    try {
      const atr = await card.getAtr();
      const hex = Array.from(atr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      appendLog(`ATR: ${hex}`);
    } catch (e: unknown) {
      appendLog(`getAtr() error: ${stringifyError(e)}`);
    }
  }, []);

  const handleTransmit = useCallback(async () => {
    const card = cardRef.current;
    if (!card) return;
    try {
      const bytes = buildBytesFromHex(apduHex);
      const cmd = CommandApdu.fromUint8Array(bytes);
      appendLog(`APDU_SENT: ${cmd.toHexString()}`);
      setUiByEvent("APDU_SENT", `len=${bytes.length}`);
      const resp = await card.transmit(cmd);
      const respHex = Array.from(resp.toUint8Array())
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      appendLog(
        `APDU Resp: ${respHex} (SW=${resp.sw1.toString(16).toUpperCase()}/${resp.sw2.toString(16).toUpperCase()})`,
      );
    } catch (e: unknown) {
      const err = stringifyError(e);
      appendLog(`APDU_FAILED: ${err}`);
      setUiByEvent("APDU_FAILED", err);
    }
  }, [apduHex]);

  const handleReset = useCallback(async () => {
    const card = cardRef.current;
    if (!card) return;
    try {
      await card.reset();
      appendLog("reset(): requested");
      // Fallback in case native doesn't emit CARD_SESSION_RESET
      setUiByEvent("CARD_SESSION_RESET", "post-reset fallback");
    } catch (e: unknown) {
      appendLog(`reset() error: ${stringifyError(e)}`);
    }
  }, []);

  const handleReleaseCard = useCallback(async () => {
    const card = cardRef.current;
    if (!card) return;
    try {
      await card.release();
      appendLog("releaseCard(): requested");
      // Fallback state update for UI controls
      setUiByEvent("CARD_SESSION_RESET", "post-release fallback");
    } catch (e: unknown) {
      appendLog(`releaseCard() error: ${stringifyError(e)}`);
    } finally {
      cardRef.current = null;
    }
  }, []);

  // onKeyboardPress removed; nibble editing handled by HexTextInput sheet.

  // preview removed
  const apduReady = useMemo(() => {
    const clean = sanitizeHex(apduHex);
    return clean.length > 0 && clean.length % 2 === 0;
  }, [apduHex]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>NFC Test</Text>

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
            label="Get Device Info"
            onPress={() => {
              void handleGetDeviceInfo();
            }}
            disabled={!canReleasePlatform}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device</Text>
        <View style={styles.row}>
          <Button
            label="Acquire"
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
          <Text style={styles.statusText}>{status}</Text>
          <View style={styles.flags}>
            <Flag label="Platform" active={ui.platformInitialized} />
            <Flag label="Device" active={ui.deviceAcquired} />
            <Flag label="Card" active={ui.cardPresent} />
            <Flag label="Session" active={ui.sessionActive} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Log</Text>
        <View style={styles.statusBox}>
          <View style={styles.row}>
            <Button
              label="Clear Log"
              onPress={() => {
                setLogs([]);
              }}
            />
          </View>
          {logs.length === 0 ? (
            <Text style={styles.statusText}>No events</Text>
          ) : (
            logs.slice(0, 50).map((line, i) => (
              <Text key={i} style={styles.statusText}>
                {line}
              </Text>
            ))
          )}
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
