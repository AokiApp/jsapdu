# 実装検証・動作確認ガイド

**📋 注意**: このガイドは検証手順の補完です。**実装内容の詳細・受入基準**は以下を参照：
- **受入基準の詳細**: [implementer-checklists.md](../implementer-checklists.md) - 各コンポーネントの受入基準
- **性能要件**: [android-nfc-tsd.md](../tsd/android-nfc-tsd.md) - 時間制約・性能基準
- **テスト計画**: [rdd/test-plan.md](../rdd/test-plan.md) - 包括的テスト戦略

---

## 🎯 このガイドの位置づけ

**既存の品質管理体系を補完**する実践的検証手順を提供します：
- **既存**: [implementer-checklists.md](../implementer-checklists.md) の受入基準（何を満たすべきか）
- **このガイド**: 受入基準を満たしているかの**確認方法**（どう検証するか）

### 検証レベルと既存仕様との対応
1. **ビルド検証** → [android-nfc-tsd.md](../tsd/android-nfc-tsd.md) の環境要件確認
2. **単体検証** → [api-contract.md](../tsd/api-contract.md) の各メソッド契約確認
3. **統合検証** → [implementer-checklists.md](../implementer-checklists.md) の受入基準確認
4. **性能検証** → [performance-metrics.md](../rdd/performance-metrics.md) の基準確認
5. **堅牢性検証** → [api-contract.md](../tsd/api-contract.md) のエラー写像確認

---

## 🔨 レベル1: ビルド検証

### 1-1: TypeScript コンパイル検証
```bash
cd packages/rn

# 型エラーがないことを確認
npx tsc --noEmit
# ✅ 期待結果: エラー出力なし

# ESLint チェック (optional)
npx eslint src/ --ext .ts,.tsx
# ✅ 期待結果: 重大なエラーなし
```

### 1-2: Nitro コード生成検証
```bash
# 生成ファイルのクリア
rm -rf nitrogen/generated/

# 再生成
npx nitrogen
# ✅ 期待結果: 成功メッセージ

# 生成ファイル確認
ls -la nitrogen/generated/android/
# ✅ 期待結果: 以下ファイルが存在
#   - aokiapp_jsapdurn+autolinking.gradle
#   - aokiapp_jsapdurn+autolinking.cmake
#   - HybridJsapduRnSpec.hpp
#   - JNIJsapduRn.cpp
```

### 1-3: Android Gradle ビルド検証
```bash
cd android

# クリーンビルド
./gradlew clean
./gradlew assembleDebug --info
# ✅ 期待結果: BUILD SUCCESSFUL

# AARファイル確認
ls -la build/outputs/aar/
# ✅ 期待結果: android-debug.aar ファイルが存在

# サイズ確認 (参考値)
du -h build/outputs/aar/android-debug.aar
# ✅ 期待結果: 50KB - 2MB 程度
```

### 1-4: React Native リンク検証
```bash
cd ../example

# 依存関係インストール
npm install

# Metro bundler テスト
npx react-native start --reset-cache &
sleep 10
curl -s http://localhost:8081/status | grep -q "packager-status:running"
# ✅ 期待結果: running状態

# bundleビルドテスト
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/test.bundle
# ✅ 期待結果: エラーなし

pkill -f "react-native start" # Metro停止
```

---

## 🧪 レベル2: 単体検証

### 2-1: プラットフォーム初期化検証

**テスト対象:**
- 初期化成功確認
- 二重初期化防止
- デバイス情報取得

**検証方法:**
- Jestテストケースの作成
- 正常系・異常系の両方をテスト
- cleanup処理の適切な実装

**期待結果:**
- init() が正常完了する
- 二重init()でエラーが発生する
- getDeviceInfo()で適切なデバイス情報が返る

### 2-2: デバイス管理検証

**テスト対象:**
- デバイス取得成功
- 不正デバイスID処理
- デバイス解放処理

**検証方法:**
- 各テストでの前処理・後処理統一
- エラーケースの網羅的確認
- リソースリークの確認

**期待結果:**
- 有効デバイスIDで取得成功
- 無効デバイスIDでエラー発生
- 適切なクリーンアップ完了

