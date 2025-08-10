import type { TLVResult } from "../common/types.js";
import { TagClass } from "../common/types.js";

/**
 * TLV構造体（Tag/Length/Value）を受け取り、DERエンコードされたArrayBufferを返す
 */
export class BasicTLVBuilder {
  /**
   * TLV構造体からDERエンコードバイト列を生成する
   * @param tlv - TLV構造体（tag, length, value）
   * @returns DERエンコード済みArrayBuffer
   */
  public static build(tlv: TLVResult): ArrayBuffer {
    const { tag, value } = tlv;
    const { tagClass, tagNumber, constructed } = tag;

    if (tagNumber < 0 || tagNumber >= Number.MAX_SAFE_INTEGER) {
      throw new Error("Tag number is out of valid range.");
    }
    if (
      typeof tagClass !== "number" ||
      tagClass < TagClass.Universal ||
      tagClass > TagClass.Private
    ) {
      throw new Error(`Invalid tag class: ${tagClass}`);
    }

    // 1. Encode Tag
    const tagBytes: number[] = [];
    let firstByte = (tagClass << 6) | (constructed ? 0x20 : 0x00);

    if (tagNumber < 31) {
      firstByte |= tagNumber;
      tagBytes.push(firstByte);
    } else {
      firstByte |= 0x1f;
      tagBytes.push(firstByte);

      const tagNumBytes: number[] = [];
      let num = tagNumber;
      do {
        tagNumBytes.unshift(num % 128);
        num = Math.floor(num / 128); // Use division for numbers > 32-bit
      } while (num > 0);

      for (let i = 0; i < tagNumBytes.length - 1; i++) {
        tagBytes.push(tagNumBytes[i] | 0x80);
      }
      tagBytes.push(tagNumBytes[tagNumBytes.length - 1]);
    }

    // 2. Encode Length
    const lengthBytes: number[] = [];
    const len = value.byteLength;

    if (len < 128) {
      lengthBytes.push(len);
    } else {
      const lenOfLenBytes: number[] = [];
      let tempLen = len;
      do {
        lenOfLenBytes.unshift(tempLen & 0xff);
        tempLen = Math.floor(tempLen / 256);
      } while (tempLen > 0);

      if (lenOfLenBytes.length > 126) {
        // The length of the length field can be at most 126 bytes in BER/DER.
        // (First byte is 0x80 | 126 = 0xFE). 0xFF is reserved.
        throw new Error("Value is too long to be encoded.");
      }

      lengthBytes.push(0x80 | lenOfLenBytes.length);
      lengthBytes.push(...lenOfLenBytes);
    }

    // 3. Concatenate T, L, V
    const totalLength = tagBytes.length + lengthBytes.length + len;
    const result = new Uint8Array(totalLength);
    const valueBytes = new Uint8Array(value);

    let offset = 0;
    result.set(tagBytes, offset);
    offset += tagBytes.length;
    result.set(lengthBytes, offset);
    offset += lengthBytes.length;
    result.set(valueBytes, offset);

    return result.buffer;
  }
}
