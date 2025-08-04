import { TagClass, TagInfo } from "./types.js";

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
function isConstructedSchema(
  schema: TLVSchema,
): schema is ConstructedTLVSchema<readonly TLVSchema[]> {
  return "fields" in schema;
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
    _schema: T,
    _data: BuildData<T>,
  ): ArrayBuffer {
    void _schema;
    void _data;
    // Stub implementation - will be implemented later
    throw new Error("Not implemented");
  }

  /**
   * Recursively builds data in asynchronous mode.
   * @param schema - The schema to build with.
   * @param data - The data to build.
   * @returns A Promise of the built result.
   */
  private buildWithSchemaAsync<T extends TLVSchema>(
    _schema: T,
    _data: BuildData<T>,
  ): Promise<ArrayBuffer> {
    void _schema;
    void _data;
    // Stub implementation - will be implemented later
    return Promise.reject(new Error("Not implemented"));
  }

  /**
   * Creates tag information from schema.
   * @param schema - The schema to create tag info from.
   * @returns Tag information.
   */
  private createTagInfo(schema: TLVSchema): TagInfo {
    return {
      tagClass: schema.tagClass ?? TagClass.Universal,
      constructed: isConstructedSchema(schema),
      tagNumber: schema.tagNumber ?? 0,
    };
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
