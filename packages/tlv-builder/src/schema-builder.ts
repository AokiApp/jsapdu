import { BasicTLVBuilder } from "./basic-builder.js";
import { TagClass } from "./types.js";

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
 * @template EncodedType - The type before encoding.
 */
export interface PrimitiveTLVSchema<EncodedType = DefaultEncodeType>
  extends TLVSchemaBase {
  /**
   * Optional encode function which can return either a value or a Promise of a value.
   */
  readonly encode?: (data: EncodedType) => ArrayBuffer | Promise<ArrayBuffer>;
}

/**
 * Interface for defining a constructed TLV schema.
 * @template F - The array of child field schemas.
 */
export interface ConstructedTLVSchema<F extends readonly TLVSchema[]>
  extends TLVSchemaBase {
  readonly fields: F;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type TLVSchema =
  | PrimitiveTLVSchema<any>
  | ConstructedTLVSchema<readonly TLVSchema[]>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export type BuildData<S extends TLVSchema> =
  S extends ConstructedTLVSchema<infer F>
    ? {
        [Field in F[number] as Field["name"]]: BuildData<Field>;
      }
    : S extends PrimitiveTLVSchema<infer EncodedType>
      ? EncodedType
      : never;

/**
 * Checks if a given schema is a constructed schema.
 * @param schema - A TLV schema object.
 * @returns True if the schema has fields; false otherwise.
 */
function isConstructedSchema<F extends readonly TLVSchema[]>(
  schema: TLVSchema,
): schema is ConstructedTLVSchema<F> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  return "fields" in schema && Array.isArray((schema as any).fields);
}

/**
 * A builder that builds TLV data based on a given schema (synchronous or asynchronous).
 * @template S - The schema type.
 */
export class SchemaBuilder<S extends TLVSchema> {
  schema: S;

  /**
   * Constructs a SchemaBuilder for the specified schema.
   * @param schema - The TLV schema to use.
   */
  constructor(schema: S) {
    this.schema = schema;
  }

  /**
   * Overloaded method: synchronous version.
   * @param data - The input data matching the schema structure.
   * @returns Built TLV result.
   */
  public build(data: BuildData<S>): ArrayBuffer;

  /**
   * Overloaded method: asynchronous version.
   * @param data - The input data matching the schema structure.
   * @param options - Enable async building.
   * @returns A Promise of built ArrayBuffer.
   */
  public build(
    data: BuildData<S>,
    options: { async: true },
  ): Promise<ArrayBuffer>;

  /**
   * Builds data either in synchronous or asynchronous mode.
   * @param data - The input data matching the schema structure.
   * @param options - If { async: true }, builds asynchronously; otherwise synchronously.
   * @returns Either a built ArrayBuffer or a Promise of a built ArrayBuffer.
   */
  public build(
    data: BuildData<S>,
    options?: { async?: boolean },
  ): ArrayBuffer | Promise<ArrayBuffer> {
    if (options?.async) {
      return this.buildAsync(data);
    } else {
      return this.buildSync(data);
    }
  }

  /**
   * Builds data in synchronous mode.
   * @param data - The input data.
   * @returns Built TLV result.
   */
  public buildSync(data: BuildData<S>): ArrayBuffer {
    return this.buildWithSchemaSync(this.schema, data);
  }

  /**
   * Builds data in asynchronous mode.
   * @param data - The input data.
   * @returns A Promise of built TLV result.
   */
  public async buildAsync(data: BuildData<S>): Promise<ArrayBuffer> {
    return await this.buildWithSchemaAsync(this.schema, data);
  }

