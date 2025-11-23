/**
 * NFC Antenna Guide Screen
 *
 * Visual guide that uses the real NFC antenna API when available
 * (RnSmartCardPlatform.getDeviceInfo().antennaInfo) and falls back
 * to a generic diagram otherwise.
 */

import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RnSmartCardPlatform } from "@aokiapp/jsapdu-rn";
import type { RootStackParamList } from "../App";

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

const PHONE_WIDTH = 180;
const PHONE_HEIGHT = 320;

export default function NfcAntennaScreen() {
  const isIos = Platform.OS === "ios";
  const [antennaInfo, setAntennaInfo] =
    useState<LocalNfcAntennaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    const platform = new RnSmartCardPlatform();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // force=true で、他画面で既に初期化済みでも再初期化エラーにならないようにする
        await platform.init(true);
        const devices = await platform.getDeviceInfo();
        const primary = devices[0] as { antennaInfo?: unknown } | undefined;
        const info = primary?.antennaInfo;

        if (!isLocalNfcAntennaInfo(info)) {
          if (!cancelled) {
            setError("この端末からはアンテナ位置情報が提供されていません。");
          }
          return;
        }

        if (!cancelled) {
          setAntennaInfo(info);
        }
      } catch (e) {
        console.error("[NfcAntennaScreen] Failed to load antenna info", e);
        if (!cancelled) {
          setError("アンテナ情報の取得に失敗しました。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      void platform
        .release(true)
        .catch((e) =>
          console.warn("[NfcAntennaScreen] platform.release failed", e)
        );
    };
  }, []);

  const handleOpenDetail = () => {
    navigation.navigate("NfcAntennaDetail");
  };

  // アンテナ描画用の座標を決定（mm -> px スケーリング）
  const antennaCircleStyle = (() => {
    if (antennaInfo && antennaInfo.antennas.length > 0) {
      const dev = antennaInfo.deviceSize;
      const [ant] = antennaInfo.antennas;

      if (!ant) {
        // 念のためのフォールバック（中央付近）
        const fallbackSize = 80;
        return {
          width: fallbackSize,
          height: fallbackSize,
          borderRadius: fallbackSize / 2,
          left: (PHONE_WIDTH - fallbackSize) / 2,
          top: (PHONE_HEIGHT - fallbackSize) / 2,
        };
      }

      // デバイス実寸(mm)を端末枠サイズ(px)にフィットさせる
      const scaleX = PHONE_WIDTH / dev.width;
      const scaleY = PHONE_HEIGHT / dev.height;

      // 半径は API に radius があれば使い、なければ固定値
      const radiusMm = ant.radius ?? Math.min(dev.width, dev.height) * 0.12;
      const radiusPx = radiusMm * Math.min(scaleX, scaleY);

      const centerXpx = ant.centerX * scaleX;
      const centerYpx = ant.centerY * scaleY;

      return {
        width: radiusPx * 2,
        height: radiusPx * 2,
        borderRadius: radiusPx,
        left: centerXpx - radiusPx,
        top: centerYpx - radiusPx,
      };
    }

    // アンテナ情報がない場合のフォールバック（中央付近に固定）
    const fallbackSize = 80;
    return {
      width: fallbackSize,
      height: fallbackSize,
      borderRadius: fallbackSize / 2,
      left: (PHONE_WIDTH - fallbackSize) / 2,
      top: (PHONE_HEIGHT - fallbackSize) / 2,
    };
  })();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>NFCアンテナの位置</Text>
      <Text style={styles.subtitle}>
        対応端末では OS のアンテナ情報 API から実アンテナ位置を取得して表示します。
        未対応端末では一般的な位置の参考図を表示します。
      </Text>

      {loading && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.statusText}>アンテナ情報を取得しています…</Text>
        </View>
      )}

      {!loading && antennaInfo && (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            実デバイス情報:{" "}
            {Math.round(antennaInfo.deviceSize.width)}mm ×{" "}
            {Math.round(antennaInfo.deviceSize.height)}mm / アンテナ数{" "}
            {antennaInfo.antennas.length} / 形状{" "}
            {antennaInfo.formFactor ?? "unknown"}
          </Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, styles.statusError]}>{error}</Text>
        </View>
      )}

      <View style={styles.phoneBlock}>
        <Text style={styles.phoneLabel}>
          {isIos ? "iPhone（参考イメージ）" : "Android（参考イメージ）"}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleOpenDetail}
        >
          <View style={styles.phoneOuter}>
            <View style={[styles.antennaAreaBase, antennaCircleStyle]} />
          </View>
        </Pressable>
        <Text style={styles.phoneHint}>
          端末背面の
          {isIos ? "上部付近" : "中央〜上部付近"}
          にカードを近づけてください。
        </Text>
      </View>

      <View style={styles.notes}>
        <Text style={styles.noteTitle}>注意事項</Text>
        <Text style={styles.noteItem}>
          • 実際のアンテナ位置はメーカーや機種によって異なります。
        </Text>
        <Text style={styles.noteItem}>
          • 読み取りに失敗する場合は、カードの位置を少しずつ動かしてみてください。
        </Text>
        <Text style={styles.noteItem}>
          • ケースや金属プレートがあると読み取りに影響することがあります。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 12,
  },
  statusRow: {
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: "#4B5563",
  },
  statusError: {
    color: "#DC2626",
  },
  phoneBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  phoneLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  phoneOuter: {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#9CA3AF",
    backgroundColor: "#F9FAFB",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  antennaAreaBase: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "#2563EB",
    backgroundColor: "rgba(37,99,235,0.1)",
  },
  phoneHint: {
    marginTop: 12,
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  notes: {
    alignSelf: "stretch",
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  noteItem: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
});