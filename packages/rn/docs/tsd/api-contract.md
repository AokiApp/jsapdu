# Android NFC API契約仕様

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装における公開APIの契約を定めるものである。対象はNitro Modulesのハイブリッドオブジェクトを介したJSI連携であり、プラットフォーム、デバイス、カードの三層構造に属する各メソッドについて、前提条件、事後条件、終了条件、例外写像、時間制約、同期規程を文章により明確化する。

参照すべき基本契約は [SmartCardPlatformManager.class()](packages/interface/src/abstracts.ts:7)、[SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) に定義される。Android側の実装は、PC/SC参照実装の運用上の含意に整合する形で具体化される（例: [PcscDevice.startSession()](packages/pcsc/src/device.ts:156)、[PcscCard.transmit()](packages/pcsc/src/card.ts:61)）。APDU型は [CommandApdu.class()](packages/interface/src/apdu/command-apdu.ts:5) および [ResponseApdu.class()](packages/interface/src/apdu/response-apdu.ts:1) を用いる。

実装者向けのチェックリストは [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) を参照。文書の目次は [index.md](packages/rn/docs/index.md:1) に整理する。

## FFI中立性の原則

- 公開API（FFI）はOS特有の概念を露出しない。ReaderMode、IsoDep、Intent、Activity等の語は公開APIのメソッド名・引数・戻り値に含めない。契約は [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) に基づく中立語（RF有効化、カード存在イベント、APDU往復）で記述する。
- Android特有の挙動に関する言及は「実装注意（Android）」に限定し、FFI公開契約の本文には含めない。
- 例外、時間制約、同期規程はプラットフォーム非依存のコード体系に統一する（参照: [SmartCardError.class()](packages/interface/src/errors.ts:23)、[TimeoutError.class()](packages/interface/src/errors.ts:84)）。
- DeviceInfoのAPI識別子は apduApi=["nfc", "androidnfc"] を返却する。FFI契約として Android 実装は両方を含めること。OS名は追加してもよい（内部注記として impl=android なども管理可）。
- 拡張APDU（Lc/Le二バイト）は検出を行わず常時使用前提とする。拡張APDU非対応端末はサポート外とし、未処理例外によるクラッシュを許容する（レガシー端末切り捨て方針）。端末上限は [length-limits.md](packages/rn/docs/tsd/length-limits.md:11) に従い、呼出側が遵守する。
- ATR取得順序は「Historical Bytes優先、無ければ HiLayerResponse(ATS) の生バイト」。取得不能時は "PROTOCOL_ERROR" とする（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）。
- 非対象タグ（FeliCa/NDEF）は [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) で内部抑制し、ISO-DEP検出のみ待機成立とする。
- 拡張APDUに関する能力検出および事前切り捨ては行わない（acquireDevice 段階での判定は実施しない）。
- 将来のiOS実装に対しても同一契約で整合させるため、公開APIはOS非依存の振る舞いを保証する。

（注）本書におけるAndroid固有語の登場はFFIの内部実装注記であり、公開契約の一部ではない。

補足（OS中立性の定義と範囲）

- OS中立性とは、公開FFIにOS固有の関数名・クラス名・フレームワーク語（例: CoreNFC, ReaderMode, IsoDep, Intent, Activity）を持ち込まないことを指す。
- OS間で挙動を完全同一にすることを強要するものではない。差分は契約の例外写像・方針・実装注意で吸収し、公開APIの形を共通に保つ。
- OS識別はメタデータ（例: apduApi、将来的な device.os）として許容する。ユーザコードに if-platform 分岐を強制せず、契約・方針で統一された振る舞いにより移植容易性を担保する。

## 総則

