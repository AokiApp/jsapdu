import { useState } from 'react';
import {
  Text,
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import NfcTestScreen from './NfcTest';
import MynaTest from './MynaTest';

export default function App() {
  const [screen, setScreen] = useState<'nfc' | 'myna'>('nfc');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>JSAPDU React Native</Text>
      </View>

      <View style={styles.switchRow}>
        <TouchableOpacity
          style={[
            styles.switchButton,
            screen === 'nfc' && styles.switchButtonActive,
          ]}
          onPress={() => setScreen('nfc')}
        >
          <Text
            style={[
              styles.switchButtonText,
              screen === 'nfc' && styles.switchButtonTextActive,
            ]}
          >
            NFC Test
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.switchButton,
            screen === 'myna' && styles.switchButtonActive,
          ]}
          onPress={() => setScreen('myna')}
        >
          <Text
            style={[
              styles.switchButtonText,
              screen === 'myna' && styles.switchButtonTextActive,
            ]}
          >
            Myna Test
          </Text>
        </TouchableOpacity>
      </View>

      {screen === 'nfc' ? <NfcTestScreen /> : <MynaTest />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  headerText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  switchButton: {
    marginHorizontal: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: 'white',
  },
  switchButtonActive: {
    backgroundColor: '#2196F3',
  },
  switchButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  switchButtonTextActive: {
    color: 'white',
  },
});
