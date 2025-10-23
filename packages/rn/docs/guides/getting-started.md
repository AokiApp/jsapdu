# 実装環境セットアップガイド

**📋 注意**: このガイドは環境準備のみです。実装内容の詳細は以下を参照してください：
- **実装手順の詳細**: [implementer-checklists.md](../implementer-checklists.md)
- **5分クイックガイド**: [index.md](../index.md)
- **技術要求事項**: [my-requests.md](../my-requests.md)

---

## 📚 初見実装者向け学習パス

### Step 0: プロジェクト理解 (10分)
**まずこれらを読んで全体像を把握:**
1. [技術要求事項](../my-requests.md) - 何を作るか・なぜ作るか
2. [5分クイックガイド](../index.md) - 実装内容の要点整理
3. [Nitro Modules概要](../nitro-modules-guide.md) - 使用技術の理解

### Step 1: 環境準備 (15分)

#### 必須環境
- **Node.js 18+** + **npm/yarn**
- **React Native CLI**: `npm install -g @react-native-community/cli`
- **Android Studio** (SDK 24-34)
- **実機**: NFC対応Android端末 (エミュレータ不可)

#### 依存関係インストール
```bash
# プロジェクトルートで
npm install react-native-nitro-modules@0.31.1 --save
npm install nitrogen@0.31.1 --save-dev
npm install react-native@0.74+ --save
npm install @react-native-community/cli@latest --save-dev
npm install typescript@5+ @types/react-native --save-dev
```

#### Nitroコード生成
```bash
cd packages/rn
npx nitrogen  # Nitro Modulesのコード生成
ls -la nitrogen/generated/  # android/, ios/, shared/ 確認
```

### Step 2: 実装方針の確認 (5分)
**次に進む前に必読:**
- [実装者チェックリスト](../implementer-checklists.md) - **最重要**
- [API契約仕様](../tsd/api-contract.md) - 実装すべきインターフェース
- Context7 - ライブラリの使い方等を知ることができるMCP。これをコールすると非常に有益、というかコールしろ。

---

## 🎯 **この後の実装手順**

環境準備が完了したら、**既存の体系的ドキュメントに従って実装してください:**

### 📋 推奨実装順序
1. **[implementer-checklists.md](../implementer-checklists.md)** - 実装チェックリスト（単一情報源）
2. **[api-contract.md](../tsd/api-contract.md)** - 公開API契約の詳細
3. **[android-nfc-tsd.md](../tsd/android-nfc-tsd.md)** - 技術仕様・制約
4. 必要に応じて：**[android-nfc-ddd.md](../ddd/android-nfc-ddd.md)**, **[android-nfc-rdd.md](../rdd/android-nfc-rdd.md)**

### 🔗 補完情報
- **検証方法**: [verification-guide.md](./verification-guide.md)
- **アーキテクチャ方針**: [implementation-architecture.md](./implementation-architecture.md)
- **実装例参考**: [examples/](./examples/)

---

**⚠️ 重要**: このguides/ディレクトリは既存ドキュメント体系の**補完**です。メインの実装指針は既存ドキュメントを参照してください。

## 🏗️ Step 3: 複数ファイル実装アーキテクチャ

### 実装方針の明確化
**重要**: 以下の2つのアプローチから選択してください：

#### アプローチA: 複数ファイル分散方式 (推奨・プロダクション向け)
- **JS側**: インターフェース・エクスポート・実装クラスを適切に分離
- **Kotlin側**: Platform/Device/Card別クラス分離
- **利点**: 責務分離、保守性向上、テスト容易性、拡張性

#### アプローチB: 単一ファイル集約方式 (プロトタイプ・学習向け)
- **JS側**: すべての実装を `src/index.tsx` に集約
- **Kotlin側**: すべての実装を `JsapduRn.kt` に集約
- **利点**: 初期開発の高速化、シンプルな構造

**このガイドではアプローチAを選択** (プロダクション品質・保守性重視)

アプローチBを採用する際には、上司に必ず相談してください。

> **Warning**: すなわち、基本的にindex.tsしかない、とかJsapduRnModule.ktしかない、みたいな状況になったらそれは事故レベルであり、即座に上司に報告してください、ということです。

### 3-1: TypeScript 側実装方針

**実装すべきファイル構成:**
- `packages/rn/src/JsapduRn.nitro.ts` - Nitroインターフェース定義
- `packages/rn/src/index.tsx` - 実装クラス・エクスポート

**実装指針:**
- HybridObject継承でNitro Modulesと連携
- DeviceInfo、ResponseApdu等のインターフェース定義
- SmartCardPlatform/Device/Cardクラスの実装
- エラーハンドリングと状態管理
- 型安全性の確保

**参照すべき仕様:**
- [SmartCardPlatform](packages/interface/src/abstracts.ts:17)
- [SmartCardDevice](packages/interface/src/abstracts.ts:202)
- [SmartCard](packages/interface/src/abstracts.ts:283)

