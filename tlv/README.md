# @aokiapp/tlv

A TypeScript library for Tag-Length-Value (TLV) parsing and building, with schema-driven APIs.

## Features

- **Parser**: Parse TLV data with schema support, sync/async modes, and type inference.
- **Builder**: Build TLV data from schema and structured input, sync/async modes.
- **Submodule exports**: Use `@aokiapp/tlv/parser` and `@aokiapp/tlv/builder` for clear separation.
- **Common types**: Shared TLV types and tag classes in `@aokiapp/tlv/common`.
- **TypeScript-first**: Full type safety and inference.
- **No bundled schemas**: Flexible for any TLV/ASN.1 use case.

## Usage

```typescript
import { BasicTLVParser, SchemaParser, Schema } from "@aokiapp/tlv/parser";
import { BasicTLVBuilder, SchemaBuilder } from "@aokiapp/tlv/builder";
import { TagClass, TLVResult } from "@aokiapp/tlv/common";
```

## Directory Structure

- `src/parser/` — TLV parsing logic
- `src/builder/` — TLV building logic
- `src/common/` — Shared types and utilities

## License

SEE LICENSE IN LICENSE.md