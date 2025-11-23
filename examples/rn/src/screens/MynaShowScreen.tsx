import React, { useLayoutEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  useNavigation,
  useRoute,
  CommonActions,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../App";
import type { BasicFourInfo } from "../types/myna";
import { SchemaParser } from "@aokiapp/tlv/parser";
import { schemaKenhojoBasicFour } from "@aokiapp/mynacard";

const MynaShowScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "MynaShow">>();
  const route = useRoute<RouteProp<RootStackParamList, "MynaShow">>();
  const infoParam: BasicFourInfo | undefined = route.params?.info;
  const rawParam: number[] | undefined = (
    route.params as unknown as { raw?: number[] }
  ).raw;

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

  const info: BasicFourInfo | undefined = React.useMemo(() => {
    if (Array.isArray(rawParam)) {
      try {
        const bytes = new Uint8Array(rawParam);
        const parser = new SchemaParser(schemaKenhojoBasicFour);
        const v = parser.parse(bytes.buffer) as unknown;
        if (isParsedBasicFour(v)) {
          const offsets = Array.isArray(v.offsets)
            ? (v.offsets as unknown[]).filter(
                (x): x is number => typeof x === "number",
              )
            : [];
          return {
            name: v.name,
            address: v.address,
            birth: v.birth,
            gender: v.gender,
            offsets,
          };
        }
      } catch {
        // ignore parse errors
      }
    }
    return infoParam;
  }, [rawParam, infoParam]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "読み取り結果" });
  }, [navigation]);

  const [showDetails, setShowDetails] = useState(false);

  const formatBirth = (b: string | undefined): string => {
    if (!b) return "";
    const m = b.match(/(\d{4}).*?(\d{1,2}).*?(\d{1,2})/);
    if (m) {
      const y = m[1] ?? "";
      const mm = (m[2] ?? "").padStart(2, "0");
      const dd = (m[3] ?? "").padStart(2, "0");
      if (y && mm && dd) {
        return `${y}年${mm}月${dd}日`;
      }
    }
    return b;
  };

  const genderIcon = (g?: string): string => {
    if (!g) return "⚧";
    if (g.includes("1")) return "♂️";
    if (g.includes("2")) return "♀️";
    return "⚧";
  };

  const InfoRow: React.FC<{ label: string; value?: string; icon?: string }> = ({
    label,
    value,
    icon,
  }) => (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon ?? "🔷"}</Text>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value ?? "-"}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>読み取り結果</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ステータス: 読み取り完了</Text>
          </View>
          <Text style={styles.subText}>
            マイナンバーカードから取得した基本四情報を表示します。
          </Text>
        </View>

        {info ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>基本四情報</Text>
            <InfoRow label="氏名" value={info.name} icon="🧑" />
            <InfoRow label="住所" value={info.address} icon="🏠" />
            <InfoRow
              label="生年月日"
              value={formatBirth(info.birth)}
              icon="🎂"
            />
            <InfoRow
              label="性別"
              value={info.gender}
              icon={genderIcon(info.gender)}
            />

            {Array.isArray(info.offsets) && info.offsets.length > 0 && (
              <View style={styles.detailsSection}>
                <TouchableOpacity onPress={() => setShowDetails((s) => !s)}>
                  <Text style={styles.detailsToggle}>
                    {showDetails ? "詳細を隠す ▲" : "詳細を表示 ▼"}
                  </Text>
                </TouchableOpacity>
                {showDetails && (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsTitle}>Offsets</Text>
                    <Text style={styles.detailsText}>
                      {info.offsets.join(", ")}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>データが見つかりません</Text>
            <Text style={styles.emptyText}>
              読み取りからやり直してください。
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "MynaPin" }],
              }),
            )
          }
        >
          <Text style={styles.buttonText}>最初に戻る</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f4f8" },
  scrollContent: { padding: 20 },
  header: { marginBottom: 12, alignItems: "center" },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subText: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  badge: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowIcon: { fontSize: 18, marginRight: 10 },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 12, color: "#475569" },
  rowValue: { fontSize: 16, color: "#0f172a", fontWeight: "600", marginTop: 2 },
  detailsSection: { marginTop: 8 },
  detailsToggle: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  detailsBox: {
    marginTop: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  detailsTitle: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  detailsText: { fontSize: 12, color: "#334155" },
  emptyCard: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#f59e0b",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7c2d12",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: { fontSize: 13, color: "#7c2d12", textAlign: "center" },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default MynaShowScreen;
