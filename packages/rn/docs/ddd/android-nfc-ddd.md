# Android NFC設計詳細仕様書（DDD）

## 🚀 初見の実装者へ
**設計詳細が初めての方**：
- **まず環境準備**: [guides/getting-started.md](../guides/getting-started.md)
- **実装概要**: [my-requests.md](../my-requests.md) - なぜこの設計か
- **実装チェックリスト**: [implementer-checklists.md](../implementer-checklists.md) - 具体的作業

## 📋 このドキュメントの役割
本書は**アーキテクチャ・責務分担・コンポーネント設計**を詳述します。
React Native向けスマートカードAPDU通信ライブラリのAndroid実装において、Nitro Modulesに基づく三層構造（プラットフォーム・デバイス・カード）の設計詳細を記述します。

**参考にした設計**: 既存のPC/SC実装 ([packages/pcsc/](../../../pcsc/)) の設計原則
**使用技術**: Android ReaderMode・IsoDep・Nitro Modules

**関連ドキュメント**:
- 実装チェックリスト: [implementer-checklists.md](../implementer-checklists.md)
- ドキュメント目次: [index.md](../index.md)

---

# 設計詳細内容

## FFI中立性の原則

- 設計上、FFI公開契約はOS特有の概念を露出しない。Android内部のReaderMode/IsoDepの取り扱いは「実装注意（Android）」に限定し、公開インタフェースは [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) の責務に準拠する。
- 用語の置換指針: ReaderMode→RF有効化（プラットフォーム内部）、IsoDep→ISO-DEPセッション（プラットフォーム内部）、Intent/Activity→アプリ前景状態（FFIでは露出しない）。
- 例外写像・同期・時間制約はプラットフォーム非依存の規程で表現し、Android特有の挙動は内部の「実装注意」に収容する（参照: [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:1)、[api-contract.md](packages/rn/docs/tsd/api-contract.md:1)）。
- DeviceInfoのapduApi等の識別は ["nfc", "androidnfc"] を返却する。Android 実装は両方を含めること。実装差異は内部注記で管理する。
- 拡張APDU（Lc/Le二バイト）は必須対応。FFI契約上は常に拡張長APDUが利用可能であることを前提とし、非対応端末は切り捨て対象。端末上限は [length-limits.md](packages/rn/docs/tsd/length-limits.md:11) の理論値を採用。
- ATRはATSそのまま（生バイト）を返すことを仕様として固定する（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）。歴史バイトや他形式は考慮しない。
- 非対象タグ（FeliCa/NDEF）は [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) で内部抑制し、ISO-DEP検出のみ待機成立とする。
- 拡張APDU非対応端末は [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) 時点で "PLATFORM_ERROR" により切り捨てる（契約に明記）。

（注）当該原則はiOS版の整合性確保のための前提であり、Android記述は公開契約の内部注記に留める。

## 全体構成

全体構成は、プラットフォーム管理（PlatformManager）、プラットフォーム（Platform）、デバイス（Device）、カード（Card）により構成される。プラットフォーム管理は単一インスタンスとしてプラットフォームを提供し、プラットフォームは初期化と解放、デバイス情報の提供、デバイス取得を担う。デバイスはReaderModeの有効化状態を管理し、タグ検出およびセッションの開始と終了を担う。カードはAPDU送受信および属性取得の責務を持つ。

インタフェースは [SmartCardPlatformManager.class()](packages/interface/src/abstracts.ts:7)、[SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) を基本契約とし、Android実装はこれらを忠実に満たす形で具体化する。

## コンポーネント設計

PlatformManagerは、アプリケーションからの入口として単一のプラットフォームインスタンスを返す。生成は遅延評価とし、呼出時に未作成であれば新たに構築する。プラットフォームは内部状態として初期化フラグを保持し、ReaderModeの有効化に先立ち初期化を完了させる。

プラットフォームはデバイス管理のためのマップを持つ。現行の受入基準では統合NFCリーダを1件のみ返却する（通常1件）。将来は複数デバイス（例: BLEリーダ）を許容する方針。デバイスIDは例示として "integrated-nfc-0" を用いるが固定ではない。デバイスはReaderModeの有効化と無効化を明示的に制御し、タグ検出コールバックを登録する。タグ検出時にはカードコンテキストを準備し、セッション確立に必要なIsoDepを取得する。

カードはIsoDepインスタンスを保持し、送受信を担う。属性取得においては、ATS情報をATR相当として提供する。カードはアクティブ状態の管理を行い、解放時にはアクティブフラグを適切に更新する。

## ライフサイクル

プラットフォームの初期化は一度のみ許容し、二重初期化を禁止する（[SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33)）。解放は、登録済みデバイスの解放処理を先行し、ReaderMode停止および内部状態のクリアを伴う（[SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)）。

デバイス取得（[SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)）は、ReaderModeの有効化を開始トリガとする。解放（[SmartCardDevice.release()](packages/interface/src/abstracts.ts:269)）はReaderModeの停止、カードセッションの解放、内部参照の破棄を順序通りに行う。

セッション開始（[SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249)）は、タグ検出後にIsoDepを用いて即時に確立する。セッション終了はカード側の解放操作（[SmartCard.release()](packages/interface/src/abstracts.ts:312)）により非アクティブ化し、デバイス解放時はカード解放を先行させる。

## セッション管理

