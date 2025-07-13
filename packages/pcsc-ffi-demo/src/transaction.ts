import {
  PcscErrorCode,
  SCARD_LEAVE_CARD,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCardBeginTransaction,
  SCardConnect,
  SCardDisconnect,
  SCardEndTransaction,
  SCardEstablishContext,
  SCardListReaders,
  SCardReleaseContext,
  pcsc_stringify_error,
} from "@aokiapp/pcsc-ffi-node";

export async function runTransactionDemo() {
  const hContext = [0];
  let ret: number;

  // 1. Establish a context
  ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    console.error(`Failed to establish context: ${pcsc_stringify_error(ret)}`);
    return;
  }
  const context = hContext[0];
  console.log("Context established.");

  try {
    // 2. List readers
    const pccReaders = [0];
    ret = SCardListReaders(context, null, null, pccReaders);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `Failed to list readers (get size): ${pcsc_stringify_error(ret)}`,
      );
      return;
    }

    const readersLength = pccReaders[0];
    const isWindows = process.platform === "win32";
    const charSize = isWindows ? 2 : 1;
    const encoding: BufferEncoding = isWindows ? "utf16le" : "utf8";

    if (readersLength === 0) {
      console.log("No readers found.");
      return;
    }

    // Allocate readers buffer in *bytes*
    const readersBuffer = Buffer.alloc(readersLength * charSize);
    ret = SCardListReaders(context, null, readersBuffer, pccReaders);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to list readers: ${pcsc_stringify_error(ret)}`);
      return;
    }

    const readers = readersBuffer
      .toString(encoding)
      .split("\0")
      .filter((r) => r);
    console.log("Readers:", readers);

    if (readers.length === 0) {
      console.log("No active readers found.");
      return;
    }

    const readerName = readers[0];
    console.log(`Attempting to connect to reader: ${readerName}`);

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
    console.log(`Connected to card. Handle: ${cardHandle}`);

    try {
      // 4. Begin transaction
      ret = SCardBeginTransaction(cardHandle);
      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        console.error(
          `Failed to begin transaction: ${pcsc_stringify_error(ret)}`,
        );
        return;
      }
      console.log("Transaction started.");

      // Simulate some card operations here
      console.log("Performing card operations within transaction...");
    } finally {
      // 5. End transaction
      ret = SCardEndTransaction(cardHandle, SCARD_LEAVE_CARD);
      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        console.error(
          `Failed to end transaction: ${pcsc_stringify_error(ret)}`,
        );
      } else {
        console.log("Transaction ended.");
      }

      // 6. Disconnect from the card
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
    // 7. Release the context
    ret = SCardReleaseContext(context);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to release context: ${pcsc_stringify_error(ret)}`);
    } else {
      console.log("Context released.");
    }
  }
}

runTransactionDemo();