### 3-2: Kotlin 側実装方針

**実装すべきファイル構成:**
- `packages/rn/android/.../JsapduRn.kt` - Nitroエントリーポイント
- `packages/rn/android/.../SmartCardManagers.kt` - ヘルパークラス群

**実装指針:**
- @DoNotStrip アノテーション必須
- HybridJsapduRnSpec継承
- Promise.async による非同期処理
- Platform/Device/Card管理クラス分離
- NfcAdapter/IsoDep/Tag の適切な使用

**重要な実装要件:**
- ReaderMode フラグ: NFC_A | NFC_B | NFC_F | SKIP_NDEF
- ATR取得順序: Historical Bytes → HiLayerResponse
- エラー正規化: SmartCardError コード体系準拠
- UI Thread回避: すべてのI/Oを非同期実行

## 🔨 Step 4: ビルド設定とコンパイル

### 4-1: Android Gradle設定
`packages/rn/android/build.gradle`:
```gradle
apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

// Nitro生成ファイルの適用 (重要)
apply from: '../nitrogen/generated/android/aokiapp_jsapdurn+autolinking.gradle'

android {
    compileSdk 34
    
    defaultConfig {
        minSdk 24
        targetSdk 34
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_11
        targetCompatibility JavaVersion.VERSION_11
    }
    
    kotlinOptions {
        jvmTarget = '11'
    }
}

dependencies {
    implementation 'com.facebook.react:react-native:+'
    implementation 'com.margelo.nitro:react-native-nitro-modules:0.31.1'
}
```

### 4-2: CMake設定 (JNI用)
`packages/rn/android/CMakeLists.txt`:
```cmake
cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE ON)
set(CMAKE_CXX_STANDARD 20)

add_library(aokiapp_jsapdurn SHARED
  src/main/cpp/cpp-adapter.cpp
)

# Nitro生成ファイルを含める
include(../nitrogen/generated/android/aokiapp_jsapdurn+autolinking.cmake)
```

### 4-3: C++ JNIアダプタ
`packages/rn/android/src/main/cpp/cpp-adapter.cpp`:
```cpp
#include <jni.h>
#include "aokiapp_jsapdurnOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::aokiapp_jsapdurn::initialize(vm);
}
```

## 🚀 Step 5: ビルドとテスト実行

### 5-1: ライブラリビルド
```bash
# プロジェクトルートで
cd packages/rn

# 1. TypeScript型チェック
npx tsc --noEmit

# 2. Nitro再生成 (変更後)
npx nitrogen

# 3. Androidライブラリのビルド
cd android
./gradlew clean
./gradlew assembleDebug

# 4. ビルド成功確認
ls -la build/outputs/aar/
# 期待する出力: android-debug.aar ファイル
```

### 5-2: テストアプリのセットアップ
```bash
# exampleアプリでテスト
cd examples/rn

# 1. 依存関係の完全インストール
npm install

# 2. Android依存関係の同期
cd android
./gradlew clean

# 3. Metro bundlerの起動 (別ターミナル)
cd ..
npx react-native start

# 4. Android実機でのビルド・実行 (別ターミナル)
npx react-native run-android --variant=debug

# 5. ログ監視 (別ターミナル)
adb logcat | grep -E "(nfc|nitro|jsapdu|ERROR)"
```

### 5-3: 段階的動作確認
```bash
# 1. アプリが起動することを確認
# 2. Metro bundlerにエラーが出ないことを確認
# 3. Android Logcatでクラッシュがないことを確認

# デバッグログの確認
adb logcat | grep -i "JsapduRn"
```

## 📄 Step 6: AndroidManifest設定

### 6-1: ライブラリ側マニフェスト (最小限)
`packages/rn/android/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <!-- ライブラリ側では権限宣言なし (ホストアプリに委任) -->
</manifest>
```

### 6-2: テストアプリ側マニフェスト (完全版)
`examples/rn/android/app/src/main/AndroidManifest.xml`:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <!-- NFC権限 -->
  <uses-permission android:name="android.permission.NFC" />
  <uses-feature
    android:name="android.hardware.nfc"
    android:required="false" />
  
  <application
    android:name=".MainApplication"
    android:label="@string/app_name"
    android:theme="@style/AppTheme">
    
    <activity
      android:name=".MainActivity"
      android:exported="true"
      android:launchMode="singleTask">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

## 🧪 Step 7: 基本的な動作確認

