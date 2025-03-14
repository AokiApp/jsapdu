/**
 * Literal type representing tag class
 */
type TagClass =
  | "Universal"
  | "Application"
  | "Context-specific"
  | "Private"
  | "Unknown";

interface TagInfo {
  tagClass: TagClass;
  constructed: boolean;
  tagNumber: number;
}

/**
 * Base interface for common schema properties
 */
interface TLVSchemaBase {
  readonly encode?: string;
  readonly fields?: readonly TLVFieldSchema[];
  // Tag information validation fields (all optional)
  readonly tagClass?: TagClass;
  readonly constructed?: boolean;
  readonly tagNumber?: number;
}

/**
 * Field schema - for internal fields (name is required)
 */
interface TLVFieldSchema extends TLVSchemaBase {
  readonly name: string; // required
}

/**
 * Root schema - for top level (name is optional)
 */
export interface TLVRootSchema extends TLVSchemaBase {
  readonly name?: string; // optional
}

// Union type including both (for backward compatibility)
type TLVSchema = TLVRootSchema | TLVFieldSchema;

type ParsedResult<S extends TLVSchema> =
  // Check if 'fields' is an array of TLVFieldSchema
  S["fields"] extends readonly TLVFieldSchema[]
    ? // If true, create an object with field names as keys and recursively apply ParsedResult
      { [F in S["fields"][number] as F["name"]]: ParsedResult<F> }
    : // If 'fields' is not present, check if 'encode' is a string
      S["encode"] extends string
      ? // If true, return string type
        string
      : // Otherwise, return Uint8Array type
        Uint8Array;

// Parse result type when no schema is specified (includes tag info, length, and value)
interface TLVResult {
  tag: TagInfo;
  length: number;
  value: ArrayBuffer;
}

export class TLVParser<S extends TLVSchema | null = null> {
  schema: S;
  buffer!: Uint8Array;
  view!: DataView;
  offset = 0;

  constructor(schema: S = null as S) {
    this.schema = schema;
  }

  public parse<T extends TLVSchema>(
    buffer: ArrayBuffer | Uint8Array,
  ): ParsedResult<T> | TLVResult {
    if (buffer instanceof ArrayBuffer) {
      this.buffer = new Uint8Array(buffer);
    } else {
      this.buffer = buffer;
    }
    this.view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset,
      this.buffer.byteLength,
    );
    this.offset = 0;

    if (this.schema) {
      return this.parseWithSchema(this.schema) as ParsedResult<T>;
    }
    return this.parseTLV();
  }

  private parseWithSchema<T extends TLVSchema>(schema: T): ParsedResult<T> {
    const tagInfo = this.readTagInfo();

    this.validateTagInfo(tagInfo, schema);

    const length = this.readLength();
    const endOffset = this.offset + length;

    if (schema.fields && schema.fields.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj: any = {};
      for (const field of schema.fields) {
        if (!field.name) {
          throw new Error("Nested field must have a name");
        }
        const subBuffer = this.buffer.slice(this.offset, endOffset);
        const fieldParser = new TLVParser(field);
        obj[field.name] = fieldParser.parse(subBuffer);
        this.offset += fieldParser.offset;
      }
      return obj as ParsedResult<T>;
    } else {
      const rawValue = this.readValue(length);
      if (schema.encode) {
        return new TextDecoder(schema.encode).decode(
          rawValue,
        ) as ParsedResult<T>;
      }
      return new Uint8Array(rawValue) as ParsedResult<T>;
    }
  }

  /**
   * Validate the actual tag information against the schema specification
   */
  private validateTagInfo(tagInfo: TagInfo, schema: TLVSchema): void {
    if (schema.tagClass !== undefined && schema.tagClass !== tagInfo.tagClass) {
      throw new Error(
        `Tag class mismatch: expected ${schema.tagClass}, but got ${tagInfo.tagClass}`,
      );
    }

    if (
      schema.constructed !== undefined &&
      schema.constructed !== tagInfo.constructed
    ) {
      throw new Error(
        `Tag constructed flag mismatch: expected ${schema.constructed}, but got ${tagInfo.constructed}`,
      );
    }

    if (
      schema.tagNumber !== undefined &&
      schema.tagNumber !== tagInfo.tagNumber
    ) {
      throw new Error(
        `Tag number mismatch: expected ${schema.tagNumber}, but got ${tagInfo.tagNumber}`,
      );
    }
  }

  // Parse single TLV when no schema is provided
  private parseTLV(): TLVResult {
    const tagInfo = this.readTagInfo();
    const length = this.readLength();
    const value = this.readValue(length);
    return { tag: tagInfo, length, value };
  }

  // Read tag information (supports single byte or long form)
  private readTagInfo(): TagInfo {
    const firstByte = this.view.getUint8(this.offset);
    this.offset += 1;
    const tagClassBits = (firstByte & 0xc0) >> 6;
    const tagClass = this.getTagClass(tagClassBits);
    const isConstructed = !!(firstByte & 0x20);
    let tagNumber = firstByte & 0x1f;
    if (tagNumber === 0x1f) {
      tagNumber = 0;
      let b: number;
      do {
        b = this.view.getUint8(this.offset);
        this.offset += 1;
        tagNumber = (tagNumber << 7) | (b & 0x7f);
      } while (b & 0x80);
    }
    return { tagClass, constructed: isConstructed, tagNumber };
  }

  // Convert tag class bit value to string
  private getTagClass(bits: number): TagClass {
    switch (bits) {
      case 0:
        return "Universal";
      case 1:
        return "Application";
      case 2:
        return "Context-specific";
      case 3:
        return "Private";
      default:
        return "Unknown";
    }
  }

  // Read length field (supports short and long form)
  private readLength(): number {
    const lengthByte = this.view.getUint8(this.offset);
    this.offset += 1;
    if (lengthByte & 0x80) {
      const numBytes = lengthByte & 0x7f;
      let length = 0;
      for (let i = 0; i < numBytes; i++) {
        length = (length << 8) | this.view.getUint8(this.offset);
        this.offset += 1;
      }
      return length;
    }
    return lengthByte;
  }

  // Read value part and return as ArrayBuffer
  private readValue(length: number): ArrayBuffer {
    const chunk = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    // Create a new ArrayBuffer to ensure the correct type
    const result = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(result).set(chunk);
    return result;
  }
}
