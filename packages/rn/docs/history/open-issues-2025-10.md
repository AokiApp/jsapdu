# Archived: Android NFCオープン課題・リスク登録 (2025-10)

本書は、2025年10月時点でのAndroidにおけるISO-DEPベースのAPDU通信実装に関する未確定事項および潜在的リスクの記録です。現行の課題・リスクはGitHub Issuesおよび[Known issues](../rdd/test-plan.md)に移管されました。

---

# Android NFCオープン課題・リスク登録
本書は、AndroidにおけるISO-DEPベースのAPDU通信実装に関する未確定事項および潜在的リスクを整理し、意思決定と追跡を容易にすることを目的とする。対象はReact Native Nitro Modulesによるネイティブ実装であり、関連する契約は [SmartCardPlatform.init()](../../interface/src/abstracts.ts:33)、[SmartCardPlatform.release()](../../interface/src/abstracts.ts:39)、[SmartCardPlatform.acquireDevice()](../../interface/src/abstracts.ts:103)、[SmartCardDevice.waitForCardPresence()](../../interface/src/abstracts.ts:259)、[SmartCardDevice.startSession()](../../interface/src/abstracts.ts:249)、[SmartCardDevice.release()](../../interface/src/abstracts.ts:269)、[SmartCard.getAtr()](../../interface/src/abstracts.ts:293)、[SmartCard.transmit()](../../interface/src/abstracts.ts:300)、[SmartCard.reset()](../../interface/src/abstracts.ts:306) に依拠する。

## 適用範囲

本書はAndroid API Level 24以上、ReaderModeにおけるNFC-A、NFC-B、NFC-Fの同時有効化およびNDEF検出回避設定を前提としたAPDU通信機能に適用される。デバイスは端末内蔵の統合リーダを単一識別子として扱い、Nitro Modulesの設定は [packages/rn/nitro.json](../../rn/nitro.json:1) に従う。

## オープン課題

課題1（ISO-DEPのリセットセマンティクス）: [SmartCard.reset()](../../interface/src/abstracts.ts:306) の契約に対し、AndroidのIsoDepには明示的なリセット操作が存在しない。セッション再確立（IsoDepのクローズ&リオープン）、ReaderModeの一時無効化によるRF再交渉、あるいはカードの物理解放を前提とした運用のいずれかを準備する必要がある。初期方針としてはセッション再確立を標準とし、成功しない場合は [SmartCardError.code](../../interface/src/errors.ts:31) として "PLATFORM_ERROR" を返却する。

課題2（ATSの取得とATR相当の定義）: [SmartCard.getAtr()](../../interface/src/abstracts.ts:293) はATRまたはATS相当の返却を要求する。Androidにおいては歴史バイト（Historical Bytes）または上位層応答（HiLayerResponse）の取得可否が端末差異の影響を受ける。取得優先順位を歴史バイト、ついで上位層応答とし、両者が得られない場合は "PROTOCOL_ERROR" を返却する暫定案を採る。

課題3（ReaderModeフラグと電力影響）: NFC-A/B/Fを同時に有効化する構成は検出遅延および電力消費に影響を与えうる。NDEF検出回避の適用により不要な割込みを抑制するが、長時間待機時の電力プロファイルについて測定を実施し、必要に応じて待機時間、スリープ間隔、あるいは動的フラグ制御の方針を設ける。

課題4（権限および機能無効時のフォールバック）: デバイスがNFCを無効化している場合、あるいは権限要件を満たさない場合における初期化失敗の扱いを定義する必要がある。初期化時には明示的に検査を行い、未満足の場合は "NOT_INITIALIZED" または "PLATFORM_ERROR" を返却する。アプリケーション側で設定画面遷移を促す設計を前提とし、ライブラリ自体はUI遷移を実行しない。

