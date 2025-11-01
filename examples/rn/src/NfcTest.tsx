// @eslint-disable react-hooks/exhaustive-deps
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

export default function NfcTestScreen() {
  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const deviceRef = useRef<SmartCardDevice | null>(null);
  const cardRef = useRef<SmartCard | null>(null);

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
