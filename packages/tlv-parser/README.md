# @aokiapp/tlv-parser

**The most advanced TLV parser for TypeScript with schema-driven type safety**

## What Makes This Special? ✨

Unlike other TLV parsers, @aokiapp/tlv-parser offers **industry-leading features** that set it apart:

### 🎯 **Full TypeScript Type Inference**
```typescript
// Other libraries: lose type safety, return `any`
const result: any = otherParser.parse(buffer);

// @aokiapp/tlv-parser: complete type safety from schema to result
const parser = new SchemaParser(schema);
const result = parser.parse(buffer); // Fully typed based on schema!
// TypeScript knows: result.name is string, result.age is number
```

### ⚡ **Async/Sync Dual Mode**
```typescript
// Unique: same parser, sync or async as needed
const parser = new SchemaParser(schema);

// Sync mode (fast for simple data)
const result = parser.parse(buffer);

// Async mode (supports crypto operations, network calls)
const result = await parser.parseAsync(buffer);
```

### 🔐 **Crypto-Ready Async Decoders**
```typescript
// Revolutionary: async decoders for crypto operations
const certSchema = Schema.primitive("publicKey", async (buffer) => {
  // Direct crypto integration - impossible with other parsers!
  return await crypto.subtle.importKey("jwk", keyData, algorithm, true, ["verify"]);
});

const cert = await parser.parseAsync(buffer);
const key: CryptoKey = cert.publicKey; // Real CryptoKey object!
```

### 🏗️ **Schema Composition & Reusability**
```typescript
// Advanced: compose complex schemas from reusable components
const personSchema = Schema.constructed("person", [
  Schema.primitive("name", decodeString),
  Schema.primitive("age", decodeNumber)
]);

const companySchema = Schema.constructed("company", [
  Schema.primitive("name", decodeString),
  personSchema, // Reuse schemas!
  Schema.constructed("employees", [personSchema]) // Nested reuse!
]);
```

### 🎨 **Intelligent Tag Validation**
```typescript
// Smart validation with detailed error messages
const schema = Schema.primitive("field", decoder, {
  tagClass: TagClass.Private,
  tagNumber: 0x42
});

// Automatic validation with helpful errors:
// "Tag class mismatch: expected Private, got Application"
// "Tag number mismatch: expected 66, got 65"
```

## Overview

This package provides **the most comprehensive TLV parsing solution** for SmartCard and ASN.1 data structures. Unlike basic parsers that just extract bytes, @aokiapp/tlv-parser delivers **structured, type-safe data extraction** with **enterprise-grade features**.

## Installation

```bash
npm install @aokiapp/tlv-parser
```

## Quick Start

### Basic TLV Parsing
```typescript
import { BasicTLVParser } from "@aokiapp/tlv-parser";

// Parse a single TLV structure
const buffer = new ArrayBuffer(/* TLV data */);
const result = BasicTLVParser.parse(buffer);

console.log("Tag Class:", result.tag.tagClass);
console.log("Tag Number:", result.tag.tagNumber);
console.log("Constructed:", result.tag.constructed);
console.log("Length:", result.length);
console.log("Value:", result.value);
console.log("End Offset:", result.endOffset);
```

### Schema-Based Parsing
```typescript
import { SchemaParser, Schema } from "@aokiapp/tlv-parser";

// Define schema
const schema = Schema.constructed("person", [
  Schema.primitive("name", (buffer) => new TextDecoder().decode(buffer)),
  Schema.primitive("age", (buffer) => new DataView(buffer).getUint8(0))
]);

// Parse with schema
const parser = new SchemaParser(schema);
const result = parser.parse(buffer);

console.log("Name:", result.name);  // Automatically decoded as string
console.log("Age:", result.age);    // Automatically decoded as number
```

## Core Components

### BasicTLVParser

The `BasicTLVParser` handles raw TLV parsing according to ASN.1 BER/DER encoding rules.

#### Parsing Single TLV Structure
```typescript
import { BasicTLVParser } from "@aokiapp/tlv-parser";

const result = BasicTLVParser.parse(buffer);

// Result structure:
interface TLVResult {
  tag: {
    tagClass: TagClass;      // Universal, Application, Context, Private
    constructed: boolean;    // true for constructed, false for primitive
    tagNumber: number;       // Tag number
  };
  length: number;           // Content length
  value: ArrayBuffer;       // Content data
  endOffset: number;        // Position after this TLV
}
```

#### Tag Classes
```typescript
import { TagClass } from "@aokiapp/tlv-parser";

TagClass.Universal        // 0b00 - Universal tags (built-in ASN.1 types)
TagClass.Application      // 0b01 - Application-specific tags  
TagClass.ContextSpecific  // 0b10 - Context-specific tags
TagClass.Private          // 0b11 - Private tags
```

### SchemaParser

