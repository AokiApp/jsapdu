# Android NFC試験計画書

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装に関する試験計画を定めるものである。対象はNitro Modulesを基盤とするネイティブ実装であり、ISO-DEPに基づくAPDUレベルの通信機能の妥当性、性能、安定性、回復性、電力特性を評価する。

本計画は、要件定義書 [packages/rn/docs/rdd/android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md)、設計詳細仕様書 [packages/rn/docs/ddd/android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md)、技術仕様書 [packages/rn/docs/tsd/android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md) を準拠文書とし、公開APIは [JsapduRn.interface()](packages/rn/src/JsapduRn.nitro.ts:3) および実装エントリは [JsapduRn.class()](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:6) に従う。

なお、本計画に記載のAPI参照は、インタフェース契約として [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33)、[SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)、[SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)、[SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)、[SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249)、[SmartCardDevice.release()](packages/interface/src/abstracts.ts:269)、[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)、[SmartCard.transmit()](packages/interface/src/abstracts.ts:300)、[SmartCard.reset()](packages/interface/src/abstracts.ts:306) を対象とする。

## 適用範囲

本計画は、Android API Level 24以上の端末において、ReaderModeによりNFC-A、NFC-B、NFC-Fを有効化し、NDEF検出を回避する設定を前提として実施する。デバイスは端末内蔵の統合リーダを単一識別子として扱う。Nitroの設定は [nitro.json](packages/rn/nitro.json:1) に従う。

試験は、機能試験、異常系試験、性能試験、長時間安定性試験、電力試験を含む。将来のHCE機能は本計画の対象外である。

## 用語

本書におけるAPDUはISO/IEC 7816-4に準拠するコマンドおよび応答の単位を指す。ATRは接触型の応答、ATSは非接触型の同等情報として扱う。AndroidにおけるIsoDepはAPDU送受信の抽象とし、ReaderModeはタグ検出の動作モードを指す。

## 試験環境

使用端末、OSバージョン、ビルド種別、NFC設定、アプリのビルド構成を試験記録に明記する。端末互換性の詳細は後続の互換性付録文書に整理する予定である。測定機材（電力計、温度計）の有無と設定を併せて記録する。

## 試験観点

試験は、初期化と解放の手続きが規定どおりに完了すること、デバイス取得時にReaderModeが適切に有効化され解放時に無効化されること、カード検出の待機が指定タイムアウト内で適切に成立またはタイムアウトすること、セッション開始がイベント駆動で整合的に確立されること、APDU送受信が妥当な応答とステータスワードを返却すること、属性取得がATS相当を返却すること、異常時のエラー写像が仕様に合致すること、並行呼出しが排他制御により整合性を保つことを確認する。

## 品質基準（定量）

受入判定に用いる定量的基準を以下のとおり定める。数値は初期目標値であり、実測結果により合理的範囲で見直す。カードはISO-DEP対応、アンテナ重ね合わせ、室温二十五度、端末省電力オフを標準条件とする。

1. タグ検出遅延は、ReaderMode有効化後にカード接触から [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) が成立するまでの時間を測る。中央値三百ミリ秒以下、九十五パーセンタイル一秒以下を目標とし、許容上限は二秒とする。

2. セッション確立時間は、タグ検出から [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) が返却するまでを測る。中央値二百ミリ秒以下、九十五パーセンタイル五百ミリ秒以下を目標とする。

3. APDU往復遅延は、小サイズのAPDU（例: SELECT）の [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) 一往復の時間を測る。中央値八十ミリ秒以下、九十五パーセンタイル二百ミリ秒以下を目標とする。拡張長を伴う場合は中央値二百ミリ秒以下、九十五パーセンタイル五百ミリ秒以下を目標とする。

4. 長時間安定性は、連続五百回のセッション確立とAPDU送受信において例外が発生せず、メモリおよびハンドルのリークが検出されないことを確認する。セッション未解放が残置しないことをもって合格とする。

5. タイムアウトの忠実度は、指定値に対する実測終了時刻の偏差が五百ミリ秒以内であることを目標とし、許容上限を一秒とする。

6. 電力特性は、ReaderMode待機中の平均電力上昇がアプリ非待機時基準に対して百ミリワット以内であることを目標とし、温度上昇が短時間で顕著に増加しないことを確認する。

7. エラー写像は、代表異常事象に対して [SmartCardError.code](packages/interface/src/errors.ts:31) の割当てが仕様に一致することを条件とする。未初期化は"NOT_INITIALIZED"、二重初期化は"ALREADY_INITIALIZED"、カード非在は"CARD_NOT_PRESENT"、タイムアウトは"TIMEOUT"、重複接続は"ALREADY_CONNECTED"、パラメータ不正は"INVALID_PARAMETER"、プラットフォーム障害は"PLATFORM_ERROR"とする。

## 試験手順

機能試験として、初期化と解放の順序性を確認する。まず [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) を呼出し、二重初期化時に適切に拒否されることを検証する。続いて [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) を呼出し、ReaderModeが有効化されることをログにより確認する。カード非接触状態で [SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240) が偽を返すことを確認し、指定タイムアウトで [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) がタイムアウトすることを確認する。カード接触により当該待機が直ちに成立することを確認し、ただちに [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) を呼出してセッションが確立することを確認する。

APDU送受信の試験として、[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293) がATS相当を返却することを確認する。標準的なSELECTコマンドとREAD BINARYのシーケンスを [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) で実行し、応答データとステータスワードの妥当性を検証する。拡張長APDUについては、端末上限に抵触しない範囲のデータ長を選定し、成功することを確認する。

異常系の試験として、未初期化状態での各API呼出しが"NOT_INITIALIZED"を返すこと、二重初期化が"ALREADY_INITIALIZED"となること、重複取得が"ALREADY_CONNECTED"となること、カード非在時のセッション開始が"CARD_NOT_PRESENT"となること、タイムアウト系が"TIMEOUT"となること、外部例外が [fromUnknownError()](packages/interface/src/errors.ts:115) により"PLATFORM_ERROR"でラップされることを確認する。

並行実行の試験として、ReaderModeの有効化・無効化、セッション開始・解放、APDU送受信の同時呼出しをシナリオ化し、排他制御により整合的に直列化されることを確認する。既存PC/SC実装の [PcscCard.transmit()](packages/pcsc/src/card.ts:61) が暗黙に示す応答バッファ方針との整合性を評価し、Android側で過大なLe指定が適切に扱われることを確認する。

長時間安定性の試験として、カード接触状態で連続送受信を百往復以上繰り返し、例外・リークの無いことを確認する。離脱・再接触を含むシナリオを追加し、セッションの再確立と状態整合性の維持を確認する。

電力特性の試験として、ReaderMode待機を十分な時間保持し、消費電力および端末温度の変化を記録する。必要に応じて間欠駆動の効果を比較し、受入基準に適合するかを判定する。

## 測定手法

時間計測は、アプリ内の高分解能タイマにより開始・終了時刻を取得し、同一条件の反復により中央値、九十五パーセンタイルを算出する。電力は可能な範囲で外部電力計またはプラットフォームAPIにより測定する。ログは時刻、スレッド、操作名、結果、エラーコードを含め、機微情報は原則出力しない。

## 成果物

試験報告書には、試験環境、手順、結果、統計値、逸脱とその根拠、改善提案を含める。逸脱があった場合は、暫定措置と恒久対応の案を併記する。

## 承認

本計画の受入は、各試験の実施結果が「品質基準（定量）」に適合し、重大な未解決の逸脱がないことを条件とする。適合しない場合は、設計の見直しまたは受入基準の合理的改訂を審議する。
