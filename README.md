# jsapdu

A modern TypeScript library for SmartCard communication across multiple platforms and protocols.

## Features

- 🎯 Platform-agnostic SmartCard communication
- 🔌 Support for multiple connection types (USB, NFC, Bluetooth LE)
- 📱 Cross-platform support (PC/SC, WinSCard, Core NFC, Android NFC, etc.)
- 🌐 Cross-runtime support (Node.js, browser, React Native)
- 🎭 Host Card Emulation (HCE) support
- 🔄 Modern async/await API with `Symbol.asyncDispose` support
- 🏗️ Strongly typed architecture
- 📦 APDU command and response handling

## Architecture

The library is built around several key abstractions:

- `SmartCardPlatformManager`: Platform-specific implementation provider
- `SmartCardPlatform`: Base platform abstraction (PC/SC, NFC, etc.)
- `SmartCardDeviceInfo`: Reader/device information and capabilities
- `SmartCardDevice`: Device communication handler
- `SmartCard`: Card communication session
- `EmulatedCard`: Host Card Emulation (HCE) functionality

### Supported Protocols

#### Device to Card (D2C)

- ISO 7816 (Contact)
- NFC (Contactless)

#### Platform to Device (P2D)

- USB CCID
- Bluetooth LE
- NFC

## What it is not

- A full-fledged SmartCard middleware
  - Only cares about APDU communication, does not handle something higher-level, such card file structure, well-known INS commands, etc.
- A cryptographic library
  - Does not provide cryptographic operations, such as RSA, ECC, etc.
- A NFC NDEF tag library
  - NDEF is different from APDU, and this library does not handle NDEF operations, so you can't write NDEF records to a NFC tag using this library.
- FeliCa related functionality
  - FeliCa is a different protocol from ISO 7816 and NFC, and this library does not support FeliCa.
- Non-APDU protocol support
  - This library only supports APDU commands and responses.

## License

[License Type] - See LICENSE file for details

## Contributing

Contributions are welcome! Please read the contributing guidelines before making a pull request.
