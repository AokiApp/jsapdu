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
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../App";
import { RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type {
  PlatformEventType,
  PlatformEventPayload,
} from "@aokiapp/jsapdu-rn";
import type { SmartCardDevice, SmartCard } from "@aokiapp/jsapdu-interface";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";
import { KENHOJO_AP, KENHOJO_AP_EF } from "@aokiapp/mynacard";
import type { BasicFourInfo } from "../types/myna";

// Local glow animation hook (keeps component lean)
const useGlowAnimation = (visible: boolean) => {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop: { start: () => void; stop: () => void } | null = null;
    if (visible) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: GLOW_DURATION_MS,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: GLOW_DURATION_MS,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
            useNativeDriver: true,
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

type UiState = {
  platformInitialized: boolean;
  deviceAcquired: boolean;
  cardPresent: boolean;
  sessionActive: boolean;
};

type Phase =
  | "IDLE"
  | "INITIALIZING"
  | "ACQUIRING_DEVICE"
  | "WAITING_FOR_CARD"
  | "STARTING_SESSION"
  | "READING"
  | "COMPLETED";

// Flow constants (no UI style changes)
const WAIT_CARD_SECONDS = 20;
const GLOW_DURATION_MS = 700;

const stringifyError = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
};

// Release helpers (centralized cleanup)
const releaseCard = async (
  cardRef: React.MutableRefObject<SmartCard | null>,
) => {
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
  if (platform) {
    try {
      await platform.release();
    } catch {
      // ignore NOT_INITIALIZED and other release errors
    }
  }
  platformRef.current = null;
};

const MynaReadScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "MynaRead">>();
  const route = useRoute<RouteProp<RootStackParamList, "MynaRead">>();
  const { pin } = route.params;

  const [statusText, setStatusText] = useState("Idle");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [basicInfo, setBasicInfo] = useState<BasicFourInfo | null>(null);
  const rawBasicRef = useRef<number[] | null>(null);
  // Guards to prevent duplicate finalize/navigation when CARD_LOST fires multiple times
  const navigationCommittedRef = useRef(false);
  const finalizingRef = useRef(false);

  const platformRef = useRef<RnSmartCardPlatform | null>(null);
  const deviceRef = useRef<SmartCardDevice | null>(null);
  const cardRef = useRef<SmartCard | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const abortingRef = useRef(false);

  const [ui, setUi] = useState<UiState>({
    platformInitialized: false,
    deviceAcquired: false,
    cardPresent: false,
    sessionActive: false,
  });

  const [phase, setPhase] = useState<Phase>("IDLE");
  const phaseRef = useRef<Phase>("IDLE");
  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "読取ステップ" });
  }, [navigation]);

  const glow = useGlowAnimation(drawerVisible);
  const pulseOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.5],
  });
  const titleOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const setUiByEvent = useCallback(
    (evt: PlatformEventType, details?: string) => {
      console.log("[READ] event:", evt, details);
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
      // Merge finalize handling into event path to reduce useEffect count
      if (evt === "CARD_LOST") {
        if (
          phaseRef.current === "COMPLETED" &&
          !finalizingRef.current &&
          !navigationCommittedRef.current
        ) {
          void finalizeAfterCardRemoval();
        }
      }
    },
    [],
  );

  async function releaseAll(reason: string) {
    await releaseCard(cardRef);
    await releaseDevice(deviceRef);
    await releasePlatform(platformRef);
    setUi({
      platformInitialized: false,
      deviceAcquired: false,
      cardPresent: false,
      sessionActive: false,
    });
    setStatusText(`PLATFORM_RELEASED: ${reason}`);
    setPhase("IDLE");
  }
  function safeAbortFlow() {
    // Fire-and-forget release, don't block UI/navigation
    void releaseAll("abort");
    setDrawerVisible(false);
    setBasicInfo(null);
    rawBasicRef.current = null;
    setPhase("IDLE");
  }

  async function finalizeAfterCardRemoval() {
    if (finalizingRef.current || navigationCommittedRef.current) {
      console.log(
        "[READ] finalizeAfterCardRemoval skipped (finalizing or already committed)",
      );
      return;
    }
    finalizingRef.current = true;
    try {
      await releaseAll("finalize");
      setDrawerVisible(false);
      // Prepare params for show screen
      console.log("[READ] finalizeAfterCardRemoval", {
        hasRaw: Array.isArray(rawBasicRef.current)
          ? rawBasicRef.current.length
          : 0,
        hasInfo: !!basicInfo,
      });
      let params: RootStackParamList["MynaShow"] = {};
      if (
        Array.isArray(rawBasicRef.current) &&
        rawBasicRef.current.length > 0
      ) {
        // clone to ensure a plain array is passed
        params = { raw: rawBasicRef.current.slice() };
      } else if (basicInfo) {
        params = { info: basicInfo };
      }
      navigationCommittedRef.current = true;
      abortingRef.current = true;
      console.log("[READ] navigating to MynaShow with params:", params);
      navigation.replace("MynaShow", params);
    } finally {
      rawBasicRef.current = null;
      finalizingRef.current = false;
      setPhase("IDLE");
    }
  }
  const attachEventHandlers = useCallback(() => {
    const platform = platformRef.current;
    if (!platform) return [];
    const unsubs: Array<() => void> = [];

    // Buckets for Device/Card listeners so we can detach them cleanly
    const devUnsubs: Array<() => void> = [];
    const cardUnsubs: Array<() => void> = [];

    const attachDeviceListeners = () => {
      const dev = deviceRef.current;
      if (!dev) return;

      const onDev = (evt: string) => (payload: unknown) => {
        setUiByEvent(
          evt as PlatformEventType,
          (payload as PlatformEventPayload | undefined)?.details,
        );

        // Bridge to card listeners when session starts
        if (evt === "CARD_SESSION_STARTED") {
          attachCardListeners();
        }

        // Detach card listeners when card/session/device ends
        if (
          evt === "CARD_LOST" ||
          evt === "CARD_SESSION_RESET" ||
          evt === "DEVICE_RELEASED"
        ) {
          cardUnsubs.forEach((u) => {
            try {
              u();
            } catch (err) {
              console.error("[READ] card unsubscribe failed", err);
            }
          });
          cardUnsubs.length = 0;
          cardRef.current = null;
        }
      };

      const deviceEvents = [
        "CARD_FOUND",
        "CARD_LOST",
        "CARD_SESSION_STARTED",
        "CARD_SESSION_RESET",
        "DEVICE_RELEASED",
        "WAIT_TIMEOUT",
        "DEBUG_INFO",
      ] as const;

      deviceEvents.forEach((evt) => {
        devUnsubs.push(dev.on(evt, onDev(evt)));
      });

      // Ensure device listener cleanup is included in returned unsubs
      unsubs.push(() => {
        devUnsubs.forEach((u) => {
          try {
            u();
          } catch (err) {
            console.error("[READ] device unsubscribe failed", err);
          }
        });
        devUnsubs.length = 0;
      });
    };

    const attachCardListeners = () => {
      const card = cardRef.current;
      if (!card) return;

      const onCard = (evt: string) => (payload: unknown) => {
        setUiByEvent(
          evt as PlatformEventType,
          (payload as PlatformEventPayload | undefined)?.details,
        );
      };

      const cardEvents = ["CARD_LOST", "APDU_SENT", "APDU_FAILED"] as const;
      cardEvents.forEach((evt) => {
        cardUnsubs.push(card.on(evt, onCard(evt)));
      });

      // Ensure card listener cleanup is included in returned unsubs
      unsubs.push(() => {
        cardUnsubs.forEach((u) => {
          try {
            u();
          } catch (err) {
            console.error("[READ] card unsubscribe failed", err);
          }
        });
        cardUnsubs.length = 0;
      });
    };

    const onPlat =
      (evt: PlatformEventType) => (payload: PlatformEventPayload) => {
        setUiByEvent(evt, payload?.details);

        // When device/card lifecycle happens, attach respective listeners
        if (evt === "DEVICE_ACQUIRED") {
          attachDeviceListeners();
        }
        if (evt === "CARD_SESSION_STARTED") {
          attachCardListeners();
        }
        if (evt === "PLATFORM_RELEASED") {
          // Full cleanup on platform release
          devUnsubs.forEach((u) => {
            try {
              u();
            } catch (err) {
              console.error("[READ] device unsubscribe failed", err);
            }
          });
          devUnsubs.length = 0;
          cardUnsubs.forEach((u) => {
            try {
              u();
            } catch (err) {
              console.error("[READ] card unsubscribe failed", err);
            }
          });
          cardUnsubs.length = 0;
        }
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
      "DEBUG_INFO",
    ];
    events.forEach((evt) => {
      unsubs.push(platform.on(evt, onPlat(evt)));
    });
    return unsubs;
  }, [setUiByEvent]);

  // Clean up on blur/unmount
  useFocusEffect(
    useCallback(() => {
      // Register back/pop intercept while screen is focused
      const beforeRemoveSub = navigation.addListener("beforeRemove", (e) => {
        const action = (
          e as unknown as {
            data?: { action?: Parameters<typeof navigation.dispatch>[0] };
          }
        ).data?.action;
        if (abortingRef.current) {
          // Already aborting, allow default behavior
          return;
        }
        // Only intercept back/pop gestures, let programmatic navigations (e.g., replace) proceed
        const type = (action as { type?: string } | undefined)?.type;
        if (type !== "GO_BACK" && type !== "POP") {
          return;
        }
        e.preventDefault();
        abortingRef.current = true;
        // Abort and then proceed with the original back action to avoid recursion
        safeAbortFlow();
        if (action) {
          navigation.dispatch(action);
        }
      });

      // Cleanup on blur/unmount
      return () => {
        // remove listener
        beforeRemoveSub();
        // detach platform listeners and abort flow
        const unsubs = unsubsRef.current;
        unsubs.forEach((u) => u());
        unsubsRef.current = [];
        void safeAbortFlow();
      };
    }, [navigation]),
  );

  // Decode "63Cx" PIN retry status words into retry count
  const parsePinRetriesFromSw = (sw1: number, sw2: number): number | null => {
    const sw = (sw1 << 8) | sw2;
    // 0x63Cx => retries left in low nibble of SW2
    return (sw & 0xfff0) === 0x63c0 ? sw2 & 0x0f : null;
  };

  const runSequencelet = async (card: SmartCard, pinValue: string) => {
    // 1) Select Kenhojo AP
    {
      const sel = await card.transmit(selectDf(KENHOJO_AP));
      if (sel.sw1 !== 0x90 || sel.sw2 !== 0x00) {
        throw new Error(
          `SELECT AP failed: ${sel.sw1.toString(16)}/${sel.sw2.toString(16)}`,
        );
      }
    }

    // 2) Verify PIN (show retries left if applicable)
    {
      const rapdu = await card.transmit(
        verify(pinValue, { ef: KENHOJO_AP_EF.PIN }),
      );
      if (rapdu.sw1 !== 0x90 || rapdu.sw2 !== 0x00) {
        const retries = parsePinRetriesFromSw(rapdu.sw1, rapdu.sw2);
        if (retries !== null) {
          throw new Error(`PIN verification failed. 残り${retries}回`);
        }
        throw new Error(
          `PIN verification failed: ${rapdu.sw1.toString(16)}/${rapdu.sw2.toString(16)}`,
        );
      }
    }

    // 3) Read BASIC_FOUR
    {
      const rapdu = await card.transmit(
        readEfBinaryFull(KENHOJO_AP_EF.BASIC_FOUR),
      );
      if (rapdu.sw1 !== 0x90 || rapdu.sw2 !== 0x00) {
        throw new Error(
          `Read BASIC_FOUR failed: ${rapdu.sw1.toString(16)}/${rapdu.sw2.toString(16)}`,
        );
      }
      return rapdu.data;
    }
  };

  // Orchestrate the full flow via a single state-driven effect
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        switch (phase) {
          case "INITIALIZING": {
            try {
              const platform = new RnSmartCardPlatform();
              platformRef.current = platform;
              const unsubs = attachEventHandlers();
              unsubsRef.current = unsubs;

              try {
                await platform.init();
              } catch (e) {
                const msg = stringifyError(e).toLowerCase();
                if (msg.includes("already initialized")) {
                  try {
                    await platform.release();
                  } catch {
                    /* ignore */
                  }
                  await platform.init();
                } else {
                  throw e;
                }
              }
              setUiByEvent("PLATFORM_INITIALIZED");
              setDrawerVisible(true);
              if (cancelled) return;
              setPhase("ACQUIRING_DEVICE");
            } catch (e) {
              setStatusText(`init error: ${stringifyError(e)}`);
              setPhase("IDLE");
            }
            break;
          }
          case "ACQUIRING_DEVICE": {
            const platform = platformRef.current;
            if (!platform) {
              setPhase("IDLE");
              return;
            }
            try {
              const infos = await platform.getDeviceInfo();
              if (cancelled) return;
              if (infos.length === 0) {
                setStatusText("No NFC device available");
                setPhase("IDLE");
                return;
              }
              const dev = await platform.acquireDevice(infos[0]!.id);
              deviceRef.current = dev;
              setUiByEvent("DEVICE_ACQUIRED");
              if (cancelled) return;
              setPhase("WAITING_FOR_CARD");
            } catch (e) {
              setStatusText(`acquire error: ${stringifyError(e)}`);
              setPhase("IDLE");
            }
            break;
          }
          case "WAITING_FOR_CARD": {
            const dev = deviceRef.current;
            if (!dev) {
              setPhase("IDLE");
              return;
            }
            try {
              await dev.waitForCardPresence(WAIT_CARD_SECONDS);
              if (cancelled) return;
              setUiByEvent("CARD_FOUND");
              setPhase("STARTING_SESSION");
            } catch (e) {
              setUiByEvent("WAIT_TIMEOUT", stringifyError(e));
              setPhase("IDLE");
            }
            break;
          }
          case "STARTING_SESSION": {
            const dev = deviceRef.current;
            if (!dev) {
              setPhase("IDLE");
              return;
            }
            if (!ui.sessionActive && !cardRef.current) {
              try {
                const card = await dev.startSession();
                if (cancelled) return;
                cardRef.current = card;
                setUiByEvent("CARD_SESSION_STARTED");
              } catch (e) {
                setStatusText(`startSession() error: ${stringifyError(e)}`);
                setPhase("IDLE");
                return;
              }
            }
            setPhase("READING");
            break;
          }
          case "READING": {
            const card = cardRef.current;
            if (!card) {
              setPhase("IDLE");
              return;
            }
            try {
              const basicFourData = await runSequencelet(card, pin);
              console.log(
                "[READ] runSequencelet basicFourData:",
                basicFourData,
              );
              if (cancelled) return;
              rawBasicRef.current = Array.from(basicFourData);
              setPhaseSafe("COMPLETED");
            } catch (e) {
              setStatusText(`verify/read error: ${stringifyError(e)}`);
              setPhase("IDLE");
            }
            break;
          }
          default:
            break;
        }
      } catch {
        // swallow to keep flow resilient
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [phase, ui.sessionActive, pin, attachEventHandlers, setUiByEvent]);

  // Navigate after removal strictly when card is lost and the sequence finished.
  // This avoids calling navigation directly inside the event handler and prevents
  // duplicate transitions due to multiple CARD_LOST emissions.

  // Navigation waits for CARD_LOST; auto-fallback removed (reverted to original behavior).
  const handleReadStart = useCallback(async () => {
    console.log("[READ] handleReadStart invoked", {
      phase,
      drawerVisible,
    });
    // Ensure previous session (if any) is fully released and listeners removed
    const prevUnsubs = unsubsRef.current;
    prevUnsubs.forEach((u) => u());
    unsubsRef.current = [];
    await releaseCard(cardRef);
    await releaseDevice(deviceRef);
    await releasePlatform(platformRef);

    setDrawerVisible(true);
    setBasicInfo(null);
    rawBasicRef.current = null;
    navigationCommittedRef.current = false;
    finalizingRef.current = false;
    abortingRef.current = false;

    setPhase("INITIALIZING");
  }, [phase, drawerVisible]);

  // Derived UI flags (preserve screen behavior without changing styles)
  const reading =
    phase === "INITIALIZING" ||
    phase === "ACQUIRING_DEVICE" ||
    phase === "WAITING_FOR_CARD";
  const deviceAcquiring =
    phase === "INITIALIZING" || phase === "ACQUIRING_DEVICE";
  const cardReading = phase === "STARTING_SESSION" || phase === "READING";
  const sequenceDone = phase === "COMPLETED";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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
          onPress={() => {
            // Let beforeRemove handle abort; just go back once
            navigation.goBack();
          }}
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
            ) : !ui.deviceAcquired ? (
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

            <View style={{ marginTop: 16, alignItems: "center" }}>
              <Text style={{ color: "#6B7280", fontSize: 12 }}>
                {statusText}
              </Text>
            </View>
          </Animated.View>
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
});

export default MynaReadScreen;
