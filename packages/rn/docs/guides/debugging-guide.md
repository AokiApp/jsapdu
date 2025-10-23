# デバッグ・トラブルシューティングガイド

## 🐛 よくある問題と解決方法

### 1. 初期化・設定関連

#### ❌ "NFC not supported"
```
Error: NFC not supported
    at JsapduRn.initPlatform
```

**原因と対策:**
- **エミュレータを使用している** → 実機で確認
- **NFC機能がオフ** → Android設定でNFCを有効化
- **非NFC端末** → NFC対応端末で確認
- **権限不足** → AndroidManifest.xmlを確認

**確認コマンド:**
```bash
# NFCアダプタの確認
adb shell dumpsys nfc
```

#### ❌ "Already initialized"
```
Error: Already initialized
```

**対策:**
```typescript
// 二重初期化を防ぐ
let isInitialized = false;

if (!isInitialized) {
  await SmartCardPlatform.init();
  isInitialized = true;
}
```

### 2. ビルド・コンパイル関連

#### ❌ Nitro生成ファイルが見つからない
```
Error: Could not find nitrogen/generated/android/...
```

**対策:**
```bash
# 1. 生成ファイルのクリア
rm -rf nitrogen/generated/

# 2. 再生成
npx nitrogen

# 3. Android側のクリーンビルド
cd android && ./gradlew clean && cd ..
```

#### ❌ JNI/JSIバインディングエラー
```
java.lang.UnsatisfiedLinkError: No implementation found for...
```

**対策:**
```bash
# 1. C++アダプタの確認
ls packages/rn/android/src/main/cpp/cpp-adapter.cpp

# 2. CMakeLists.txtの確認
cat packages/rn/android/CMakeLists.txt

# 3. 完全再ビルド
npx react-native clean
cd android && ./gradlew clean && cd ..
npx react-native run-android
```

### 3. NFC通信関連

#### ❌ "Card not present"
```
Error: Card not present
```

**デバッグ手順:**
```typescript
// 1. デバイス状態の確認
const isAvailable = await device.isDeviceAvailable();
console.log('Device available:', isAvailable);

// 2. カード検出状態の確認
const isPresent = await device.isCardPresent();
console.log('Card present:', isPresent);

// 3. タイムアウトを長めに設定
await device.waitForCardPresence(30000); // 30秒
```

#### ❌ "Platform error" during transmit
```
Error: Platform error - NFC I/O通信に失敗しました
```

**原因と対策:**
- **カードが離れた** → カードを再度タッチ
- **APDU長が制限超過** → コマンド長を確認
- **セッションタイムアウト** → セッション再開

```typescript
try {
  const response = await card.transmit(apdu);
} catch (error) {
  if (error.code === 'PLATFORM_ERROR') {
    console.log('Card removed or I/O error');
    // セッション再確立
    await card.reset();
    // 再試行
    const response = await card.transmit(apdu);
  }
}
```

## 🔍 デバッグツール・コマンド

### Android NFCログ確認
```bash
# NFC関連のログをフィルタ
adb logcat | grep -i nfc

# Nitroモジュール関連のログ
adb logcat | grep -i nitro

# アプリ固有のログ (タグ指定)
adb logcat -s YourAppTag

# エラーレベルのみ表示
adb logcat *:E
```

### NFC機能の詳細確認
```bash
# NFCサービス状態
adb shell dumpsys nfc

# ReaderMode状態の確認
adb shell dumpsys activity | grep -i reader

# 権限確認
adb shell dumpsys package your.app.package | grep -i nfc
```

### 実機での詳細デバッグ
```typescript
// デバッグ情報を出力する関数
export function enableDebugLogging() {
  const originalTransmit = SmartCard.prototype.transmit;
  
  SmartCard.prototype.transmit = async function(apdu: ArrayBuffer) {
    const cmd = Array.from(new Uint8Array(apdu));
    console.log('APDU Command:', cmd.map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    try {
      const response = await originalTransmit.call(this, apdu);
      const data = Array.from(new Uint8Array(response.data));
      console.log('APDU Response:', 
        data.map(b => b.toString(16).padStart(2, '0')).join(' '),
        `SW: ${response.sw1.toString(16)}${response.sw2.toString(16)}`
      );
      return response;
    } catch (error) {
      console.error('APDU Error:', error);
      throw error;
    }
  };
}
```

## 🧪 ユニットテスト・統合テスト

### Jest設定例
```javascript
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/test-setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/android/',
    '<rootDir>/ios/'
  ]
};
```