本契約における「前提条件」は呼出時点で満たすべき状態を指し、「事後条件」は正常終了後に保証される状態を指す。「終了条件」は戻り値または効果の記述であり、「例外写像」は異常系におけるコード割当てを指す。待機および送受信に関する時間制約は、試験計画および性能測定条件に基づく数値を用いて評価される（参照: [packages/rn/docs/rdd/test-plan.md](packages/rn/docs/rdd/test-plan.md)、[packages/rn/docs/rdd/performance-metrics.md](packages/rn/docs/rdd/performance-metrics.md)）。APDU長の扱いは別規程に従う（参照: [packages/rn/docs/tsd/length-limits.md](packages/rn/docs/tsd/length-limits.md)）。

## メソッド別契約（プラットフォーム）

[SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) は、未初期化であることを前提条件とする。正常終了後、プラットフォームは初期化済み状態となり、ReaderModeの有効化に必要な前準備を完了していることを事後条件とする。二重初期化は "ALREADY_INITIALIZED" として扱い、環境不備や権限未充足は "PLATFORM_ERROR" とする。

[SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39) は、初期化済みであることを前提条件とする。正常終了後、全ての取得済みデバイスは解放され、ReaderModeに係る前準備は解除され、プラットフォームは未初期化状態に戻ることを事後条件とする。未初期化時の呼出は "NOT_INITIALIZED"、デバイス側の解放失敗は "PLATFORM_ERROR" とする。

[SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87) は、初期化済みであることを前提条件とし、通常は内蔵NFCリーダを単一識別子のデバイスとして返すことを終了条件とする（現行の受入基準は0または1件成立）。非NFC端末の場合は0件を返却する。将来は複数デバイス（例: BLEリーダ）を許容する。IDは例示として "integrated-nfc-0" を用いるが固定ではない。公開スキーマはインタフェース定義に一致させ、追加フィールドは設けない。supportsHce は初期版では false 固定とする。apduApi は ["nfc","androidnfc"] を返却する。未初期化時は "NOT_INITIALIZED"、列挙失敗は "PLATFORM_ERROR" とする。

[SmartCardPlatform.acquireDevice(id)](packages/interface/src/abstracts.ts:103) は、初期化済みであること、および指定IDが返却済みデバイス情報に含まれることを前提条件とする。非NFC端末の場合、取得は常に "PLATFORM_ERROR" を返却する。正常終了後、ReaderModeは有効化され、デバイスは取得状態に遷移することを事後条件とする。重複取得は "ALREADY_CONNECTED" とし、ID不正は "READER_ERROR" とする。環境により共有違反等が生じた場合は "PLATFORM_ERROR" とする。

## メソッド別契約（デバイス）

[SmartCardDevice.isDeviceAvailable()](packages/interface/src/abstracts.ts:231) は、ReaderModeの有効化状態または既存セッションの存在に基づき可用性を返す。取得直後でカード非在であっても可用である。内部例外は抑制し、可用性判定の失敗は偽を返す。

[SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240) は、ロックを伴わない軽量判定であり、最後に検出されたタグの存否に基づく。正常終了時、カード非在は偽、在は真を返す。検査失敗は "PLATFORM_ERROR" とし、未初期化や未取得の状態はプラットフォーム側の契約に従い "NOT_INITIALIZED" 等を返す。

[SmartCardDevice.waitForCardPresence(timeout)](packages/interface/src/abstracts.ts:259) は、イベント駆動による待機を行う。前提条件はデバイス取得済みでReaderModeが有効化されていることであり、事後条件はISO-DEPタグ検出成立またはタイムアウト終了である。FeliCa/NDEF等の非対象タグは内部抑制し、待機は継続する。タイムアウトは "TIMEOUT" として返す。待機解除時の状態は整合性を維持する。加えて、画面オフやDoze移行等のキャンセル事象は公開契約上 "TIMEOUT" として正規化し、エラー写像の一貫性を維持する。

[SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) は、カード在を前提条件とし、IsoDepに基づくセッション確立を終了条件とする。既存のアクティブセッションがある場合、当該カード参照を返す。カード非在は "CARD_NOT_PRESENT"、確立失敗は "PLATFORM_ERROR" とする。重複確立の防止は同期規程に従う。

