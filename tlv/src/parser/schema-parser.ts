import { BasicTLVParser } from "./basic-parser.js";
import { TagClass, TagInfo } from "../common/types.js";

type DefaultEncodeType = ArrayBuffer;

/**
 * Base interface for a TLV schema object.
 */
interface TLVSchemaBase {
  readonly name: string;
  readonly tagClass?: TagClass;
  readonly tagNumber?: number;
}

/**
 * Interface for defining a primitive TLV schema.
 * @template DecodedType - The type after decoding.
 */
export interface PrimitiveTLVSchema<DecodedType = DefaultEncodeType>
  extends TLVSchemaBase {
  /**
   * Optional decode function which can return either a value or a Promise of a value.
   */
  readonly decode?: (buffer: ArrayBuffer) => DecodedType | Promise<DecodedType>;
}

/**
 * Interface for defining a constructed TLV schema.
 * @template F - The array of child field schemas.
 */
export interface ConstructedTLVSchema<F extends readonly TLVSchema[]>
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

/**
 * Checks if a given schema is a constructed schema.
 * @param schema - A TLV schema object.
 * @returns True if the schema has fields; false otherwise.
 */
function isConstructedSchema(
  schema: TLVSchema,
): schema is ConstructedTLVSchema<readonly TLVSchema[]> {
  return (
    "fields" in schema &&
    Array.isArray(
      (schema as unknown as ConstructedTLVSchema<readonly TLVSchema[]>).fields,
    )
  );
}

/**
 * A parser that parses TLV data based on a given schema (synchronous or asynchronous).
 * @template S - The schema type.
 */
export class SchemaParser<S extends TLVSchema> {
  schema: S;
  buffer = new ArrayBuffer(0);
  view = new DataView(this.buffer);
  offset = 0;
  strict: boolean;

  /**
   * Constructs a SchemaParser for the specified schema.
   * @param schema - The TLV schema to use.
   */
  constructor(schema: S, options?: { strict?: boolean }) {
    this.schema = schema;
    this.strict = options?.strict ?? false;
  }

  /**
   * Overloaded method: synchronous version.
   * @param buffer - The input data as an ArrayBuffer.
   * @returns Parsed result matching the schema.
   */
  public parse(buffer: ArrayBuffer): ParsedResult<S>;

  /**
   * Overloaded method: asynchronous version.
   * @param buffer - The input data as an ArrayBuffer.
   * @param options - Enable async parsing.
   * @returns A Promise of parsed result matching the schema.
   */
  public parse(
    buffer: ArrayBuffer,
    options: { async: true },
  ): Promise<ParsedResult<S>>;

  /**
   * Parses data either in synchronous or asynchronous mode.
   * @param buffer - The input data as an ArrayBuffer.
   * @param options - If { async: true }, parses asynchronously; otherwise synchronously.
   * @returns Either a parsed result or a Promise of a parsed result.
   */
  public parse(
    buffer: ArrayBuffer,
    options?: { async?: boolean; strict?: boolean },
  ): ParsedResult<S> | Promise<ParsedResult<S>> {
    const prevStrict = this.strict;
    if (options?.strict !== undefined) {
      this.strict = options.strict;
    }
    try {
      if (options?.async) {
        return this.parseAsync(buffer);
      } else {
        return this.parseSync(buffer);
      }
    } finally {
      this.strict = prevStrict;
    }
  }

  /**
   * Parses data in synchronous mode.
   * @param buffer - The input data.
   * @returns Parsed result matching the schema.
   */
  public parseSync(buffer: ArrayBuffer): ParsedResult<S> {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    return this.parseWithSchemaSync(this.schema);
  }

  /**
   * Parses data in asynchronous mode.
   * @param buffer - The input data.
   * @returns A Promise of parsed result matching the schema.
   */
  public async parseAsync(buffer: ArrayBuffer): Promise<ParsedResult<S>> {
    this.buffer = buffer;
    this.view = new DataView(buffer);
    this.offset = 0;
    return await this.parseWithSchemaAsync(this.schema);
  }