The `SchemaParser` provides type-safe, schema-driven parsing with automatic data conversion.

#### Creating Schemas
```typescript
import { Schema, TagClass } from "@aokiapp/tlv-parser";

// Primitive schema (leaf node)
const nameSchema = Schema.primitive(
  "name", 
  (buffer) => new TextDecoder("utf-8").decode(buffer),
  { 
    tagClass: TagClass.Private, 
    tagNumber: 0x01 
  }
);

// Constructed schema (container)
const personSchema = Schema.constructed(
  "person",
  [
    Schema.primitive("name", decodeString),
    Schema.primitive("age", decodeAge),
    Schema.primitive("email", decodeString)
  ],
  {
    tagClass: TagClass.Application,
    tagNumber: 0x10
  }
);
```

#### Synchronous Parsing
```typescript
const parser = new SchemaParser(schema);

// Parse synchronously
const result = parser.parseSync(buffer);
console.log("Parsed data:", result);

// Alternative syntax
const result2 = parser.parse(buffer); // Defaults to sync
```

#### Asynchronous Parsing
```typescript
const parser = new SchemaParser(schema);

// Parse asynchronously (supports async decode functions)
const result = await parser.parseAsync(buffer);

// Alternative syntax  
const result2 = await parser.parse(buffer, { async: true });
```

## Schema Definition

### Primitive Schemas

Primitive schemas define leaf nodes with optional decode functions:

```typescript
// Text field
const textField = Schema.primitive(
  "text",
  (buffer) => new TextDecoder("utf-8").decode(buffer)
);

// Number field
const numberField = Schema.primitive(
  "number", 
  (buffer) => new DataView(buffer).getUint32(0, false) // Big-endian
);

// Binary field (no decoder - returns ArrayBuffer)
const binaryField = Schema.primitive("binary");

// Async decoder
const hashField = Schema.primitive(
  "hash",
  async (buffer) => {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return new Uint8Array(digest);
  }
);

// With tag constraints
const constrainedField = Schema.primitive(
  "constrained",
  decoder,
  {
    tagClass: TagClass.Private,
    tagNumber: 0x05
  }
);
```

### Constructed Schemas

Constructed schemas define container nodes with child fields:

```typescript
// Simple container
const container = Schema.constructed("container", [
  Schema.primitive("field1", decoder1),
  Schema.primitive("field2", decoder2)
]);

// Nested containers
const nested = Schema.constructed("root", [
  Schema.primitive("id", decodeNumber),
  Schema.constructed("details", [
    Schema.primitive("name", decodeString),
    Schema.primitive("value", decodeNumber)
  ])
]);

// With tag constraints
const taggedContainer = Schema.constructed(
  "tagged",
  [/* fields */],
  {
    tagClass: TagClass.Application,
    tagNumber: 0x20
  }
);
```

## Type Safety

The schema parser provides full TypeScript type inference:

```typescript
// Schema definition
const userSchema = Schema.constructed("user", [
  Schema.primitive("id", (buf) => new DataView(buf).getUint32(0)),
  Schema.primitive("name", (buf) => new TextDecoder().decode(buf)),
  Schema.primitive("active", (buf) => buf.byteLength > 0 && new Uint8Array(buf)[0] !== 0)
] as const); // 'as const' for better type inference

// Parsing result is fully typed
const parser = new SchemaParser(userSchema);
const user = parser.parse(buffer);

// TypeScript knows the exact structure:
user.id;      // number
user.name;    // string  
user.active;  // boolean
```

## Advanced Usage

### Custom Decoders

Create reusable decoder functions:

```typescript
// Date decoder
function decodeDate(buffer: ArrayBuffer): Date {
  const str = new TextDecoder().decode(buffer); // "YYYYMMDD"
  return new Date(
    parseInt(str.slice(0, 4)),  // Year
    parseInt(str.slice(4, 6)) - 1, // Month (0-based)
    parseInt(str.slice(6, 8))   // Day  
  );
}

// Offset array decoder
function decodeOffsets(buffer: ArrayBuffer): number[] {
  const view = new DataView(buffer);
  const offsets = [];
  for (let i = 0; i < buffer.byteLength; i += 2) {
    offsets.push(view.getUint16(i, false)); // Big-endian
  }
  return offsets;
}

// Usage in schema
const schema = Schema.constructed("data", [
  Schema.primitive("createdAt", decodeDate),
  Schema.primitive("offsets", decodeOffsets)
]);
```

### Async Decoders

Support for asynchronous data processing:

