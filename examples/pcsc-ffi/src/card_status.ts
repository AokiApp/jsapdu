import {
  MAX_ATR_SIZE,
  MAX_READERNAME,
  PcscErrorCode,
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCardConnect,
  SCardDisconnect,
  SCardEstablishContext,
  SCardListReaders,
  SCardReleaseContext,
  SCardStatus,
  pcsc_stringify_error,
} from "@aokiapp/pcsc-ffi-node";

export function runCardStatusDemo() {
  console.log("Starting card_status demo...");

  const hContext = [0];
  let ret: number;

  // 1. Establish a context
  console.log("Establishing context...");
  ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    console.error(`Failed to establish context: ${pcsc_stringify_error(ret)}`);
    return;
  }
  const context = hContext[0];
  console.log("Context established.");

  try {
    // 2. List readers
    console.log("Getting reader list...");
    const pcchReaders = [0];
    ret = SCardListReaders(context, null, null, pcchReaders);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `Failed to get reader list size: ${pcsc_stringify_error(ret)}`,
      );
      return;
    }

    const readerBufferSize = pcchReaders[0];
    const isWindows = process.platform === "win32";
    const charSize = isWindows ? 2 : 1;
    const encoding: BufferEncoding = isWindows ? "utf16le" : "utf8";

    console.log(
      `Reader buffer size needed: ${readerBufferSize} characters (~${readerBufferSize * charSize} bytes)`,
    );

    if (readerBufferSize === 0) {
      console.log("No readers found.");
      return;
    }

    const readersBuffer = Buffer.alloc(readerBufferSize * charSize);
    pcchReaders[0] = readerBufferSize; // Reset buffer size
    ret = SCardListReaders(context, null, readersBuffer, pcchReaders);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to list readers: ${pcsc_stringify_error(ret)}`);
      return;
    }

    const readers = readersBuffer
      .toString(encoding)
      .split("\0")
      .filter((r) => r.length > 0);

    if (readers.length === 0) {
      console.log("No active readers found.");
      return;
    }

    console.log("Readers found:", readers.length);
    readers.forEach((reader, index) => {
      console.log(`  Reader ${index + 1}: "${reader}"`);
    });

    const readerName = readers[0];
    console.log(`Attempting to connect to first reader: ${readerName}`);

    // 3. Connect to the first reader
    const hCard = [0];
    const pdwActiveProtocol = [0];
    ret = SCardConnect(
      context,
      readerName,
      SCARD_SHARE_SHARED,
      SCARD_PROTOCOL_T0 | SCARD_PROTOCOL_T1,
      hCard,
      pdwActiveProtocol,
    );

    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to connect to card: ${pcsc_stringify_error(ret)}`);
      return;
    }
    const cardHandle = hCard[0];
    const activeProtocol = pdwActiveProtocol[0];
    console.log(
      `Connected to card. Handle: ${cardHandle}, Protocol: ${activeProtocol}`,
    );

    try {
      // 4. Get the card status
      console.log("Getting card status...");
      const mszReaderName = Buffer.alloc(MAX_READERNAME * charSize);
      const pcchReaderLen = [MAX_READERNAME]; // Length in characters
      const pdwState = [0];
      const pdwProtocol = [0];
      const pbAtr = Buffer.alloc(MAX_ATR_SIZE);
      const pcbAtrLen = [MAX_ATR_SIZE];

      ret = SCardStatus(
        cardHandle,
        mszReaderName,
        pcchReaderLen,
        pdwState,
        pdwProtocol,
        pbAtr,
        pcbAtrLen,
      );

      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        console.error(
          `Failed to get card status: ${pcsc_stringify_error(ret)}`,
        );
        return;
      }

      const readerNameStatus = mszReaderName
        .toString(encoding, 0, pcchReaderLen[0] * charSize)
        .replace(/\0/g, "");
      const state = pdwState[0];
      const protocol = pdwProtocol[0];
      const atr = pbAtr.toString("hex", 0, pcbAtrLen[0]);

      console.log("Card Status:");
      console.log(`  Reader Name: ${readerNameStatus}`);
      console.log(`  State: ${state}`);
      console.log(`  Protocol: ${protocol}`);
      console.log(`  ATR: ${atr}`);
    } finally {
      // 5. Disconnect from the card
      console.log("Disconnecting from card...");
      ret = SCardDisconnect(cardHandle, SCARD_LEAVE_CARD);
      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        console.error(
          `Failed to disconnect from card: ${pcsc_stringify_error(ret)}`,
        );
      } else {
        console.log("Disconnected from card.");
      }
    }
  } finally {
    // 6. Release the context
    console.log("Releasing context...");
    ret = SCardReleaseContext(context);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to release context: ${pcsc_stringify_error(ret)}`);
    } else {
      console.log("Context released.");
    }
  }
}

// Execute the demo
runCardStatusDemo();
