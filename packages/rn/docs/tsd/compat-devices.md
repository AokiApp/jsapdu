# Android NFC互換性・端末差異仕様

本書は、React Native向けスマートカードAPDU通信ライブラリのAndroid実装における端末互換性の取扱いを定めるものである。ISO-DEPに基づくAPDUレベルの通信機能について、端末差異が品質に与える影響を体系的に把握し、設計側・試験側双方における対処方針を明文化する。

本書は、技術仕様書 [packages/rn/docs/tsd/android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md) を補完し、試験計画書 [packages/rn/docs/rdd/test-plan.md](packages/rn/docs/rdd/test-plan.md) および性能測定条件 [packages/rn/docs/rdd/performance-metrics.md](packages/rn/docs/rdd/performance-metrics.md) と整合するものとする。API契約の参照は、待機動作として [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)、送受信として [SmartCard.transmit()](packages/interface/src/abstracts.ts:300)、初期化・解放として [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33) および [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)、デバイス取得として [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)、属性取得として [SmartCard.getAtr()](packages/interface/src/abstracts.ts:293) を対象とする。

## 目的

端末ごとに異なるNFC制御、バッファ上限、イベントタイミング、電力管理の挙動を把握し、仕様上の制約として明記することで、設計と試験を安定化させることを目的とする。互換性の観点は、動作可否の確認に留まらず、レイテンシ・スループット・タイムアウト忠実度・温度・電力の差異を包括する。

## 適用範囲

本書の適用範囲はAndroid API Level 24以上の端末とし、ReaderModeの構成はNFC-A、NFC-B、NFC-Fの同時有効化（固定運用）、SKIP_NDEF によるNDEF検出回避を確定方針とする。端末差による動的切替は行わない。端末の内蔵リーダを単一デバイス識別子として扱う設計方針は、要件定義書 [packages/rn/docs/rdd/android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md) に従う。理由: A/B/F を固定で有効化することで検出経路の実装差を低減し、FeliCa 等の非対象は SKIP_NDEF と待機側の内部抑制で無視されるため、成立条件（ISO-DEP）の一貫性を維持できる。

## 代表端末選定基準

代表端末の選定は、ベンダ多様性（例: Google、Samsung、Sony、Xiaomi 等）、SoC多様性（例: Snapdragon、Tensor 等）、世代多様性（複数APIレベル）、NFCハードウェア差異を勘案して行う。選定基準は、一般的な市場シェア、開発者コミュニティでの可用性、入手性、測定再現性を重視する。

## 端末差異の主な影響項目

端末差異が品質に影響する項目は、以下の各観点を含む。記述は文章主体とし、箇条書きは必要な場合のみに限定する。

端末によりIsoDep.transceiveの最大長が異なる。拡張APDUのLe指定が端末上限に抵触する場合、送受信は失敗し得るが、本仕様では当該失敗を公開FFIで正規化せず、未処理例外の伝播を許容する。長さ規程は呼出側の遵守事項として [length-limits.md](packages/rn/docs/tsd/length-limits.md:1) に従う。

タグ検出イベントのタイミングに端末差異が存在しうる。ReaderMode有効化後の検出遅延は、測定値に基づき受入基準の中央値および上限値を見直すことがある。タイムアウト忠実度は、待機操作および送受信操作について、測定上の偏差許容範囲に基づき判断する。

電力管理の動作が端末ごとに異なる。長時間待機時の平均電力上昇および温度変化は、端末差異の影響を受ける可能性がある。間欠駆動、待機時間調整等の方策により、受入基準内に収める。

ATS相当情報（ATR）の取得方針は HB_then_ATS（Historical Bytes優先→HiLayerResponse(ATS)）とする。歴史バイトの取得が困難な端末では ATS を採用し、いずれも得られない場合は "PROTOCOL_ERROR" を返却する（確定方針）。

## 互換性評価の方法

互換性評価は、試験計画書の各観点を代表端末で実施し、中央値および九十五パーセンタイル、許容上限を算出した上で、差異を特記事項として整理する。評価は、ReaderMode有効化と無効化の手順、タグ検出の待機、セッション確立、APDU送受信、属性取得、異常系（未初期化、二重初期化、重複取得、カード非在、タイムアウト、外部例外）の各シナリオを対象とする。

測定値が受入基準の範囲外となった場合は、原因分析を行い、設計側の対処（フラグ構成の最適化、待機の間欠化、長さ上限の明記等）または受入基準の合理的見直しを提案する。

## 報告書フォーマット

互換性報告は、端末固有情報（メーカー、型番、OSバージョン、ビルド、NFC設定）、測定条件（室温、省電力設定、カード種）、測定結果（各指標の中央値、九十五パーセンタイル、許容上限との比較）、逸脱と対処方針を含める。機微情報（APDU内容、タグUID等）は原則として記載しない。例外の詳細は [SmartCardError.getDebugInfo()](packages/interface/src/errors.ts:51) に基づく情報に留める。

## 設計への反映

互換性上の制約は、技術仕様書 [packages/rn/docs/tsd/android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md) の「バッファとエンコーディング」「互換性」章に反映し、APIの前提条件、エラー写像、タイムアウト方針に影響する内容は当該章に追記する。長さ上限の扱いは別紙として「APDU長規程（length-limits）」を新設し、数値と分割方針を併記する。

## 改訂管理

本書は、測定結果の更新、代表端末の追加、受入基準の見直しに伴い改訂する。改訂時は、関連文書（試験計画、性能測定条件、技術仕様）を同時に更新し、整合性を維持する。重要事項の改訂については、レビューおよび承認のプロセスを経るものとする。
