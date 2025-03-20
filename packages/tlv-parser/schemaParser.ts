const TagClass = {
  Universal: 0,
  Application: 1,
  ContextSpecific: 2,
  Private: 3,
};
type TagClass = (typeof TagClass)[keyof typeof TagClass];

interface TagInfo {
  tagClass: TagClass;
  constructed: boolean;
  tagNumber: number;
}

type DefaultEncodeType = ArrayBuffer;

interface TLVSchemaBase {
  readonly name: string;
  readonly tagClass?: TagClass;
  readonly tagNumber?: number;
}

interface PrimitiveTLVSchema<DecodedType = DefaultEncodeType>
  extends TLVSchemaBase {
  readonly decode?: (buffer: ArrayBuffer) => DecodedType;
}

interface ConstructedTLVSchema<F extends readonly TLVSchema[]>
  extends TLVSchemaBase {
  readonly fields: F;
}

type TLVSchema =
  | PrimitiveTLVSchema<unknown>
  | ConstructedTLVSchema<readonly TLVSchema[]>;

type ParsedResult<S extends TLVSchema> =
  S extends ConstructedTLVSchema<infer F>
    ? {
        [Field in F[number] as Field["name"]]: ParsedResult<Field>;
      }
    : S extends PrimitiveTLVSchema<infer DecodedType>
      ? DecodedType
      : never;

function isConstructedSchema(
  schema: TLVSchema,
): schema is ConstructedTLVSchema<readonly TLVSchema[]> {
  return "fields" in schema;
}

export class SchemaParser<S extends TLVSchema> {
  schema: S;
  buffer = new ArrayBuffer(0);
  view = new DataView(this.buffer);
  offset = 0;

  constructor(schema: S) {
    this.schema = schema;
  }

  public parse(buffer: ArrayBuffer): ParsedResult<S> {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;

    return this.parseWithSchema(this.schema);
  }

  private parseWithSchema<T extends TLVSchema>(schema: T): ParsedResult<T> {
    const tagInfo = this.readTagInfo();
    this.validateTagInfo(tagInfo, schema);

    const length = this.readLength();
    const endOffset = this.offset + length;

    if (isConstructedSchema(schema)) {
      // 構造化
      // schema.fields の型は TLVSchema[] なので要素を順番に処理
      const result = {} as {
        [K in (typeof schema.fields)[number] as K["name"]]: ParsedResult<K>;
      };

      for (const field of schema.fields) {
        // フィールド用のパーサを作り再帰
        const subBuffer = this.buffer.slice(this.offset, endOffset);
        const fieldParser = new SchemaParser(field);
        const fieldResult = fieldParser.parse(subBuffer);

        // フィールド名をキーに格納
        result[field.name] = fieldResult;

        // 消費した分だけオフセットを進める
        this.offset += fieldParser.offset;
      }

      // 最終的に endOffset と一致することを確認
      if (this.offset !== endOffset) {
        throw new Error(
          "Constructed element does not end exactly at endOffset.",
        );
      }

      return result as ParsedResult<T>;
    } else {
      // プリミティブ
      const rawValue = this.readValue(length);

      if (schema.decode) {
        return schema.decode(rawValue) as ParsedResult<T>;
      } else {
        // decode未定義なら生バイナリのまま返す
        return rawValue as ParsedResult<T>;
      }
    }
  }

  /**
   * 指定された数のバイトがバッファ内で利用可能であることを確認
   */
  private ensureAvailable(bytes: number): void {
    if (this.offset + bytes > this.buffer.byteLength) {
      throw new Error(
        `Buffer underflow: ${bytes} bytes required, but only ${
          this.buffer.byteLength - this.offset
        } bytes available`,
      );
    }
  }

  /**
   * 実際のタグ情報をスキーマ仕様に対して検証
   */
  private validateTagInfo(tagInfo: TagInfo, schema: TLVSchema): void {
    if (schema.tagClass !== undefined && schema.tagClass !== tagInfo.tagClass) {
      throw new Error(
        `Tag class mismatch: expected ${schema.tagClass}, but got ${tagInfo.tagClass}`,
      );
    }

    // constructedプロパティの確認を型に基づいて行う
    const expectedConstructed = isConstructedSchema(schema);
    if (expectedConstructed !== tagInfo.constructed) {
      throw new Error(
        `Tag constructed flag mismatch: expected ${expectedConstructed}, but got ${tagInfo.constructed}`,
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

  /**
   * タグ情報（タグクラス、構造化フラグ、タグ番号）を読み取る
   * @returns タグ情報
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
        this.ensureAvailable(1);
        b = this.view.getUint8(this.offset);
        this.offset += 1;
        tagNumber = (tagNumber << 7) | (b & 0x7f);
      } while (b & 0x80);
    }
    return { tagClass, constructed: isConstructed, tagNumber };
  }

  /**
   * タグクラスのビット値を文字列に変換
   */
  private getTagClass(bits: number): TagClass {
    switch (bits) {
      case 0:
        return TagClass.Universal;
      case 1:
        return TagClass.Application;
      case 2:
        return TagClass.ContextSpecific;
      case 3:
        return TagClass.Private;
      default:
        throw new Error(`Invalid tag class bits: ${bits}`);
    }
  }

  /**
   * 長さフィールドを読み取る（短形式と長形式をサポート）
   * @returns TLV値の長さ
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

  /**
   * バリュー部分を読み取りArrayBufferとして返す
   */
  private readValue(length: number): ArrayBuffer {
    this.ensureAvailable(length);
    const chunk = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return chunk;
  }
}

export class Schema {
  public static primitive<N extends string, D = ArrayBuffer>(
    name: N,
    decode?: (buffer: ArrayBuffer) => D,
    options?: {
      tagClass?: TagClass;
      tagNumber?: number;
    },
  ): PrimitiveTLVSchema<D> & { name: N } {
    const { tagClass, tagNumber } = options ?? {};
    return {
      name,
      decode,
      tagClass,
      tagNumber,
    };
  }

  public static constructed<N extends string, F extends readonly TLVSchema[]>(
    name: N,
    fields: F,
    options?: {
      tagClass?: TagClass;
      tagNumber?: number;
    },
  ): ConstructedTLVSchema<F> & { name: N } {
    const { tagClass, tagNumber } = options ?? {};
    return {
      name,
      fields,
      tagClass,
      tagNumber,
    };
  }
}
