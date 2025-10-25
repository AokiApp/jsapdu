# Android NFC性能測定条件および評価指標

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装に関する性能評価の枠組みを定めるものである。ISO-DEPに基づくAPDUレベルの通信機能について、遅延、スループット、安定性、タイムアウト忠実度、電力特性等を測定し、受入可否の判定に資する定量的基準を提示する。

本書は、要件定義書の方針を補完し、試験計画書に記載された試験観点を定量化する性質を持つ。参照文書は、要件定義書 [packages/rn/docs/rdd/android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md)、試験計画書 [packages/rn/docs/rdd/test-plan.md](packages/rn/docs/rdd/test-plan.md)、設計詳細仕様書 [packages/rn/docs/ddd/android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md)、技術仕様書 [packages/rn/docs/tsd/android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md) である。API契約は、タグ待機の基準を [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)、送受信を [SmartCard.transmit()](packages/interface/src/abstracts.ts:300)、初期化と解放を [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) および [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)、デバイス取得を [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)、属性取得を [SmartCard.getAtr()](packages/interface/src/abstracts.ts:293) により規定する。既存PC/SC実装の運用上の含意は、応答バッファ方針の例として [PcscCard.transmit()](packages/pcsc/src/card.ts:61) を参照する。

## 測定目的

本測定は、ユーザの操作に対する応答性、連続運用時の安定性、タイムアウトの遵守、過大な負荷時の振る舞い、およびReaderMode待機中の電力特性を明らかにすることを目的とする。測定値は受入基準の判定、設計改善の優先度付け、互換性上の注意事項の抽出に用いる。

## 測定対象および指標

測定対象は、タグ検出遅延、セッション確立遅延、APDU往復遅延（標準長および拡張長）、長時間安定性、タイムアウト忠実度、電力特性と温度特性である。指標は、中央値、九十五パーセンタイル、許容上限値を基本とし、必要に応じて分散および標準偏差を併記する。

タグ検出遅延は、ReaderMode有効化とカード接触により [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) が成立するまでの時間を対象とする。セッション確立遅延は、タグ検出成立から [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) が返却するまでの時間を対象とする。APDU往復遅延は、標準的コマンドおよび拡張長コマンドについて [SmartCard.transmit()](packages/interface/src/abstracts.ts:300) の呼出から応答受領までの時間を対象とする。長時間安定性は、セッション確立と送受信の反復における例外とリークの発生有無を対象とする。タイムアウト忠実度は、待機操作および送受信操作が指定値に対して許容誤差内で終了するかを対象とする。電力特性と温度特性は、ReaderMode待機中の平均電力上昇と温度変化を対象とする。

## 測定条件

標準条件は、Android API Level 24以上、NFC機能有効、ReaderModeはNFC-A、NFC-B、NFC-Fを同時有効化しNDEF検出を回避する設定とする。端末は内蔵NFCアンテナを用い、カードはISO-DEP対応の代表カードを採用する。室温は二十五度を目安とし、省電力機能は無効とする。アプリのビルド構成は最適化を有効とするが、測定時ログは最小限に留める。

拡張長APDUの測定においては、端末上限に抵触しない範囲のデータ長を選定する。端末差異による上限の影響が疑われる場合は、複数端末で測定を実施し、結果の比較により制約事項を抽出する。

## 測定手法

時間測定は、高分解能タイマにより開始と終了のイベント時刻を記録し、十分な反復数に基づき統計値を算出する。反復の規模は、遅延測定で百回以上、安定性評価で五百回以上を基本とする。電力測定は外部計測器またはプラットフォームAPIにより、ReaderMode待機時の平均電力上昇を測定する。温度は端末内センサまたは外部センサにより測定し、短時間の急激な上昇がないことを確認する。

ログは、時刻、操作名、スレッド、結果、エラーコードを含めるが、APDUの内容やタグ識別子等の機微情報は原則出力しない。例外は [fromUnknownError()](packages/interface/src/errors.ts:115) により統一的にラップし、原因情報の保持を図る。

## 評価および受入基準

受入判定は、各指標が目標値に適合すること、許容上限を超過しないこと、連続運用において例外が発生しないこと、タイムアウトが許容誤差内で終了すること、ReaderMode待機の電力特性が目標内に収まることを条件とする。許容上限を超過した場合は、設計上の改善が必要である。

拡張長APDUに関する受入は、端末上限に抵触しない範囲で成功すること、過大なLe指定時には仕様に従い "INVALID_PARAMETER" または "PLATFORM_ERROR" を返却することを条件とする。長時間安定性の受入は、リークがなく、セッション未解放が残置しないことを条件とする。

## 逸脱時の取扱い

測定値が目標を逸脱した場合は、測定条件の再確認、ログの解析、端末差異の評価を実施する。設計側では、ReaderModeフラグ構成の最適化、待機時間の調整、間欠駆動の採用、応答バッファ管理の見直し等の措置を検討する。タイムアウトの逸脱については、待機操作および送受信操作の指定値と実測終了時刻の偏差が許容範囲内であるかを再評価し、必要に応じてSLAの改訂を提案する。

## 互換性および端末差異

端末差異に起因する上限長、イベントタイミング、電力管理の差異については、測定結果に基づき技術仕様に制約事項として明記する。互換性の付録文書（後続追加予定）において、代表端末の測定値、上限条件、特記事項を整理する。

## 改訂管理

本書は、試験計画および技術仕様の改訂に追随して更新する。測定値の見直し、受入基準の合理化、端末差異の追加は、レビューおよび承認を経て反映する。更新時には、関連文書（要件定義書、設計詳細仕様書、技術仕様書）に必要な修正を行い、整合性を維持する。
