export function toUint8Array(
  data: Uint8Array<ArrayBuffer> | number[] | string,
): Uint8Array<ArrayBuffer> {
  if (typeof data === "string") {
    return new Uint8Array(
      (data.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)),
    );
  }
  return data instanceof Uint8Array ? data : Uint8Array.from(data);
}