  /**
   * Recursively parses data in synchronous mode.
   * @param schema - The schema to parse with.
   * @returns Parsed result.
   */
  private parseWithSchemaSync<T extends TLVSchema>(schema: T): ParsedResult<T> {
    const subBuffer = this.buffer.slice(this.offset);
    const { tag, value, endOffset } = BasicTLVParser.parse(subBuffer);
    this.offset += endOffset;

    this.validateTagInfo(tag, schema);

    if (isConstructedSchema(schema)) {
      let subOffset = 0;
      let fieldsToProcess = [...schema.fields];

      // strictモード時、SET要素の順序をDER仕様で検証
      if (
        schema.tagNumber === 17 &&
        (schema.tagClass === TagClass.Universal ||
          schema.tagClass === undefined) &&
        this.strict
      ) {
        fieldsToProcess = fieldsToProcess.slice().sort((a, b) => {
          const encodeTag = (field: TLVSchema) => {
            const tagClass = field.tagClass ?? TagClass.Universal;
            const tagNumber = field.tagNumber ?? 0;
            const constructed = isConstructedSchema(field) ? 0x20 : 0x00;
            const bytes: number[] = [];
            let firstByte = (tagClass << 6) | constructed;
            if (tagNumber < 31) {
              firstByte |= tagNumber;
              bytes.push(firstByte);
            } else {
              firstByte |= 0x1f;
              bytes.push(firstByte);
              let num = tagNumber;
              const tagNumBytes: number[] = [];
              do {
                tagNumBytes.unshift(num % 128);
                num = Math.floor(num / 128);
              } while (num > 0);
              for (let i = 0; i < tagNumBytes.length - 1; i++) {
                bytes.push(tagNumBytes[i] | 0x80);
              }
              bytes.push(tagNumBytes[tagNumBytes.length - 1]);
            }
            return new Uint8Array(bytes);
          };
          return compareUint8Arrays(encodeTag(a), encodeTag(b));
        });

        /**
         * Compare two Uint8Arrays lexicographically.
         * Returns -1 if a < b, 1 if a > b, 0 if equal.
         */
        function compareUint8Arrays(a: Uint8Array, b: Uint8Array): number {
          const len = Math.min(a.length, b.length);
          for (let i = 0; i < len; i++) {
            if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
          }
          if (a.length !== b.length) return a.length < b.length ? -1 : 1;
          return 0;
        }
      }

      const result = {} as {
        [K in (typeof fieldsToProcess)[number] as K["name"]]: ParsedResult<K>;
      };

      for (const field of fieldsToProcess) {
        const fieldParser = new SchemaParser(field, { strict: this.strict });
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
        const decoded = schema.decode(value);
        if (
          decoded instanceof Promise ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
          (decoded as any).then instanceof Function
        ) {
          throw new Error(
            `Asynchronous decoder used in synchronous parse for field: ${schema.name}`,
          );
        }
        return decoded as ParsedResult<T>;
      }
      return value as ParsedResult<T>;
    }
  }

  /**
   * Recursively parses data in asynchronous mode.
   * @param schema - The schema to parse with.
   * @returns A Promise of the parsed result.
   */
  private async parseWithSchemaAsync<T extends TLVSchema>(
    schema: T,
  ): Promise<ParsedResult<T>> {
    const subBuffer = this.buffer.slice(this.offset);
    const { tag, value, endOffset } = BasicTLVParser.parse(subBuffer);
    this.offset += endOffset;

    this.validateTagInfo(tag, schema);

    if (isConstructedSchema(schema)) {
      let subOffset = 0;
      const result = {} as {
        [K in (typeof schema.fields)[number] as K["name"]]: ParsedResult<K>;
      };

      for (const field of schema.fields) {
        const fieldParser = new SchemaParser(field);
        const parsedField = await fieldParser.parseAsync(
          value.slice(subOffset),
        );
        result[field.name] = parsedField;
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
        // decode might return a Promise, so it is awaited
        const decoded = schema.decode(value);
        return (await Promise.resolve(decoded)) as ParsedResult<T>;
      }
      return value as ParsedResult<T>;
    }
  }

  /**
   * Validates tag information against the expected schema.
   * @param tagInfo - The parsed tag info.
   * @param schema - The schema to validate.
   * @throws Error if tag class, tag number, or constructed status does not match.
   */
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

/**
 * Utility class for creating new TLV schemas.
 */
export class Schema {
  /**
   * Creates a primitive TLV schema definition.
   * @param name - The name of the field.
   * @param decode - Optional decode function.
   * @param options - Optional tag class and tag number.
   * @returns A primitive TLV schema object.
   */
  public static primitive<N extends string, D = ArrayBuffer>(
    name: N,
    decode?: (buffer: ArrayBuffer) => D | Promise<D>,
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

  /**
   * Creates a constructed TLV schema definition.
   * @param name - The name of the field.
   * @param fields - An array of TLV schema definitions.
   * @param options - Optional tag class and tag number.
   * @returns A constructed TLV schema object.
   */
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
