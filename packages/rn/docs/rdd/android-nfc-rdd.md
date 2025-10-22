## 統合告知
本書は範囲/制約の要点に圧縮しました。設計・仕様・契約の本文は以下に集約しています。
- 実装手順と受入基準: [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1)
- 公開API契約: [api-contract.md](packages/rn/docs/tsd/api-contract.md:1)
- 技術仕様: [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:1)
- 設計詳細: [android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md:1)

# Android NFC要件定義書

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装について、要件を正式に定義するものである。対象はReact Native Nitro Modulesを基盤としたネイティブ実装であり、JSレイヤーは型定義および最小限のバインディング提供に留める。

実装者向けのチェックリストは [implementer-checklists.md](packages/rn/docs/implementer-checklists.md:1) を参照。文書の目次は [index.md](packages/rn/docs/index.md:1) に整理する。

## FFI中立性の原則

- 公開API（FFI）はOS特有の概念を露出しない。Android特有のReaderMode、IsoDep、Intent等の語は公開APIのメソッド名・引数・戻り値に含めない。
- 当該語が登場する説明は「実装注意（Android）」に限定し、要件本文では「RF有効化」「カード存在イベント」「APDU送受信」等の中立用語で定義する（契約は [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) に準拠）。
- DeviceInfoのAPI識別子は中立名（例: "nfc"）を用いる。実装差異は内部注記で管理し、FFIの戻り値にはOS名を含めない。
- 本原則は将来のiOS実装における互換性維持のため必須である。

（注）本要件におけるAndroid固有の挙動は、公開契約の内部注記として扱い、FFIの表面設計には反映しない。

本書における主眼はISO-DEPによるAPDUレベルの通信であり、NDEF等の上位プロトコルは対象外とする。ホストカードエミュレーションは将来計画とし、初期リリースでは範囲外とする。

## 目的と範囲

本実装の目的は、Android端末の統合NFCリーダ機能を用いて、ISO-DEP対応スマートカードとのAPDU送受信を確実かつ安定的に提供することである。範囲はプラットフォーム初期化、デバイス取得、カード検出、セッション確立、APDU送受信、セッション解放までを含む。

対象外の機能は次のとおりとする。NDEF読み書き、MIFARE Classic等の非標準プロトコル、アプリケーション層のファイルシステムやデータ構造の解釈、ホストカードエミュレーションの機能提供。

## 背景と関連規格

本実装は、ISO/IEC 7816-4に準拠するAPDUコマンド体系、およびISO/IEC 14443 Type A/Bを基盤とした近接型非接触カードのプロトコルを前提とする。NFC-F（FeliCa）は将来対応対象とするが、初期リリースでは機能保証の範囲に含めない。AndroidプラットフォームではReaderModeおよびIsoDepクラスを活用し、タグ検出からトランシーブまでを端末ネイティブAPIで実現する。

本プロジェクトは既存のPC/SC実装（参考）の設計原則に沿い、プラットフォーム、デバイス、カードという三層の責務分離を踏襲する。React Native Nitro Modulesにより、JSIバインディングを介した高効率なJSとの連携を提供する。

## 対象環境

対象OSはAndroid API Level 24以上とする。NFC機能を有する端末での動作を前提とし、ReaderModeが利用可能であることを条件とする。React Nativeは新アーキテクチャ（JSI/Nitro Modules）を前提とし、64bitアーキテクチャにおける安定動作を必須要件とする。

権限要件はNFC利用に係るシステム権限を前提とし、起動時または初期化時に当該権限が満たされない場合は適切な失敗応答を返すものとする。

## 機能要件

本実装は、プラットフォーム初期化と解放、統合NFCデバイス情報の提供、デバイスの取得、ReaderModeの有効化および無効化、タグ検出のイベント駆動型待機、カードセッションの開始と終了、APDUの送受信、カード属性（ATS相当）の取得を提供するものとする。

プラットフォームの初期化は一度のみ成功させ、二重初期化を防止する。解放時には未解放のデバイスおよびカードセッションを順序立てて解放し、ReaderModeを停止する。

デバイス情報は統合NFCリーダを一意のデバイスとして表現し、表示名、説明、APDU対応可否、HCE対応可否、D2CおよびP2Dのプロトコル属性、APDU API識別子は "nfc" を用いる。

デバイス取得時にReaderModeを有効化し、セッション解放時にReaderModeを無効化する。ReaderModeのフラグはNFC-A、NFC-B、NFC-Fを有効化し、NDEF関連の処理を回避する設定を適用する。

カード検出はイベント駆動とし、所定のタイムアウト内にタグが検出されない場合はタイムアウトとして扱う。検出後のセッション開始はIsoDepを介して確立し、APDU送受信の前提条件を満たす。

APDU送受信は、要求コマンドの妥当性を前提とし、拡張長を含む応答長の取り扱いに留意する。応答データとステータスワード（SW1、SW2）を返却し、異常時には定義済みエラーを返す。

カード属性の取得は、ATRに相当するATSを返却対象とし、AndroidのIsoDepが提供する情報の範囲で一貫した表現を採用する。

## 非機能要件

性能は、タグ検出からセッション開始までの遅延、およびAPDU往復のレイテンシとスループットについて、実用上許容可能な値を維持することを目標とする。安定性は、連続処理時の資源リークの回避、例外発生時の確実な解放、状態遷移の整合性維持を必須とする。

堅牢性向上のため、タイムアウト、再試行、排他制御、イベントキャンセルに関する実装方針を遵守する。ログは開発時のトレースに資するが、運用時の過度な情報出力を避ける。

## 制約