### 2-3: 手動実機検証 (実際のNFCカード使用)
```bash
# テストアプリでの手動確認
cd examples/rn
npx react-native run-android

# 実機での手順:
# 1. アプリ起動
# 2. "NFC基本テスト開始" タップ
# 3. 各段階で以下を確認:

# ✅ 初期化段階
#   - "初期化完了" 表示
#   - ログに "✅ プラットフォーム初期化完了"

# ✅ デバイス検出段階  
#   - "デバイス検出: 1件" 表示
#   - デバイスID: integrated-nfc-0 表示

# ✅ カード待機段階
#   - ダイアログ "カードをタッチしてください" 表示
#   - NFCカードをタッチ → "カード検出" 表示

# ✅ ATR取得段階
#   - ATR文字列が表示される (例: "3B 8F 80 01 80 4F...")
#   - 成功ダイアログが表示される
```

---

## 🔗 レベル3: 統合検証

### 3-1: エンドツーエンド自動テスト
```typescript
// examples/rn/src/__tests__/integration.test.ts
describe('Integration Verification', () => {
  const CARD_TIMEOUT = 30000; // カード検出タイムアウト

  test('should perform complete card interaction', async () => {
    // この部分は実際のカードが必要なため、CI環境ではスキップ
    if (process.env.CI || !process.env.ENABLE_NFC_TESTS) {
      return;
    }

    // 完全なフロー
    await SmartCardPlatform.init();
    
    const devices = await SmartCardPlatform.getDeviceInfo();
    expect(devices.length).toBeGreaterThan(0);
    
    const device = await SmartCardPlatform.acquireDevice(devices[0].id);
    
    // カード検出 (手動でカードをタッチする必要がある)
    console.log('Please touch NFC card now...');
    await device.waitForCardPresence(CARD_TIMEOUT);
    
    const card = await device.startSession();
    
    // ATR取得
    const atr = await card.getAtr();
    expect(atr).toBeInstanceOf(ArrayBuffer);
    expect(atr.byteLength).toBeGreaterThan(0);
    
    // 基本的なSELECT命令
    const selectMf = new Uint8Array([0x00, 0xA4, 0x00, 0x0C, 0x02, 0x3F, 0x00]);
    const response = await card.transmit(selectMf.buffer);
    
    expect(response).toHaveProperty('sw1');
    expect(response).toHaveProperty('sw2');
    expect(response).toHaveProperty('data');
    
    // クリーンアップ
    await card.release();
    await device.release();
    await SmartCardPlatform.release();
  }, CARD_TIMEOUT + 5000);
});
```

### 3-2: リソース管理検証
```typescript
describe('Resource Management Verification', () => {
  test('should handle multiple init/release cycles', async () => {
    for (let i = 0; i < 10; i++) {
      await SmartCardPlatform.init();
      const devices = await SmartCardPlatform.getDeviceInfo();
      expect(devices.length).toBe(1);
      await SmartCardPlatform.release();
    }
  });

  test('should handle release without init', async () => {
    // 初期化せずに解放してもエラーにならないことを確認
    await expect(SmartCardPlatform.release()).resolves.not.toThrow();
  });
});
```

---

## 📊 レベル4: 性能検証

### 4-1: レスポンス時間測定
```typescript
// examples/rn/src/__tests__/performance.test.ts
describe('Performance Verification', () => {
  const measureTime = async (operation: () => Promise<any>) => {
    const start = performance.now();
    await operation();
    return performance.now() - start;
  };

  test('should initialize within acceptable time', async () => {
    const initTime = await measureTime(() => SmartCardPlatform.init());
    expect(initTime).toBeLessThan(1000); // 1秒以内
    
    await SmartCardPlatform.release();
  });

  test('should get device info quickly', async () => {
    await SmartCardPlatform.init();
    
    const deviceInfoTime = await measureTime(() => 
      SmartCardPlatform.getDeviceInfo()
    );
    expect(deviceInfoTime).toBeLessThan(100); // 100ms以内
    
    await SmartCardPlatform.release();
  });
});
```

### 4-2: メモリリーク検証
```bash
# メモリプロファイリング (Android)
cd examples/rn

# プロファイリング付きビルド
npx react-native run-android --variant=release

# adb経由でメモリ監視
adb shell dumpsys meminfo com.jsapdurnexample > memory_before.txt

# アプリで100回の初期化/解放を実行
# (アプリ内でループテストを実行)

adb shell dumpsys meminfo com.jsapdurnexample > memory_after.txt

# メモリ使用量比較
diff memory_before.txt memory_after.txt
# ✅ 期待結果: 大幅なメモリ増加なし (±10MB以内)
```

