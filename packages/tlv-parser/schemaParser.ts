import { TagClass, TagInfo } from "./types";
import { BasicTLVParser } from "./basicParser";

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
    const subBuffer = this.buffer.slice(this.offset);
    const { tag, value, endOffset } = BasicTLVParser.parse(subBuffer);
    this.offset += endOffset;

    this.validateTagInfo(tag, schema);

    if (isConstructedSchema(schema)) {
      const result = {} as {
        [K in (typeof schema.fields)[number] as K["name"]]: ParsedResult<K>;
      };

      let subOffset = 0;
      for (const field of schema.fields) {
        const fieldParser = new SchemaParser(field);
        result[field.name] = fieldParser.parse(value.slice(subOffset));
        subOffset += fieldParser.offset;
      }

      if (subOffset !== value.byteLength) {
        throw new Error(
          "Constructed element does not end exactly at the expected length.",
        );
      }

      return result as ParsedResult<T>;
    } else {
      if (schema.decode) {
        return schema.decode(value) as ParsedResult<T>;
      }
      return value as ParsedResult<T>;
    }
  }

  private validateTagInfo(tagInfo: TagInfo, schema: TLVSchema): void {
    if (schema.tagClass !== undefined && schema.tagClass !== tagInfo.tagClass) {
      throw new Error(
        `Tag class mismatch: expected ${schema.tagClass}, but got ${tagInfo.tagClass}`,
      );
    }
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
