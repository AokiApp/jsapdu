// Utility for Uint8Array <-> number[] conversion
export function toUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}
export function fromUint8Array(arr: Uint8Array): number[] {
  return Array.from(arr);
}
