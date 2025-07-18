# 🃏 jsapdu

[![npm version](https://badge.fury.io/js/%40aokiapp%2Fjsapdu.svg)](https://badge.fury.io/js/%40aokiapp%2Fjsapdu)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: ANAL](https://img.shields.io/badge/License-ANAL-blue.svg)](./LICENSE.md)

**The modern TypeScript library for SmartCard communication that just works.**

jsapdu bridges the gap between your applications and SmartCard hardware, providing a unified, type-safe interface across multiple platforms. Whether you're building government ID solutions, payment systems, or secure authentication, jsapdu handles the complexity so you can focus on your business logic.

## ✨ Why jsapdu?

```typescript
// Connect to any SmartCard with just a few lines
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";

const platform = PcscPlatformManager.getInstance().getPlatform();
await platform.init();

const device = await platform.acquireDevice(
  (await platform.getDeviceInfo())[0].id,
);
const card = await device.startSession();

// Send APDU commands with full type safety
const response = await card.transmit(
  new CommandApdu(0x00, 0xa4, 0x04, 0x00, aid),
);
console.log(`Success: ${response.sw === 0x9000}`);
```

### 🎯 **Zero Configuration** • Works out of the box with PC/SC, NFC, and more

### 🔒 **Type Safe** • Full TypeScript support with intelligent autocomplete

### 🌐 **Cross Platform** • Windows, macOS, Linux, and mobile support

### 📱 **Modern APIs** • async/await, Symbol.asyncDispose, and clean abstractions

### ⚡ **Advanced TLV Parser** • Industry-leading schema-driven parsing with full type inference

### 🃏 **SmartCard Ready** • Built-in support for Japanese MynaCard and extensible for any card type

### 🧪 **PC/SC FFI Included** • Direct access to PC/SC functions via Foreign Function Interface (FFI)

## 🚀 Quick Start

### Installation

```bash
npm install @aokiapp/jsapdu @aokiapp/jsapdu-pcsc
```

### Your First SmartCard Connection

```typescript
import { PcscPlatformManager } from "@aokiapp/jsapdu-pcsc";
import { CommandApdu } from "@aokiapp/jsapdu-interface";

async function connectToCard() {
  // Initialize platform
  await using platform = PcscPlatformManager.getInstance().getPlatform();
  await platform.init();

  // Find and connect to card
  const devices = await platform.getDeviceInfo();
  await using device = await platform.acquireDevice(devices[0].id);
  await using card = await device.startSession();

  // Get card information
  const atr = await card.getAtr();
  console.log("Card ATR:", Buffer.from(atr).toString("hex"));

  // Send commands
  const selectCommand = new CommandApdu(
    0x00,
    0xa4,
    0x04,
    0x00,
    Buffer.from("A0000000041010", "hex"),
  );
  const response = await card.transmit(selectCommand);

  if (response.sw === 0x9000) {
    console.log("Application selected successfully!");
  }
}

connectToCard().catch(console.error);
```

### Japanese MynaCard Support

```typescript
import { JPKI_AP, KENHOJO_AP } from "@aokiapp/mynacard";
import { selectDf, verify, readEfBinaryFull } from "@aokiapp/apdu-utils";

// Read MynaCard basic information
await card.transmit(selectDf(KENHOJO_AP));
await card.transmit(verify("1234", { ef: 0x11 })); // PIN verification
const data = await card.transmit(readEfBinaryFull(0x02)); // Read basic info

// Parse structured TLV data
import { SchemaParser, schemaKenhojoBasicFour } from "@aokiapp/mynacard";
const parser = new SchemaParser(schemaKenhojoBasicFour);
const info = parser.parse(data.arrayBuffer());
console.log("Name:", info.name, "Address:", info.address);
```

## 📦 Packages

| Package                                              | Description                      | Use Case                      |
| ---------------------------------------------------- | -------------------------------- | ----------------------------- |
| [`@aokiapp/jsapdu-interface`](./packages/interface)  | Core abstractions and types      | Platform-agnostic development |
| [`@aokiapp/jsapdu-pcsc`](./packages/pcsc)            | PC/SC platform implementation    | Desktop SmartCard readers     |
| [`@aokiapp/apdu-utils`](./packages/apdu-utils)       | APDU command builders            | Common SmartCard operations   |
| [`@aokiapp/mynacard`](./packages/mynacard)           | Japanese MynaCard support        | Government ID integration     |
| [`@aokiapp/tlv-parser`](./packages/tlv-parser)       | TLV data parsing                 | Structured data extraction    |
| [`@aokiapp/pcsc-ffi-node`](./packages/pcsc-ffi-node) | PC/SC Foreign Function Interface | Low-level PC/SC access        |

## 🌟 Features

### Platform Support

- **PC/SC** - Windows, macOS, Linux desktop readers
- **NFC** - Contactless card communication
- **Bluetooth LE** - Wireless SmartCard readers
- **WebUSB** - Browser-based card access _(coming soon)_

### SmartCard Protocols

- **ISO 7816** - Contact card communication
- **NFC/ISO 14443** - Contactless communication
- **APDU** - Application Protocol Data Units
- **TLV** - Tag-Length-Value data parsing

### Developer Experience

- **Full TypeScript support** with intelligent autocomplete
- **Modern async/await APIs** with automatic resource cleanup
- **Comprehensive error handling** with structured error codes
- **Extensive testing** with unit, integration, and E2E tests

## 🎌 Japanese MynaCard Integration

jsapdu provides first-class support for Japanese government MynaCard (マイナンバーカード):

```typescript
// Access different MynaCard applications
import { JPKI_AP, KENHOJO_AP, KENKAKU_AP } from "@aokiapp/mynacard";

// Read certificate information
await card.transmit(selectDf(JPKI_AP));
const cert = await card.transmit(readEfBinaryFull(0x01)); // Signature certificate

// Read personal information (券面事項入力補助)
await card.transmit(selectDf(KENHOJO_AP));
const basicInfo = await card.transmit(readEfBinaryFull(0x02));

// Parse with built-in schemas
import { schemaKenhojoBasicFour } from "@aokiapp/mynacard";
const parser = new SchemaParser(schemaKenhojoBasicFour);
const parsed = parser.parse(basicInfo.arrayBuffer());
// { name: "田中太郎", address: "東京都...", birth: "1990-01-01", gender: "男" }
```

## 📚 Documentation

- [**Getting Started Guide**](./docs/getting-started.md) - Complete setup and first steps
- [**API Reference**](./docs/api/README.md) - Detailed API documentation
- [**Architecture Guide**](./docs/architecture/README.md) - System design and patterns
- [**MynaCard Guide**](./docs/guides/mynacard.md) - Japanese government card integration
- [**Examples**](./examples) - Real-world usage examples

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/AokiApp/jsapdu.git
cd jsapdu

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run E2E tests (requires SmartCard hardware)
npm run test:e2e
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the AokiApp Normative Application License (ANAL) - see the [LICENSE](./LICENSE.md) file for details.

## 🏢 About

Created by [**AokiApp Inc.**](https://aoki.app) - Building the future of digital identity and secure communications.

---

<div align="center">

**[🌟 Star this project](https://github.com/AokiApp/jsapdu)** • **[📚 Read the docs](./docs)** • **[💬 Get support](https://github.com/AokiApp/jsapdu/issues)**

</div>
