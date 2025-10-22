# 統合告知

本書の内容は、実装者向けの単一情報源へ統合しました。以降は以下の文書を参照してください。

- 実装手順と受入基準の単一情報源: [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1)
- 公開API契約（FFI中立、メソッド名・引数・戻り値）: [api-contract.md](packages/rn/docs/tsd/api-contract.md:1)
- 技術仕様（時間制約・長さ・例外・スレッド・実装注意）: [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:1)
- 索引（5分クイックガイド、Errata、単一情報源の運用）: [index.md](packages/rn/docs/index.md:1)
- 付録（APDU長規程）: [length-limits.md](packages/rn/docs/tsd/length-limits.md:1)
- 付録（端末互換性・差異）: [compat-devices.md](packages/rn/docs/tsd/compat-devices.md:1)

本書はスタブとして維持し、重複する以下の内容を上記へ集約済みです。
- FFI中立の命名規約、OS語非露出の原則 → [api-contract.md](packages/rn/docs/tsd/api-contract.md:10)
- スレッド/非同期（UIスレッド禁止）、並行性・排他規程 → [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:1), [android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md:1)
- ライフサイクル・キャンセル（画面オフ/Doze時はTIMEOUT返却と解放） → [android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md:109), [api-contract.md](packages/rn/docs/tsd/api-contract.md:38)
- APDU長・拡張長の方針 → [length-limits.md](packages/rn/docs/tsd/length-limits.md:1)

読み手優先の方針:
- 「何をすればよいか」は [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) と [index.md](packages/rn/docs/index.md:1) に一本化。
- 詳細仕様や原則は、本文重複を避けて [api-contract.md](packages/rn/docs/tsd/api-contract.md:1) と [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:1) に集約。
- 試験・互換性・長さ等の詳細は付録へ分離。

今後、本スタブは必要に応じてリンク更新のみ行い、本文の重複は作りません。
# Nitro Modules Method Conventions（FFI中立・実装指針）

本書は、React Native Nitro Modules（JSI）に基づく公開FFIの命名・型・スレッド・エラー・メモリ・並行性の統一指針を定める。目的は、OS特有の概念をFFIに露出せず、実装者が迷わず同一の契約に従って安定実装できるようにすること。

参照:
- インタフェース契約: [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17), [SmartCardDevice.class()](packages/interface/src/abstracts.ts:202), [SmartCard.class()](packages/interface/src/abstracts.ts:283)
- RN Nitro型定義: [JsapduRn.interface()](packages/rn/src/JsapduRn.nitro.ts:3)
- Androidエントリ: [JsapduRn.class()](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:6)
- 設定: [nitro.json](packages/rn/nitro.json:1)
- 実装者チェックリスト: [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1)
- API契約（単一情報源）: [api-contract.md](packages/rn/docs/tsd/api-contract.md:1)

## FFI中立性（必須）

- 公開FFIのメソッド名・引数・戻り値にOS特有の語（ReaderMode, IsoDep, Intent, Activity）を使用しない。
  用語置換: ReaderMode→RF enable/disable（内部）、IsoDep→ISO-DEP session（内部）（参照 [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:7)）。
- DeviceInfoの apduApi は ["nfc","androidnfc"] を返却（Android）。FFI公開では両方を含める。なお、OS語の非露出原則に対する例外として apduApi に OS識別を含めるが、メソッド名・引数・戻り値には OS語を含めない（参照 [api-contract.md](packages/rn/docs/tsd/api-contract.md:14)、[implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1)）。

OS中立性の定義（補足）
- 目的は「移植不能なOS専用APIがFFIへ漏れてユーザ実装が if-platform まみれになる事態」を避けること。公開APIは中立語で統一し、OS差は内部で吸収する。
- OS間の挙動を完全同一にする義務は課さない。差分は契約の例外写像（中立コード体系）と技術仕様の実装注意で扱う。
- OS識別はメタデータ（apduApi、将来的な device.os 等）で許容し、分岐は原則「能力・方針」に基づける（例: 本仕様では拡張APDUの事前検出を行わない方針を採用）。

## 命名規約（FFI公開）

公開FFIはインタフェース契約の動詞・名詞を用いる。内部OS語は使わない。

- Platform
  - init → [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33)
  - release → [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)
  - getDeviceInfo → [SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87)
  - acquireDevice → [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)

- Device
  - isDeviceAvailable → [SmartCardDevice.isDeviceAvailable()](packages/interface/src/abstracts.ts:231)
  - isCardPresent → [SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240)
  - waitForCardPresence → [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)
  - startSession → [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249)
  - startHceSession（初期版未対応） → [SmartCardDevice.startHceSession()](packages/interface/src/abstracts.ts:264)
  - release → [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269)