[SmartCardDevice.startHceSession()](packages/interface/src/abstracts.ts:264) は初期版では未対応とし、"UNSUPPORTED_OPERATION" を返す。

[SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) は、アクティブセッションの存在に関わらずデバイスを正しく解放し、ReaderModeを停止する。正常終了後、デバイスは非アクティブであり、プラットフォーム側のデバイス管理から除外される。カード解放失敗を伴う場合、"PLATFORM_ERROR" とする。

## メソッド別契約（カード）

[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293) は、まず Historical Bytes を返却対象とし、無ければ HiLayerResponse(ATS) の生バイトを返却する。Androidでは Type A の場合に [Historical Bytes]、Type B は ATS のみとなる。取得不能の判定は「null または長さ0」の場合とし、その際は "PROTOCOL_ERROR" を返す。アクティブセッションを前提とする。

[SmartCard.transmit(apdu)](packages/interface/src/abstracts.ts:300) は、アクティブセッションを前提条件とし、ISO-DEPセッションのtransceive（内部実装）により応答データとステータスワード（SW1、SW2）を返却することを終了条件とする。APDU長の扱いは [packages/rn/docs/tsd/length-limits.md](packages/rn/docs/tsd/length-limits.md) に従い、理論上限または端末上限を超える指定は "INVALID_PARAMETER" とする。拡張長サポートに関する事前検出およびランタイム検査は行わないため、非対応による失敗は公開FFIで正規化せず、未処理例外が伝播する可能性を仕様として許容する。transceive失敗は一般に "PLATFORM_ERROR" とする。

[SmartCard.reset()](packages/interface/src/abstracts.ts:306) は、アクティブセッションを前提としてセッション再確立により擬似的リセットを行う。正常終了後、カードは再度アクティブとなり、ATR/ATSの再取得が可能であることを事後条件とする。再確立不能は "PLATFORM_ERROR" とする。

[SmartCard.release()](packages/interface/src/abstracts.ts:312) は、アクティブ状態の解除を行う。正常終了後、カードは非アクティブであり、デバイス側の解放手続きに委ねる。重複解放は成功扱いとし、状態整合性を維持する。

## 時間制約

- 待機（[SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)）のタイムアウト初期値は 15000ms（確定）。安全側重視でユーザーがカードを認識するまでの十分な時間を確保。
- 送受信（[SmartCard.transmit()](packages/interface/src/abstracts.ts:300)）のタイムアウト初期値は 3000ms（確定）。端末差異や重いAPDU処理に対応するため安全側の値を採用。
- キャンセル検知（画面オフ／Doze）発火からの待機/I/Oキャンセル要求は ≤250ms 以内の発行を推奨し、公開FFIの戻りは "TIMEOUT" に正規化する（[Android NFC技術仕様書（TSD）](packages/rn/docs/tsd/android-nfc-tsd.md:53)）。
- 数値基準の最終適用は性能測定条件の章に従う（参照: [packages/rn/docs/rdd/performance-metrics.md](packages/rn/docs/rdd/performance-metrics.md)）。

## 同期規程

ReaderModeの有効化・無効化、セッション確立・解放、送受信は排他制御により直列化される。開始処理と解放処理の競合を防止し、複数のタグ検出イベントが同時到来した場合でも、セッション確立が完了するまで後続イベントを抑制する。規程はPC/SC参照実装のMutex運用に準ずる（例: [PcscDevice.startSession()](packages/pcsc/src/device.ts:156)、[PcscDevice.release()](packages/pcsc/src/device.ts:222)）。

### 非同期境界（推奨）

