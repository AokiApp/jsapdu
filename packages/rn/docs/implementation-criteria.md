# jsapdu RN 実装ルール・設計クライテリア・受入基準（2025年10月再定義・実装例・運用例・判定例付き）

---

## 1. 責務分離と設計原則（実装例・アンチパターン）

### ベストプラクティス例

- **SmartCardPlatformの実装例**  
  ```typescript
  export class SmartCardPlatformImpl extends SmartCardPlatform {
    async init(): Promise<void> { /* ... */ }
    async getDeviceInfo(): Promise<SmartCardDeviceInfo[]> { /* ... */ }
    async acquireDevice(id: string): Promise<SmartCardDevice> { /* ... */ }
    async release(): Promise<void> { /* ... */ }
  }
  ```
  - **やってはいけない例**  
    - `init()`で内部的にデバイスやカードの状態を直接管理する（→SRP違反）
    - NitroModuleのインスタンスをコンストラクタで受け取り、フィールドで保持する
    - SmartCard*関連abstractクラスを継承せずに実装する（→型安全性違反）

- **SmartCardDeviceの実装例**  
  - `waitForCardPresence()`は「カードが来るまで待つ」だけ。カードのAPDU送受信やATR取得はSmartCardに委譲する。
  - **アンチパターン**  
    - `waitForCardPresence()`内でAPDU送信やATR取得を行う（→責務混在）

- **SmartCardの実装例**  
  - `transmit()`は必ずCommandApdu型を受け取り、ResponseApdu型で返す。ArrayBufferやUint8Arrayの直接操作は禁止。

---

## 2. エラー処理・例外設計（実装例・テスト例）

- **SmartCardErrorの使い方例**  
  ```typescript
  try {
    await device.waitForCardPresence(10000);
  } catch (e) {
    if (e instanceof SmartCardError && e.code === "TIMEOUT") {
      // タイムアウト時の処理
    }
  }
  ```
- **Android例外→FFIエラーのマッピング例**  
  - TagLostException → SmartCardError("PLATFORM_ERROR", "カードが取り外されました")
  - IOException → SmartCardError("PLATFORM_ERROR", "NFC I/O通信に失敗しました")
- **アンチパターン**  
  - 例外をcatchせずにそのままthrowする
  - catch時にエラーコードやデバッグ情報を付与しない

---

## 3. ファイル構成・分割・命名規約（具体例）

- **ディレクトリ構成例**
  ```
  src/
    platform/
      smart-card-platform-impl.ts
    device/
      smart-card-device-impl.ts
      android-device-info.ts
    card/
      smart-card-impl.ts
    errors/
      error-mapper.ts
    index.tsx
  ```