- Card
  - getAtr → [SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)
  - transmit → [SmartCard.transmit()](packages/interface/src/abstracts.ts:300)
  - reset → [SmartCard.reset()](packages/interface/src/abstracts.ts:306)
  - release → [SmartCard.release()](packages/interface/src/abstracts.ts:312)

## 型・データマーシャリング

- APDUコマンド/応答
  - 入出力は Uint8Array（ArrayBuffer所有）で統一。APDU生成/復元は [CommandApdu.class()](packages/interface/src/apdu/command-apdu.ts:5), [ResponseApdu.class()](packages/interface/src/apdu/response-apdu.ts:1) を用いる。
  - Base64や文字列によるペイロード表現は禁止（ログ・デバッグ用途のみ文字列化可）。

- 例外・エラー
  - すべて [SmartCardError.class()](packages/interface/src/errors.ts:23) によるコード体系へ正規化。未知の例外は [fromUnknownError()](packages/interface/src/errors.ts:115) でラップ。
  - 正規化の責務分担（ハイブリッド）: Kotlin側は既知のAndroid I/O例外を "PLATFORM_ERROR" に正規化し、それ以外の未知例外はそのまま投げる。TS側（[JsapduRn.interface()](packages/rn/src/JsapduRn.nitro.ts:3)）で [fromUnknownError()](packages/interface/src/errors.ts:115) により最終正規化を行う。Kotlin入口: [JsapduRn.class()](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:6)
  - 代表コード: NOT_INITIALIZED, ALREADY_INITIALIZED, CARD_NOT_PRESENT, TIMEOUT, ALREADY_CONNECTED, INVALID_PARAMETER, PLATFORM_ERROR, PROTOCOL_ERROR（参照 [api-contract.md](packages/rn/docs/tsd/api-contract.md:62)）。

## スレッド・非同期

- UIスレッドでのI/O禁止。APDU送受信・待機・セッション操作は非UIスレッドで実行（参照 [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:77)）。
- Promise/同期値の整理:
  - 時間のかかる操作（waitForCardPresence, startSession, transmit, reset, release）はPromise（async）扱い。
  - インタフェース仕様に従い、軽量問い合わせ（isDeviceAvailable, isCardPresent, getDeviceInfo）も Promise（非同期）とする。仕様変更は行わない。

## 並行性・排他

- RF enable/disable、session start/release、transceive は直列化。AsyncMutex等で再入禁止（参照 [android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md:42)）。
- 多重検出イベントはセッション確立完了まで抑制（参照 [android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md:46)）。

## ライフサイクル・キャンセル

- 画面オフ／Doze時は待機・I/Oをキャンセルし、Deviceを [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) で解放。待機中断は "TIMEOUT" 返却（参照 [android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md:107)）。ホストは [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) → [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) を再実行。
- RF有効化は acquireDevice、無効化は release に一致させる（参照 [android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md:105)）。

## APDU長・拡張長（方針）

- 拡張APDU（Lc/Le二バイト）は検出を行わず常時使用前提とする。非対応による失敗は [fromUnknownError()](packages/interface/src/errors.ts:115) でラップして "PLATFORM_ERROR" として正規化する（参照 [api-contract.md](packages/rn/docs/tsd/api-contract.md:15)）。
- 送受信の長さ上限は [length-limits.md](packages/rn/docs/tsd/length-limits.md:1) に準拠。端末上限超過は原則 "INVALID_PARAMETER"、端末I/O例外は一般に "PLATFORM_ERROR"。
- 初期版では分割送受信を実装しない。将来の拡張で検討（参照 [length-limits.md](packages/rn/docs/tsd/length-limits.md:17)）。

## ロギング・機微情報

- APDU内容・タグUID等の機微情報は原則非出力。開発時のみ限定ログ（参照 [test-plan.md](packages/rn/docs/rdd/test-plan.md:61)）。
- エラー詳細は [SmartCardError.getDebugInfo()](packages/interface/src/errors.ts:51) に基づく。

## 実装の落とし穴（Pitfalls）

- UIスレッドからtransceiveを呼び出し、ブロック／ANRを招く。
- 待機中の画面オフ／Dozeキャンセル時にDeviceを解放しない（リーク）。
- APDU長上限の事前検査をせず、端末側エラーに依存する。
- OS語（ReaderMode, IsoDep）をFFI名や戻り値に露出。

## 検証と受入

- 実装は [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) の受入基準に従いレビューする。
- 仕様準拠は [api-contract.md](packages/rn/docs/tsd/api-contract.md:1) を単一情報源とし、RDD/DDD/TSDはリンク参照で重複を避ける。

## 改訂

- 規約変更時は本書と [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1)、[api-contract.md](packages/rn/docs/tsd/api-contract.md:1) を同時更新。重複本文は作らず索引 [index.md](packages/rn/docs/index.md:1) を更新して誘導する。