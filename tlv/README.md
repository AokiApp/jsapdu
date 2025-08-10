# @aokiapp/tlv

[![CI](https://github.com/AokiApp/tlv/actions/workflows/ci.yml/badge.svg)](https://github.com/AokiApp/tlv/actions/workflows/ci.yml) [![npm version](https://img.shields.io/npm/v/@aokiapp/tlv.svg)](https://www.npmjs.com/package/@aokiapp/tlv) [![License: ANAL-Tight](https://img.shields.io/badge/License-ANAL--Tight-blue.svg)](https://github.com/AokiApp/tlv/blob/main/LICENSE.md)

High-performance TypeScript library for Tag-Length-Value (TLV) parsing and building, with schema-driven API and full type support.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
- [Modules](#modules)
  - [Parser](#parser)
  - [Builder](#builder)
  - [Common Types](#common-types)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Features

- ⚡️ Fast, zero-dependency TLV parser and builder  
- 📐 Schema-driven API with sync/async support  
- 🔒 Full TypeScript type safety and inference  
- 🧩 Modular design: separate parser, builder, and common types  

## Getting Started

### Installation

```bash
npm install @aokiapp/tlv
```

### Quick Start

#### Basic Parser

```typescript
import { BasicTLVParser } from "@aokiapp/tlv/parser";

const buffer = new Uint8Array([0x04, 0x05, /*...*/]).buffer;
const result = BasicTLVParser.parse(buffer);
console.log(result);
```

#### Schema Parser

```typescript
import { SchemaParser } from "@aokiapp/tlv/parser";
import { TagClass } from "@aokiapp/tlv/common";

const schema = {
  name: "string",
  tagNumber: 0x0c,
  decode: (buf: ArrayBuffer) => new TextDecoder().decode(buf),
};
const parser = new SchemaParser(schema);
const parsed = parser.parse(buffer);
console.log(parsed);
```

## Modules

### Parser (`@aokiapp/tlv/parser`)

- **BasicTLVParser**: `parse(buffer: ArrayBuffer): TLVResult` — Parse raw TLV.  
- **SchemaParser\<S>**: `parse(buffer, options?): ParsedResult<S> | Promise<ParsedResult<S>>` — Schema-based parsing.  

### Builder (`@aokiapp/tlv/builder`)

- **BasicTLVBuilder**: `build(tlv: TLVResult): ArrayBuffer` — DER encode TLV result.  
- **SchemaBuilder\<S>**: `build(data, options?): ArrayBuffer | Promise<ArrayBuffer>` — Schema-based building.  

### Common Types (`@aokiapp/tlv/common`)

- `TagClass` — Enum for Universal, Application, ContextSpecific, Private.  
- `TLVResult`, `TagInfo` — Interfaces for parsed TLV data.  

## API Reference

### Parser

#### BasicTLVParser

[`BasicTLVParser.parse(buffer: ArrayBuffer): TLVResult`](tlv/src/parser/basic-parser.ts:9)  
Parse a single TLV structure.

- buffer: ArrayBuffer containing TLV data.  
- Returns: TLVResult.

#### SchemaParser\<S>

[`SchemaParser.parse(buffer: ArrayBuffer, options?: { async?: boolean; strict?: boolean }): ParsedResult<S> | Promise<ParsedResult<S>>`](tlv/src/parser/schema-parser.ts:109)  
Parse TLV data based on a schema.

- buffer: ArrayBuffer input.  
- options.async: true for asynchronous parsing.  
- options.strict: override strict DER mode.  
- Returns: Parsed result matching schema, synchronously or as a Promise.

### Builder

#### BasicTLVBuilder

[`BasicTLVBuilder.build(tlv: TLVResult): ArrayBuffer`](tlv/src/builder/basic-builder.ts:13)  
Build DER-encoded TLV from a TLVResult.

#### SchemaBuilder\<S>

[`SchemaBuilder.build(data: BuildData<S>, options?: { async?: boolean; strict?: boolean }): ArrayBuffer | Promise<ArrayBuffer>`](tlv/src/builder/schema-builder.ts:104)  
Build TLV data based on a schema.

### Common Types

[`TagClass`](tlv/src/common/types.ts:1) — Enum of TLV tag classes.  
[`TagInfo`](tlv/src/common/types.ts:9) — Interface for TLV tag metadata.  
[`TLVResult`](tlv/src/common/types.ts:15) — Interface for parsed TLV results.
## Examples

### Parsing Primitive TLV

```typescript
import { BasicTLVParser } from "@aokiapp/tlv/parser";
import { TagClass } from "@aokiapp/tlv/common";

const buffer = new Uint8Array([0x04, 0x03, 0x41, 0x42, 0x43]).buffer;
const result = BasicTLVParser.parse(buffer);
console.log(result);
// {
//   tag: { tagClass: TagClass.Universal, tagNumber: 4, constructed: false },
//   length: 3,
//   value: ArrayBuffer([...]),
//   endOffset: 5
// }
```

### Parsing Constructed TLV

```typescript
import { SchemaParser } from "@aokiapp/tlv/parser";
import { TagClass } from "@aokiapp/tlv/common";

const schema = {
  name: "person",
  tagClass: TagClass.Universal,
  tagNumber: 0x10, // Sequence
  fields: [
    { name: "age", tagNumber: 0x02, decode: buf => new DataView(buf).getUint8(0) },
    { name: "name", tagNumber: 0x0c, decode: buf => new TextDecoder().decode(buf) }
  ]
};
const buffer = /* TLV-encoded ArrayBuffer for person */;
const parsed = new SchemaParser(schema).parse(buffer);
console.log(parsed); // { age: 30, name: "Alice" }
```

### Building Primitive TLV

```typescript
import { BasicTLVBuilder } from "@aokiapp/tlv/builder";
import { TagClass } from "@aokiapp/tlv/common";

const tlv = {
  tag: { tagClass: TagClass.Universal, tagNumber: 0x04, constructed: false },
  length: 3,
  value: new TextEncoder().encode("Hi!").buffer,
  endOffset: 0
};
const encoded = BasicTLVBuilder.build(tlv);
console.log(new Uint8Array(encoded)); // [0x04, 0x03, 0x48, 0x69, 0x21]
```

### Building Constructed TLV

```typescript
import { SchemaBuilder } from "@aokiapp/tlv/builder";
import { TagClass } from "@aokiapp/tlv/common";

const schema = {
  name: "person",
  tagClass: TagClass.Universal,
  tagNumber: 0x10, // Sequence
  fields: [
    { name: "age", tagNumber: 0x02, encode: n => new Uint8Array([n]).buffer },
    { name: "name", tagNumber: 0x0c, encode: s => new TextEncoder().encode(s).buffer }
  ]
};
const builder = new SchemaBuilder(schema);
const built = builder.build({ age: 30, name: "Alice" });
console.log(new Uint8Array(built)); // TLV-encoded person structure
```

See the [examples](https://github.com/AokiApp/tlv/tree/main/examples) folder for full demos.

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](https://github.com/AokiApp/tlv/blob/main/.github/CONTRIBUTING.md) for guidelines.

## License

Released under the [AokiApp Normative Application License - Tight (ANAL-Tight)](../LICENSE.md).