NDEFは対象外とし、APDUレベルの通信に専心する。ISO-DEPを主対象とし、NFC-Fは将来計画とする。拡張APDUにおける長さの取り扱い、バッファ上限、端末実装差による制約については仕様内で明示し、超過時はエラーとする。

ReaderModeの有効化はデバイス取得時に限定し、不要時は速やかに無効化する。権限未付与、NFC機能無効、ReaderMode非対応等の環境制約に対しては、適切なエラー応答を定義する。

## エラーモデル

エラーは、未初期化、二重初期化、リソース不足、パラメータ不正、タイムアウト、プラットフォーム障害、カード非在、接続重複等の区分により識別される。各エラーは安全なメッセージと開発時の詳細情報を持ち、外部ライブラリ由来の例外はラップして報告する。

タイムアウトは待機系の操作に適用され、処理中断後は状態の整合性を保ちつつ復帰可能とする。カード非在は検出時と送受信時の双方で適切に扱い、状態遷移の不整合を招かないようにする。

## セキュリティ

ReaderModeは必要な期間に限定して有効化し、不要時は停止することで不要なRF発信を抑制する。権限および設定に関する検査を初期化時に実施し、不備がある場合は明確な失敗応答を返却する。

APDU通信に伴う機微情報の取扱いについては、ログ出力の抑制、メモリ管理の適正化、例外時の資源解放を徹底する。

## 性能および測定基準

測定は、タグ検出遅延、セッション確立までの時間、単一APDUの往復遅延、連続送受信時の平均レイテンシおよび分散を対象とする。測定条件、試験カード、端末型式、温度等の外的要因を試験記録に明示する。

評価は、上記指標が目標値を満たすこと、異常時の復帰時間が許容範囲内であること、連続試験において資源リークやハングが発生しないことを基準とする。

## 用語定義

APDUは、スマートカードとのコマンドおよび応答の単位であり、ISO/IEC 7816-4に準拠する。ReaderModeは、Android端末がタグ検出に関与する動作モードであり、NDEF検出の回避設定を併用する。IsoDepは、ISO-DEPプロトコルに基づくトランシーブ機能を提供するAndroidの抽象である。ATRは接触型カードにおける応答であり、ATSは非接触型における同等情報として扱う。Nitro Modulesは、React Nativeにおける高効率なJSIバインディング基盤である。

## 承認基準

本要件の承認は、初期化、デバイス取得、ReaderMode有効化、カード検出、セッション開始、APDU送受信、セッション解放の一連の操作が仕様どおりに完了し、定義済みのエラーおよびタイムアウトが適切に扱われ、非機能要件の性能および安定性基準を満たすことを条件とする。

さらに、ログおよび例外の取り扱いが本書の方針に合致し、対象外機能が提供されていないこと、ReaderModeの有効期間が必要最小限に限られていることを確認する。

## 改訂管理

本書の改訂は、設計文書および技術仕様の更新に追随して行う。範囲変更、対象外機能の追加、ReaderModeのフラグ構成変更等の重要事項については、事前のレビューおよび承認を要する。

### 非機能要件（追補）

送受信のタイムアウトはセッション単位で設定・取得可能であり、長時間処理コマンドに対して適正化する。最大送信長は端末実装に依存し、実行時に取得した数値を上限として運用する。接続および送受信はメインスレッドから発行してはならず、ブロッキングI/Oは解放操作によりキャンセル可能である。これらの要件は [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) および [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) における運用規程と整合する。

### 互換性（追補）

拡張長APDUの可否は端末差異に基づき、動的確認を前提とする。送信可能最大長も端末により異なるため、実機測定により受入基準を確立する。数値および測定条件の管理は端末差異仕様および長さ規程に従う（参照: [packages/rn/docs/tsd/compat-devices.md](packages/rn/docs/tsd/compat-devices.md)、[packages/rn/docs/tsd/length-limits.md](packages/rn/docs/tsd/length-limits.md)、[packages/rn/docs/rdd/test-plan.md](packages/rn/docs/rdd/test-plan.md)、[packages/rn/docs/rdd/performance-metrics.md](packages/rn/docs/rdd/performance-metrics.md)）。
### ReaderModeフラグ方針（確定）

- 有効フラグ: NFC_A | NFC_B | NFC_F | SKIP_NDEF（NDEFは非対象）
- 初期実装の対象: ISO-DEPのみ（FeliCaは検出対象に含めるが、処理は行わない）
- 有効化／無効化の時機: RFは [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) で有効化し、 [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) で無効化する。
- カード存在検知: ReaderModeのコールバックによりイベント駆動で検出し、 [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) の同期待ち挙動と整合するように運用する。
### ライフサイクル（画面オフ／Doze）方針（確定）

- 画面オフ時、Doze移行時はReaderModeをキャンセルする。キャンセルはイベント通知のみではなく、デバイスの解放（ [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) ）を必ず伴う。
- RFの有効化／無効化は継続して [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)／[SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) によって管理する。キャンセルが発生した場合も同様に解放する。
- ブロッキング待機（ [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) ）中にキャンセルが発生した場合、待機は直ちに打ち切られ、 [TimeoutError.class()](packages/interface/src/errors.ts:84)（TIMEOUT）を返す。内部的にはデバイスが解放されるため、その後の操作は新たなデバイス取得から再開する。
- FFI中立性の維持: パブリックAPI／FFIにAndroid特有の概念（ReaderMode固有型・インテント等）を持ち込まない。挙動はインタフェース契約（ [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17)、[SmartCardDevice.class()](packages/interface/src/abstracts.ts:202)、[SmartCard.class()](packages/interface/src/abstracts.ts:283) ）に従うクロスプラットフォーム仕様として定義する。将来のiOS実装においても同一契約で整合することを保証する。