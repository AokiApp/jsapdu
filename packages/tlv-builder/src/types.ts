export const TagClass = {
  Universal: 0,
  Application: 1,
  ContextSpecific: 2,
  Private: 3,
} as const;
export type TagClass = (typeof TagClass)[keyof typeof TagClass];

export interface TagInfo {
  tagClass: TagClass;
  constructed: boolean;
  tagNumber: number;
}
export interface TLVResult {
  tag: TagInfo;
  length: number;
  value: ArrayBuffer;
  endOffset: number;
}

/**
 * DER encoding options for controlling build behavior
 */
export interface DEREncodingOptions {
  /** Validate length encoding according to DER rules */
  validateLength?: boolean;
  /** Enforce strict ordering for SET elements */
  strictOrdering?: boolean;
  /** Enable debug mode for detailed error messages */
  debug?: boolean;
}
