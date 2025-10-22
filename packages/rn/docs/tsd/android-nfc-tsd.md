# Android NFC技術仕様書（TSD）

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装に係る技術仕様を定めるものである。対象はNitro Modulesを介したJSI連携によるネイティブ実装であり、公開API、型定義、スレッドおよび同期、時間制約、バッファとエンコーディング、エラーコード、互換性およびバージョニングの各観点について規定する。

本仕様はISO-DEPに基づくAPDUレベルの通信に専念し、NDEFは対象外とする。Android API Level 24以上を対象とし、ReaderModeはNFC-A、NFC-B、NFC-Fを常時有効化（固定運用）し、SKIP_NDEF によりNDEF検出を回避する。端末差による動的切替は行わない。

実装者向けのチェックリストは [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) を参照。文書の目次は [index.md](packages/rn/docs/index.md:1) に整理する。

## FFI中立性の原則

- 公開API、型定義、引数、戻り値はOS特有の概念を露出しない。ReaderMode、IsoDep、Intent、Activity等のAndroid特有の語はFFI上のメソッド名・型・戻り値には登場させない（契約は [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) を用いた中立表現で定義する）。
- 動作説明にAndroid特化の語が登場する場合は「実装注意（Android）」として付記に限定し、契約本文では「RF有効化」「カード存在イベント」「APDU往復」等の中立語で表現する（例: ReaderMode=RF有効化（プラットフォーム内部）、IsoDep=ISO-DEPセッション（プラットフォーム内部））。
- 例外、時間制約、同期規程はプラットフォーム非依存のコード体系に統一する（参照: [SmartCardError.class()](packages/interface/src/errors.ts:23)、[TimeoutError.class()](packages/interface/src/errors.ts:84)）。
- DeviceInfoのAPI識別子は apduApi=["nfc", "androidnfc"] を返却する。Android 実装は両方を含めること。内部実装の注記として「impl=android」を管理してもよい。
- 拡張APDU（Lc/Le二バイト）は検出を行わず常時使用前提とする。端末非対応による失敗は公開FFIで正規化せず、未処理例外の伝播を仕様として許容する。端末上限は [length-limits.md](packages/rn/docs/tsd/length-limits.md:11) に従い、呼出側が遵守する。
- ATR取得（Android）: IsoDep では Type A で [IsoDep.getHistoricalBytes()](packages/rn/docs/tsd/android-nfc-tsd.md:85) が得られる場合はそれを返却し、無ければ [IsoDep.getHiLayerResponse()](packages/rn/docs/tsd/android-nfc-tsd.md:85)（ATS）を返却。Type B では [IsoDep.getHiLayerResponse()](packages/rn/docs/tsd/android-nfc-tsd.md:85) のみ。いずれも取得不能の場合は "PROTOCOL_ERROR"（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）。
- 非対象タグ（FeliCa/NDEF）は [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) で内部抑制し、ISO-DEP検出のみ待機成立とする。
- 拡張APDUに関する能力検出や事前切り捨ては行わない（acquireDevice 段階での判定は実施しない）。
- 将来のiOS実装においても同一契約で整合させるため、本仕様の公開APIはOS非依存の振る舞いを保証する。

（注）本書におけるReaderModeやIsoDepへの言及は、FFIの内部実装注記であり、FFI公開契約の一部ではない。

## API仕様

公開インタフェースはNitro Modulesのハイブリッドオブジェクト定義である [JsapduRn.interface()](packages/rn/src/JsapduRn.nitro.ts:3) を拡張し、プラットフォーム、デバイス、カードの各操作を提供する。プラットフォームは初期化と解放、デバイス情報の取得、デバイスの取得を行う。デバイスはReaderModeの有効化状態とセッション管理を担い、カードはAPDU送受信と属性取得の責務を持つ。

初期化操作は一度のみ許容し、二重初期化時はエラーとする。解放操作は未解放のリソース（デバイス、カード、ReaderMode）を順序立てて停止し、再初期化可能な状態に戻す。デバイス情報は統合NFCリーダを一意の識別子で返却し、公開スキーマはインタフェース定義に一致させる。supportsHce は初期版では false 固定。apduApi は ["nfc","androidnfc"] を返却する。デバイス取得はReaderModeの有効化を伴い、解放時にはReaderModeを停止する。

カード検出の待機はイベント駆動とし、指定されたタイムアウト内にISO-DEPタグ検出が行われない場合はタイムアウトエラーを返却する。FeliCa/NDEF等の非対象タグは内部抑制し、待機は継続する。セッション開始はISO-DEPタグ検出後にIsoDepを用いて確立し、既にアクティブなセッションがある場合は既存参照を返却する。APDU送受信は要求コマンドの妥当性を前提とし、拡張APDUに対応した応答長の管理を行う。属性取得はATS（生バイト）を返却対象とする。

