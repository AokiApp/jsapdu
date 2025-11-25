import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, TextStyle } from "react-native";

const EASE_IN_QUAD = (t: number) => t * t;
const EASE_OUT_QUAD = (t: number) => t * (2 - t);
const CARET_FADE_DURATION = 120;
const CARET_DELAY = 380;

export type HexInputBoxProps = {
  hex: string;
  cursor: number;
  onPress: () => void;
  editable: boolean;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  open: boolean;
};

export default function HexInputBox({
  hex,
  cursor,
  onPress,
  editable,
  style,
  placeholder,
  open,
}: HexInputBoxProps) {
  const [rowHeight, setRowHeight] = useState<number>(0);
  const [textHeight, setTextHeight] = useState<number>(0);
  const [prefixWidth, setPrefixWidth] = useState<number>(0);

  const caretOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let stopped = false;
    if (open) {
      caretOpacity.setValue(1);
      const loop = () => {
        if (stopped) return;
        Animated.sequence([
          Animated.timing(caretOpacity, {
            toValue: 0.35,
            duration: CARET_FADE_DURATION,
            easing: EASE_OUT_QUAD,
            useNativeDriver: true,
          }),
          Animated.delay(CARET_DELAY),
          Animated.timing(caretOpacity, {
            toValue: 1,
            duration: CARET_FADE_DURATION,
            easing: EASE_IN_QUAD,
            useNativeDriver: true,
          }),
          Animated.delay(CARET_DELAY),
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
  }, [open, caretOpacity]);

  const caretHeight = Math.max(12, Math.round(textHeight || 20));
  const caretTop = Math.max(0, Math.round((rowHeight - caretHeight) / 2));
  const caretLeft = prefixWidth;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!editable}
      style={[styles.display, !editable && styles.displayDisabled]}
    >
      <View
        style={styles.row}
        onLayout={(e) => setRowHeight(e.nativeEvent.layout.height)}
      >
        <Text
          style={[
            hex.length === 0 ? styles.placeholderText : styles.displayText,
            style,
          ]}
          numberOfLines={1}
          onLayout={(e) => setTextHeight(e.nativeEvent.layout.height)}
        >
          {hex.length === 0 ? placeholder || "" : hex}
        </Text>

        {hex.length > 0 ? (
          <View style={styles.measureBox} pointerEvents="none">
            <Text
              style={[styles.displayText, style]}
              numberOfLines={1}
              onLayout={(e) => setPrefixWidth(e.nativeEvent.layout.width)}
            >
              {hex.slice(0, cursor)}
            </Text>
          </View>
        ) : null}

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
});
