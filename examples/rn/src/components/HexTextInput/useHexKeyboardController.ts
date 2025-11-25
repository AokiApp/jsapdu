import { useCallback, useRef, useState } from "react";
import { Animated, Alert, Easing } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";

export type InputId = symbol | string;

export type OpenArgs = {
  id: InputId;
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
};

export type HexKeyboardController = {
  open: (args: OpenArgs) => void;
  close: () => void;
  isOpen: boolean;
  insetPx: number;
  setInsetPx: (px: number) => void;
  isActive: (id: InputId) => boolean;
  hex: string;
  cursor: number;
  moveLeft: () => void;
  moveRight: () => void;
  pressNibble: (n: string) => void;
  backspace: () => void;
  sheetTranslateY: Animated.Value;
  copyAllHex: () => void;
  pasteHexFromClipboard: () => Promise<void>;
};

const sanitize = (s: string = "") =>
  s.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

const SHEET_HIDE_POS = 360;
const SHOW_DURATION_MS = 260;
const HIDE_DURATION_MS = 200;

// Easing wrappers to avoid unbound method lint warnings
const easingOutQuad = Easing.out((x: number) => Easing.quad(x));
const easingInQuad = Easing.in((x: number) => Easing.quad(x));

export function useHexKeyboardController(): HexKeyboardController {
  const [isOpen, setIsOpen] = useState(false);
  const [hex, setHex] = useState<string>("");
  const [cursor, setCursor] = useState<number>(0);
  const [insetPx, setInsetPx] = useState<number>(0);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_HIDE_POS)).current;

  const activeRef = useRef<{
    id: InputId | null;
    onChangeText: (t: string) => void;
    onBlur?: () => void;
  }>({
    id: null,
    onChangeText: () => {},
  });
  const statusRef = useRef<"closed" | "opening" | "open" | "closing">("closed");

  const open = useCallback(
    (args: OpenArgs) => {
      const st = statusRef.current;
      if (st === "opening" || st === "open") return;
      statusRef.current = "opening";

      const clean = sanitize(args.value || "");
      activeRef.current = {
        id: args.id,
        onChangeText: args.onChangeText,
        onBlur: args.onBlur,
      };
      setHex(clean);
      setCursor(clean.length);
      setIsOpen(true);

      sheetTranslateY.setValue(SHEET_HIDE_POS);
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: SHOW_DURATION_MS,
        easing: easingOutQuad,
        useNativeDriver: true,
      }).start(() => {
        statusRef.current = "open";
      });
    },
    [sheetTranslateY],
  );

  const internalHide = useCallback(() => {
    const st = statusRef.current;
    if (st === "closing" || st === "closed") return;
    statusRef.current = "closing";

    Animated.timing(sheetTranslateY, {
      toValue: SHEET_HIDE_POS,
      duration: HIDE_DURATION_MS,
      easing: easingInQuad,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      statusRef.current = "closed";
    });
  }, [sheetTranslateY]);

  const close = useCallback(() => {
    const st = statusRef.current;
    if (st === "closing" || st === "closed") return;

    const clean = hex;
    const onChangeText = activeRef.current.onChangeText;
    const onBlur = activeRef.current.onBlur;

    if (clean.length % 2 === 1) {
      Alert.alert("未完のバイト", "最後のニブルを破棄します。続行しますか？", [
        { text: "キャンセル", style: "cancel" },
        {
          text: "続行",
          style: "destructive",
          onPress: () => {
            onChangeText(clean.slice(0, -1));
            internalHide();
            onBlur?.();
          },
        },
      ]);
    } else {
      internalHide();
      onBlur?.();
    }
  }, [hex, internalHide]);

  const isActive = useCallback(
    (id: InputId) => activeRef.current.id === id,
    [],
  );

  const pressNibble = useCallback(
    (n: string) => {
      if (!/^[0-9a-fA-F]$/.test(n)) return;
      const next = hex.slice(0, cursor) + n.toUpperCase() + hex.slice(cursor);
      setHex(next);
      setCursor((c) => Math.min(c + 1, next.length));
      activeRef.current.onChangeText(next);
    },
    [hex, cursor],
  );

  const backspace = useCallback(() => {
    if (cursor === 0 || hex.length === 0) return;
    const next = hex.slice(0, cursor - 1) + hex.slice(cursor);
    setHex(next);
    setCursor((c) => Math.max(0, c - 1));
    activeRef.current.onChangeText(next);
  }, [hex, cursor]);

  const moveLeft = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const moveRight = useCallback(() => {
    setCursor((c) => Math.min(hex.length, c + 1));
  }, [hex.length]);

  const copyAllHex = useCallback(() => {
    Clipboard.setString(hex);
  }, [hex]);

  const pasteHexFromClipboard = useCallback(async () => {
    try {
      const txt = await Clipboard.getString();
      const stripped = (txt || "").replace(/\s+/g, "").trim();
      if (!stripped || !/^[0-9a-fA-F]+$/.test(stripped)) {
        return;
      }
      const next = stripped.toUpperCase();
      setHex(next);
      setCursor(next.length);
      activeRef.current.onChangeText(next);
    } catch (err) {
      console.warn("[HexKeyboard] Clipboard read failed", err);
    }
  }, []);

  return {
    open,
    close,
    isOpen,
    insetPx,
    setInsetPx,
    isActive,
    hex,
    cursor,
    moveLeft,
    moveRight,
    pressNibble,
    backspace,
    sheetTranslateY,
    copyAllHex,
    pasteHexFromClipboard,
  };
}
