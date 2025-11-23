import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, Pressable, StyleSheet, View, Vibration, Easing, Animated } from 'react-native';
import type { StyleProp, TextStyle, NativeSyntheticEvent, TextInputFocusEvent } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import HexInputBox from './HexInputBox';
import HexKeyboard from './HexKeyboard';

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

const hidePos = 360;
export default function HexTextInput(props: HexTextInputProps) {
  const { value, onChangeText, style, onFocus, onBlur, editable = true, placeholder, autoFocus } = props;
  const [open, setOpen] = useState(false);
  const hex = useMemo(() => sanitize(value || ''), [value]);
  const [cursor, setCursor] = useState<number>(hex.length);
  const [backdropReady, setBackdropReady] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(24)).current;
  const didAutoFocusRef = useRef(false);

  const show = useCallback(() => {
    if (!editable) return;
    sheetTranslateY.setValue(hidePos);
    setBackdropReady(false);
    Keyboard.dismiss();
    setCursor(sanitize(value || '').length);
    setOpen(true);
    requestAnimationFrame(() => {
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 260,
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setBackdropReady(true);
      });
    });
    onFocus?.({} as NativeSyntheticEvent<TextInputFocusEvent>);
  }, [editable, onFocus, value, sheetTranslateY]);

  const hide = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: hidePos,
      duration: 200,
      /* eslint-disable-next-line @typescript-eslint/unbound-method */
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

  const closeWithTrim = useCallback(() => {
    const clean = sanitize(hex);
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

  const copyAllHex = useCallback(() => {
    const clean = sanitize(hex);
    Clipboard.setString(clean);
    Vibration.vibrate(8);
  }, [hex]);

  const pasteHexFromClipboard = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      const stripped = (txt || '').replace(/\s+/g, '').trim();
      if (!stripped || !/^[0-9a-fA-F]+$/.test(stripped)) {
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
        open={open}
      />
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
            <HexKeyboard
              onKeyPress={(k) => pressNibble(k)}
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