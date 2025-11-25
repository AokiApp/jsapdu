/**
 * Feature menu
 *
 * A simple, polished menu to navigate to different feature test screens.
 * Keep logic minimal – only navigation.
 */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* React 19 automatic JSX runtime: default import not required */
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

type MenuRoute = "NfcAntenna" | "SmartCardTest" | "MynaPin";

type MenuItem = {
  key: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  route: MenuRoute;
};

const ITEMS: MenuItem[] = [
  {
    key: "nfc-antenna",
    title: "NFC Antenna Guide",
    subtitle: "Where to place your card on the device",
    emoji: "📡",
    route: "NfcAntenna",
  },
  {
    key: "smartcard",
    title: "Smart Card Test",
    subtitle: "Multi-device smart card tester (NFC, OMAPI...)",
    emoji: "🧾",
    route: "SmartCardTest",
  },
  {
    key: "myna",
    title: "Myna Test",
    subtitle: "My Number Card flow",
    emoji: "💳",
    route: "MynaPin",
  },
];

export default function MenuScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Feature Menu</Text>
          <Text style={styles.subtitle}>Choose a test to run</Text>
        </View>

        <View style={styles.list}>
          {ITEMS.map((i) => (
            <Pressable
              key={i.key}
              accessibilityRole="button"
              accessibilityLabel={`${i.title}. ${i.subtitle ?? ""}`}
              android_ripple={{ color: "rgba(79,70,229,0.12)" }}
              onPress={() =>
                navigation.navigate({ name: i.route, params: undefined })
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              testID={`menu-item-${i.key}`}
            >
              <View style={styles.cardInner}>
                <Text style={styles.emoji}>{i.emoji ?? "•"}</Text>
                <View style={styles.texts}>
                  <Text style={styles.itemTitle}>{i.title}</Text>
                  {i.subtitle ? (
                    <Text style={styles.itemSubtitle}>{i.subtitle}</Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7FB",
  },
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
  },
  list: {
    marginTop: 8,
    gap: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: Platform.OS === "ios" ? StyleSheet.hairlineWidth : 0,
    borderColor: "rgba(17, 24, 39, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  emoji: {
    fontSize: 22,
    marginRight: 12,
  },
  texts: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  itemSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#6B7280",
  },
  chevron: {
    marginLeft: 8,
    fontSize: 24,
    color: "#9CA3AF",
    lineHeight: 24,
  },
});
