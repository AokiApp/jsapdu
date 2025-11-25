# Android NFC ライブラリ - 完全ドキュメントガイド

**React Native向けスマートカードAPDU通信ライブラリ (Android実装)**

## 📋 このプロジェクトについて

### 🎯 **何を作るのか？**

**Android NFC機能を使ったスマートカード通信ライブラリ** です。
NFCカードをスマートフォンにタッチして、カード内のデータを読み書きできるReact Nativeライブラリを実装します。

### 🛠️ **技術スタック**

- **React Native**: モバイルアプリフレームワーク
- **Nitro Modules**: 高性能なネイティブ連携技術
- **Android NFC API**: ReaderMode・IsoDep を使用
- **ISO-DEP**: 国際標準のスマートカードプロトコル

### 📚 **前提知識 (初見実装者向け)**

このプロジェクトに参加する前に、以下の知識があると理解しやすいです：

| 必要度      | 技術領域            | 学習リソース                                                |
| ----------- | ------------------- | ----------------------------------------------------------- |
| 🔴 **必須** | React Native基礎    | [公式ガイド](https://reactnative.dev/docs/getting-started)  |
| 🔴 **必須** | Android基礎開発     | [Android Developer](https://developer.android.com/)         |
| 🟠 **重要** | TypeScript          | [TypeScript Handbook](https://www.typescriptlang.org/docs/) |
| 🟠 **重要** | Kotlin              | [Kotlin公式](https://kotlinlang.org/docs/home.html)         |
| 🟡 **推奨** | Nitro Modules       | [実装ガイド](./nitro-modules-guide.md)                      |
| 🟡 **推奨** | NFC・スマートカード | [NFC Forum](https://nfc-forum.org/)                         |

### 🗺️ **プロジェクト全体像**

```
jsapdu/ (モノレポ)
├── packages/interface/     # 共通インターフェース定義
├── packages/pcsc/          # PC/SC実装 (参考)
└── packages/rn/            # ← このAndroid実装を作成
    ├── src/               # TypeScript FFI層
    ├── android/           # Kotlin ネイティブ実装
    └── docs/              # このドキュメント群
```

---

## 🚀 初見実装者向けクイックスタート

### ステップ1: 全体理解 (5分)

1. **[要件と背景を理解](./my-requests.md)** - 何を作るか把握
2. **[既存の仕様を確認](./implementer-checklists.md)** - 作るべき機能の把握
3. **技術選択の理由を理解** - なぜNitro Modules・ReaderModeなのか

### ステップ2: 技術習得 (15分)

1. **[Nitro Modulesを学ぶ](./nitro-modules-guide.md)** - フレームワーク理解
2. **[Android NFC APIを学ぶ](#android-nfc-参考資料)** - ReaderMode・IsoDep
3. **[既存実装を参考にする](../../../pcsc/)** - 設計パターン理解

### ステップ3: 実装開始 (30分)

1. **[環境セットアップ](./guides/getting-started.md)** - 依存関係・ビルド環境
2. **[アーキテクチャ方針](./guides/implementation-architecture.md)** - ファイル構成・設計方針
3. **[品質検証](./guides/verification-guide.md)** - テスト・検証方法

### Android NFC 参考資料

- [NfcAdapter](https://developer.android.com/reference/android/nfc/NfcAdapter) - Reader Mode
- [IsoDep](https://developer.android.com/reference/android/nfc/tech/IsoDep) - APDU送受信
- [ISO-DEP概要](https://www.nfc-forum.org/our-work/specifications-and-certification/specifications/nfc-forum-technical-specifications/) - プロトコル理解

---

## 📚 ドキュメント構造

**📋 対象読者**: このディレクトリのドキュメントは**ライブラリ実装者・コントリビューター**向けです
**📦 ライブラリ利用者**は [`packages/rn/README.md`](../README.md) を参照してください

### 🎯 実装者向けガイド

| ドキュメント                                                      | 内容                                     | 優先度      | 所要時間 |
| ----------------------------------------------------------------- | ---------------------------------------- | ----------- | -------- |
| [**📋 実装者チェックリスト**](./implementer-checklists.md)        | **プロフェッショナル・コーディング規約** | 🔴 **必読** | **5分**  |
| [**実装環境セットアップ**](./guides/getting-started.md)           | 依存関係・ビルド・基本手順               | 🔴 必須     | 15分     |
| [**品質検証プロセス**](./guides/verification-guide.md)            | 5段階品質検証・テスト指針                | 🟠 重要     | 20分     |
| [**アーキテクチャ方針**](./guides/implementation-architecture.md) | ファイル構成・設計原則                   | 🟡 推奨     | 15分     |
| [**実装設計指針**](./guides/examples/)                            | UI・ライフサイクル設計                   | 🟡 参考     | 10分     |

### 📖 API・契約仕様

| ドキュメント                                           | 内容                   | 実装時参照頻度  |
| ------------------------------------------------------ | ---------------------- | --------------- |
| [API契約仕様](./tsd/api-contract.md)                   | メソッド・エラー・制約 | 🔴 常時参照     |
| [エラーハンドリング](../../../interface/src/errors.ts) | エラーコード定義       | 🟠 エラー実装時 |

### 🔧 技術仕様・要件

| ドキュメント                                 | 内容               | 参照タイミング          |
| -------------------------------------------- | ------------------ | ----------------------- |
| [技術仕様書 (TSD)](./tsd/android-nfc-tsd.md) | 実装制約・性能要件 | 🟠 詳細実装時           |
| [要件定義書 (RDD)](./rdd/android-nfc-rdd.md) | 機能範囲・制約事項 | 🟡 設計検討時           |
| [設計詳細書 (DDD)](./ddd/android-nfc-ddd.md) | 責務分担・構造設計 | 🟡 アーキテクチャ検討時 |

### 📋 リファレンス

| ドキュメント                                     | 内容               | 参照タイミング      |
| ------------------------------------------------ | ------------------ | ------------------- |
| [APDU長規程](./tsd/length-limits.md)             | 送受信サイズ制限   | 🟡 APDU実装時       |
| [端末互換性](./tsd/compat-devices.md)            | 端末差異対応       | 🟡 テスト・最適化時 |
| [Nitro Modules ガイド](./nitro-modules-guide.md) | フレームワーク詳細 | 🟡 技術理解時       |

---

## 🎯 実装可能性の評価結果

### ✅ **高い実装可能性を確認**

**理由:**

1. **技術詳細が十分**: ReaderMode、IsoDep、Nitro Modulesの詳細説明
2. **FFI中立設計**: iOS対応も見据えた抽象化完了
3. **エラーハンドリング体系化**: 一貫したエラー写像定義
4. **参考実装存在**: PC/SC実装との整合性

**実装に必要なファイル一覧:**

```
packages/rn/
├── 📄 nitro.json (Nitro設定)
├── 📄 package.json, tsconfig.json
├── 📂 src/
│   ├── 📄 JsapduRn.nitro.ts (FFIインターフェース)
│   └── 📄 index.tsx (統一API)
├── 📂 android/
│   ├── 📄 build.gradle, CMakeLists.txt
│   ├── 📂 src/main/
│   │   ├── 📄 AndroidManifest.xml
│   │   ├── 📂 cpp/cpp-adapter.cpp (JNI)
│   │   └── 📂 java/.../JsapduRn.kt (実装)
└── 📂 example/ (テストアプリ)
```

---

## 💀 コーディング規約の厳格遵守

### ⚠️ 実装者への重要な警告

**一つのファイルに多数の行を書くような馬鹿な実装は技術的負債を生み出す愚行です。**

実装前に必ず確認してください：

- 📏 **ファイルサイズ制限**: 1ファイル100行以内（最大150行）
- 🏗️ **責務分離の徹底**: 適切なディレクトリ構造でファイル分割
- 🚫 **index.ts全部詰め込み禁止**: エクスポートのみに限定
- 📋 **詳細は必読**: [実装者チェックリスト](./implementer-checklists.md#プロフェッショナル・コーディング規約厳格遵守)

```diff
❌ 馬鹿な実装例
- packages/rn/src/index.ts (500行の巨大ファイル)

✅ プロフェッショナルな実装例
+ packages/rn/src/index.ts (30行 - エクスポートのみ)
+ packages/rn/src/hogehoge.ts (80行)
+ packages/rn/src/foo/bar.ts (95行)
+ packages/rn/src/fugahuga.ts (75行)
```

**プロフェッショナルなコードを目指し、検査時には行数の観点もしっかりと意識してコードレビューを実施してください。**

---

## 🛠️ 開発者体験の向上

### Before (既存ドキュメント)

```
😰 「何から始めればいいかわからない」
😰 「エラーが出ても対処法がない」
😰 「動作サンプルが見当たらない」
😰 「ファイル配置が曖昧」
```

### After (改善版)

```
😊 5分でNFC読み取りが動作
😊 エラー時の具体的解決手順
😊 コピー&ペーストで使えるサンプル
😊 明確なファイル配置ガイド
😊 プロフェッショナルなコーディング規約
```

---

## 🎓 学習パス推奨

### 📚 初心者向け (総所要時間: 30分)

1. [5分実装ガイド](./guides/getting-started.md) (5分)
2. [基本サンプル](./guides/examples/basic-card-reader.md) (15分)
3. [よくあるエラー](./guides/debugging-guide.md#よくある問題と解決方法) (10分)

### 🔧 中級者向け (総所要時間: 1時間)

1. [API契約理解](./tsd/api-contract.md) (20分)
2. [技術仕様詳細](./tsd/android-nfc-tsd.md) (25分)
3. [パフォーマンス監視](./guides/debugging-guide.md#パフォーマンス監視) (15分)

### 🏗️ 上級者向け (総所要時間: 2時間)

1. [アーキテクチャ詳細](./ddd/android-nfc-ddd.md) (45分)
2. [要件と制約](./rdd/android-nfc-rdd.md) (30分)
3. [端末互換性](./tsd/compat-devices.md) (30分)
4. [Nitro Modulesアーキテクチャ](./nitro-modules-guide.md) (35分)

---

## 🤝 貢献・フィードバック

### 📝 ドキュメント改善

- 不明点やエラーがあれば GitHub Issues で報告
- 実装中の発見事項は随時ドキュメントに反映
- サンプルコードの追加・改良歓迎

### 🧪 実装テスト

1. [基本実装ガイド](./guides/getting-started.md)に従って実装
2. [デバッグガイド](./guides/debugging-guide.md)でトラブル解決
3. 新しい問題・解決策があれば共有

---

## 📞 サポート・質問

### よくある質問

- **Q: エミュレータで動作しない** → A: 実機が必要 ([詳細](./guides/debugging-guide.md#nfc-not-supported))
- **Q: ビルドエラーが発生** → A: [ビルドトラブル解決手順](./guides/debugging-guide.md#ビルドコンパイル関連)
- **Q: カードが検出されない** → A: [カード検出の詳細デバッグ](./guides/debugging-guide.md#nfc通信関連)

### 技術サポート

- 実装相談: 設計仕様書・技術仕様書を参照
- バグ報告: デバッグガイドの情報と共にレポート
- 機能要望: 要件定義書の制約と照らし合わせて検討

---

**🎉 これで Android NFC ライブラリの実装に必要な情報がすべて揃いました！**

**👉 まずは [5分実装ガイド](./guides/getting-started.md) から始めましょう**
