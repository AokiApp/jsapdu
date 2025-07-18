// Mapping of C/FFI type aliases (as string literals used in `KoffiTypedFn`) to their
// corresponding JavaScript-side representations.  These JS types follow the
// conventions we rely on when calling the native PC/SC functions with Koffi:
//   • Scalar integral values   → number
//   • ``char*`` / ``char16_t*`` pointers → string (input) or string/Buffer (output)
//   • ``void*`` and other generic pointers → any (caller is expected to pass Buffer, number, or null)
//   • "out" pointers to scalars            → number[] (Koffi represents out-params as 1-length arrays)
//   • Raw byte buffers                     → Buffer

// Feel free to add to this list as new PC/SC types appear.

// SCARD_READERSTATE interface for SCardGetStatusChange
interface SCARD_READERSTATE {
  szReader: string;
  pvUserData: unknown;
  dwCurrentState: number;
  dwEventState: number;
  cbAtr: number;
  rgbAtr: Uint8Array;
}

type CTypeAliasMap = {
  // -- Standard WinTypes ----------------------------------------------------
  DWORD: number;
  LONG: number;

  // Pointers / handles ------------------------------------------------------
  LPCVOID: unknown;

  SCARDCONTEXT: number | bigint;
  LPSCARDCONTEXT: (number | bigint)[];

  SCARDHANDLE: number | bigint;
  LPSCARDHANDLE: (number | bigint)[];

  LPDWORD: number[];

  // Strings -----------------------------------------------------------------
  LPCSTR: string;
  LPSTR: string | Buffer;
  LPCWSTR: string;
  LPWSTR: string | Buffer;

  // Raw buffers -------------------------------------------------------------
  LPBYTE: Buffer;
  LPCBYTE: Buffer;

  // Structures --------------------------------------------------------------
  // SCARD_IO_REQUEST structures can be passed either as a numeric pointer, a Buffer, or
  // a lightweight JS object literal containing the expected fields (e.g. `{ dwProtocol, cbPciLength }`).
  LPCSCARD_IO_REQUEST: Buffer | number | Record<string, unknown>;
  LPSCARD_IO_REQUEST: Buffer | number | Record<string, unknown>;

  // SCARD_READERSTATE structures for SCardGetStatusChange
  LPSCARD_READERSTATE: SCARD_READERSTATE[];
};

type CTypeAlias = keyof CTypeAliasMap;

type CTypeAliasesToJsTypes<T extends string> = T extends CTypeAlias
  ? CTypeAliasMap[T]
  : T extends `${CTypeAlias}@${string}`
    ? CreateAnnotatedType<T>
    : never;

// Handle combined annotations like @nullable@out, @nullable@inout
type CreateAnnotatedType<T extends string> =
  T extends `${infer U}@nullable@${infer V}`
    ? V extends "out" | "inout"
      ? U extends CTypeAlias
        ? null | CTypeAliasMap[U]
        : never
      : never
    : T extends `${infer U}@nullable`
      ? U extends CTypeAlias
        ? null | CTypeAliasMap[U]
        : never
      : T extends `${CTypeAlias}@alwaysNull`
        ? null
        : T extends `${infer U}@${"inout" | "out"}`
          ? U extends CTypeAlias
            ? CTypeAliasMap[U]
            : never
          : never;

/**
 * It converts
 * ```ts
 * (dwScope: "DWORD", pvReserved1: "LPCVOID@null@", pvReserved2: "LPCVOID@null@", phContext: "LPSCARDCONTEXT") => "LONG"
 * ```
 * to
 * ```ts
 * (dwScope: number, pvReserved1: null, pvReserved2: null, phContext: number[]) => number
 * ```
 */
export type KoffiTypedFn<
  T extends (...args: A) => R,
  // Allow both plain aliases and annotated aliases (e.g., "LPDWORD@out")
  A extends string[] = Parameters<T>,
  R extends string = ReturnType<T>,
> = (
  ...args: {
    [K in keyof A]: CTypeAliasesToJsTypes<A[K]>;
  }
) => CTypeAliasesToJsTypes<R>;
