import React, { createContext, useContext, useEffect } from "react";
import { View, StyleSheet, Animated, BackHandler } from "react-native";
import HexKeyboard from "./HexKeyboard";
import {
  useHexKeyboardController,
  type InputId,
  type OpenArgs,
} from "./useHexKeyboardController";

type HexKeyboardContextValue = {
  open: (args: OpenArgs) => void;
  close: () => void;
  isOpen: boolean;
  insetPx: number;
  isActive: (id: InputId) => boolean;
  hex: string;
  cursor: number;
  moveLeft: () => void;
  moveRight: () => void;
  pressNibble: (n: string) => void;
  backspace: () => void;
};

export const HexKeyboardContext = createContext<HexKeyboardContextValue | null>(
  null,
);

export function useOptionalHexKeyboard(): HexKeyboardContextValue | null {
  return useContext(HexKeyboardContext);
}

export function useHexKeyboard(): HexKeyboardContextValue | null {
  const ctx = useContext(HexKeyboardContext);
  return ctx;
}

export default function HexKeyboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const controller = useHexKeyboardController();

  // Android back key closes the hex keyboard instead of navigating back
  useEffect(() => {
    const onBackPress = () => {
      if (controller.isOpen) {
        controller.close();
        return true; // consume back press
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => {
      sub.remove();
    };
  }, [controller.isOpen, controller.close]);

  const ctxValue: HexKeyboardContextValue = {
    open: controller.open,
    close: controller.close,
    isOpen: controller.isOpen,
    insetPx: controller.insetPx,
    isActive: controller.isActive,
    hex: controller.hex,
    cursor: controller.cursor,
    moveLeft: controller.moveLeft,
    moveRight: controller.moveRight,
    pressNibble: controller.pressNibble,
    backspace: controller.backspace,
  };

  return (
    <HexKeyboardContext.Provider value={ctxValue}>
      <View style={{ flex: 1, paddingBottom: controller.insetPx }}>
        {children}
      </View>
      {controller.isOpen ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: controller.sheetTranslateY }] },
            ]}
            pointerEvents="auto"
            onLayout={(e) =>
              controller.setInsetPx(Math.round(e.nativeEvent.layout.height))
            }
          >
            <HexKeyboard
              onKeyPress={controller.pressNibble}
              onBackspace={controller.backspace}
              onEnter={controller.close}
              onMoveLeft={controller.moveLeft}
              onMoveRight={controller.moveRight}
              onCopyAll={controller.copyAllHex}
              onPasteFromClipboard={() => {
                void controller.pasteHexFromClipboard();
              }}
            />
          </Animated.View>
        </View>
      ) : null}
    </HexKeyboardContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  sheet: { backgroundColor: "#1a1c1fff", padding: 8 },
});