課題5（タグ交換時の再確立ポリシー）: セッション中のカード離脱・再接触に対して、[SmartCardDevice.isCardPresent()](../../interface/src/abstracts.ts:240) の結果と [SmartCardDevice.startSession()](../../interface/src/abstracts.ts:249) の振る舞いを整合させる必要がある。タグ離脱検知時点で既存カードを非アクティブ化し、再接触後のセッション開始で新規カードオブジェクトを返却する方針とする。

課題6（transceive最大長と分割送受信）: 端末実装によりIsoDep.transceiveの最大長が異なり、拡張APDUの大きなLe指定が失敗する可能性がある。[CommandApdu.le](../../interface/src/apdu/command-apdu.ts:11) に基づく応答サイズ期待は維持しつつ、端末上限を超える場合は "PLATFORM_ERROR" もしくは "INVALID_PARAMETER" を返却する。必要に応じて分割送受信の導入可否を設計審議する。

課題7（タイムアウトの統一方針）: [SmartCardDevice.waitForCardPresence()](../../interface/src/abstracts.ts:259) と [SmartCard.transmit()](../../interface/src/abstracts.ts:300) に適用するタイムアウトの既定値と設定手段を統一する必要がある。初期案としては待機に数秒から十数秒、送受信は端末特性に応じた上限を用意し、[TimeoutError.class()](../../interface/src/errors.ts:84) により一貫して通知する。

課題8（HCEとの相互作用）: 初期リリースでは [SmartCardDevice.startHceSession()](../../interface/src/abstracts.ts:264) を未対応とする一方、OS側のHCEサービスが有効な環境との同時動作における影響評価を要する。現時点では仕様外とし、検出された問題は個別に記録・評価する。

課題9（ログと機微情報の取扱い）: デバッグ容易性と機微情報保護の両立が必要である。APDUの内容、ATS情報、タグUID等の取り扱いについて、開発時と運用時のログ方針を区別し、既定では赤線化または抑制を適用する。例外時の詳細情報は [SmartCardError.getDebugInfo()](../../interface/src/errors.ts:51) に委ねる。

課題10（並行操作と整合性）: Nitro経由のJS呼出しが並行到来する場合、ReaderModeの有効化・無効化、セッション確立・解放、送受信の各操作に競合が発生しうる。排他機構により直列化し、途中状態での再入を禁止する規約を文書化する。

## リスク一覧

リスクA（端末差異による互換性）: 応答長、ATS取得可否、イベントタイミング、電力管理の差異が品質に影響する。代表機種での評価、ならびに差異の吸収ポリシー策定が必要である。

リスクB（バックグラウンドおよびライフサイクル制約）: アプリケーション状態遷移に伴うReaderModeの停止・再開が検出に影響する。フラグ管理と状態遷移の手順を明確化し、不要なRF発信を抑制する。

リスクC（電力および発熱）: 長時間待機時の電力消費と発熱によりユーザ体験が低下する可能性がある。測定計画の整備と閾値超過時の措置（待機中断、間欠駆動等）が必要である。

リスクD（例外のラップ不足）: ネイティブ例外のまま上位へ伝播した場合、診断性が低下する。[fromUnknownError()](../../interface/src/errors.ts:115) による統一的なラップを徹底する。

## 対応方針

初期リリースではISO-DEPの安定性を最優先とし、HCEおよびNFC-Fに関する機能は段階的に対象化する。タイムアウト、再試行、排他制御に関する基本方針を設計書に反映し、ReaderModeの有効期間は必要最小限とする。ATSの取得は優先順位に基づいて実装し、不取得時の扱いを仕様として明示する。端末差異については制約事項としてTSDに記述し、事前に回避可能な条件はAPIの前提条件として公開する。

## 見直し計画

本書の各課題は実装進捗と試験結果に応じて更新する。設計詳細仕様書および技術仕様書への反映は、課題クローズ時に必ず実施する。優先順位はISO-DEPのリセットセマンティクス、ATSの定義、transceive最大長の三点を最上位とし、評価完了後にReaderModeフラグおよび電力影響の最適化に移行する。