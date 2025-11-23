import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

export type KeyProps = {
  label: string;
  onPress: () => void;
  variant?: 'digit' | 'control' | 'alphabet' | 'cursor';
  repeatable?: boolean;
  haptic?: boolean;
  onLongPressAction?: () => void;
  suppressPressIn?: boolean;
  cornerIcon?: 'copy' | 'paste';
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
  const v = variant || 'digit';

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTriggeredRef = useRef(false);
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
    vibrate();
    if (onLongPressAction) {
      longPressTriggeredRef.current = true;
      onLongPressAction();
      return;
    }
    if (!repeatable || intervalRef.current) return;
    onPressRef.current();
    intervalRef.current = setInterval(() => {
      onPressRef.current();
    }, 60);
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
      delayLongPress={700}
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
            {cornerIcon === 'copy' ? '⎘' : '📋'}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.keyText, txtMap[v]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  key: {
    width: '19%',
    height: 96, // 私は96サイズがちょうどいいと思っているから変えないで。
    borderRadius: 6,
    backgroundColor: '#3d4049ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyCursor: { backgroundColor: '#33303dff' },
  keyControl: { backgroundColor: '#7696f5ff' },
  keyAlphabet: { backgroundColor: '#52555fff' },
  keyDigit: { backgroundColor: '#3d4049ff' },
  keyText: { fontSize: 36, fontWeight: '400', color: '#c7caccff' },
  keyTextCursor: { color: '#c7caccff', fontWeight: '700' },
  keyTextControl: { color: '#2a2d30ff', fontWeight: '700' },
  keyTextAlphabet: { color: '#c7caccff' },
  keyTextDigit: { color: '#c7caccff' },
  keyPressedBase: { backgroundColor: 'rgba(0,0,0,0.08)' },
  keyPressedDigit: { backgroundColor: '#33343b' },
  keyPressedAlphabet: { backgroundColor: '#454854' },
  keyPressedControl: { backgroundColor: '#6085f0' },
  keyPressedCursor: { backgroundColor: '#2a2933' },
  keyIconWrap: { position: 'absolute', left: 6, top: 6 },
  keyIconText: { fontSize: 16, color: '#c7caccff' },
});