import React, { useCallback, useMemo, useRef } from "react";
import { View, Modal, Pressable, StyleSheet, Animated } from "react-native";
import type { StyleProp, TextStyle, NativeSyntheticEvent, TextInputFocusEvent } from "react-native";
import HexInputBox from "./HexInputBox";
import HexKeyboard from "./HexKeyboard";
import { useOptionalHexKeyboard } from "./HexKeyboardProvider";
import { useHexKeyboardController } from "./useHexKeyboardController";

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

const sanitize = (s: string = "") => s.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

export default function HexTextInput(props: HexTextInputProps) {
  const { value, onChangeText, style, onFocus, onBlur, editable = true, placeholder } = props;
  const ctx = useOptionalHexKeyboard();
  const idRef = useRef(Symbol("HexTextInput"));

  // Shared controller for fallback path (when Provider is absent)
  const controller = useHexKeyboardController();

  const hexProp = useMemo(() => sanitize(value || ""), [value]);

  // Active determination and display values
  const active = ctx ? ctx.isActive(idRef.current) : controller.isOpen;
  const displayHex =
    ctx && active ? ctx.hex : !ctx && active ? controller.hex : hexProp;
  const displayCursor =
    ctx && active
      ? ctx.cursor
      : !ctx && active
      ? controller.cursor
      : displayHex.length;

  const show = useCallback(() => {
    if (!editable) return;
    if (ctx) {
      ctx.open({ id: idRef.current, value: hexProp, onChangeText, onBlur });
      onFocus?.({} as NativeSyntheticEvent<TextInputFocusEvent>);
      return;
    }
    // Fallback: open via shared controller; uses same state/handlers as Provider path
    controller.open({ id: idRef.current, value: hexProp, onChangeText, onBlur });
    onFocus?.({} as NativeSyntheticEvent<TextInputFocusEvent>);
  }, [editable, ctx, controller, hexProp, onChangeText, onBlur, onFocus]);

  return (
    <View>
      <HexInputBox
        hex={displayHex}
        cursor={displayCursor}
        onPress={show}
        editable={editable}
        style={style}
        placeholder={placeholder}
        open={active}
      />

      {!ctx && (
        <Modal
          visible={controller.isOpen}
          transparent
          onRequestClose={controller.close}
        >
          <View style={styles.overlay}>
            <Pressable
              style={styles.backdrop}
              onPress={controller.close}
              accessibilityRole="button"
              testID="hexTextInputBackdrop"
            />

            <Animated.View
              style={[styles.sheet, { transform: [{ translateY: controller.sheetTranslateY }] }]}
            >
              <HexKeyboard
                onKeyPress={controller.pressNibble}
                onBackspace={controller.backspace}
                onEnter={controller.close}
                onMoveLeft={controller.moveLeft}
                onMoveRight={controller.moveRight}
                onCopyAll={controller.copyAllHex}
                onPasteFromClipboard={() => { void controller.pasteHexFromClipboard(); }}
              />
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1 },
  sheet: { backgroundColor: "#1a1c1fff", padding: 8 },
});