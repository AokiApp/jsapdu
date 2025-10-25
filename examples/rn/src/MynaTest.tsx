import React, { useState, useEffect, useRef } from "react";
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
  Alert,
} from "react-native";
import { platformManager, RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type { SmartCardDevice, SmartCard } from "@aokiapp/jsapdu-interface";
import { selectDf, verify } from "@aokiapp/apdu-utils";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";

type Step = "pin" | "read" | "show";

const MynaTest: React.FC = () => {
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<Step>("pin");
  const [reading, setReading] = useState(false); // button spinner
  const [drawerVisible, setDrawerVisible] = useState(false); // NFC drawer visibility
  const [deviceAcquiring, setDeviceAcquiring] = useState(false); // acquiring reader device
  const [deviceAcquired, setDeviceAcquired] = useState(false); // device acquired event
  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const platformInitializedRef = useRef(false);
  const deviceRef = useRef<SmartCardDevice | null>(null); // keep device in ref, not state
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [cardReading, setCardReading] = useState(false); // spinner while card is detected/reading

  // Glow for shiny drawer
  const glow = useRef(new Animated.Value(0)).current;

  const onChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "");
    setPin(digits.slice(0, 4));
  };

  const goNext = () => {
    if (pin.length === 4) {
      setStep("read");
    }
  };

  // Shimmer glow while drawer is visible
  useEffect(() => {
    if (drawerVisible) {
      const loop = Animated.loop(
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
      return () => loop.stop();
    } else {
      glow.stopAnimation(() => glow.setValue(0));
    }
  }, [drawerVisible, glow]);

  // Acquire device once drawer becomes visible; UI switches via DEVICE_ACQUIRED and CARD_FOUND events
  useEffect(() => {
    if (!drawerVisible) return;
    let canceled = false;
    const platform = platformRef.current;
    if (!platformInitializedRef.current || !platform) return;

    // Subscribe to native events (unsubscribe via returned off())
    const offAcquired = platform.on("DEVICE_ACQUIRED", () => {
      if (canceled) return;
      setDeviceAcquiring(false);
      setDeviceAcquired(true);
    });
    const offCardFound = platform.on("CARD_FOUND", () => {
      if (canceled) return;
      setCardReading(true);
    });
    const offCardLost = platform.on("CARD_LOST", () => {
      if (canceled) return;
      setCardReading(false);
    });

    setDeviceAcquiring(true);
    setDeviceAcquired(false);
    deviceRef.current = null;
    setCardReading(false);

    void (async () => {
      try {
        const devices = await platform.getDeviceInfo();
        if (!devices || devices.length === 0) {
          setDeviceAcquiring(false);
          return;
        }
        const deviceId = devices[0]!.id;
        const device = await platform.acquireDevice(deviceId);
        if (canceled) return;
        deviceRef.current = device;
        // UI transition awaits DEVICE_ACQUIRED and CARD_FOUND events
      } catch {
        if (canceled) return;
        setDeviceAcquiring(false);
      }
    })();

    return () => {
      canceled = true;
      offAcquired();
      offCardFound();
      offCardLost();
    };
  }, [drawerVisible]);
  const [sequenceDone, setSequenceDone] = useState(false);

  // Poll native card presence when cardReading is true
  useEffect(() => {
    if (!cardReading) return;
    pollIntervalRef.current = setInterval(() => {
      void (async () => {
        try {
          const present = await deviceRef.current?.isCardPresent();
          if (!present) {
            clearInterval(pollIntervalRef.current!);
            setCardReading(false);
            setDrawerVisible(false);
            await deviceRef.current?.release();
            await platformRef.current?.release();
            deviceRef.current = null;
            platformRef.current = null;
            platformInitializedRef.current = false;
            setDeviceAcquiring(false);
            setDeviceAcquired(false);
            setStep("show");
          }
        } catch {
          // ignore errors
        }
      })();
    }, 500);
  }, [cardReading, sequenceDone]);

  const runSequencelet = async (card: SmartCard, pinValue: string) => {
    await card.transmit(selectDf(KENHOJO_AP));
    await card.transmit(verify(pinValue, { ef: KENHOJO_AP_EF.PIN }));
  };

  // Trigger sequencelet once session is active and card is present
  useEffect(() => {
    const process = async () => {
      const device = deviceRef.current;
      if (!device || !deviceAcquired || !cardReading || sequenceDone) return;
      try {
        const card = await device.startSession();
        await runSequencelet(card, pin);
        setSequenceDone(true);
        setCardReading(false);
      } catch (error) {
        console.error(error);
      }
    };
    void process();
  }, [deviceAcquired, cardReading, sequenceDone, pin]);

  // Derived animated values
  const pulseOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.5],
  });
  const titleOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const handleReadStart = async () => {
    // reset drawer state
    setDrawerVisible(false);
    setDeviceAcquiring(false);
    setDeviceAcquired(false);

    // show button spinner immediately
    setReading(true);

    try {
      platformRef.current = platformManager.getPlatform();
      await platformRef.current.init();
      platformInitializedRef.current = true;

      // open drawer after init completes (initially shows spinner)
      setDrawerVisible(true);
    } catch {
      // init failed → stop spinner and keep drawer hidden
      setReading(false);
      return;
    }

    // stop button spinner after drawer opens
    setReading(false);
  };

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
              onPress={handleReadStart}
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
                    <Text style={styles.promptText}>
                      カードを取り外してください
                    </Text>
                  </View>
                ) : cardReading ? (
                  <View style={styles.sheetSpinner}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.sheetSpinnerText}>読取中...</Text>
                  </View>
                ) : !deviceAcquired ? (
                  <View style={styles.sheetSpinner}>
                    <ActivityIndicator size="small" color="#007AFF" />
                    <Text style={styles.sheetSpinnerText}>
                      {deviceAcquiring
                        ? "リーダーを準備中..."
                        : "準備しています..."}
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
