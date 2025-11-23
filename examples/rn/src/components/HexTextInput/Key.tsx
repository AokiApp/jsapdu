import { useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View, Vibration } from "react-native";
const LONG_PRESS_DELAY = 700;
const REPEAT_INTERVAL_MS = 60;

export type KeyProps = {
  label: string;
  onPress: () => void;
  variant?: "digit" | "control" | "alphabet" | "cursor";
  repeatable?: boolean;
  haptic?: boolean;
  onLongPressAction?: () => void;
  suppressPressIn?: boolean;
  cornerIcon?: "copy" | "paste";
};

export default function Key({
  label,
  onPress,
  variant,
  repeatable,
  haptic = true,
  onLongPressAction,
  suppressPressIn = false,
  cornerIcon,
}: KeyProps) {
  const resolvedVariant = variant ?? "digit";

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const vibrate = useCallback(() => {
    if (haptic) {
      Vibration.vibrate(8);
    }
  }, [haptic]);

  const handlePressIn = useCallback(() => {
    vibrate();
    if (!suppressPressIn) {
      onPressRef.current();
    }
  }, [vibrate, suppressPressIn]);

  const handleLongPress = useCallback(() => {
    if (onLongPressAction) {
      vibrate();
      longPressTriggeredRef.current = true;
      onLongPressAction();
      return;
    }
    if (!repeatable || intervalRef.current) return;
    onPressRef.current();
    intervalRef.current = setInterval(() => {
      onPressRef.current();
    }, REPEAT_INTERVAL_MS);
  }, [repeatable, onLongPressAction, vibrate]);

  const handlePressOut = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handlePress = useCallback(() => {
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
      delayLongPress={LONG_PRESS_DELAY}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.keyContainerBase,
        variantBackgroundMap[resolvedVariant],
        pressed ? styles.pressedOverlay : null,
        pressed ? variantPressedMap[resolvedVariant] : null,
      ]}
    >
      {cornerIcon ? (
        <View style={styles.keyIconWrap}>
          <Text style={styles.keyIconText}>
            {cornerIcon === "copy" ? "⎘" : "📋"}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.textBase, variantTextMap[resolvedVariant]]}>
        {label}
      </Text>
    </Pressable>
  );
}

const PALETTE = {
  digit: "#3d4049ff",
  cursor: "#33303dff",
  control: "#7696f5ff",
  alphabet: "#52555fff",
  text: "#c7caccff",
  textOnControl: "#2a2d30ff",
  pressedOverlay: "rgba(0,0,0,0.08)",
  pressedDigit: "#33343b",
  pressedAlphabet: "#454854",
  pressedControl: "#6085f0",
  pressedCursor: "#2a2933",
} as const;

const styles = StyleSheet.create({
  keyContainerBase: {
    width: "19%",
    height: 96, // 私は96サイズがちょうどいいと思っているから変えないで。
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Text styles
  textBase: { fontSize: 36, fontWeight: "400", color: PALETTE.text },
  // Pressed overlay (uniform)
  pressedOverlay: { backgroundColor: PALETTE.pressedOverlay },
  // Icon
  keyIconWrap: { position: "absolute", left: 6, top: 6 },
  keyIconText: { fontSize: 16, color: PALETTE.text },
});

// Variants (expanded here to reduce indirection)
const variantBackgroundMap = StyleSheet.create({
  digit: { backgroundColor: PALETTE.digit },
  control: { backgroundColor: PALETTE.control },
  alphabet: { backgroundColor: PALETTE.alphabet },
  cursor: { backgroundColor: PALETTE.cursor },
});

// Variant text styles (expanded, keep base typography in styles.textBase)
const variantTextMap = StyleSheet.create({
  digit: { color: PALETTE.text },
  control: { color: PALETTE.textOnControl, fontWeight: "700" },
  alphabet: { color: PALETTE.text },
  cursor: { color: PALETTE.text, fontWeight: "700" },
});

// Pressed-state overlays per variant (expanded)
const variantPressedMap = StyleSheet.create({
  digit: { backgroundColor: PALETTE.pressedDigit },
  control: { backgroundColor: PALETTE.pressedControl },
  alphabet: { backgroundColor: PALETTE.pressedAlphabet },
  cursor: { backgroundColor: PALETTE.pressedCursor },
});
