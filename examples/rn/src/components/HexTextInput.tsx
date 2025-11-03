import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
  Easing,
  Animated,
} from "react-native";
import type {
  StyleProp,
  TextStyle,
  ViewStyle,
  NativeSyntheticEvent,
  TextInputFocusEvent,
} from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";

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

const hidePos = 360;
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
  } = props;

  const [open, setOpen] = useState(false);
  const hex = useMemo(() => sanitize(value || ""), [value]);
  const [cursor, setCursor] = useState<number>(hex.length);
  const [rowH, setRowH] = useState<number>(0);
  const [textH, setTextH] = useState<number>(0);
  const [prefixW, setPrefixW] = useState<number>(0);
  const [backdropReady, setBackdropReady] = useState(false);

  // Animated values for sheet slide and caret blink
  const sheetTranslateY = useRef(new Animated.Value(24)).current;
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const didAutoFocusRef = useRef(false);
  const easeInQuad = (t: number) => t * t;
  const easeOutQuad = (t: number) => t * (2 - t);

  const show = useCallback(() => {
    if (!editable) return;
    // Reset position before opening
    sheetTranslateY.setValue(hidePos);
    setBackdropReady(false);
    Keyboard.dismiss();
    setCursor(sanitize(value || "").length);
    setOpen(true);
    // kick entrance slide after mount
    requestAnimationFrame(() => {
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        // eslint-disable-next-line @typescript-eslint/unbound-method
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBackdropReady(true);
      });
    });
    onFocus?.({} as NativeSyntheticEvent<TextInputFocusEvent>);
  }, [editable, onFocus, value, sheetTranslateY]);

  const hide = useCallback(() => {
    // animate out then close
    Animated.timing(sheetTranslateY, {
      toValue: hidePos,
      duration: 200,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
    });
  }, [sheetTranslateY]);

  useEffect(() => {
    if (!didAutoFocusRef.current && autoFocus && editable) {
      didAutoFocusRef.current = true;
      show();
    }
  }, [autoFocus, editable, show]);

  useEffect(() => {
    setCursor((c) => Math.min(c, hex.length));
  }, [hex]);

  useEffect(() => {
    let stopped = false;
    if (open) {
      // caret blink only; sheet slide handled in show()
      caretOpacity.setValue(1);
      const loop = () => {
        if (stopped) return;
        Animated.sequence([
          Animated.timing(caretOpacity, {
            toValue: 0.35,
            duration: 120,
            easing: easeOutQuad,
            useNativeDriver: true,
          }),
          Animated.delay(380),
          Animated.timing(caretOpacity, {
            toValue: 1,
            duration: 120,
            easing: easeInQuad,
            useNativeDriver: true,
          }),
          Animated.delay(380),
        ]).start(({ finished }) => {
          if (finished && !stopped) loop();
        });
      };
      loop();
    } else {
      caretOpacity.setValue(1);
    }
    return () => {
      stopped = true;
    };
  }, [open]);

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
    (n: string) => {
      const clean = sanitize(hex);
      const next = sanitize(clean.slice(0, cursor) + n + clean.slice(cursor));
      onChangeText?.(next);
      setCursor((c) => Math.min(c + 1, next.length));
    },
    [hex, cursor, onChangeText],
  );

  const backspace = useCallback(() => {
    const clean = sanitize(hex);
    if (cursor === 0 || clean.length === 0) return;
    const next = sanitize(clean.slice(0, cursor - 1) + clean.slice(cursor));
    onChangeText?.(next);
    setCursor((c) => Math.max(0, c - 1));
  }, [hex, cursor, onChangeText]);

  const moveLeft = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);
  const moveRight = useCallback(() => {
    const len = sanitize(hex).length;
    setCursor((c) => Math.min(len, c + 1));
  }, [hex]);

  // Copy entire HEX on long press of 'C'
  const copyAllHex = useCallback(() => {
    const clean = sanitize(hex);
    // Copy even if empty to reflect current state; provide subtle haptic feedback
    Clipboard.setString(clean);
    Vibration.vibrate(8);
  }, [hex]);

  // Paste HEX from clipboard on long press of '7'
  const pasteHexFromClipboard = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      const stripped = (txt || "").replace(/\s+/g, "").trim();
      if (!stripped || !/^[0-9a-fA-F]+$/.test(stripped)) {
        // Gently reject: non-blocking haptic only
        Vibration.vibrate(15);
        return;
      }
      const next = stripped.toUpperCase();
      onChangeText?.(next);
      setCursor(next.length);
    } catch {
      Vibration.vibrate(15);
    }
  }, [onChangeText]);

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

  const caretLeft = useMemo(() => {
    return prefixW;
  }, [prefixW]);

  const caretHeight = useMemo(() => {
    return Math.max(12, Math.round(textH || 20));
  }, [textH]);

  const caretTop = useMemo(() => {
    return Math.max(0, Math.round((rowH - caretHeight) / 2));
  }, [rowH, caretHeight]);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={show}
        disabled={!editable}
        style={[styles.display, !editable && styles.displayDisabled]}
      >
        {hex.length === 0 ? (
          <View
            style={styles.row}
            onLayout={(e) => setRowH(e.nativeEvent.layout.height)}
          >
            <Text
              style={[styles.placeholderText, style]}
              numberOfLines={1}
              onLayout={(e) => setTextH(e.nativeEvent.layout.height)}
            >
              {placeholder || ""}
            </Text>
            {open ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.caretVert,
                  {
                    left: caretLeft,
                    top: caretTop,
                    height: caretHeight,
                    opacity: caretOpacity,
                  },
                ]}
              />
            ) : null}
          </View>
        ) : (
          <View
            style={styles.row}
            onLayout={(e) => setRowH(e.nativeEvent.layout.height)}
          >
            <Text
              style={[styles.displayText, style]}
              numberOfLines={1}
              onLayout={(e) => setTextH(e.nativeEvent.layout.height)}
            >
              {hex}
            </Text>

            <View style={styles.measureBox} pointerEvents="none">
              <Text
                style={[styles.displayText, style]}
                numberOfLines={1}
                onLayout={(e) => setPrefixW(e.nativeEvent.layout.width)}
              >
                {hex.slice(0, cursor)}
              </Text>
            </View>

            {open ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.caretVert,
                  {
                    left: caretLeft,
                    top: caretTop,
                    height: caretHeight,
                    opacity: caretOpacity,
                  },
                ]}
              />
            ) : null}
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent onRequestClose={closeWithTrim}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={closeWithTrim}
            disabled={!backdropReady}
          />
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View style={styles.grid}>
              {keys.map((k, i) => (
                <Key
                  key={k + i}
                  label={k}
                  onPress={() => {
                    if (k === "⌫") return backspace();
                    if (k === "⏎") return closeWithTrim();
                    if (k === "<") return moveLeft();
                    if (k === ">") return moveRight();
                    pressNibble(k);
                  }}
                  repeatable={k === "⌫" || k === "<" || k === ">"}
                  variant={
                    /^[0-9]$/.test(k)
                      ? "digit"
                      : /^[A-F]$/.test(k)
                        ? "alphabet"
                        : /^[<>]$/.test(k)
                          ? "cursor"
                          : "control"
                  }
                  // Indicate copy/paste capability and wire long-press actions
                  suppressPressIn={k === "C" || k === "7"}
                  onLongPressAction={
                    k === "C"
                      ? copyAllHex
                      : k === "7"
                        ? pasteHexFromClipboard
                        : undefined
                  }
                  cornerIcon={
                    k === "C" ? "copy" : k === "7" ? "paste" : undefined
                  }
                />
              ))}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function Key({
  label,
  onPress,
  variant,
  repeatable,
  haptic = true,
  onLongPressAction,
  suppressPressIn = false,
  cornerIcon,
}: {
  label: string;
  onPress: () => void;
  variant?: "digit" | "control" | "alphabet" | "cursor";
  repeatable?: boolean;
  haptic?: boolean;
  onLongPressAction?: () => void;
  suppressPressIn?: boolean;
  cornerIcon?: "copy" | "paste";
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
  const pressedMap: Record<string, ViewStyle> = {
    digit: styles.keyPressedDigit,
    control: styles.keyPressedControl,
    alphabet: styles.keyPressedAlphabet,
    cursor: styles.keyPressedCursor,
  };
  const v = variant || "digit";

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTriggeredRef = useRef(false);
  // keep a ref to the latest onPress so the repeating interval always calls current handler
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const vibrate = useCallback(() => {
    if (haptic) {
      Vibration.vibrate(8);
    }
  }, [haptic]);

  const handlePressIn = useCallback(() => {
    vibrate();
    if (!suppressPressIn) {
      onPress();
    }
  }, [vibrate, onPress, suppressPressIn]);

  const handleLongPress = useCallback(() => {
    if (onLongPressAction) {
      longPressTriggeredRef.current = true;
      onLongPressAction();
      return;
    }
    if (!repeatable || intervalRef.current) return;
    // call once immediately, then start interval which uses latest handler via ref
    onPressRef.current();
    intervalRef.current = setInterval(() => {
      onPressRef.current();
    }, 60);
  }, [repeatable, onLongPressAction]);

  const handlePressOut = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePress = useCallback(() => {
    // prevent accidental character insertion on long-press
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (suppressPressIn) {
      onPressRef.current();
    }
  }, [suppressPressIn]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onLongPress={handleLongPress}
      delayLongPress={350}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.key,
        map[v],
        pressed ? styles.keyPressedBase : null,
        pressed ? pressedMap[v] : null,
      ]}
    >
      {cornerIcon ? (
        <View style={styles.keyIconWrap}>
          <Text style={styles.keyIconText}>
            {cornerIcon === "copy" ? "⎘" : "📋"}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.keyText, txtMap[v]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  display: {
    minHeight: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#aeb4c9ff",
    backgroundColor: "#f4f4f5ff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  displayDisabled: { opacity: 0.6 },
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },
  measureBox: {
    position: "absolute",
    left: 0,
    top: 0,
    opacity: 0,
  },
  displayText: { fontSize: 16, lineHeight: 22, color: "#2d3031ff" },
  placeholderText: { fontSize: 16, color: "#7d828aff" },
  caretVert: {
    position: "absolute",
    width: 2,
    backgroundColor: "#7696f5ff",
  },
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
  keyText: { fontSize: 36, fontWeight: "400", color: "#c7caccff" },
  keyTextCursor: { color: "#c7caccff", fontWeight: "700" },
  keyTextControl: { color: "#2a2d30ff", fontWeight: "700" },
  keyTextAlphabet: { color: "#c7caccff" },
  keyTextDigit: { color: "#c7caccff" },
  keyPressedBase: { backgroundColor: "rgba(0,0,0,0.08)" },
  keyPressedDigit: { backgroundColor: "#33343b" },
  keyPressedAlphabet: { backgroundColor: "#454854" },
  keyPressedControl: { backgroundColor: "#6085f0" },
  keyPressedCursor: { backgroundColor: "#2a2933" },
  keyIconWrap: { position: "absolute", left: 6, top: 6 },
  keyIconText: { fontSize: 16, color: "#c7caccff" },
});
