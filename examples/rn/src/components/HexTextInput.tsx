import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  StyleProp,
  TextStyle,
  ViewStyle,
  NativeSyntheticEvent,
  TextInputFocusEvent,
} from "react-native";

export type HexTextInputProps = {
  value: string;
  onChangeText: (t: string) => void;
  style?: StyleProp<TextStyle>;
  onFocus?: (e: NativeSyntheticEvent<TextInputFocusEvent>) => void;
  onBlur?: () => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

const sanitize = (s = "") => s.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

export default function HexTextInput(props: HexTextInputProps) {
  const {
    value,
    onChangeText,
    style,
    onFocus,
    onBlur,
    editable = true,
    placeholder,
    autoFocus,
    ...rest
  } = props;
  const [open, setOpen] = useState(false);
  const hex = useMemo(() => sanitize(value || ""), [value]);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);

  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEvent>) => {
      Keyboard.dismiss();
      // best-effort Android suppression: `showSoftInputOnFocus` exists on Android TextInput
      // @ts-expect-error - Android-only prop; safe to set here
      rest.showSoftInputOnFocus = false;
      show();
      onFocus?.(e);
    },
    [onFocus, rest, show],
  );

  const closeWithTrim = useCallback(() => {
    const clean = sanitize(hex);
    if (clean.length % 2 === 1) {
      Alert.alert("未完のバイト", "最後のニブルを破棄します。続行しますか？", [
        { text: "キャンセル", style: "cancel" },
        {
          text: "続行",
          style: "destructive",
          onPress: () => {
            onChangeText?.(clean.slice(0, -1));
            hide();
            onBlur?.();
          },
        },
      ]);
    } else {
      hide();
      onBlur?.();
    }
  }, [hex, onChangeText, onBlur, hide]);

  const pressNibble = useCallback(
    (n: string) => onChangeText?.(sanitize(hex + n)),
    [hex, onChangeText],
  );
  const backspace = useCallback(
    () => onChangeText?.(sanitize(hex).slice(0, -1)),
    [hex, onChangeText],
  );

  const keys = [
    "C",
    "7",
    "8",
    "9",
    "F",
    "B",
    "4",
    "5",
    "6",
    "E",
    "A",
    "1",
    "2",
    "3",
    "D",
    "<",
    ">",
    "0",
    "⌫",
    "⏎",
  ];

  return (
    <View>
      <TextInput
        {...rest}
        value={hex}
        onChangeText={(t) => onChangeText?.(sanitize(t))}
        editable={editable}
        placeholder={placeholder}
        style={style}
        autoFocus={autoFocus}
        onFocus={
          handleFocus as React.ComponentProps<typeof TextInput>["onFocus"]
        }
        showSoftInputOnFocus={false}
      />

      <Modal visible={open} transparent onRequestClose={closeWithTrim}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={closeWithTrim} />
          <View style={styles.sheet}>
            <View style={styles.grid}>
              {keys.map((k, i) => (
                <Key
                  key={k + i}
                  label={k}
                  onPress={() => {
                    if (k === "⌫") return backspace();
                    if (k === "⏎") return closeWithTrim();
                    if (k === "<" || k === ">") return;
                    pressNibble(k);
                  }}
                  variant={
                    /^[0-9]$/.test(k)
                      ? "digit"
                      : /^[A-F]$/.test(k)
                        ? "alphabet"
                        : /^[<>]$/.test(k)
                          ? "cursor"
                          : "control"
                  }
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Key({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant?: "digit" | "control" | "alphabet" | "cursor";
}) {
  const map: Record<string, ViewStyle> = {
    digit: styles.keyDigit,
    control: styles.keyControl,
    alphabet: styles.keyAlphabet,
    cursor: styles.keyCursor,
  };
  const txtMap: Record<string, TextStyle> = {
    digit: styles.keyTextDigit,
    control: styles.keyTextControl,
    alphabet: styles.keyTextAlphabet,
    cursor: styles.keyTextCursor,
  };
  const v = variant || "digit";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        map[v],
        pressed ? styles.keyPressedBase : null,
        pressed ? styles.keyPressedDigit : null,
      ]}
    >
      <Text style={[styles.keyText, txtMap[v]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  sheet: { backgroundColor: "#1a1c1fff", padding: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "space-between",
  },
  key: {
    width: "19%",
    height: 96, // 私は96サイズがちょうどいいと思っているから変えないで。
    borderRadius: 6,
    backgroundColor: "#3d4049ff",
    alignItems: "center",
    justifyContent: "center",
  },
  keyCursor: { backgroundColor: "#33303dff" },
  keyControl: { backgroundColor: "#7696f5ff" },
  keyAlphabet: { backgroundColor: "#52555fff" },
  keyDigit: { backgroundColor: "#3d4049ff" },
  keyText: { fontSize: 24, fontWeight: "300", color: "#c7caccff" },
  keyTextCursor: { color: "#c7caccff", fontWeight: "700" },
  keyTextControl: { color: "#2a2d30ff", fontWeight: "700" },
  keyTextAlphabet: { color: "#c7caccff" },
  keyTextDigit: { color: "#c7caccff" },
  keyPressedBase: { backgroundColor: "rgba(0,0,0,0.08)" },
  keyPressedDigit: { backgroundColor: "#33343b" },
});