### 4-3: 並行処理検証
```typescript
describe('Concurrency Verification', () => {
  test('should handle sequential operations safely', async () => {
    await SmartCardPlatform.init();
    
    // 連続してデバイス情報を取得
    const promises = Array(10).fill(0).map(() => 
      SmartCardPlatform.getDeviceInfo()
    );
    
    const results = await Promise.all(promises);
    
    // すべて同じ結果が返ることを確認
    results.forEach(devices => {
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('integrated-nfc-0');
    });
    
    await SmartCardPlatform.release();
  });
});
```

---

## 🛡️ レベル5: 堅牢性検証

### 5-1: エラー処理検証
```typescript
describe('Error Handling Verification', () => {
  test('should handle uninitialized access', async () => {
    await expect(SmartCardPlatform.getDeviceInfo())
      .rejects.toThrow('Not initialized');
    
    await expect(SmartCardPlatform.acquireDevice('test'))
      .rejects.toThrow('Not initialized');
  });

  test('should handle device acquisition without init', async () => {
    await expect(SmartCardPlatform.acquireDevice('integrated-nfc-0'))
      .rejects.toThrow('Not initialized');
  });

  test('should handle card operations without device', async () => {
    await SmartCardPlatform.init();
    
    // デバイス取得せずにカード待機
    await expect(async () => {
      const device = await SmartCardPlatform.acquireDevice('integrated-nfc-0');
      await device.release(); // デバイス解放
      await device.waitForCardPresence(1000); // 解放後の操作
    }).rejects.toThrow();
    
    await SmartCardPlatform.release();
  });
});
```

### 5-2: タイムアウト処理検証
```typescript
describe('Timeout Verification', () => {
  test('should timeout on card wait', async () => {
    await SmartCardPlatform.init();
    const device = await SmartCardPlatform.acquireDevice('integrated-nfc-0');
    
    // 短いタイムアウトでカード待機 (カードをタッチしない)
    const start = performance.now();
    await expect(device.waitForCardPresence(1000))
      .rejects.toThrow('TIMEOUT');
    const elapsed = performance.now() - start;
    
    // タイムアウト時間が正確であることを確認 (±10%の誤差許容)
    expect(elapsed).toBeGreaterThan(900);
    expect(elapsed).toBeLessThan(1500);
    
    await device.release();
    await SmartCardPlatform.release();
  });
});
```

### 5-3: 異常状態回復検証
```typescript
describe('Recovery Verification', () => {
  test('should recover from platform errors', async () => {
    await SmartCardPlatform.init();
    
    try {
      // 意図的にエラーを発生させる
      await SmartCardPlatform.acquireDevice('invalid-device');
    } catch (error) {
      // エラー後でも正常な操作ができることを確認
      const devices = await SmartCardPlatform.getDeviceInfo();
      expect(devices).toHaveLength(1);
    }
    
    await SmartCardPlatform.release();
  });
});
```

---

## 🚀 検証実行スクリプト

### 自動化検証スクリプト
```bash
#!/bin/bash
# packages/rn/scripts/verify.sh

set -e

echo "=== Android NFC ライブラリ検証開始 ==="

# レベル1: ビルド検証
echo "📋 レベル1: ビルド検証"
cd packages/rn

npx tsc --noEmit
echo "✅ TypeScript コンパイル成功"

npx nitrogen
echo "✅ Nitro コード生成成功"

cd android
./gradlew clean assembleDebug
echo "✅ Android ビルド成功"

# レベル2-5: テスト実行
echo "📋 レベル2-5: 単体・統合・性能・堅牢性検証"
cd ../example

npm test
echo "✅ 自動テスト完了"

echo "=== 検証完了 ==="
echo "🎉 すべての自動検証が成功しました"
echo "📱 手動検証: 実機でアプリを起動してNFCテストを実行してください"
```

### 検証レポート生成
```bash
# 検証結果の保存
./scripts/verify.sh 2>&1 | tee verification_report_$(date +%Y%m%d_%H%M%S).txt
```

---

## ✅ 検証完了基準

### 必須クリア項目
- [ ] **ビルド検証**: エラーなくビルド完了
- [ ] **単体検証**: 全テストケース成功  
- [ ] **統合検証**: エンドツーエンドフロー成功
- [ ] **性能検証**: 応答時間が基準値以内
- [ ] **堅牢性検証**: エラー処理が適切

