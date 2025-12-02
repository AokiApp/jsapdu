# jsapdu Documentation

Complete documentation for the jsapdu smart card library monorepo.

## User Documentation

Quick-start guides for library consumers:

- **[@aokiapp/jsapdu-interface](../packages/interface/README.md)** - Core APDU and platform abstractions
- **[@aokiapp/apdu-utils](../packages/apdu-utils/README.md)** - Ready-to-use APDU command builders
- **[@aokiapp/mynacard](../packages/mynacard/README.md)** - Japanese MynaCard support
- **[@aokiapp/jsapdu-pcsc](../packages/pcsc/README.md)** - PC/SC reader support (Node.js)
- **[@aokiapp/pcsc-ffi-node](../packages/pcsc-ffi-node/README.md)** - Low-level PC/SC FFI bindings
- **[@aokiapp/jsapdu-rn](../packages/rn/README.md)** - React Native NFC support

## Technical Documentation

Deep-dive documentation for contributors and advanced users:

### Architecture
- **[Package Interactions](./architecture/package-interactions.md)** - How packages work together, dependency graph, data flow patterns

### Implementation Details

**@aokiapp/jsapdu-interface:**
- **[Extended APDU Support](../packages/interface/docs/extended-apdu.md)** - Automatic standard/extended APDU detection, encoding formats, compatibility

**@aokiapp/jsapdu-pcsc:**
- **[AsyncMutex Implementation](../packages/pcsc/docs/async-mutex.md)** - Concurrency control for PC/SC operations, performance characteristics

**@aokiapp/jsapdu-rn:**
- **[Nitro Error Mapping](../packages/rn/docs/nitro-error-mapping.md)** - Android/iOS exception handling, error normalization strategy

**@aokiapp/mynacard:**
- **[TLV Schema System](../packages/mynacard/docs/tlv-schemas.md)** - Japanese card data parsing, schema architecture, custom decoders

### Testing
- **[E2E Testing Patterns](./testing/e2e-testing-patterns.md)** - Hardware testing methodology, test organization, real-world scenarios

## Quick Navigation

### I want to...

**...use smart cards in Node.js:**
1. Start with [@aokiapp/jsapdu-pcsc](../packages/pcsc/README.md)
2. Use [@aokiapp/apdu-utils](../packages/apdu-utils/README.md) for commands
3. Add [@aokiapp/mynacard](../packages/mynacard/README.md) if working with Japanese cards

**...use NFC in React Native:**
1. Start with [@aokiapp/jsapdu-rn](../packages/rn/README.md)
2. Use [@aokiapp/apdu-utils](../packages/apdu-utils/README.md) for commands  
3. Add [@aokiapp/mynacard](../packages/mynacard/README.md) if working with Japanese cards

**...build APDU commands:**
1. Use [@aokiapp/apdu-utils](../packages/apdu-utils/README.md) for common commands
2. Use [@aokiapp/jsapdu-interface](../packages/interface/README.md) `CommandApdu` class for custom commands

**...implement a new platform:**
1. Read [Package Interactions](./architecture/package-interactions.md) for architecture
2. Extend base classes from [@aokiapp/jsapdu-interface](../packages/interface/README.md)
3. Study [@aokiapp/jsapdu-pcsc](../packages/pcsc/README.md) or [@aokiapp/jsapdu-rn](../packages/rn/README.md) as reference

**...parse MynaCard data:**
1. Use constants from [@aokiapp/mynacard](../packages/mynacard/README.md)
2. Read [TLV Schema System](../packages/mynacard/docs/tlv-schemas.md) for parsing details

**...work with low-level PC/SC:**
1. Use [@aokiapp/pcsc-ffi-node](../packages/pcsc-ffi-node/README.md) for direct FFI access
2. Study [AsyncMutex](../packages/pcsc/docs/async-mutex.md) for concurrency patterns

**...understand error handling:**
1. See error sections in each package README
2. Read [Nitro Error Mapping](../packages/rn/docs/nitro-error-mapping.md) for React Native specifics

**...write tests:**
1. Read [E2E Testing Patterns](./testing/e2e-testing-patterns.md)
2. Study examples in `examples/` directory

## Documentation Principles

**User READMEs (packages/*/README.md):**
- Focus on "how to use"
- Multiple practical examples
- Concise but complete API reference
- No internal implementation details

**Technical Docs (packages/*/docs/ and docs/*/):**
- Implementation details and rationale
- Architecture and design patterns
- Performance considerations
- Testing strategies
- For contributors and advanced users

## Contributing

When adding new features:
1. Update user README with usage examples
2. Add technical documentation if implementation is non-trivial
3. Include test examples in E2E testing guide
4. Update package interactions diagram if adding new package

## License

This documentation is part of the jsapdu project, licensed under MIT.