- 非同期（Promise）: [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33), [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39), [SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87), [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103), [SmartCardDevice.isDeviceAvailable()](packages/interface/src/abstracts.ts:231), [SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240), [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259), [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249), [SmartCard.transmit()](packages/interface/src/abstracts.ts:300), [SmartCard.reset()](packages/interface/src/abstracts.ts:306), [SmartCard.release()](packages/interface/src/abstracts.ts:312)
- 備考: 即時値の同期APIは原則設けない。内部I/Oが不要な問い合わせでも公開契約上はPromiseを返す。

（重複節の統合）非同期境界は前出の定義に従う。

## 例外写像

未初期化は "NOT_INITIALIZED"、二重初期化は "ALREADY_INITIALIZED"、カード非在は "CARD_NOT_PRESENT"、タイムアウトは "TIMEOUT"、重複取得は "ALREADY_CONNECTED"、パラメータ不正は "INVALID_PARAMETER"、プロトコル異常は "PROTOCOL_ERROR"、プラットフォーム障害は "PLATFORM_ERROR" とする。外部例外は [fromUnknownError()](packages/interface/src/errors.ts:115) によりラップし、原因情報を保持する。例外時の状態は整合的に復帰可能であるべきことを要件とする。

拡張APDU未正規化の方針（理由）

- 端末差（IsoDep実装・FSD/FSC・OEM制限）の振れ幅が大きく、事前検出の互換性コストが高い。
- ランタイム検出はI/O前段の追加ラウンドトリップを招きUX悪化・複雑化をもたらす。
- 分割送受信を初期版で不採用（設計簡素化）とするため、未対応端末では自然に例外が発生し、そのまま上位で処理した方が明快。

Android例外→SmartCardError写像（抜粋）

- java.io.IOException（I/O失敗/タグロスト含む）→ "PLATFORM_ERROR"（message: "NFC I/O通信に失敗しました"）
- android.nfc.TagLostException → "PLATFORM_ERROR"（message: "カードが取り外されました"）
- java.lang.IllegalStateException（接続状態不整合）→ "PLATFORM_ERROR"（message: "NFC接続状態が不正です"）
- android.nfc.ReaderModeException等 → "PLATFORM_ERROR"（message: "NFCリーダーモードでエラーが発生しました"）
- パラメータ組成不正（APDU長規程違反 等）→ "INVALID_PARAMETER"
- プロトコル不整合（APDUフォーマット破損/応答不正）→ "PROTOCOL_ERROR"

実装注意：[SmartCardError.message](packages/interface/src/errors.ts:31) にはユーザー向けの日本語説明を設定し、[SmartCardError.getDebugInfo()](packages/interface/src/errors.ts:51) には元例外の詳細情報を保持する。

Android例外→SmartCardError写像（抜粋）

- java.io.IOException（I/O失敗/タグロスト含む）→ "PLATFORM_ERROR"
- android.nfc.TagLostException → "PLATFORM_ERROR"
- java.lang.IllegalStateException（接続状態不整合）→ "PLATFORM_ERROR"
- パラメータ組成不正（APDU長規程違反 等）→ "INVALID_PARAMETER"
- プロトコル不整合（APDUフォーマット破損/応答不正）→ "PROTOCOL_ERROR"

## ログおよび機微情報

ログは時刻、操作名、結果、エラーコードを含めるが、APDU内容やタグ識別子等の機微情報は原則として出力しない。詳細情報は開発時に限定し、運用時は抑制する。エラー詳細は [SmartCardError.getDebugInfo()](packages/interface/src/errors.ts:51) の構造に従う。

## 受入基準

本契約の受入は、各メソッドが前提条件と事後条件を満たし、終了条件に適合し、例外写像が規定に一致し、時間制約が許容範囲内で遵守され、同期規程により並行呼出しが整合的に処理されることを条件とする。測定値の適合は性能測定条件の基準に従い判定する。

## 改訂管理

本書は、設計詳細、技術仕様、試験計画の改訂に追随する。端末差異による制約の追加、長さ上限の見直し、タイムアウト基準の改訂は、測定結果に基づきレビューおよび承認を経て反映する。関連文書の修正を同時に行い、整合性を維持する。
