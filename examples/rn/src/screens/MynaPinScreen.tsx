import React, { useLayoutEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../App";

const MynaPinScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "MynaPin">>();
  const [pin, setPin] = useState("");

  useLayoutEffect(() => {
    navigation.setOptions({ title: "PIN 入力" });
  }, [navigation]);

  const onChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "");
    setPin(digits.slice(0, 4));
  };

  const goNext = () => {
    if (pin.length === 4) {
      navigation.navigate("MynaRead", { pin });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
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
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: { backgroundColor: "#ccc" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});

export default MynaPinScreen;