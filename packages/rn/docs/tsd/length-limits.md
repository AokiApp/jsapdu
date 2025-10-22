# APDU長規程（Android NFC）

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装におけるAPDU長（Lc、Le、総バイト長）の取扱いを定めるものである。ISO-DEPに基づく拡張長APDUを含む諸条件について、許容範囲、制約、エラー写像、試験および受入基準を明文化する。

本規程は技術仕様書 [packages/rn/docs/tsd/android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md) を補完し、試験計画書 [packages/rn/docs/rdd/test-plan.md](packages/rn/docs/rdd/test-plan.md) および性能測定条件 [packages/rn/docs/rdd/performance-metrics.md](packages/rn/docs/rdd/performance-metrics.md) に整合する。API契約は [SmartCard.transmit()](packages/interface/src/abstracts.ts:300)、[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)、[SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) を参照する。シリアライズ仕様は [CommandApdu.class()](packages/interface/src/apdu/command-apdu.ts:5) および応答復元は [ResponseApdu.class()](packages/interface/src/apdu/response-apdu.ts:1) を参照する。

定義において、短長APDUはLc・Leを一バイトで表現し、Leの値0は256と解釈する。拡張長APDUはLc・Leを二バイトで表現し、Leの値0は65536と解釈する。これらの解釈は [CommandApdu.toUint8Array()](packages/interface/src/apdu/command-apdu.ts:53) および [CommandApdu.fromUint8Array()](packages/interface/src/apdu/command-apdu.ts:131) の挙動に一致する。

- AndroidのIsoDepにおけるtransceiveは、端末実装に依存する最大受信長を持つ。理論上の拡張長上限は六万五千五百三十六バイトのデータ部とステータス二バイトであるが、端末はこれより小さい上限を持つ場合がある。
- 本ライブラリは拡張APDU（Lc/Le二バイト）を必須対応とし、非対応端末は切り捨て対象。FFI契約上は常に拡張長APDUが利用可能であることを前提とする。端末上限は本規程の理論値を採用し、個別端末の非対応はサポート外。
- ATRはATSそのまま（生バイト）を返すことを仕様として固定する（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）。歴史バイトや他形式は考慮しない。
- 非対象タグ（FeliCa/NDEF）は [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) で内部抑制し、ISO-DEP検出のみ待機成立とする。
- 拡張APDU非対応端末は [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) 時点で "PLATFORM_ERROR" により切り捨てる（契約に明記）。

規程値として、応答バッファの理論上限は六万五千五百三十八バイト（データ＋SW1/2）とし、設計上の上限値として採用する。既存参照実装の [PcscCard.transmit()](packages/pcsc/src/card.ts:61) は応答バッファの上限を六万五千五百三十八バイトに設定している。Android実装はこの理論上限を超える指定を拒否する。

ただし、端末固有上限が理論上限より小さい場合、当該端末の上限に従う。端末上限は互換性仕様 [packages/rn/docs/tsd/compat-devices.md](packages/rn/docs/tsd/compat-devices.md) に記録し、測定に基づき更新する。

送信（Lc）に関して、短長APDUではLcは最大255、拡張長APDUでは最大65535とする。受信（Le）に関して、短長APDUでは最大256、拡張長APDUでは最大65536とする。ただし端末上限により、これら理論上限の範囲内でも拒否される場合がある。

分割送受信はライブラリでは対応しない（確定方針）。端末上限を超える読み出し要求は失敗とし、エラー写像に従い返却する。GET RESPONSEによる分割受信やChainingによる分割送信が必要な場合は、ユーザーアプリ側で [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) を複数回呼び出して実装すること。ライブラリは単一APDUの送受信のみ責務とする。

エラー写像は次のとおりとする。受信長指定（Le）が端末上限または理論上限を超える場合は [ValidationError.class()](packages/interface/src/errors.ts:99) により "INVALID_PARAMETER" を返却する。送信長（Lc）が端末上限を超える場合も同様とする。端末からのtransceive失敗により応答長上限に抵触が推定される場合は "PLATFORM_ERROR" とする。未初期化やセッション非アクティブ等の状態エラーについては、技術仕様の規定に従う。

実装指針は次のとおりとする。APDU送信前に、要求コマンドから期待応答長を推定し、理論上限を超える場合は送信を行わずに直ちにエラーを返却する。期待応答長が不定（Leがnull）の場合は、端末上限に基づく安全な受信バッファを確保し、過剰な受信が生じた際は端末側で切り詰められることを前提とせず、エラーとして扱う。応答は [ResponseApdu.fromUint8Array()](packages/interface/src/apdu/response-apdu.ts:12) により復元し、データとSW1/2を返却する。

試験は、試験計画書に準拠する。拡張長APDUの成功条件は、端末上限に抵触しない範囲のデータ長において、期待応答が正しく得られることである。過大なLe指定については、"INVALID_PARAMETER" の返却、transceive失敗時の "PLATFORM_ERROR" の返却を確認する。長さ規程の適合性は、代表端末における測定値と整合することをもって判定する。

受入基準は次のとおりとする。理論上限超過の要求が拒否されること、端末上限の範囲内で拡張長APDUが成功すること、過大なLe/Lc指定に対して一貫したエラー写像が行われること、長時間連続送受信において長さに起因する例外やリークが発生しないこと。

改訂管理において、端末上限の更新、分割送受信方針の追加、理論上限の見直しは、測定結果に基づきレビューおよび承認を経て反映する。関連文書（技術仕様、試験計画、互換性仕様）を同時に更新し、整合性を維持する。