## 型定義

APDUコマンドは [CommandApdu.class()](packages/interface/src/apdu/command-apdu.ts:5) を用いて表現する。コマンドはCLA、INS、P1、P2、データ、Leから構成され、拡張長を含む表現に対応する。応答は [ResponseApdu.class()](packages/interface/src/apdu/response-apdu.ts:1) を用いて表現し、データ部とステータスワード（SW1、SW2）を保持する。

エラーは [SmartCardError.class()](packages/interface/src/errors.ts:23) を基本型とし、未初期化、二重初期化、カード非在、タイムアウト、接続重複、パラメータ不正、プラットフォーム障害等のコードを用いて識別する。外部API由来の例外は [fromUnknownError()](packages/interface/src/errors.ts:115) によりラップし、原因情報を保持する。

## KotlinおよびJNI連携

Android側のエントリポイントはNitro Modulesのブリッジクラスである [JsapduRn.class()](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:6) に定義する。JNI連携の初期化はC++アダプタ [cpp-adapter.cpp](packages/rn/android/src/main/cpp/cpp-adapter.cpp:1) により行われる。JSIへのバインディングはNitroのコード生成および設定ファイル [nitro.json](packages/rn/nitro.json:1) に従い、公開インタフェースの各メソッドを型安全にマッピングする。

ReaderModeの有効化とタグ検出コールバックはAndroidのNFC APIにより実装し、コールバックスレッドからのセッション確立は適切な同期機構により直列化する。NitroのハイブリッドオブジェクトはJSスレッドとネイティブスレッドの境界を跨いで動作するため、戻り値はPromiseまたは同期値のいずれかに応じ、スレッド安全な手続きで返却する。

## スレッドと同期

プラットフォーム初期化、デバイス取得、ReaderModeの有効化、タグ検出、セッション開始、APDU送受信、解放の各操作は、相互干渉を避けるために排他制御の対象とする。開始処理と解放処理が同時に実行されることのないよう、Mutexに相当する同期構造を用い、順序保証を行う。タグ検出のイベント到来は重複検出による競合を避ける観点から、セッション確立完了まで後続イベントを抑制する。

APDU送受信はカードのアクティブ状態に依存し、非アクティブ状態での呼出はエラーとする。タイムアウト発生時は待機操作を即時終了し、状態一貫性を保持した上で再待機可能な状態に復帰する。

## 時間制約とタイムアウト

カード検出の待機は呼出側がタイムアウト値を指定する。推奨値は実用環境における検出時間の分布を踏まえ、数秒から十数秒の範囲が望ましい。APDU送受信におけるタイムアウトは、カードおよび端末の実装差に依存するため、必要に応じて呼出側設定とする。タイムアウト発生時は [TimeoutError.class()](packages/interface/src/errors.ts:84) を返却し、再試行の可否は上位設計に委ねる。

### 画面オフ／Doze検知（実装方針：自動監視）
- 実装方法（確定）
  - Nitro Module内で [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) 時にBroadcastReceiverを自動登録
  - 監視対象：ACTION_SCREEN_OFF、ACTION_USER_PRESENT、ACTION_DEVICE_IDLE_MODE_CHANGED
  - [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39) 時にBroadcastReceiverを自動解除
- ポリシー
  - 検知時に待機/I/Oをキャンセルし [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) を実施。公開FFIの戻りは "TIMEOUT" に正規化する。
  - キャンセル要求は即時（実装裁量、目安≤250ms）に発行し、状態整合性を優先して再待機・再取得可能な終端を保証する。
- 実装注意：ホストアプリ側でのライフサイクル管理実装は不要。Nitro Module が内部で全て処理する。

## バッファとエンコーディング

APDUコマンドのシリアライズは [CommandApdu.toUint8Array()](packages/interface/src/apdu/command-apdu.ts:53) に従い、拡張長APDUでは長さフィールドを2バイトとして表現する。応答の復元は [ResponseApdu.fromUint8Array()](packages/interface/src/apdu/response-apdu.ts:12) を用いる。AndroidのIsoDepにおけるtransceiveは端末依存の最大長を持ちうるため、過大なLe指定に対してはエラーとし、必要な場合は分割送受信の方針を別途設計する。

エンコーディングはバイト列を基本とし、文字列表現はログおよびデバッグ用途に限る。メモリ管理はバッファの不要なコピーを避ける方針とし、JSとネイティブ間のデータ移送はNitroの効率的なバインディングを活用する。

