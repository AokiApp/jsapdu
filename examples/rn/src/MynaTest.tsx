import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./App";

import { RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type {
  PlatformEventType,
  PlatformEventPayload,
} from "@aokiapp/jsapdu-rn";
import type { SmartCardDevice, SmartCard } from "@aokiapp/jsapdu-interface";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import {
  KENHOJO_AP,
  KENHOJO_AP_EF,
  schemaKenhojoBasicFour,
} from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv/parser";

type Step = "pin" | "read" | "show";
type UiState = {
  platformInitialized: boolean;
  deviceAcquired: boolean;
  cardPresent: boolean;
  sessionActive: boolean;
};

type BasicFourInfo = {
  offsets: number[];
  name: string;
  address: string;
  birth: string;
  gender: string;
};

// Small hook for the shimmer glow to keep the screen component lean
const useGlowAnimation = (visible: boolean) => {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: { start: () => void; stop: () => void } | null = null;
    if (visible) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 700,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 700,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
    } else {
      glow.stopAnimation(() => glow.setValue(0));
    }
    return () => {
      try {
        loop?.stop();
      } catch {
        // no-op
      }
    };
  }, [visible, glow]);

  return glow;
};

const stringifyError = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
};

// Release helpers (centralized cleanup)
const releaseCard = async (cardRef: React.MutableRefObject<SmartCard | null>) => {
  const card = cardRef.current;
  if (card) {
    try {
      await card.release();
    } catch {
      // ignore
    }
    cardRef.current = null;
  }
};

const releaseDevice = async (
  deviceRef: React.MutableRefObject<SmartCardDevice | null>,
) => {
  const dev = deviceRef.current;
  if (dev) {
    try {
      await dev.release();
    } catch {
      // ignore
    }
    deviceRef.current = null;
  }
};

const releasePlatform = async (
  platformRef: React.MutableRefObject<RnSmartCardPlatform | null>,
) => {
  const platform = platformRef.current;
  if (platform && platform.isInitialized()) {
    try {
      await platform.release();
    } catch {
      // ignore
    }
  }
  platformRef.current = null;
};

