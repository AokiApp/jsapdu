import { TagClass, TLVResult } from "./types";

export class BasicTLVParser {
  public static parse(buffer: ArrayBuffer): TLVResult {
    const view = new DataView(buffer);
    let offset = 0;

    const tagInfo = this.readTagInfo(view, offset);
    offset = tagInfo.newOffset;

    const lengthInfo = this.readLength(view, offset);
    offset = lengthInfo.newOffset;

    const valueInfo = this.readValue(buffer, offset, lengthInfo.length);
    offset = valueInfo.newOffset;

    return {
      tag: tagInfo.tag,
      length: lengthInfo.length,
      value: valueInfo.value,
      endOffset: offset,
    };
  }

  protected static readTagInfo(view: DataView, offset: number) {
    const firstByte = view.getUint8(offset++);
    const tagClassBits = (firstByte & 0xc0) >> 6;
    const tagClass: TagClass = this.getTagClass(tagClassBits);
    const isConstructed = !!(firstByte & 0x20);
    let tagNumber = firstByte & 0x1f;
    if (tagNumber === 0x1f) {
      tagNumber = 0;
      let b: number;
      do {
        b = view.getUint8(offset++);
        tagNumber = (tagNumber << 7) | (b & 0x7f);
      } while (b & 0x80);
    }
    return {
      tag: { tagClass, constructed: isConstructed, tagNumber },
      newOffset: offset,
    };
  }

  protected static getTagClass(bits: number): TagClass {
    switch (bits) {
      case 0:
        return TagClass.Universal;
      case 1:
        return TagClass.Application;
      case 2:
        return TagClass.ContextSpecific;
      case 3:
        return TagClass.Private;
    }
    throw new Error("Invalid tag class");
  }

  protected static readLength(view: DataView, offset: number) {
    let length = view.getUint8(offset++);
    if (length & 0x80) {
      const numBytes = length & 0x7f;
      length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | view.getUint8(offset++);
      }
    }
    return { length, newOffset: offset };
  }

  protected static readValue(
    buffer: ArrayBuffer,
    offset: number,
    length: number,
  ) {
    const value = buffer.slice(offset, offset + length);
    return { value, newOffset: offset + length };
  }
}