  /**
   * Recursively builds data in synchronous mode.
   * @param schema - The schema to build with.
   * @param data - The data to build.
   * @returns Built result.
   */
  private buildWithSchemaSync<T extends TLVSchema>(
    schema: T,
    data: BuildData<T>,
  ): ArrayBuffer {
    if (isConstructedSchema(schema)) {
      const fieldsToProcess = [...schema.fields];

      // For SET, sort fields by tag as required by DER
      if (
        (schema.tagNumber === 17 && schema.tagClass === TagClass.Universal) ||
        (schema.tagNumber === 17 && schema.tagClass === undefined)
      ) {
        fieldsToProcess.sort((a, b) => {
          const tagA = a.tagNumber ?? 0;
          const tagB = b.tagNumber ?? 0;
          return tagA - tagB;
        });
      }

      const childrenBuffers = fieldsToProcess.map((fieldSchema) => {
        const fieldName = fieldSchema.name;
        const fieldData = (data as Record<string, unknown>)[fieldName];

        if (fieldData === undefined) {
          throw new Error(`Missing required field: ${fieldName}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return this.buildWithSchemaSync(fieldSchema, fieldData as any);
      });

      const totalLength = childrenBuffers.reduce(
        (sum, buf) => sum + buf.byteLength,
        0,
      );
      const childrenData = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of childrenBuffers) {
        childrenData.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }

      return BasicTLVBuilder.build({
        tag: {
          tagClass: schema.tagClass ?? TagClass.Universal,
          tagNumber: schema.tagNumber ?? 16, // Default to SEQUENCE for constructed
          constructed: true,
        },
        length: childrenData.byteLength,
        value: childrenData.buffer,
        endOffset: 0,
      });
    } else {
      // PrimitiveTLVSchema
      let value: ArrayBuffer;
      if (schema.encode) {
        const encoded = schema.encode(data);
        if (encoded instanceof Promise) {
          throw new Error(
            `Asynchronous encoder used in synchronous build for field: ${schema.name}`,
          );
        }
        value = encoded;
      } else {
        if (!((data as unknown) instanceof ArrayBuffer)) {
          throw new Error(
            `Field '${schema.name}' requires an ArrayBuffer, but received other type.`,
          );
        }
        value = data;
      }

      return BasicTLVBuilder.build({
        tag: {
          tagClass: schema.tagClass ?? TagClass.Universal,
          tagNumber: schema.tagNumber ?? 0,
          constructed: false,
        },
        length: value.byteLength,
        value: value,
        endOffset: 0,
      });
    }
  }

  /**
   * Recursively builds data in asynchronous mode.
   * @param schema - The schema to build with.
   * @param data - The data to build.
   * @returns A Promise of the built result.
   */
  private async buildWithSchemaAsync<T extends TLVSchema>(
    schema: T,
    data: BuildData<T>,
  ): Promise<ArrayBuffer> {
    if (isConstructedSchema(schema)) {
      const fieldsToProcess = [...schema.fields];

      // For SET, sort fields by tag as required by DER
      if (
        (schema.tagNumber === 17 && schema.tagClass === TagClass.Universal) ||
        (schema.tagNumber === 17 && schema.tagClass === undefined)
      ) {
        fieldsToProcess.sort((a, b) => {
          const tagA = a.tagNumber ?? 0;
          const tagB = b.tagNumber ?? 0;
          return tagA - tagB;
        });
      }

      const childBuffers = await Promise.all(
        fieldsToProcess.map((fieldSchema) => {
          const fieldName = fieldSchema.name;
          const fieldData = (data as Record<string, unknown>)[fieldName];

          if (fieldData === undefined) {
            throw new Error(`Missing required field: ${fieldName}`);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return this.buildWithSchemaAsync(fieldSchema, fieldData as any);
        }),
      );

      const totalLength = childBuffers.reduce(
        (sum, buf) => sum + buf.byteLength,
        0,
      );
      const childrenData = new Uint8Array(totalLength);
      let offset = 0;
      for (const buffer of childBuffers) {
        childrenData.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      }

      return BasicTLVBuilder.build({
        tag: {
          tagClass: schema.tagClass ?? TagClass.Universal,
          tagNumber: schema.tagNumber ?? 16, // Default to SEQUENCE for constructed
          constructed: true,
        },
        length: childrenData.byteLength,
        value: childrenData.buffer,
        endOffset: 0,
      });
    } else {
      // PrimitiveTLVSchema
      let value: ArrayBuffer;
      if (schema.encode) {
        value = await Promise.resolve(schema.encode(data));
      } else {
        if (!((data as unknown) instanceof ArrayBuffer)) {
          throw new Error(
            `Field '${schema.name}' requires an ArrayBuffer, but received other type.`,
          );
        }
        value = data;
      }

      return BasicTLVBuilder.build({
        tag: {
          tagClass: schema.tagClass ?? TagClass.Universal,
          tagNumber: schema.tagNumber ?? 0,
          constructed: false,
        },
        length: value.byteLength,
        value: value,
        endOffset: 0,
      });
    }
  }
}

/**
 * Utility class for creating new TLV schemas (identical to parser schemas).
 */
export class Schema {
  /**
   * Creates a primitive TLV schema definition.
   * @param name - The name of the field.
   * @param encode - Optional encode function.
   * @param options - Optional tag class and tag number.
   * @returns A primitive TLV schema object.
   */
  // オーバーロード: encode あり（Eを推論）
  public static primitive<N extends string, E>(
    name: N,
    encode: (data: E) => ArrayBuffer | Promise<ArrayBuffer>,
    options?: {
      tagClass?: TagClass;
      tagNumber?: number;
    },
  ): PrimitiveTLVSchema<E> & { name: N };

  // オーバーロード: encode なし（E=ArrayBuffer）
  public static primitive<N extends string>(
    name: N,
    encode?: (data: ArrayBuffer) => ArrayBuffer | Promise<ArrayBuffer>,
    options?: {
      tagClass?: TagClass;
      tagNumber?: number;
    },
  ): PrimitiveTLVSchema<ArrayBuffer> & { name: N };

  // 実装
  public static primitive<N extends string, E>(
    name: N,
    encode?: (data: E) => ArrayBuffer | Promise<ArrayBuffer>,
    options?: {
      tagClass?: TagClass;
      tagNumber?: number;
    },
  ): PrimitiveTLVSchema<E> & { name: N } {
    const { tagClass, tagNumber } = options ?? {};
    return {
      name,
      encode,
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
