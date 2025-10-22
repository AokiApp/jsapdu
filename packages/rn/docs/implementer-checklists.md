# Android NFC Implementer Checklists

## Read First
- [Requirements](packages/rn/docs/rdd/android-nfc-rdd.md:1)
- [Design Details](packages/rn/docs/ddd/android-nfc-ddd.md:1)
- [Technical Spec](packages/rn/docs/tsd/android-nfc-tsd.md:1)
- [API Contract](packages/rn/docs/tsd/api-contract.md:1)
- [Interface core](packages/interface/src/abstracts.ts:1)

## Quick Start Sequence
- Precheck: Ensure host app manifest declares NFC permission and feature per [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:94). Choose required true/false per distribution policy. See example [packages/rn/example/android/app/src/main/AndroidManifest.xml](packages/rn/example/android/app/src/main/AndroidManifest.xml:1).
1. [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33)
2. [SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87)
3. [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103)
4. [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259)
5. [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249)
6. [SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)
7. [SmartCard.transmit()](packages/interface/src/abstracts.ts:300)
8. [SmartCard.release()](packages/interface/src/abstracts.ts:312)
9. [SmartCardPlatform.release()](packages/interface/src/abstracts.ts:39)

## Platform Checklist
- Preconditions: Not initialized; NFC permission granted; host manifest declares NFC permission and feature; ReaderMode未対応端末は取得不可（acquire時に "PLATFORM_ERROR"）。参照: [android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md:28), [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:94).
- Actions:
  - Initialize platform via [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33).
  - Enumerate device info via [SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87); 現行は単一の統合NFCデバイスのみ返却（受入基準は0または1件）。将来は複数デバイス（例: BLEリーダ）を許容。IDは例示 "integrated-nfc-0"。apduApi=["nfc","androidnfc"]（Android returns both）。supportsHce=false（初期版）。公開スキーマはインタフェース定義に一致させ、追加フィールドは設けない。
  - 拡張APDU（Lc/Le二バイト）は検出せず常時使用前提。端末非対応による失敗は [fromUnknownError()](packages/interface/src/errors.ts:115) でラップして "PLATFORM_ERROR" として正規化する。長さ上限は [length-limits.md](packages/rn/docs/tsd/length-limits.md:11) に従い、送受信前に呼出側で遵守する。
  - ATR取得順序は「Historical Bytes優先、無ければ HiLayerResponse(ATS) の生バイト」。いずれも得られない場合は "PROTOCOL_ERROR"（[SmartCard.getAtr()](packages/interface/src/abstracts.ts:293)）。
  - 非対象タグ（FeliCa/NDEF）は [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) で内部抑制し、ISO-DEP検出のみ待機成立とする。
  - 拡張APDU非対応端末の事前切り捨ては行わない（事前検出なし）。実行時失敗は [fromUnknownError()](packages/interface/src/errors.ts:115) でラップし "PLATFORM_ERROR" として正規化する。
  - Acquire device via [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103); this activates RF.
- Postconditions:
  - Platform initialized; device acquired; RF active.
- Errors: "ALREADY_INITIALIZED", "NOT_INITIALIZED", "PLATFORM_ERROR" (see [api-contract.md](packages/rn/docs/tsd/api-contract.md:20)).
- Threading: Non-UI-thread I/O (see [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:77)).

## Device Checklist
- Preconditions: Platform initialized; device acquired; RF active.
- Actions:
  - Non-blocking presence check [SmartCardDevice.isCardPresent()](packages/interface/src/abstracts.ts:240).
  - Blocking wait [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) with caller-supplied timeout（ミリ秒・任意、省略時は 30000ms（30秒））。timeout=0 は即時 [TimeoutError.class()](packages/interface/src/errors.ts:84)（TIMEOUT）、負値は [api-contract.md](packages/rn/docs/tsd/api-contract.md:62) の 'INVALID_PARAMETER'。ISO-DEPタグ検出のみ成立。FeliCa/NDEF等の非対象タグは内部抑制し、待機は継続する。
  - On screen-off/Doze: cancel and [SmartCardDevice.release()](packages/interface/src/abstracts.ts:269) (see policy in [android-nfc-rdd.md](packages/rn/docs/rdd/android-nfc-rdd.md:107)). Host next step: [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103) → [SmartCardDevice.waitForCardPresence()](packages/interface/src/abstracts.ts:259) を再実行（Deviceは内部で解放済み）。
- Postconditions:
  - On detection: ready for session start; on cancellation: device released.
- Errors: "CARD_NOT_PRESENT", "TIMEOUT", "PLATFORM_ERROR" (see [api-contract.md](packages/rn/docs/tsd/api-contract.md:36)).
- Concurrency: Serialize RF on/off, session start/release (see [android-nfc-ddd.md](packages/rn/docs/ddd/android-nfc-ddd.md:42)).

