import type { TLVResult, TagInfo } from "./types.js";

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
    // Stub: 実装は後で
    throw new Error("Not implemented");
  }

  /**
   * Tag部をDERエンコード
   */
  protected static encodeTag(tag: TagInfo): ArrayBuffer {
    throw new Error("Not implemented");
  }

  /**
   * Length部をDERエンコード
   */
  protected static encodeLength(length: number): ArrayBuffer {
    throw new Error("Not implemented");
  }
}