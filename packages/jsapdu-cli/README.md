# @aokiapp/jsapdu-cli

Command line tool for smart card communication using jsapdu. This tool provides easy-to-use commands for interacting with smart cards through PC/SC readers, with special support for Japanese MynaCard (マイナンバーカード).

## Installation

### Global Installation (Recommended)

```bash
npm install -g @aokiapp/jsapdu-cli
```

After installation, the `jsapdu` command will be available globally.

### Local Installation

```bash
npm install @aokiapp/jsapdu-cli
npx jsapdu --help
```

## Prerequisites

- Node.js 18.0.0 or higher
- PC/SC compatible smart card reader
- Smart card reader drivers installed
- On Windows: WinSCard API (usually pre-installed)
- On macOS: PC/SC framework (usually pre-installed)  
- On Linux: pcsc-lite library

## Usage

### Basic Commands

#### List Available Readers

```bash
# List all available smart card readers
jsapdu readers

# Show detailed reader information
jsapdu readers --verbose

# Output as JSON
jsapdu readers --json
```

#### Connect to Card

```bash
# Connect to first available card
jsapdu connect

# Connect using specific reader
jsapdu connect --reader "Reader Name"

# Wait for card insertion (default: 30 seconds)
jsapdu connect --wait 60

# Output as JSON
jsapdu connect --json
```

#### Send APDU Commands

```bash
# Send a basic APDU command (hex format)
jsapdu apdu "00A4040000"

# Send command with data
jsapdu apdu "00A404000A1234567890ABCDEF1234"

# Use specific reader
jsapdu apdu "00A4040000" --reader "Reader Name"

# Show detailed information
jsapdu apdu "00A4040000" --verbose

# Output as JSON
jsapdu apdu "00A4040000" --json
```

### MynaCard (マイナンバーカード) Operations

The CLI provides specialized commands for Japanese MynaCard operations:

#### Basic MynaCard Information

```bash
# Show MynaCard information
jsapdu mynacard info

# Detailed information
jsapdu mynacard info --verbose

# JSON output
jsapdu mynacard info --json
```

#### Access JPKI (公的個人認証) Application

```bash
# Access JPKI application
jsapdu mynacard jpki

# With detailed output
jsapdu mynacard jpki --verbose
```

#### Access Kenhojo (券面補助) Application

```bash
# Access Kenhojo application for basic card information
jsapdu mynacard kenhojo

# With specific reader
jsapdu mynacard kenhojo --reader "Reader Name"
```

#### Access Kenkaku (券面格納) Application

```bash
# Access Kenkaku application for stored information
jsapdu mynacard kenkaku

# JSON output
jsapdu mynacard kenkaku --json
```

## Command Options

### Global Options

- `--help, -h`: Show help information
- `--version, -V`: Show version information

### Common Options

- `--reader <id>, -r <id>`: Specify reader ID to use
- `--json, -j`: Output results as JSON
- `--verbose, -v`: Show detailed information
- `--wait <timeout>, -w <timeout>`: Wait timeout for card presence (seconds)

## Examples

### Basic Smart Card Operations

```bash
# List readers
jsapdu readers
# Output: Found 1 reader(s):
# 1. Generic USB2.0-CRW

# Connect to card
jsapdu connect
# Output: Using reader: Generic USB2.0-CRW
# Connected to card successfully!
# ATR: 3B 8F 80 01 80 4F 0C A0 00 00 03 06 03 00 01 00 00 00 00 6A

# Send SELECT command to select master file
jsapdu apdu "00A4000C02"
```

### MynaCard Operations

```bash
# Check if MynaCard is present
jsapdu mynacard info
# Output: MynaCard (マイナンバーカード) detected!

# Access JPKI application
jsapdu mynacard jpki
# Output: ✓ JPKI application selected successfully

# Access with JSON output for automation
jsapdu mynacard jpki --json
# Output: {"application":"JPKI","selected":true,"response":"9000"}
```

### Automation Examples

```bash
# Check reader status and output as JSON for scripting
jsapdu readers --json | jq '.[] | .friendlyName'

# Wait for card and get ATR
jsapdu connect --wait 120 --json | jq '.atr'

# Chain commands for MynaCard automation
jsapdu mynacard jpki --json && jsapdu apdu "00A4000000"
```

## Error Handling

The CLI tool provides clear error messages and exits with appropriate status codes:

- Exit code 0: Success
- Exit code 1: General error (reader not found, card not present, etc.)

Common error scenarios:

```bash
# No readers found
jsapdu readers
# Output: No smart card readers found.

# No card present
jsapdu connect
# Output: No card detected after waiting.

# Invalid APDU format
jsapdu apdu "invalid"
# Output: Invalid hex string. Use format: 00A4040000
```

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Project Structure

```
packages/jsapdu-cli/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── cli.ts             # Main CLI implementation
│   ├── commands/          # Command implementations
│   │   ├── readers.ts     # Reader listing command
│   │   ├── connect.ts     # Card connection command
│   │   ├── apdu.ts        # APDU sending command
│   │   └── mynacard.ts    # MynaCard specific commands
│   └── utils/
│       └── formatters.ts  # Output formatting utilities
├── package.json
├── tsconfig.json
└── README.md
```

## Dependencies

This CLI tool is built on top of the jsapdu ecosystem:

- `@aokiapp/jsapdu-interface`: Core abstractions and interfaces
- `@aokiapp/jsapdu-pcsc`: PC/SC platform implementation
- `@aokiapp/apdu-utils`: Common APDU command utilities
- `commander`: Command line argument parsing

## License

This project is licensed under the ANAL-Tight-1.0.1 license. See the [LICENSE](https://raw.githubusercontent.com/AokiApp/ANAL/refs/heads/main/licenses/ANAL-Tight-1.0.1.md) for details.

## Support

For issues, questions, or contributions, please visit the [GitHub repository](https://github.com/AokiApp/jsapdu).

## Related Projects

- [@aokiapp/jsapdu-interface](../interface/README.md): Core interfaces
- [@aokiapp/jsapdu-pcsc](../pcsc/README.md): PC/SC implementation  
- [@aokiapp/apdu-utils](../apdu-utils/README.md): APDU utilities
- [@aokiapp/mynacard](../mynacard/README.md): MynaCard specific functionality