const MynaTest: React.FC = () => {
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("pin");
  const [reading, setReading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [statusText, setStatusText] = useState("Idle");
  const [basicInfo, setBasicInfo] = useState<BasicFourInfo | null>(null);

  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const deviceRef = useRef<SmartCardDevice | null>(null);
  const cardRef = useRef<SmartCard | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);

  const [ui, setUi] = useState<UiState>({
    platformInitialized: false,
    deviceAcquired: false,
    cardPresent: false,
    sessionActive: false,
  });
  const [deviceAcquiring, setDeviceAcquiring] = useState(false);
  const [cardReading, setCardReading] = useState(false);

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "MynaTest">
    >();

  // Header reflects current step
  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        step === "pin" ? "PIN 入力" : step === "read" ? "読取ステップ" : "表示ステップ",
    });
  }, [navigation, step]);

  // Interpolate shimmer for the drawer
  const glow = useGlowAnimation(drawerVisible);
  const pulseOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.5],
  });
  const titleOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const onChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "");
    setPin(digits.slice(0, 4));
  };

  const goNext = () => {
    if (pin.length === 4) {
      setStep("read");
    }
  };

  // Update UI by native event (kept small and predictable)
  const setUiByEvent = useCallback(
    (evt: PlatformEventType, details?: string) => {
      setUi((prev) => {
        switch (evt) {
          case "PLATFORM_INITIALIZED":
            return {
              platformInitialized: true,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "PLATFORM_RELEASED":
            return {
              platformInitialized: false,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "DEVICE_ACQUIRED":
            return { ...prev, deviceAcquired: true };
          case "DEVICE_RELEASED":
            return {
              platformInitialized: prev.platformInitialized,
              deviceAcquired: false,
              cardPresent: false,
              sessionActive: false,
            };
          case "CARD_FOUND":
            return { ...prev, cardPresent: true };
          case "CARD_LOST":
            return { ...prev, cardPresent: false, sessionActive: false };
          case "CARD_SESSION_STARTED":
            return { ...prev, sessionActive: true };
          case "CARD_SESSION_RESET":
            return { ...prev, sessionActive: false };
          case "WAIT_TIMEOUT":
          default:
            return prev;
        }
      });
      const msg = details ? `${evt}: ${details}` : evt;
      setStatusText(msg);
      if (evt === "DEVICE_ACQUIRED") setDeviceAcquiring(false);
      if (evt === "CARD_FOUND") setCardReading(true);
      if (evt === "CARD_LOST") {
        setCardReading(false);
        void finalizeAfterCardRemoval();
      }
    },
    // No external state is read here directly (only setters), safe with empty deps
    [],
  );

  // Centralized release/abort/finalize flows (navigation-aware)
  async function releaseAll(reason: string) {
    await releaseCard(cardRef);
    await releaseDevice(deviceRef);
    await releasePlatform(platformRef);

    // Reflect released state without relying on native event timing
    setUi({
      platformInitialized: false,
      deviceAcquired: false,
      cardPresent: false,
      sessionActive: false,
    });
    setStatusText(`PLATFORM_RELEASED: ${reason}`);
  }

  async function safeAbortFlow() {
    try {
      await releaseAll("abort");
    } finally {
      setDrawerVisible(false);
      setDeviceAcquiring(false);
      setCardReading(false);
      setSequenceDone(false);
    }
  }

  async function finalizeAfterCardRemoval() {
    try {
      await releaseAll("finalize");
      setDrawerVisible(false);
      setStep("show");
    } finally {
      setDeviceAcquiring(false);
      setCardReading(false);
      // Reset for next run
      setSequenceDone(false);
    }
  }

  const attachEventHandlers = useCallback(() => {
    const platform = platformRef.current;
    if (!platform) return [];
    const unsubs: Array<() => void> = [];
    const onEvt =
      (evt: PlatformEventType) => (payload: PlatformEventPayload) => {
        setUiByEvent(evt, payload?.details);
      };
    const events: PlatformEventType[] = [
      "PLATFORM_INITIALIZED",
      "PLATFORM_RELEASED",
      "DEVICE_ACQUIRED",
      "DEVICE_RELEASED",
      "CARD_FOUND",
      "CARD_LOST",
      "CARD_SESSION_STARTED",
      "CARD_SESSION_RESET",
      "WAIT_TIMEOUT",
    ];
    events.forEach((evt) => {
      unsubs.push(platform.on(evt, onEvt(evt)));
    });
    return unsubs;
  }, [setUiByEvent]);

  // Cleanup when navigating away (blur) as well as when unmounting
  useFocusEffect(
    useCallback(() => {
      return () => {
        const unsubs = unsubsRef.current;
        unsubs.forEach((u) => u());
        unsubsRef.current = [];
        void safeAbortFlow();
      };
    }, []),
  );

  useEffect(() => {
    return () => {
      const unsubs = unsubsRef.current;
      unsubs.forEach((u) => u());
      unsubsRef.current = [];
      void safeAbortFlow();
    };
  }, []);

  // Intercept back navigation to move within steps instead of leaving the screen
  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      // At 'pin' step, allow default back behavior
      if (step === "pin") return;
      e.preventDefault();

      if (step === "show") {
        setStep("pin");
        return;
      }

      if (step === "read") {
        // Abort any ongoing flow and return to PIN
        void safeAbortFlow();
        setDrawerVisible(false);
        setStep("pin");
        return;
      }
    });
    return sub;
  }, [navigation, step]);

  const runSequencelet = async (card: SmartCard, pinValue: string) => {
    await card.transmit(selectDf(KENHOJO_AP));
    await card.transmit(verify(pinValue, { ef: KENHOJO_AP_EF.PIN }));
  };

  // When card present and device acquired, start session and verify PIN
  useEffect(() => {
    const process = async () => {
      if (!ui.deviceAcquired || !ui.cardPresent || sequenceDone) return;
      const dev = deviceRef.current;
      if (!dev) return;

      if (!ui.sessionActive) {
        try {
          const card = await dev.startSession();
          cardRef.current = card;
          // Fallback in case native doesn't emit CARD_SESSION_STARTED
          setUiByEvent("CARD_SESSION_STARTED", "post-start fallback");
        } catch (e) {
          setStatusText(`startSession() error: ${stringifyError(e)}`);
          return;
        }
      }

      const card = cardRef.current;
      if (!card) return;

      try {
        setStatusText("Verifying PIN...");
        await runSequencelet(card, pin);
        setStatusText("PIN verified. Reading data...");
        const resp = await card.transmit(
          readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
        );
        const swOk = resp.sw1 === 0x90 && resp.sw2 === 0x00;
        if (swOk) {
          const bytes = resp.toUint8Array();
          const parser = new SchemaParser(schemaKenhojoBasicFour);
          const parsedUnknown = parser.parse(bytes.buffer) as unknown;

          type ParsedBasicFour = {
            name: string;
            address: string;
            birth: string;
            gender: string;
            offsets?: unknown;
          };
          const isParsedBasicFour = (v: unknown): v is ParsedBasicFour => {
            if (!v || typeof v !== "object") return false;
            const o = v as Record<string, unknown>;
            return (
              typeof o.name === "string" &&
              typeof o.address === "string" &&
              typeof o.birth === "string" &&
              typeof o.gender === "string"
            );
          };

          if (isParsedBasicFour(parsedUnknown)) {
            const offsets = Array.isArray(parsedUnknown.offsets)
              ? (parsedUnknown.offsets as unknown[]).filter(
                  (x): x is number => typeof x === "number",
                )
              : [];
            setBasicInfo({
              name: parsedUnknown.name,
              address: parsedUnknown.address,
              birth: parsedUnknown.birth,
              gender: parsedUnknown.gender,
              offsets,
            });
            setStatusText("Data read. Remove your card.");
          } else {
            setStatusText("Unexpected data format while parsing BASIC_FOUR");
          }
        } else {
          setStatusText(
            `Failed to read BASIC_FOUR: SW=${resp.sw1
              .toString(16)
              .toUpperCase()}/${resp.sw2.toString(16).toUpperCase()}`,
          );
        }
        setSequenceDone(true);
        setCardReading(false);
      } catch (e) {
        setStatusText(`verify/read error: ${stringifyError(e)}`);
      }
    };
    void process();
  }, [
    ui.deviceAcquired,
    ui.cardPresent,
    ui.sessionActive,
    sequenceDone,
    pin,
    setUiByEvent,
  ]);

  const handleReadStart = useCallback(async () => {
    // reset drawer state
    setDrawerVisible(false);
    setDeviceAcquiring(false);
    setSequenceDone(false);

    // show button spinner immediately
    setReading(true);

    try {
      const platform = new RnSmartCardPlatform();
      platformRef.current = platform;
      const unsubs = attachEventHandlers();
      unsubsRef.current = unsubs;

      await platform.init();
      // Fallback in case native event is delayed
      setUiByEvent("PLATFORM_INITIALIZED", "post-init fallback");

      // open drawer after init completes (initially shows spinner)
      setDrawerVisible(true);

      // acquire device
      setDeviceAcquiring(true);
      const infos = await platform.getDeviceInfo();
      if (infos.length === 0) {
        setStatusText("No NFC device available");
        setDeviceAcquiring(false);
        return;
      }
      const dev = await platform.acquireDevice(infos[0]!.id);
      deviceRef.current = dev;
      // Fallback in case native doesn't emit DEVICE_ACQUIRED
      setUiByEvent("DEVICE_ACQUIRED", `fallback: ${infos[0]!.id}`);

      // wait for card
      try {
        await dev.waitForCardPresence(20);
        // Fallback in case native doesn't emit CARD_FOUND
        setUiByEvent("CARD_FOUND", "post-wait fallback");
      } catch (e) {
        setUiByEvent("WAIT_TIMEOUT", stringifyError(e));
      }
    } catch (e) {
      setStatusText(`init/acquire error: ${stringifyError(e)}`);
    } finally {
      // stop button spinner after starting drawer
      setReading(false);
    }
  }, [attachEventHandlers, setUiByEvent]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {step === "pin" && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={64}
          >
            <Text style={styles.title}>PIN を入力</Text>
            <TextInput
              value={pin}
              onChangeText={onChangeText}
              style={styles.input}
              placeholder="PIN (4桁)"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Text style={styles.helper}>
              数字のみ。入力された PIN は送信しません。
            </Text>
            <TouchableOpacity
              style={[styles.button, pin.length !== 4 && styles.buttonDisabled]}
              disabled={pin.length !== 4}
              onPress={goNext}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        )}

        {step === "read" && (
          <>
            <Text style={styles.title}>読取ステップ</Text>
            <Text style={styles.description}>
              カードリーダーの準備ができています。マイナンバーカードをかざし、「読取開始」を押してください。
            </Text>
            <TouchableOpacity
              style={[styles.button, reading && styles.buttonDisabled]}
              disabled={reading}
              onPress={() => {
                void handleReadStart();
              }}
            >
              {reading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>読取開始</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.linkButton]}
              onPress={() => setStep("pin")}
            >
              <Text style={styles.linkButtonText}>PIN を修正する</Text>
            </TouchableOpacity>

            {drawerVisible && <View style={styles.overlay} />}

            {drawerVisible && (
              <Animated.View style={styles.bottomSheet}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.pulse, { opacity: pulseOpacity }]}
                />
                <View style={styles.bottomSheetHandle} />
                <Animated.Text
                  style={[styles.sheetTitle, { opacity: titleOpacity }]}
                >
                  {sequenceDone ? "カードを取り外してください" : "NFC を待受中"}
                </Animated.Text>
                {sequenceDone ? (
                  <View style={styles.promptWrap}>
                    <Text style={styles.promptEmoji}>🙌</Text>
                    <Text style={styles.promptText}>カードを取り外してください</Text>
                  </View>
                ) : cardReading ? (
                  <View style={styles.sheetSpinner}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.sheetSpinnerText}>読取中...</Text>
                  </View>
                ) : !ui.deviceAcquired ? (
                  <View style={styles.sheetSpinner}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.sheetSpinnerText}>
                      {deviceAcquiring ? "リーダーを準備中..." : "準備しています..."}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.promptWrap}>
                    <Text style={styles.promptEmoji}>📶</Text>
                    <Text style={styles.promptText}>
                      カードをタッチエリアにかざしてください
                    </Text>
                  </View>
                )}

                <View style={{ marginTop: 16, alignItems: "center" }}>
                  <Text style={{ color: "#6B7280", fontSize: 12 }}>
                    {statusText}
                  </Text>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {step === "show" && (
          <>
            <Text style={styles.title}>表示ステップ</Text>
            <Text style={styles.description}>
              読取が完了しました。ここにデータを表示します。
            </Text>
            {basicInfo ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.description}>氏名: {basicInfo.name}</Text>
                <Text style={styles.description}>住所: {basicInfo.address}</Text>
                <Text style={styles.description}>生年月日: {basicInfo.birth}</Text>
                <Text style={styles.description}>性別: {basicInfo.gender}</Text>
              </View>
            ) : (
              <Text style={styles.description}>データは取得されていません。</Text>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={() => setStep("pin")}
            >
              <Text style={styles.buttonText}>最初に戻る</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { flex: 1, padding: 24, justifyContent: "center" },
  title: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    backgroundColor: "#fff",
    textAlign: "center",
    letterSpacing: 4,
    color: "#000",
  },
  helper: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: "#444",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#ccc" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkButton: { marginTop: 12, alignItems: "center" },
  linkButtonText: { color: "#007AFF", fontSize: 14, fontWeight: "500" },

  // Bottom drawer for NFC wait
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    minHeight: 320,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
    overflow: "hidden",
    zIndex: 20,
    borderWidth: 1,
    borderColor: "#dbe8ff",
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: "#333",
  },
  sheetSpinner: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetSpinnerText: { marginLeft: 8, color: "#007AFF", fontWeight: "600" },

  // Overlay behind the drawer
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 10,
  },

  // Pulsing glow layer inside the drawer
  pulse: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#eaf3ff",
  },

  // Prompt content after device acquisition
  promptWrap: { marginTop: 20, alignItems: "center", justifyContent: "center" },
  promptEmoji: { fontSize: 48 },
  promptText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#007AFF",
    textAlign: "center",
  },
  deviceName: {
    marginTop: 6,
    fontSize: 13,
    color: "#555",
    textAlign: "center",
  },
});

export default MynaTest;