### 手動確認項目  
- [ ] **実機テスト**: NFCカード読み取り成功
- [ ] **ATR表示**: 正しいATR値が表示される
- [ ] **エラー通知**: 適切なエラーメッセージ表示
- [ ] **リソース解放**: メモリリークなし

### 出荷基準
**すべての必須クリア項目 + 手動確認項目が完了した場合のみ、実装完了とする**

---

このガイドにより、実装の各段階で**能動的な品質保証**が可能になり、問題の早期発見と修正ができます。
## 📊 レベル6: 実装品質・完了度検証

### 6-1: 実装完了度チェックリスト

**Platform実装完了基準 ([implementer-checklists.md](../implementer-checklists.md) の Platform Checklist準拠):**
- [ ] SmartCardPlatform.init() が正常動作
- [ ] SmartCardPlatform.release() が正常動作  
- [ ] SmartCardPlatform.getDeviceInfo() が適切なデバイス情報返却
- [ ] SmartCardPlatform.acquireDevice() でReaderMode有効化
- [ ] 二重初期化・未初期化エラー処理が適切
- [ ] 非NFC端末で適切なエラー返却 ("PLATFORM_ERROR")

**Device実装完了基準 ([implementer-checklists.md](../implementer-checklists.md) の Device Checklist準拠):**
- [ ] SmartCardDevice.waitForCardPresence() でカード検出待機  
- [ ] タイムアウト処理が仕様通り (30秒デフォルト)
- [ ] 画面オフ/Doze時にTIMEOUT返却・デバイス解放
- [ ] ISO-DEPタグのみ検出、FeliCa/NDEF内部抑制
- [ ] SmartCardDevice.startSession() でセッション確立
- [ ] 適切なリソース管理・解放処理

**Card実装完了基準 ([implementer-checklists.md](../implementer-checklists.md) の Card Checklist準拠):**  
- [ ] SmartCard.getAtr() で適切なATR返却 (HB→ATS順序)
- [ ] SmartCard.transmit() でAPDU送受信成功
- [ ] 拡張APDU対応 (Lc/Le二バイト)
- [ ] 適切なエラー写像 (Android例外→SmartCardError)
- [ ] SmartCard.reset() でセッション再確立
- [ ] 非UIスレッドでのI/O実行

### 6-2: アーキテクチャ品質検証基準

**FFI中立性準拠 ([nitro-method-conventions.md](../nitro-method-conventions.md) 準拠):**
- [ ] **用語置換適切**: ReaderMode→RF有効化、IsoDep→ISO-DEPセッション (内部のみ)
- [ ] **FFI非露出**: メソッド名・引数・戻り値にAndroid語なし
- [ ] **apduApi返却**: ["nfc", "androidnfc"] 両方含む
- [ ] **エラー正規化**: 全てSmartCardErrorコード体系

**設計原則準拠 ([android-nfc-ddd.md](../ddd/android-nfc-ddd.md) 準拠):**
- [ ] **責務分離**: Platform/Device/Card層の明確分離
- [ ] **排他制御**: ReaderMode有効化/無効化・セッション管理の直列化
- [ ] **リソース管理**: RAII パターン・例外安全性
- [ ] **ライフサイクル**: 取得/解放の対称性

### 6-3: 技術仕様準拠検証 ([android-nfc-tsd.md](../tsd/android-nfc-tsd.md) 準拠)

**性能基準:**
- [ ] 時間制約遵守 (init: <1s, getDeviceInfo: <100ms, transmit: <3s)
- [ ] メモリ制限遵守 (常駐<5MB, APDU<100KB)
- [ ] レスポンス時間安定性 (±10%以内)

**技術制約:**
- [ ] UI Thread完全回避
- [ ] 拡張APDU常時使用前提
- [ ] APDU長規程遵守 ([length-limits.md](../tsd/length-limits.md))
- [ ] 端末互換性確認 ([compat-devices.md](../tsd/compat-devices.md))

### 6-4: 最終出荷判定基準

**🔴 出荷阻害要因 (1つでもあれば出荷不可):**
- [ ] 基本機能の不動作
- [ ] メモリリーク・クラッシュ
- [ ] 性能基準の大幅未達
- [ ] セキュリティ脆弱性

**🟠 品質改善要因 (改善推奨):**
- [ ] エラーメッセージの不適切さ
- [ ] 一部端末での性能劣化
- [ ] テストカバレッジ不足

**✅ 最終判定基準:**
**出荷阻害要因ゼロ かつ 実装完了度チェックリスト全項目クリア の場合のみ実装完了**

---
