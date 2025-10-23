import React from "react";
import { Text, View, StyleSheet, SafeAreaView } from "react-native";
import NfcTestScreen from "./NfcTest";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>JSAPDU React Native</Text>
      </View>
      <NfcTestScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#2196F3",
    alignItems: "center",
  },
  headerText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
});
