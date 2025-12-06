// PC/SCリーダー一覧を取得するだけのデバッグ用スクリプト
// 実行: node examples/mynacard-e2e/debug-pcsc.cjs

const pcscffi = require("../../packages/pcsc-ffi-node/dist");

function check(ret, msg) {
  if (ret !== pcscffi.PcscErrorCode.SCARD_S_SUCCESS) {
    const unsignedCode = ret >>> 0;
    const errMsg = pcscffi.pcsc_stringify_error(unsignedCode);
    throw new Error(
      `${msg}: PC/SC Error 0x${unsignedCode.toString(16)}: ${errMsg}`,
    );
  }
}

function main() {
  // 1. コンテキスト確立
  const hContext = [0];
  const ret1 = pcscffi.SCardEstablishContext(
    pcscffi.SCARD_SCOPE_USER,
    null,
    null,
    hContext,
  );
  check(ret1, "SCardEstablishContext failed");
  console.log("PC/SC context:", hContext[0]);

  // 2. リーダー一覧取得
  const pcchReaders = [0];
  let ret2 = pcscffi.SCardListReaders(hContext[0], null, null, pcchReaders);
  console.log(
    "SCardListReaders (size query) ret:",
    ret2,
    "size:",
    pcchReaders[0],
    "hContext:",
    hContext[0],
  );
  check(ret2, "SCardListReaders (size query) failed");

  const bufSize = pcchReaders[0];
  const buf = Buffer.alloc(bufSize * 2); // 余裕を持って確保
  ret2 = pcscffi.SCardListReaders(hContext[0], null, buf, pcchReaders);
  console.log(
    "SCardListReaders (actual) ret:",
    ret2,
    "buf:",
    buf,
    "size:",
    pcchReaders[0],
  );
  check(ret2, "SCardListReaders (actual) failed");

  // 3. リーダー名をパース
  const names = buf.toString("ucs2").replace(/\0+$/, "").split("\0");
  console.log("Readers:", names);

  // それぞれのリーダーに対してSCardGetStatusChangeを呼び出すが、その際timeoutを0にすることで即時返却
  for (const name of names) {
    console.log("\n=== PCSC TEST: Reader:", name, "===");
    // 1. SCardConnect
    const hCard = [0];
    const activeProtocol = [0];
    const retConn = pcscffi.SCardConnect(
      hContext[0],
      name,
      pcscffi.SCARD_SHARE_SHARED,
      pcscffi.SCARD_PROTOCOL_T0 | pcscffi.SCARD_PROTOCOL_T1,
      hCard,
      activeProtocol,
    );
    if (retConn !== pcscffi.PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `SCardConnect failed: ${pcscffi.pcsc_stringify_error(retConn)} (0x${(retConn >>> 0).toString(16)})`,
      );
      continue;
    }
    console.log(
      "Connected. hCard:",
      hCard[0],
      "ActiveProtocol:",
      activeProtocol[0],
    );

    // 2. SCardStatus (ATR取得)
    const readerBuf = Buffer.alloc(256);
    const readerLen = [readerBuf.length / 2]; // WCHAR数
    const state = [0];
    const proto = [0];
    const atrBuf = Buffer.alloc(64);
    const atrLen = [atrBuf.length];
    const retStatus = pcscffi.SCardStatus(
      hCard[0],
      readerBuf,
      readerLen,
      state,
      proto,
      atrBuf,
      atrLen,
    );
    if (retStatus !== pcscffi.PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `SCardStatus failed: ${pcscffi.pcsc_stringify_error(retStatus)} (0x${(retStatus >>> 0).toString(16)})`,
      );
    } else {
      const atrHex = atrBuf.slice(0, atrLen[0]).toString("hex").toUpperCase();
      console.log("ATR:", atrHex);
      console.log("State:", state[0], "Protocol:", proto[0]);
    }

    // 3. SCardTransmit (APDU送信: 00A4040000)
    const apdu = Buffer.from([0x00, 0xa4, 0x04, 0x00, 0x00]);
    const recvBuf = Buffer.alloc(256);
    const recvLen = [recvBuf.length];
    // Protocol制御情報
    let sendPci;
    if (activeProtocol[0] === pcscffi.SCARD_PROTOCOL_T0) {
      sendPci = pcscffi.SCARD_PCI_T0;
    } else if (activeProtocol[0] === pcscffi.SCARD_PROTOCOL_T1) {
      sendPci = pcscffi.SCARD_PCI_T1;
    } else {
      sendPci = pcscffi.SCARD_PCI_T0; // fallback
    }
    const retTransmit = pcscffi.SCardTransmit(
      hCard[0],
      sendPci,
      apdu,
      apdu.length,
      null,
      recvBuf,
      recvLen,
    );
    if (retTransmit !== pcscffi.PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `SCardTransmit failed: ${pcscffi.pcsc_stringify_error(retTransmit)} (0x${(retTransmit >>> 0).toString(16)})`,
      );
    } else {
      const respHex = recvBuf
        .slice(0, recvLen[0])
        .toString("hex")
        .toUpperCase();
      console.log("APDU Response:", respHex);
    }

    // 4. SCardDisconnect
    const retDisc = pcscffi.SCardDisconnect(hCard[0], pcscffi.SCARD_LEAVE_CARD);
    if (retDisc !== pcscffi.PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `SCardDisconnect failed: ${pcscffi.pcsc_stringify_error(retDisc)} (0x${(retDisc >>> 0).toString(16)})`,
      );
    } else {
      console.log("Disconnected.");
    }
  }

  // 後始末
  const ret3 = pcscffi.SCardReleaseContext(hContext[0]);
  console.log(
    "SCardReleaseContext raw ret:",
    ret3,
    "hex:",
    (ret3 >>> 0).toString(16),
    "signed:",
    ret3,
    "unsigned:",
    ret3 >>> 0,
    "hContext:",
    hContext,
  );
  check(ret3, "SCardReleaseContext failed");
}

try {
  main();
  process.exit(0);
} catch (e) {
  console.error("Error:", e);
  process.exit(1);
}