## エラーコード

エラーコードは以下の分類に準拠する。未初期化（NOT_INITIALIZED）、二重初期化（ALREADY_INITIALIZED）、カード非在（CARD_NOT_PRESENT）、タイムアウト（TIMEOUT）、接続重複（ALREADY_CONNECTED）、パラメータ不正（INVALID_PARAMETER）、プラットフォーム障害（PLATFORM_ERROR）である。これらは [SmartCardError.code](packages/interface/src/errors.ts:31) により識別され、各エラーは安全なメッセージと開発時の詳細情報を提供する。

外部API由来の例外は [fromUnknownError()](packages/interface/src/errors.ts:115) によりラップし、原因の型、メッセージ、スタック等の情報を可能な限り保持する。

## 利用例

典型的な利用手順は次の順序による。プラットフォームの初期化を行い、統合NFCデバイスの情報を取得する。デバイスを取得しReaderModeを有効化する。カード検出の待機を開始し、検出後にセッションを開始する。APDUを送信し、応答を受領する。処理完了後はカードセッションを解放し、ReaderModeを停止し、プラットフォームを解放する。

この手順において、各操作は状態遷移の整合性に従い、重複呼出や未初期化呼出はエラーとして扱う。

## 互換性

対象環境はAndroid API Level 24以上とする。ReaderModeのフラグは NFC_A | NFC_B | NFC_F | SKIP_NDEF（固定運用）とし、端末差による動的切替は行わない。NFC_V（ISO15693）は対象外。端末により応答長やイベントタイミングの差異が生じる可能性があるため、時間制約やバッファ管理に関する制約は本仕様に従って扱う。

ReaderModeフラグ採用理由（確定方針：完全固定）
- A/B/F を固定で有効化することで検出経路の実装差を低減し、FeliCa 等の非対象タグは SKIP_NDEF と待機側の内部抑制で無視されるため、成立条件（ISO-DEP）の一貫性を維持できる。
- ベンダ差により F を無効化すると一部端末でイベント配信の順序が不安定化する事例があるため、固定構成が安全側。
- 対象外プロトコルは公開FFIへ露出しない（成立しない）ため、性能負荷は受入基準内で許容。
- 電力効率よりも実装の安定性・シンプルさを優先。アプリ側でのフラグカスタマイズは提供しない。

## バージョニング方針

公開APIの変更はセマンティックバージョニングに基づき管理する。後方互換性を破る変更はメジャーバージョンの更新として告知し、マイナー更新では機能追加、パッチ更新では不具合修正を対象とする。技術仕様の改訂は設計文書の更新に追随し、重要事項の改訂についてはレビューおよび承認を要する。

## 付記

本仕様は、設計詳細仕様書および要件定義書の内容に整合するものとする。TypeScript側の公開インタフェースは [JsapduRn.interface()](packages/rn/src/JsapduRn.nitro.ts:3) を基点に定義され、Kotlin側の実装は [JsapduRn.class()](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:6) においてエントリポイントを提供する。APDU関連の型は [CommandApdu.class()](packages/interface/src/apdu/command-apdu.ts:5) と [ResponseApdu.class()](packages/interface/src/apdu/response-apdu.ts:1) を参照する。

### IsoDep公式APIの要点（反映方針）

Android公式APIにおけるISO-DEPのI/O運用について、技術仕様へ次の要点を反映する。第一に、送受信のタイムアウトはミリ秒単位で取得・設定可能であり、設定はI/O終了・解放時に既定値へ復帰する。第二に、送信可能な最大長は実装に依存し、実行時に取得する数値を上限として扱う。第三に、拡張長APDUは端末により非対応の可能性があるが、本仕様では事前検出およびランタイム検査を行わない。非対応による失敗は公開FFIで正規化せず、未処理例外が伝播し得る方針を採用する。第四に、INFがFSD/FSC限界を超える場合でも、フラグメント／デフラグメントはプロトコル層で自動処理される。第五に、接続および送受信はメインスレッドで実行してはならず、ブロッキングI/Oは解放操作によりキャンセル可能である。これらは [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) のタイムアウト・長さ規程、[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293) のATS取得方針、[SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) の待機設計、および [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) のI/Oキャンセル規程に整合するように適用する。

さらに、権限要件としてNFC権限の明示を前提とし、拡張長および最大長の具体的数値は端末差異仕様に従って取り扱うこととする（参照: [packages/rn/docs/tsd/compat-devices.md](packages/rn/docs/tsd/compat-devices.md)、[packages/rn/docs/tsd/length-limits.md](packages/rn/docs/tsd/length-limits.md)）。