### 7-1: テストコンポーネントの作成
`examples/rn/src/App.tsx`:
```typescript
import React, { useState } from 'react';
import {
  View,
  Button,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SmartCardPlatform } from '@aokiapp/jsapdu-rn';

export default function App() {
  const [status, setStatus] = useState('未初期化');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `${timestamp}: ${message}`;
    setResults(prev => [logMessage, ...prev.slice(0, 9)]);
    console.log(logMessage);
  };

  const testNfcBasic = async () => {
    setIsLoading(true);
    setResults([]);
    
    try {
      addLog('=== NFC基本テスト開始 ===');
      
      // Step 1: プラットフォーム初期化
      setStatus('初期化中...');
      await SmartCardPlatform.init();
      addLog('✅ プラットフォーム初期化完了');
      setStatus('初期化完了');
      
      // Step 2: デバイス情報取得
      setStatus('デバイス検索中...');
      const devices = await SmartCardPlatform.getDeviceInfo();
      addLog(`✅ デバイス検出: ${devices.length}件`);
      
      if (devices.length === 0) {
        throw new Error('NFCデバイスが見つかりません');
      }
      
      const device = devices[0];
      addLog(`デバイスID: ${device.id}`);
      addLog(`APDU API: ${device.apduApi.join(', ')}`);
      
      // Step 3: デバイス取得
      setStatus('デバイス取得中...');
      const smartCardDevice = await SmartCardPlatform.acquireDevice(device.id);
      addLog('✅ デバイス取得完了');
      
      // Step 4: カード待機
      setStatus('カード待機中... (15秒)');
      Alert.alert(
        'NFCカード待機',
        'カードをスマートフォンの背面にタッチしてください\n(15秒でタイムアウト)',
        [{ text: 'OK' }]
      );
      
      await smartCardDevice.waitForCardPresence(15000);
      addLog('✅ カード検出');
      setStatus('カード検出');
      
      // Step 5: セッション開始
      setStatus('セッション開始中...');
      const card = await smartCardDevice.startSession();
      addLog('✅ セッション開始');
      
      // Step 6: ATR取得
      setStatus('ATR取得中...');
      const atr = await card.getAtr();
      const atrHex = Array.from(new Uint8Array(atr))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ').toUpperCase();
      
      addLog(`✅ ATR取得: ${atrHex}`);
      setStatus(`ATR: ${atrHex}`);
      
      // 成功通知
      Alert.alert(
        'テスト成功',
        `NFCカードの読み取りに成功しました\n\nATR: ${atrHex}`,
        [{ text: 'OK' }]
      );
      
      // Step 7: クリーンアップ
      await card.release();
      await smartCardDevice.release();
      addLog('✅ リソース解放完了');
      
    } catch (error) {
      const errorMessage = error.message || String(error);
      addLog(`❌ エラー: ${errorMessage}`);
      setStatus(`エラー: ${errorMessage}`);
      
      Alert.alert('エラー', errorMessage);
    } finally {
      try {
        await SmartCardPlatform.release();
        addLog('✅ プラットフォーム解放');
      } catch (e) {
        addLog(`⚠️ 解放エラー: ${e.message}`);
      }
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>NFC テストアプリ</Text>
      
      <View style={styles.statusSection}>
        <Text style={styles.statusLabel}>現在の状況:</Text>
        <Text style={styles.statusText}>{status}</Text>
        {isLoading && <ActivityIndicator size="small" color="#0066cc" />}
      </View>
      
      <View style={styles.buttonSection}>
        <Button
          title={isLoading ? "テスト実行中..." : "NFC基本テスト開始"}
          onPress={testNfcBasic}
          disabled={isLoading}
        />
      </View>
      
      <View style={styles.logSection}>
        <Text style={styles.logTitle}>実行ログ:</Text>
        {results.length === 0 ? (
          <Text style={styles.emptyLog}>ログはありません</Text>
        ) : (
          results.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  statusSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  buttonSection: {
    marginBottom: 16,
  },
  logSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  logText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  emptyLog: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
```

### 7-2: 動作確認チェックリスト

**✅ 必須確認項目:**
1. アプリが起動する
2. 「NFC基本テスト開始」ボタンをタップできる
3. 初期化が完了する（「初期化完了」表示）
4. デバイス検出が成功する（1件検出される）
5. カード待機状態になる
6. NFCカードタッチでATRが取得できる

**🔍 エラー時の確認項目:**
- AndroidManifestの権限設定
- 実機のNFC機能ON/OFF
- adbログでのエラー詳細

## 🔧 トラブルシューティング

### よくあるエラー

1. **"NFC not supported"**
   - エミュレータではなく実機で確認
   - AndroidManifestの権限設定を確認

2. **"Not initialized"**
   - init()を最初に呼び出す
   - 二重初期化していないか確認

3. **ビルドエラー**
   - `npx nitrogen`でコード再生成
   - `cd android && ./gradlew clean`で再ビルド

### デバッグ方法
```bash
# Androidログ確認
adb logcat | grep -i nfc

# Nitroモジュールログ
adb logcat | grep -i nitro
```

## 📚 次のステップ

1. [詳細実装ガイド](./step-by-step-implementation.md) - 各メソッドの詳細実装
2. [エラーハンドリング](../api/error-handling.md) - 例外処理の詳細
3. [デバッグガイド](./debugging-guide.md) - トラブルシューティング
4. [サンプルアプリ](./examples/) - 実用的な使用例

---
**実装完了の目安**: 上記コードでNFCカードを検出し、ATRが取得できること