import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, Pressable, StyleSheet, View, Vibration, Easing, Animated } from 'react-native';
import type { StyleProp, TextStyle, NativeSyntheticEvent, TextInputFocusEvent } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import HexInputBox from './HexInputBox';
import HexKeyboard from './HexKeyboard';

const quadOut = (t: number) => Easing.out(Easing.quad)(t);
const quadIn = (t: number) => Easing.in(Easing.quad)(t);

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

const sanitize = (s = '') => s.replace(/[^0-9a-fA-F]/g, '').toUpperCase();

const SHEET_HIDE_POS = 360;
const SHOW_DURATION_MS = 260;
const HIDE_DURATION_MS = 200;
const HAPTIC_COPY_MS = 8;
const HAPTIC_ERROR_MS = 15;
export default function HexTextInput(props: HexTextInputProps) {
  const { value, onChangeText, style, onFocus, onBlur, editable = true, placeholder, autoFocus } = props;
  const [isOpen, setIsOpen] = useState(false);
  const hex = useMemo(() => sanitize(value || ''), [value]);
  const [cursor, setCursor] = useState<number>(hex.length);
  const [isBackdropInteractive, setIsBackdropInteractive] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HIDE_POS)).current;
  const didAutoFocusRef = useRef(false);

  const show = useCallback(() => {
    if (!editable) return;
    sheetTranslateY.setValue(SHEET_HIDE_POS);
    setIsBackdropInteractive(false);
    Keyboard.dismiss();
    setCursor(hex.length);
    setIsOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: SHOW_DURATION_MS,
        easing: quadOut,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setIsBackdropInteractive(true);
      });
    });
    onFocus?.({} as NativeSyntheticEvent<TextInputFocusEvent>);
  }, [editable, onFocus, hex, sheetTranslateY]);

  const hide = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: SHEET_HIDE_POS,
      duration: HIDE_DURATION_MS,
      easing: quadIn,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
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

  const closeWithTrim = useCallback(() => {
    const clean = hex;
    if (clean.length % 2 === 1) {
      Alert.alert('未完のバイト', '最後のニブルを破棄します。続行しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '続行',
          style: 'destructive',
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
      if (!/^[0-9a-fA-F]$/.test(n)) return;
      const next = hex.slice(0, cursor) + n.toUpperCase() + hex.slice(cursor);
      onChangeText?.(next);
      setCursor((c) => Math.min(c + 1, next.length));
    },
    [hex, cursor, onChangeText],
  );

  const backspace = useCallback(() => {
    if (cursor === 0 || hex.length === 0) return;
    const next = hex.slice(0, cursor - 1) + hex.slice(cursor);
    onChangeText?.(next);
    setCursor((c) => Math.max(0, c - 1));
  }, [hex, cursor, onChangeText]);

  const moveLeft = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const moveRight = useCallback(() => {
    setCursor((c) => Math.min(hex.length, c + 1));
  }, [hex]);

  const copyAllHex = useCallback(() => {
    Clipboard.setString(hex);
    Vibration.vibrate(HAPTIC_COPY_MS);
  }, [hex]);

  const pasteHexFromClipboard = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      const stripped = (txt || '').replace(/\s+/g, '').trim();
      if (!stripped || !/^[0-9a-fA-F]+$/.test(stripped)) {
        Vibration.vibrate(HAPTIC_ERROR_MS);
        return;
      }
      const next = stripped.toUpperCase();
      onChangeText?.(next);
      setCursor(next.length);
    } catch {
      Vibration.vibrate(HAPTIC_ERROR_MS);
    }
  }, [onChangeText]);

  const pasteHexFromClipboardTrigger = useCallback(() => {
    void pasteHexFromClipboard();
  }, [pasteHexFromClipboard]);

  return (
    <View>
      <HexInputBox
        hex={hex}
        cursor={cursor}
        onPress={show}
        editable={editable}
        style={style}
        placeholder={placeholder}
        open={isOpen}
      />
      <Modal visible={isOpen} transparent onRequestClose={closeWithTrim}>
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={closeWithTrim}
            disabled={!isBackdropInteractive}
            testID="hexTextInputBackdrop"
            accessibilityRole="button"
          />
          <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
            <HexKeyboard
              onKeyPress={pressNibble}
              onBackspace={backspace}
              onEnter={closeWithTrim}
              onMoveLeft={moveLeft}
              onMoveRight={moveRight}
              onCopyAll={copyAllHex}
              onPasteFromClipboard={pasteHexFromClipboardTrigger}
            />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1 },
  sheet: { backgroundColor: '#1a1c1fff', padding: 8 },
});