## 権限とGradle設定（実装要件）

本節は、Android版の公開API契約を満たすために必要なホストアプリ側のマニフェスト／Gradle設定を明示する。ライブラリ側のAndroidManifestは最小化し、ホストアプリ（例: [packages/rn/example/android/app/src/main/AndroidManifest.xml](packages/rn/example/android/app/src/main/AndroidManifest.xml:1)）で権限・機能を宣言する。

### 方針

- ライブラリ側マニフェスト（[packages/rn/android/src/main/AndroidManifest.xml](packages/rn/android/src/main/AndroidManifest.xml:1)）には不要な uses-permission を追加しない。権限はホストアプリで宣言する（マージ衝突・配布制限を避けるため）。
- SDKベースラインは 最低 minSdk=24、推奨 targetSdk=34・compileSdk=34。より高い値（例: 36）もサポートし、例プロジェクトは compileSdk/targetSdk 36 を使用している。
- 配布方針（決定）: uses-feature android.hardware.nfc は android:required="false" を採用する。非NFC端末では [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) は成功、[SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87) は0件を返却し、[SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) は "PLATFORM_ERROR" を返す。

### ホストアプリのマニフェスト例

NFC権限と機能の宣言（NDEFは対象外、HCEは初期版範囲外のため未宣言）。

必須端末への配布（required=true）の例:

```xml
<!-- app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.NFC" />
  <uses-feature android:name="android.hardware.nfc" android:required="true" />
  <!-- アプリ要素は省略 -->
</manifest>
```

任意端末（非NFC端末にも配布、実行時にエラー写像で対応）の例:

```xml
<!-- app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.NFC" />
  <uses-feature android:name="android.hardware.nfc" android:required="false" />
</manifest>
```

注記:
- HCEは将来対応のため `android.hardware.nfc.hce` は宣言しない（初期版は受動読取のみ）。
- required=false を選択する場合、非対応端末では [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) ないし [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) 時に "PLATFORM_ERROR" を返す実装注意を適用する。

### Gradle設定（SDKベースライン）

アプリ側の Gradle 設定例（AGP 8+の新DSL）:

```gradle
android {
  compileSdk 34

  defaultConfig {
    minSdk 24
    targetSdk 34
  }
}
```

従来DSL（AGP 7系）の場合:

```gradle
android {
  compileSdkVersion 34

  defaultConfig {
    minSdkVersion 24
    targetSdkVersion 34
  }
}
```

対象ファイル:
- アプリ: app/build.gradle（または build.gradle.kts）
- 例: [packages/rn/example/android/app/build.gradle](packages/rn/example/android/app/build.gradle:1)

### 命名規約（パッケージ／バンドル）

- NPMパッケージ名（決定）: @aokiapp/jsapdu-rn
- Java package / Bundle ID 規約: app.aoki.jsapdu.rn.android（プラットフォーム名は "android"）
- 注記（ボイラープレート尊重）: 現在のボイラープレート namespace は [packages/rn/android/build.gradle](packages/rn/android/build.gradle:34) の com.margelo.nitro.aokiapp.jsapdurn および [JsapduRn.kt](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:1) のパスに基づく。実装では本規約に合わせるか、ボイラープレートを尊重して同等の事項を仕様に組み込み、FFI契約（[SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283)）を満たすこと。

### R8/ProGuard（Nitro/JSI）

Nitro Modulesは `@DoNotStrip` によりストリッピングを回避するが、混淆設定によっては追加のkeepが必要な構成がある。問題発生時は次を追加する:

```proguard
# Nitro/JSI ブリッジの保持（必要時）
-keep class com.margelo.nitro.** { *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keepclasseswithmembers class * {
  @com.facebook.proguard.annotations.DoNotStrip *;
}
```

例の適用先: [packages/rn/example/android/app/proguard-rules.pro](packages/rn/example/android/app/proguard-rules.pro:1)

### 受入基準（Permissions/Gradle）

- アプリのマニフェストに `android.permission.NFC` と `android.hardware.nfc` の宣言が存在する（配布方針に応じ required= true/false を選択）。
- アプリの Gradle 設定が 最低 minSdk=24 を満たし、targetSdk/compileSdk は 34 以上（例: 36）である。
- 非NFC端末（required=false 際）では、初期化・取得段階で "PLATFORM_ERROR" が一貫して返る（FFI中立エラーモデルに整合）。
- R8/ProGuard を有効化したビルドで JSI ブリッジが除去されない（必要に応じ keep ルールを追加）。

この節は [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) の Platform Checklist と整合し、[api-contract.md](packages/rn/docs/tsd/api-contract.md:1) の前提条件に含める。