タグ検出はReaderModeのイベントコールバックを用いる。待機操作（[SmartCardDevice.waitForCardPresence(timeout)](packages/interface/src/abstracts.ts:259)）は、イベント駆動であり、所定の時間内に検出が発生した場合に直ちに終了する。検出がない場合はタイムアウトとして扱う。

カードの存在確認（[SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240)）は、最後に検出されたタグの存否に基づく軽量な判定とし、ロックを伴わない。セッション開始時には重複確立を防止し、既にアクティブな場合は既存カードの参照を返す。

## 排他制御と同期

ReaderModeの有効化・無効化、セッション確立・解放は、排他制御により競合を回避する。開始および解放の各操作は相互に干渉しないよう同期化する。排他にはMutexに相当する構造を用い、開始中または解放中の同時操作を直列化する。

タグ検出のイベント処理においては、複数検出イベントの同時到来に対する抑制を行い、セッション確立が完了するまでは後続イベントを無視または順延する。タイムアウト発生時の片付けと再待機は、状態遷移の一貫性を損なわないよう慎重に行う。

## 入出力仕様

デバイス情報の提供（[SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87)）は、統合NFCデバイスの情報を返す。情報には、識別子、表示名、説明、APDU対応可否、HCE対応可否、D2CおよびP2Dのプロトコル属性、APDU API識別子は ["nfc", "androidnfc"] を返却する。

APDU送受信（[SmartCard.transmit(apdu)](packages/interface/src/abstracts.ts:300)）は、IsoDepのtransceiveによる一往復を基本とし、応答はデータ部とステータスワード（SW1、SW2）に分割する。拡張APDUにおけるLeの扱いは、本規程の理論上限に適合させる。端末固有の縮小上限はサポート外（非対応端末は [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) で "PLATFORM_ERROR"）。属性取得（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）は、ATS（生バイト）を返却する。

## 例外処理

例外処理は、プラットフォーム未初期化、二重初期化、カード非在、タイムアウト、接続重複、パラメータ不正、プラットフォーム障害等の事象ごとに整理する。例外は [SmartCardError.class()](packages/interface/src/errors.ts:23) に基づき、表示可能な安全メッセージと開発時の詳細情報を持つ。外部API由来の例外は、適切にラップして報告し、状態の復帰を担保する。

## ロギング

開発時のトレースに必要な範囲でログを出力する。カード識別等の機微情報は可能な限り出力しない。タイムアウト、解放、ReaderModeの状態変更、セッションの確立と終了に関するログは、問題解析に資する粒度で記録する。

## 互換性

対象はAndroid API Level 24以上とする。ReaderModeの有効化にはNFC-A、NFC-B、NFC-Fのフラグを用い、NDEF関連の検出は回避する。端末差異に起因する応答長の制限、電力管理の差異、バックグラウンド動作の挙動については、技術仕様において制約を明記する。

## 拡張方針

初期リリースではISO-DEPに限定し、NFC-F（FeliCa）については将来の拡張対象とする。ホストカードエミュレーションは別途設計として段階的に追加する方針とし、プラットフォーム、デバイス、カードの責務分離を維持したまま機能拡張可能な構造とする。

TypeScriptの公開インタフェースは、Nitro Modulesのハイブリッドオブジェクトに基づいて拡張し、JS層からの操作性を確保する（参照: [packages/rn/src/JsapduRn.nitro.ts](packages/rn/src/JsapduRn.nitro.ts)）。Kotlin側の実装は、Androidブリッジのエントリポイントを維持しつつ、プラットフォーム、デバイス、カードの責務に応じたクラス構成で提供する（参照: [packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt)）。

### 命名・ボイラープレート尊重（追補）

- Distribution policy: android.hardware.nfc required=false（デフォルト）。非NFC端末では [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33)／[SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) 段階で "PLATFORM_ERROR" を返却する（参照: [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:119)）。
- NPMパッケージ名（決定）: @aokiapp/jsapdu-rn
- Java package / Bundle ID: com.margelo.nitro.aokiapp.jsapdurn
- 注記: RN Nitro のボイラープレートが既に namespace やクラス配置を決めている箇所（例: [packages/rn/android/build.gradle](packages/rn/android/build.gradle:34), [packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:1)）は尊重する。必要であれば仕様へ同等の事項を組み込み、ボイラープレートに頼らずとも契約が満たされるようにする。

### IsoDep運用上の設計規程（追補）

接続および送受信はメインスレッドで実行しないことを厳守する。I/Oはブロッキング動作となるため、解放操作によりキャンセルできる設計とし、同一タグに対する同時接続は行わない。INFが端末のFSD/FSC限界を超える場合でも、フラグメント／デフラグメントはプロトコル層により自動化されるため、アプリケーション側の分割処理は不要とする。拡張長APDUは必須対応であり、可否の動的確認は不要。送受信可能最大長は [length-limits.md](packages/rn/docs/tsd/length-limits.md:11) の理論上限に適合させ、端末固有の縮小上限はサポート外。非対応端末は [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) の段階で "PLATFORM_ERROR" により切り捨てる。

非機能設計として、タイムアウトの設定・取得はセッション単位で行い、長時間処理が想定されるコマンドに対しては適切に延長する。例外伝播はNitroのPromise非同期運用に整合する形で扱い、I/O失敗・タイムアウト・状態不整合は [SmartCardError.code](packages/interface/src/errors.ts:31) に基づき割当てる。