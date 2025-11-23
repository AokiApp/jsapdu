import { View, StyleSheet, Dimensions, StatusBar, Text } from "react-native";
import { useEffect, useState } from "react";
import { platformManager } from "@aokiapp/jsapdu-rn";

type LocalNfcAntennaInfo = {
  deviceSize: {
    width: number;
    height: number;
  };
  antennas: Array<{
    centerX: number;
    centerY: number;
    radius?: number;
  }>;
  formFactor: "bifold" | "trifold" | "phone" | "tablet" | null;
};

function isLocalNfcAntennaInfo(value: unknown): value is LocalNfcAntennaInfo {
  if (!value || typeof value !== "object") return false;
  const info = value as {
    deviceSize?: { width?: unknown; height?: unknown };
    antennas?: unknown;
    formFactor?: unknown;
  };
  const deviceSize = info.deviceSize;
  if (
    !deviceSize ||
    typeof deviceSize.width !== "number" ||
    typeof deviceSize.height !== "number"
  ) {
    return false;
  }
  if (!Array.isArray(info.antennas) || info.antennas.length === 0) {
    return false;
  }
  const [first] = info.antennas as Array<{
    centerX?: unknown;
    centerY?: unknown;
    radius?: unknown;
  }>;
  if (
    !first ||
    typeof first.centerX !== "number" ||
    typeof first.centerY !== "number"
  ) {
    return false;
  }
  return true;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function NfcAntennaDetailScreen() {
  const [antennaInfo, setAntennaInfo] = useState<LocalNfcAntennaInfo | null>(
    null,
  );

  useEffect(() => {
    const platform = platformManager.getPlatform();
    let cancelled = false;
    const load = async () => {
      try {
        await platform.init(true);
        const devices = await platform.getDeviceInfo();
        const primary = devices[0] as { antennaInfo?: unknown } | undefined;
        const info = primary?.antennaInfo;
        if (!cancelled && isLocalNfcAntennaInfo(info)) {
          setAntennaInfo(info);
        }
      } catch (e) {
        console.warn("[NfcAntennaDetail] antennaInfo load failed", e);
      }
    };
    void load();
    return () => {
      cancelled = true;
      void platform
        .release(true)
        .catch((e) =>
          console.warn("[NfcAntennaDetail] platform.release failed", e),
        );
    };
  }, []);

  // フォールバック値（mm）
  let deviceWidth = 70;
  let deviceHeight = 140;
  let centerX = deviceWidth / 2;
  let centerY = deviceHeight * 0.35;
  let radiusMm = Math.min(deviceWidth, deviceHeight) * 0.12;

  if (antennaInfo && antennaInfo.antennas.length > 0) {
    const dev = antennaInfo.deviceSize;
    const [ant] = antennaInfo.antennas;
    if (ant) {
      deviceWidth = dev.width;
      deviceHeight = dev.height;
      centerX = ant.centerX;
      centerY = ant.centerY;
      radiusMm = ant.radius ?? Math.min(deviceWidth, deviceHeight) * 0.12;
    }
  }

  // 画面全体をデバイス座標として使う（原点は左上、Yは下向きに増加）
  const scaleX = SCREEN_WIDTH / deviceWidth;
  const scaleY = SCREEN_HEIGHT / deviceHeight;

  const cx = centerX * scaleX;
  const cy = centerY * scaleY;
  const rPx = radiusMm * Math.min(scaleX, scaleY);

  // クロスヘア用の座標ラベル (中心座標, mm)
  const labelX = `${centerX.toFixed(1)} mm`; // 左端から
  const labelY = `${centerY.toFixed(1)} mm`; // 上端から

  // 端末サイズラベル
  const deviceWidthLabel = `${deviceWidth.toFixed(1)} mm`;
  const deviceHeightLabel = `${deviceHeight.toFixed(1)} mm`;

  // ラベル配置位置（px）
  const xLabelLeft = cx / 2 - 20;
  const xLabelTop = cy + 8;
  const yLabelLeft = cx + 8;
  const yLabelTop = cy / 2;

  const margin = 12;
  const spacing = 8; // より近接に
  const bubbleWidth = 128;
  const bubbleHeight = 32;

  let side: "right" | "left" | "top" = "right";
  let bLeft = cx + rPx + spacing;
  if (bLeft + bubbleWidth + margin > SCREEN_WIDTH) {
    const leftCandidate = cx - rPx - spacing - bubbleWidth;
    if (leftCandidate >= margin) {
      side = "left";
      bLeft = leftCandidate;
    } else {
      side = "top";
      bLeft = Math.min(
        Math.max(cx - bubbleWidth / 2, margin),
        SCREEN_WIDTH - bubbleWidth - margin,
      );
    }
  }
  let bTop: number;
  if (side === "right" || side === "left") {
    bTop = cy - bubbleHeight / 2;
    bTop = Math.min(
      Math.max(bTop, margin),
      SCREEN_HEIGHT - bubbleHeight - margin,
    );
  } else {
    bTop = cy - rPx - spacing - bubbleHeight - 4;
    if (bTop < margin) bTop = margin;
  }
  const bubbleLeft = Math.round(bLeft);
  const bubbleTop = Math.round(bTop);

  // しっぽの位置を中心座標に合わせて可変に
  function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
  }
  const tailTop = clamp(cy - bubbleTop - 5, 0, bubbleHeight - 10);
  const tailLeft = clamp(cx - bubbleLeft - 5, 0, bubbleWidth - 10);
  const bubbleTailPos: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  } =
    side === "right"
      ? { left: -5, top: tailTop }
      : side === "left"
        ? { right: -5, top: tailTop }
        : { left: tailLeft, bottom: -5 };

  // 円→吹き出しのガイドライン（左右配置時のみ）
  let guideLineStyle: { left: number; top: number; width: number } | null =
    null;
  if (side === "right") {
    const x1 = cx + rPx + 2;
    const x2 = bubbleLeft;
    const w = Math.max(0, x2 - x1 - 2);
    if (w > 0) guideLineStyle = { left: x1, top: cy - 1, width: w };
  } else if (side === "left") {
    const x1 = bubbleLeft + bubbleWidth;
    const x2 = cx - rPx - 2;
    const w = Math.max(0, x2 - x1 - 2);
    if (w > 0) guideLineStyle = { left: x1, top: cy - 1, width: w };
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden animated />
      <View style={styles.phoneFrame}>
        {/* アンテナ中心円 */}
        <View
          style={[
            styles.antennaCircle,
            {
              width: rPx * 2,
              height: rPx * 2,
              borderRadius: rPx,
              left: cx - rPx,
              top: cy - rPx,
            },
          ]}
        />

        {/* クロスヘア */}
        <View style={[styles.crossLineVertical, { left: cx }]} />
        <View style={[styles.crossLineHorizontal, { top: cy }]} />
        {guideLineStyle ? (
          <View style={[styles.guideLine, guideLineStyle]} />
        ) : null}

        {/* 座標ラベル */}
        <Text style={[styles.coordLabel, { left: xLabelLeft, top: xLabelTop }]}>
          {labelX}
        </Text>
        <Text style={[styles.coordLabel, { left: yLabelLeft, top: yLabelTop }]}>
          {labelY}
        </Text>

        {/* アンテナ吹き出し */}
        <View
          style={[
            styles.antennaBubble,
            {
              left: bubbleLeft,
              top: bubbleTop,
              width: bubbleWidth,
              height: bubbleHeight,
            },
          ]}
        >
          <Text style={styles.antennaBubbleText}>この裏にタッチ</Text>
          <View style={[styles.antennaBubbleTail, bubbleTailPos]} />
        </View>

        {/* 端末寸法ラベル */}
        <View style={styles.dimWidthContainer}>
          <Text style={styles.dimWidthLabel}>{deviceWidthLabel}</Text>
        </View>
        <View style={styles.dimHeightContainer}>
          <Text style={styles.dimHeightLabel}>{deviceHeightLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1115",
  },
  phoneFrame: {
    flex: 1,
    backgroundColor: "#111827",
    position: "relative",
    overflow: "hidden",
  },
  antennaCircle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#60A5FA",
    backgroundColor: "rgba(37,99,235,0.25)",
  },
  crossLineVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(249,250,251,0.4)",
  },
  crossLineHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(249,250,251,0.4)",
  },
  // 円→吹き出しガイドライン
  guideLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#60A5FA",
    borderRadius: 2,
  },
  // 座標ラベル共通
  coordLabel: {
    position: "absolute",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(15,17,21,0.9)",
    color: "#F9FAFB",
    fontSize: 10,
    fontWeight: "700",
  },
  // 吹き出し
  antennaBubble: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#2563EB", // 強い青で視認性UP
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  antennaBubbleText: {
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  antennaBubbleTail: {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#2563EB",
    transform: [{ rotate: "45deg" }],
  },
  // 端末寸法ラベル
  dimWidthContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: "center",
  },
  dimWidthLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(15,17,21,0.9)",
    color: "#F9FAFB",
    fontSize: 11,
    fontWeight: "700",
  },
  dimHeightContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  dimHeightLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(15,17,21,0.9)",
    color: "#F9FAFB",
    fontSize: 11,
    fontWeight: "700",
    transform: [{ rotate: "-90deg" }],
  },
});