packages/pcsc/*を参考にするといいだろう。
  
- **命名例**
  - クラス名：`SmartCardPlatformImpl`
  - メソッド名：`waitForCardPresence`
  - 定数名：`DEFAULT_TIMEOUT_MS`
- **アンチパターン**
  - 1ファイルに複数層の実装を詰め込む
  - index.tsxに実装ロジックを書く

---

## 4. テスト・品質保証（テストケース例・カバレッジ基準）

### 単体テスト例（Kotlin)

```kotlin
@Test
fun testAcquireDevice_Success() = runBlocking {
    val platform = SmartCardPlatformImpl(nitroModule)
    platform.init()
    val device = platform.acquireDevice("NFC_READER_1") 
    assertNotNull(device)
} // あくまでこれは例。実際にはより詳細かつ意味のあるテストケースを多数用意。
```

### 統合テスト・E2E例

- 実際のNFCカードを用いて、init→getDeviceInfo→acquireDevice→waitForCardPresence→startSession→getAtr→transmit→releaseの一連フローを自動化。
- CIでE2Eテストがスキップされる場合も、手動実機テストの手順・期待値をdocs/に明記。

### 異常系・例外テスト例

- `waitForCardPresence(0)`は即座にTIMEOUT例外を返すこと
- `acquireDevice`で重複取得時はALREADY_CONNECTED例外
- `transmit`でAPDU長が規定外ならINVALID_PARAMETER例外

### カバレッジ・品質基準

- テストカバレッジ80%以上をCIで自動判定。  
- テストコードも責務分離・命名規約・行数制限を遵守。

---

## 5. CI/CD・ビルド・受入基準（運用例・判定例）

- **CI運用例**
  - PR作成時に自動で`npx tsc --noEmit`と`./gradlew assembleDebug`を実行し、型エラー・ビルドエラーがゼロであることを必須条件とする。
  - Jest/JUnitの全テストがパスし、カバレッジ80%以上でなければマージ不可。
- **受入判定例**
  - 受入時は「設計・実装・テスト・CI・ドキュメント・運用ルール」すべての観点でチェックリストを用意し、全項目OKで初めて受入とする。
  - 設計変更時は必ずdocs/implementation-criteria.mdを更新し、レビュアー全員の合意を得る。

---

## 6. 運用・開発プロセス（レビューチェックリスト・合意フロー）

### PRレビュー時のチェックリスト例

- [ ] 責務分離が守られているか（層の越境がないか）
- [ ] 型安全性が担保されているか（any/unknown/型アサーション多用禁止）
- [ ] 例外処理・エラーコードがSmartCardError体系で統一されているか
- [ ] テストが正常系・異常系ともに十分か
- [ ] ファイル分割・命名規約・行数制限が守られているか
- [ ] ドキュメント・受入基準が最新か

### 設計変更・API拡張時の合意フロー例

1. 設計変更提案（Issue/PR/ドキュメントで明文化）
2. 影響範囲レビュー（関係者全員で議論）
3. 合意形成（レビュアー全員のApprove）
4. docs/implementation-criteria.md等のドキュメント更新
5. 実装・テスト・CIパス確認
6. マージ・リリースノート反映

---

## 7. API/FFI/型安全性（API設計例・型定義例）

- すべてのAPIは@aokiapp/jsapdu-interfaceの契約に完全準拠し、引数・戻り値・例外は型定義で明示。
- 例：`transmit(apdu: CommandApdu): Promise<ResponseApdu>`
- FFI層ではOS語（Intent, IsoDep, ReaderMode等）や実装語（nitroModule等）を露出しない。iOSでもAndroidでも同一の高水準APIを提供。
- 型アサーションや暗黙の型変換は禁止し、型安全性を最優先。any/unknownももちろん禁止。

---

## 8. 品質保証・受入判定（受入手順・証跡例）

- 受入判定時は、以下の証跡を必ず残すこと：
  - CIログ（型エラー・ビルドエラー・テストパス・カバレッジ）
  - テストレポート（正常系・異常系・E2E・実機）
  - ドキュメント更新履歴（設計・運用・FAQ・トラブルシュート）
  - PRレビュー記録（チェックリスト全項目OK）
- 受入基準・設計指針・FAQ・トラブルシュートの明示と、設計変更時のドキュメント更新を義務付ける。

---

## 9. 例外的な運用・設計変更時のプロセス（運用例）

- 重大な設計変更・運用変更・API拡張時は、必ず影響範囲を明示し、関係者合意・ドキュメント化・テスト追加を行う。
- 途中で発生した課題・設計変更は必ずTODO/Issueに積み、進捗管理・合意形成を徹底する。
- 例：API拡張時は「設計合意→契約ドキュメント更新→実装→テスト→リリースノート反映→受入判定」の流れを必須とする。

---

## 10. まとめ

本ドキュメントは、jsapdu RN実装の品質・保守性・拡張性・型安全性・運用効率を最大化するための「唯一の基準」として運用する。  
設計・実装・運用・テスト・ドキュメント・受入判定のすべての観点で本基準を遵守し、プロジェクト全体の品質保証・継続的改善を実現すること。  
今後、設計・運用・受入基準の見直しが必要な場合は、必ず本ドキュメントを起点に議論・合意・更新を行うこと。