```typescript
// Crypto operations
async function decodePublicKey(buffer: ArrayBuffer): Promise<CryptoKey> {
  // Parse ASN.1 structure and extract key components
  const keyData = parseRSAPublicKey(buffer);
  
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: "RSA",
      n: keyData.modulus,
      e: keyData.exponent,
      key_ops: ["verify"],
      ext: true
    },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"]
  );
}

// Usage
const certSchema = Schema.constructed("certificate", [
  Schema.primitive("publicKey", decodePublicKey), // Async decoder
  Schema.primitive("signature", (buf) => new Uint8Array(buf))
]);

// Must use async parsing
const parser = new SchemaParser(certSchema);
const cert = await parser.parseAsync(buffer);
const publicKey: CryptoKey = cert.publicKey;
```

### Validation and Error Handling

Schema parsing includes automatic validation:

```typescript
try {
  const result = parser.parse(buffer);
} catch (error) {
  if (error.message.includes("Tag class mismatch")) {
    console.log("Unexpected tag class");
  } else if (error.message.includes("Tag number mismatch")) {
    console.log("Unexpected tag number");
  } else if (error.message.includes("constructed flag mismatch")) {
    console.log("Expected constructed/primitive mismatch");
  } else {
    console.log("Parse error:", error.message);
  }
}
```

### Working with Complex Structures

Real-world example with nested data:

```typescript
// Japanese MynaCard certificate structure
const certificateSchema = Schema.constructed("certificate", [
  Schema.constructed("contents", [
    Schema.primitive("issuer", (buf) => new Uint8Array(buf)),
    Schema.primitive("subject", (buf) => new Uint8Array(buf)),
    Schema.primitive("publicKey", decodeRSAPublicKey)
  ], {
    tagClass: TagClass.Application,
    tagNumber: 0x4E
  }),
  Schema.primitive("signature", (buf) => new Uint8Array(buf), {
    tagClass: TagClass.Application, 
    tagNumber: 0x37
  })
], {
  tagClass: TagClass.Application,
  tagNumber: 0x21
});

// Parse certificate
const parser = new SchemaParser(certificateSchema);
const cert = await parser.parseAsync(certificateBuffer);

// Access nested data
const publicKey = cert.contents.publicKey; // CryptoKey
const issuer = cert.contents.issuer;       // Uint8Array
const signature = cert.signature;          // Uint8Array
```

## Performance Considerations

### Buffer Management
```typescript
// Efficient parsing of multiple TLVs
const buffer = new ArrayBuffer(largeData);
let offset = 0;

while (offset < buffer.byteLength) {
  const slice = buffer.slice(offset);
  const result = BasicTLVParser.parse(slice);
  
  // Process result...
  
  offset += result.endOffset;
}
```

### Memory Usage
```typescript
// Schema parsers are reusable
const parser = new SchemaParser(schema);

// Parse multiple buffers with same parser
const results = await Promise.all(
  buffers.map(buffer => parser.parseAsync(buffer))
);
```

## Integration Examples

### With MynaCard Data
```typescript
import { schemaKenhojoBasicFour } from "@aokiapp/mynacard";
import { SchemaParser } from "@aokiapp/tlv-parser";

// Parse Japanese government card data
const parser = new SchemaParser(schemaKenhojoBasicFour);
const info = parser.parse(cardData);

console.log("Name:", info.name);      // 氏名
console.log("Address:", info.address); // 住所
console.log("Birth:", info.birth);    // 生年月日
console.log("Gender:", info.gender);  // 性別
```

### With Raw SmartCard Data
```typescript
// Parse arbitrary SmartCard TLV structures
function parseSmartCardData(buffer: ArrayBuffer) {
  const results = [];
  let offset = 0;
  
  while (offset < buffer.byteLength) {
    const slice = buffer.slice(offset);
    const tlv = BasicTLVParser.parse(slice);
    
    results.push({
      tag: `${tlv.tag.tagClass}:${tlv.tag.tagNumber}`,
      constructed: tlv.tag.constructed,
      length: tlv.length,
      data: tlv.value
    });
    
    offset += tlv.endOffset;
  }
  
  return results;
}
```

## Error Handling

### Common Errors
- **"Input is too short"**: Buffer doesn't contain valid TLV data
- **"Tag class mismatch"**: Expected tag class doesn't match actual
- **"Tag number mismatch"**: Expected tag number doesn't match actual  
- **"Constructed flag mismatch"**: Expected constructed/primitive doesn't match
- **"Constructed element does not end exactly"**: Invalid nested structure length

### Best Practices
```typescript
try {
  const result = parser.parse(buffer);
  return result;
} catch (error) {
  console.error("TLV parsing failed:", error.message);
  
  // Log buffer for debugging (be careful with sensitive data)
  if (process.env.NODE_ENV === 'development') {
    console.debug("Buffer:", Array.from(new Uint8Array(buffer.slice(0, 32))));
  }
  
  throw error;
}
```

## Dependencies

This package has no external dependencies and works in both Node.js and browser environments.

## Related Packages

- [`@aokiapp/mynacard`](../mynacard) - Pre-defined schemas for Japanese MynaCard
- [`@aokiapp/interface`](../interface) - Core SmartCard abstractions