## Card Checklist
- Preconditions: Card present; session active.
- Actions:
  - Retrieve ATR/ATS via [SmartCard.getAtr()](packages/interface/src/abstracts.ts:293), prefer Historical Bytes, else HiLayerResponse; else "PROTOCOL_ERROR" (see [api-contract.md](packages/rn/docs/tsd/api-contract.md:46)).
  - Transmit APDU via [SmartCard.transmit()](packages/interface/src/abstracts.ts:300); enforce [length-limits.md](packages/rn/docs/tsd/length-limits.md:1)。拡張長サポートのランタイム検査は行わず、非対応による失敗は [fromUnknownError()](packages/interface/src/errors.ts:115) でラップして "PLATFORM_ERROR" として正規化する。Android: IsoDep.transceive のデフォルトタイムアウトは 5000ms（FFIから変更不可）。
  - Reset via [SmartCard.reset()](packages/interface/src/abstracts.ts:306): IsoDep再接続（RF維持）。現在のISO-DEPセッションを閉じ、RFは維持したまま内部で [SmartCardDevice.startSession()](packages/interface/src/abstracts.ts:249) を再実行。カード不在時は [SmartCardError.class()](packages/interface/src/errors.ts:23) の "CARD_NOT_PRESENT"。
  - Release via [SmartCard.release()](packages/interface/src/abstracts.ts:312).
- Postconditions:
  - Responses with data+SW1/SW2; session cleaned up on release.
- Errors: "INVALID_PARAMETER", "PLATFORM_ERROR", "PROTOCOL_ERROR" (see [api-contract.md](packages/rn/docs/tsd/api-contract.md:62)).
- Threading: Non-UI-thread for transceive (see [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:77)).

## Naming and Boilerplate

- Distribution policy: android.hardware.nfc required=false（デフォルト）
- NPM package: @aokiapp/jsapdu-rn
- Java package / Bundle ID: app.aoki.jsapdu.rn.android
- 注記: RN Nitro のボイラープレートで既に namespace が決まっている箇所は尊重する（例: [packages/rn/android/build.gradle](packages/rn/android/build.gradle:34), [JsapduRn.kt](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:1)）。必要であれば仕様へ同等の事項を組み込み、ボイラープレートに依存しない形でも契約を満たす。

## FFI Neutrality Do / Don't
- Do: use neutral terms and contracts [SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17), [SmartCardDevice.class()](packages/interface/src/abstracts.ts:202), [SmartCard.class()](packages/interface/src/abstracts.ts:283).
- Do: set apduApi to ["nfc","androidnfc"]（Android returns both）; OS名 'androidnfc' を含める。
- Don't: expose ReaderMode, IsoDep, Intent, Activity in public FFI (see [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md:7)).
- Don't: run I/O on UI thread.

## Term Substitution
- ReaderMode → RF enable/disable (internal).
- IsoDep → ISO-DEP session (internal).
- Android lifecycle → app foreground state (internal), not in FFI.

## Acceptance Criteria (per component)
- Platform: init/acquire/release per contract; RF activated on acquire, deactivated on release; errors mapped per contract.
- Device: wait cancels on screen-off/Doze with TIMEOUT; proper release on cancellation.
- Card: APDU length rules enforced; ATR/ATS retrieval order; non-UI-thread I/O; proper error mapping.

## Canonical References
- [API Contract](packages/rn/docs/tsd/api-contract.md:1)
- [Technical Spec](packages/rn/docs/tsd/android-nfc-tsd.md:1)
- [Length Limits](packages/rn/docs/tsd/length-limits.md:1)
- [Compatibility](packages/rn/docs/tsd/compat-devices.md:1)
## Implementer Actions（Manifest, Naming, Acceptance）

- Manifest updates are implementer-owned. Architects do not change code. Update host app [AndroidManifest.xml](packages/rn/example/android/app/src/main/AndroidManifest.xml:1) to declare:
  - &lt;uses-permission android:name="android.permission.NFC"/&gt;
  - &lt;uses-feature android:name="android.hardware.nfc" android:required="false"/&gt;（distribution policy default）
- 非NFC端末（distribution policy required=false）の挙動:
  - [SmartCardPlatform.init()](packages/interface/src/abstracts.ts:33): 成功。
  - [SmartCardPlatform.getDeviceInfo()](packages/interface/src/abstracts.ts:87): 0件を返却（デバイスなし）。
  - [SmartCardPlatform.acquireDevice()](packages/interface/src/abstracts.ts:103): "PLATFORM_ERROR" を返却（取得不可）。
  - 受入ではマニフェスト宣言と上記エラー写像の一致を検証する（参照: [android-nfc-tsd.md](packages/rn/docs/tsd/android-nfc-tsd.md)）。
- Naming conventions:
  - NPM package: @aokiapp/jsapdu-rn
  - Java package / Bundle ID: app.aoki.jsapdu.rn.android
  - Boilerplate respect: current namespace and paths originate from RN Nitro scaffold ([packages/rn/android/build.gradle](packages/rn/android/build.gradle:34), [JsapduRn.kt](packages/rn/android/src/main/java/com/margelo/nitro/aokiapp/jsapdurn/JsapduRn.kt:1)). Either align code to the spec naming or codify boilerplate-derived rules in the spec so FFI contracts remain consistent ([SmartCardPlatform.class()](packages/interface/src/abstracts.ts:17), [SmartCardDevice.class()](packages/interface/src/abstracts.ts:202), [SmartCard.class()](packages/interface/src/abstracts.ts:283)).
- Backlog policy: track work only via GitHub Issues (monorepo AokiApp/jsapdu). See guide and index pointers [index.md](packages/rn/docs/index.md:87), [docs/README.md](docs/README.md:183).