### モック設定
```typescript
// __mocks__/@aokiapp/jsapdu-rn.ts
export class SmartCardPlatform {
  static async init(): Promise<void> {
    console.log('Mock: Platform initialized');
  }

  static async getDeviceInfo(): Promise<any[]> {
    return [{
      id: 'mock-nfc-0',
      supportsApdu: true,
      apduApi: ['nfc', 'mock']
    }];
  }
}

export class SmartCard {
  async transmit(apdu: ArrayBuffer): Promise<any> {
    // SELECT応答のモック
    return {
      data: new ArrayBuffer(0),
      sw1: 0x90,
      sw2: 0x00
    };
  }
}
```

### 統合テスト例
```typescript
// __tests__/nfc-integration.test.ts
describe('NFC Integration Test', () => {
  beforeEach(async () => {
    await SmartCardPlatform.init();
  });

  afterEach(async () => {
    await SmartCardPlatform.release();
  });

  test('should detect NFC device', async () => {
    const devices = await SmartCardPlatform.getDeviceInfo();
    expect(devices).toHaveLength(1);
    expect(devices[0].supportsApdu).toBe(true);
  });

  test('should handle card communication', async () => {
    const device = await SmartCardPlatform.acquireDevice('integrated-nfc-0');
    
    // この部分は実際のカードが必要
    // CIでは自動スキップされるべき
    if (process.env.CI) {
      return;
    }

    await device.waitForCardPresence(5000);
    const card = await device.startSession();
    
    const atr = await card.getAtr();
    expect(atr).toBeInstanceOf(ArrayBuffer);
    expect(atr.byteLength).toBeGreaterThan(0);
  });
});
```

## 🎯 パフォーマンス監視

### レスポンス時間の測定
```typescript
export class PerformanceMonitor {
  static async measureOperation<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;
      console.log(`${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${name} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}

// 使用例
const response = await PerformanceMonitor.measureOperation(
  'APDU Transmit',
  () => card.transmit(selectCommand)
);
```

### メモリリーク検出
```typescript
// 長時間テスト用
export async function memoryLeakTest(iterations: number = 1000) {
  for (let i = 0; i < iterations; i++) {
    try {
      await SmartCardPlatform.init();
      const devices = await SmartCardPlatform.getDeviceInfo();
      await SmartCardPlatform.release();
      
      if (i % 100 === 0) {
        // ガベージコレクション強制実行
        if (global.gc) {
          global.gc();
        }
        console.log(`Iteration ${i}, Memory usage:`, process.memoryUsage());
      }
    } catch (error) {
      console.error(`Error at iteration ${i}:`, error);
      break;
    }
  }
}
```

## 🚨 本番環境での監視

### エラー追跡設定
```typescript
import crashlytics from '@react-native-firebase/crashlytics';

// NFCエラーの自動報告
export function setupNfcErrorTracking() {
  const originalError = console.error;
  console.error = (...args) => {
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('NFC') || arg.includes('SmartCard'))
    )) {
      crashlytics().recordError(new Error(args.join(' ')));
    }
    originalError(...args);
  };
}
```

### ユーザビリティ監視
```typescript
export class NfcUsabilityMetrics {
  static trackCardDetectionTime(startTime: number) {
    const detectionTime = Date.now() - startTime;
    // Analytics送信
    analytics().logEvent('nfc_card_detection_time', {
      duration_ms: detectionTime
    });
  }

  static trackApduSuccess(commandType: string) {
    analytics().logEvent('nfc_apdu_success', {
      command_type: commandType
    });
  }

  static trackApduFailure(commandType: string, errorCode: string) {
    analytics().logEvent('nfc_apdu_failure', {
      command_type: commandType,
      error_code: errorCode
    });
  }
}
```

## 📝 ログ設定のベストプラクティス

### 製品版でのログ制御
```typescript
const isDevelopment = __DEV__;

export function logNfc(level: 'info' | 'warn' | 'error', ...args: any[]) {
  if (!isDevelopment && level === 'info') {
    return; // 本番では詳細ログを抑制
  }
  
  const timestamp = new Date().toISOString();
  console[level](`[NFC ${timestamp}]`, ...args);
}

// APDU内容は開発時のみ
export function logApdu(command: ArrayBuffer, response?: any) {
  if (!isDevelopment) return;
  
  const cmd = Array.from(new Uint8Array(command));
  logNfc('info', 'APDU Command:', 
    cmd.map(b => b.toString(16).padStart(2, '0')).join(' ')
  );
  
  if (response) {
    logNfc('info', 'APDU Response:', response);
  }
}
```

---

このガイドを参考に、段階的にデバッグを進めることで、NFCライブラリの実装における問題を効率的に解決できます。