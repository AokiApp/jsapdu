import koffi from "koffi";

import {
  PcscErrorCode,
  SCARD_IO_REQUEST,
  SCARD_LEAVE_CARD,
  // MAX_READERNAME, // no longer used
  SCARD_PCI_T0,
  SCARD_PCI_T1,
  SCARD_PROTOCOL_T0,
  SCARD_PROTOCOL_T1,
  SCARD_SCOPE_SYSTEM,
  SCARD_SHARE_SHARED,
  SCardConnect,
  SCardDisconnect,
  SCardEstablishContext,
  SCardListReaders,
  SCardReleaseContext,
  SCardTransmit,
  pcsc_stringify_error,
} from "@aokiapp/pcsc-ffi-node";

export async function runSendApduDemo() {
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
    const activeProtocol = pdwActiveProtocol[0];
    console.log(
      `Connected to card. Handle: ${cardHandle}, Protocol: ${activeProtocol}`,
    );

    try {
      // 4. Send a simple APDU (e.g., SELECT Master File: 00 A4 00 00 02 3F00)
      const apdu = Buffer.from([0x00, 0xa4, 0x00, 0x00, 0x02, 0x3f, 0x00]);
      const recvBuffer = Buffer.alloc(256);
      const pcbRecvLength = [recvBuffer.length];

      // Define SCARD_IO_REQUEST for T=0 or T=1 based on active protocol
      const pioSendPci =
        activeProtocol === SCARD_PROTOCOL_T0 ? SCARD_PCI_T0 : SCARD_PCI_T1;

      const pioRecvPci = {
        // For receive, we still need a mutable object
        dwProtocol: 0, // Not used for receive
        cbPciLength: koffi.sizeof(SCARD_IO_REQUEST),
      };

      console.log(`Sending APDU: ${apdu.toString("hex")}`);

      ret = SCardTransmit(
        cardHandle,
        pioSendPci,
        apdu,
        apdu.length,
        pioRecvPci,
        recvBuffer,
        pcbRecvLength,
      );

      if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
        console.error(`Failed to transmit APDU: ${pcsc_stringify_error(ret)}`);
        return;
      }

      const responseLength = pcbRecvLength[0];
      const response = recvBuffer.toString("hex", 0, responseLength);
      console.log(`APDU Response: ${response}`);
    } finally {
      // 5. Disconnect from the card
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
    ret = SCardReleaseContext(context);
    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to release context: ${pcsc_stringify_error(ret)}`);
    } else {
      console.log("Context released.");
    }
  }
}

runSendApduDemo();
