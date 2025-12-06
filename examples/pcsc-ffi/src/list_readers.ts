import {
  PcscErrorCode,
  SCARD_SCOPE_SYSTEM,
  SCardEstablishContext,
  SCardListReaders,
  SCardReleaseContext,
  pcsc_stringify_error,
} from "@aokiapp/pcsc-ffi-node";

export function listReadersDemo() {
  console.log("Starting list_readers demo...");

  // Establish context
  console.log("Context establishing...");
  const hContext = [0];
  let ret = SCardEstablishContext(SCARD_SCOPE_SYSTEM, null, null, hContext);
  if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
    console.error(`Failed to establish context: ${pcsc_stringify_error(ret)}`);
    return;
  }
  console.log("Context established.");
  const context = hContext[0];

  try {
    // First call to get buffer size
    const pcchReaders = [0]; // Will receive the required buffer size
    ret = SCardListReaders(context, null, null, pcchReaders);

    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(
        `Failed to get reader list size: ${pcsc_stringify_error(ret)}`,
      );
      return;
    }

    const readerBufferSize = pcchReaders[0];
    const isWindows = process.platform === "win32";
    const charSize = isWindows ? 2 : 1; // WCHAR vs char
    const encoding: BufferEncoding = isWindows ? "utf16le" : "utf8";

    console.log(
      `Reader buffer size needed: ${readerBufferSize} characters (~${readerBufferSize * charSize} bytes)`,
    );

    // Allocate buffer sized for the *bytes* required by the underlying encoding
    if (readerBufferSize === 0) {
      console.log("No readers found.");
      return;
    }

    const readersBuffer = Buffer.alloc(readerBufferSize * charSize);

    // Second call to get actual reader names
    // Reset the buffer size value to what we allocated
    pcchReaders[0] = readerBufferSize;

    ret = SCardListReaders(context, null, readersBuffer, pcchReaders);

    if (ret !== PcscErrorCode.SCARD_S_SUCCESS) {
      console.error(`Failed to list readers: ${pcsc_stringify_error(ret)}`);
      return;
    }

    // Parse the multi-string reader list (null-terminated strings in a buffer)
    const readers = readersBuffer
      .toString(encoding)
      .split("\0")
      .filter((r) => r.length > 0);

    if (readers.length === 0) {
      console.log("No readers found.");
    } else {
      console.log("Readers found:", readers.length);
      readers.forEach((reader, index) => {
        console.log(`  Reader ${index + 1}: "${reader}"`);
      });
    }
  } finally {
    // Always release the context
    console.log("Releasing context...");
    SCardReleaseContext(context);
    console.log("Context released.");
  }
}

// Execute the demo
listReadersDemo();
