import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

export type HexInputBoxProps = {
  hex: string;
  cursor: number;
  onPress: () => void;
  editable: boolean;
  style?: StyleProp<TextStyle>;
  placeholder?: string;
  open: boolean;
};

export default function HexInputBox({ hex, cursor, onPress, editable, style, placeholder, open }: HexInputBoxProps) {
  const [rowH, setRowH] = useState<number>(0);
  const [textH, setTextH] = useState<number>(0);
  const [prefixW, setPrefixW] = useState<number>(0);

  const caretOpacity = useRef(new Animated.Value(1)).current;
  const easeInQuad = (t: number) => t * t;
  const easeOutQuad = (t: number) => t * (2 - t);

  useEffect(() => {
    let stopped = false;
    if (open) {
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
  }, [open, caretOpacity]);

  const caretLeft = useMemo(() => prefixW, [prefixW]);
  const caretHeight = useMemo(() => Math.max(12, Math.round(textH || 20)), [textH]);
  const caretTop = useMemo(() => Math.max(0, Math.round((rowH - caretHeight) / 2)), [rowH, caretHeight]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
            {placeholder || ''}
          </Text>
          {open ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.caretVert,
                { left: caretLeft, top: caretTop, height: caretHeight, opacity: caretOpacity },
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
                { left: caretLeft, top: caretTop, height: caretHeight, opacity: caretOpacity },
              ]}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  display: {
    minHeight: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#aeb4c9ff',
    backgroundColor: '#f4f4f5ff',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  displayDisabled: { opacity: 0.6 },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  measureBox: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
  },
  displayText: { fontSize: 16, lineHeight: 22, color: '#2d3031ff' },
  placeholderText: { fontSize: 16, color: '#7d828aff' },
  caretVert: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#7696f5ff',
  },
});