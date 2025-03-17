/**
 * Literal type representing tag class
 */
type TagClass = "Universal" | "Application" | "Context-specific" | "Private";

interface TagInfo {
  tagClass: TagClass;
  constructed: boolean;
  tagNumber: number;
}

/**
 * Base interface for common schema properties
 */
interface TLVSchemaBase<EncodedType = Uint8Array> {
  readonly tagClass?: TagClass;
  readonly constructed?: boolean;
  readonly tagNumber?: number;
  readonly fields?: readonly TLVFieldSchema<unknown>[];
  readonly encode?: (buffer: ArrayBuffer) => EncodedType | Promise<EncodedType>;
}

/**
 * Field schema - for internal fields (name is required)
 */
export interface TLVFieldSchema<EncodedType = Uint8Array>
  extends TLVSchemaBase<EncodedType> {
  readonly name: string; // required
}

/**
 * Root schema - for top level (name is optional)
 */
export interface TLVRootSchema<EncodedType = Uint8Array>
  extends TLVSchemaBase<EncodedType> {
  readonly name?: string; // optional
}

// Union type including both
type TLVSchema<T = unknown> = TLVRootSchema<T> | TLVFieldSchema<T>;

type FieldsResult<F extends readonly TLVFieldSchema<unknown>[]> = {
  [Field in F[number] as Field["name"]]: ParsedResult<Field>;
};

type EncodingResult<E> = E extends (buffer: ArrayBuffer) => infer R
  ? Awaited<R>
  : Uint8Array;

type ParsedResult<S extends TLVSchema> =
  S["fields"] extends readonly TLVFieldSchema<unknown>[]
    ? FieldsResult<S["fields"]>
    : EncodingResult<S["encode"]>;

// Parse result type when no schema is specified (includes tag info, length, and value)
interface TLVResult {
  tag: TagInfo;
  length: number;
  value: ArrayBuffer;
  endOffset: number;
}

export class TLVParser<S extends TLVSchema | null = null> {
  schema: S;
  buffer = new Uint8Array();
  view = new DataView(this.buffer.buffer);
  offset = 0;

  constructor(schema: S = null as S) {
    this.schema = schema;
  }

  public async parse(
    buffer: Uint8Array,
  ): Promise<S extends TLVSchema ? ParsedResult<S> : TLVResult> {
    this.buffer = buffer;
    this.view = new DataView(
      this.buffer.buffer,
      this.buffer.byteOffset,
      this.buffer.byteLength,
    );
    this.offset = 0;

    if (this.schema) {
      return (await this.parseWithSchema(this.schema)) as S extends TLVSchema
        ? ParsedResult<S>
        : TLVResult;
    }
    return this.parseTLV() as S extends TLVSchema ? ParsedResult<S> : TLVResult;
  }

  private async parseWithSchema<T extends TLVSchema>(
    schema: T,
  ): Promise<ParsedResult<T>> {
    const startOffset = this.offset;
    const tagInfo = this.readTagInfo();

    this.validateTagInfo(tagInfo, schema);

    const length = this.readLength();
    const endOffset = this.offset + length;

    if (schema.fields && schema.fields.length > 0) {
      const obj: Partial<FieldsResult<typeof schema.fields>> = {};
      for (const field of schema.fields) {
        const subBuffer = this.buffer.slice(this.offset, endOffset);
        const fieldParser = new TLVParser(field);
        obj[field.name] = await fieldParser.parse(subBuffer);
        this.offset += fieldParser.offset;
      }
      obj._buffer = this.buffer.slice(startOffset, endOffset);
      return obj as ParsedResult<T>;
    } else {
      const rawValue = this.readValue(length);
      if (schema.encode !== undefined) {
        return (await schema.encode(rawValue)) as ParsedResult<T>;
      }
      return new Uint8Array(rawValue) as ParsedResult<T>;
    }
  }

  /**
   * Ensure that the specified number of bytes is available in the buffer
   */
  private ensureAvailable(bytes: number): void {
    if (this.offset + bytes > this.buffer.length) {
      throw new Error(
        `Buffer underflow: ${bytes} bytes required, but only ${this.buffer.length - this.offset} bytes available`,
      );
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
    const endOffset = this.offset;
    return { tag: tagInfo, length, value, endOffset };
  }

  /**
   * Read tag information (tag class, constructed flag, tag number)
   * @returns Tag information
   */
  private readTagInfo(): TagInfo {
    this.ensureAvailable(1);
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
        throw new Error(`Invalid tag class bits: ${bits}`);
    }
  }

  /**
   * Read length field (supports short form and long form)
   * @returns Length of the TLV value
   */
  private readLength(): number {
    this.ensureAvailable(1);
    const lengthByte = this.view.getUint8(this.offset);
    this.offset += 1;
    if (lengthByte & 0x80) {
      const numBytes = lengthByte & 0x7f;
      this.ensureAvailable(numBytes);
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
    this.ensureAvailable(length);
    const chunk = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    // Create a new ArrayBuffer to ensure the correct type
    return chunk.buffer.slice(
      chunk.byteOffset,
      chunk.byteOffset + chunk.byteLength,
    );
  }
}
