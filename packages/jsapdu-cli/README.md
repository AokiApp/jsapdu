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
# Send a single APDU command (hex format)
jsapdu apdu "00A4040000"

# Send multiple APDU commands in sequence
jsapdu apdu "00A4040000" "00B0000010" "00A4020002"

# Send command with data
jsapdu apdu "00A404000A1234567890ABCDEF1234"

# Read APDU commands from file (one per line)
jsapdu apdu --file commands.txt

# Continue execution even if a command fails
jsapdu apdu "00A4040000" "invalid_cmd" "00B0000010" --continue-on-error

# Add delay between commands (milliseconds)
jsapdu apdu "00A4040000" "00B0000010" --delay 1000

# Use specific reader
jsapdu apdu "00A4040000" --reader "Reader Name"

# Show detailed information
jsapdu apdu "00A4040000" --verbose

# Output as JSON
jsapdu apdu "00A4040000" --json
```

### ISO 7816 Standard Commands

The CLI provides specialized commands for ISO 7816 standard operations:

#### SELECT Command

```bash
# Select application by AID (as DF)
jsapdu iso7816 select "A0000000041010"

# Select file as EF (Elementary File)
jsapdu iso7816 select "3F00" --ef

# Select DF and request FCI (File Control Information)
jsapdu iso7816 select "A0000000041010" --fci

# With verbose output
jsapdu iso7816 select "A0000000041010" --verbose
```

#### READ BINARY Command

```bash
# Read 256 bytes from offset 0
jsapdu iso7816 read-binary

# Read specific length from specific offset
jsapdu iso7816 read-binary --offset 0x10 --length 32

# Read from specific EF using short ID
jsapdu iso7816 read-binary --ef 1 --length 100

# Read current EF
jsapdu iso7816 read-binary --current --length 50

# Read full file
jsapdu iso7816 read-binary --full

# Use extended APDU
jsapdu iso7816 read-binary --extended --length 512
```

#### VERIFY Command

```bash
# Verify PIN as string
jsapdu iso7816 verify "1234"

# Verify PIN as hex data
jsapdu iso7816 verify "31323334" --hex

# Verify for specific EF
jsapdu iso7816 verify "1234" --ef 1

# Verify for current DF
jsapdu iso7816 verify "1234" --current
```

#### GET DATA Command

```bash
# Get data using BER-TLV tag (2 bytes)
jsapdu iso7816 get-data "9F36"

# Get data using Simple TLV tag (1 byte)
jsapdu iso7816 get-data "36" --simple-tlv

# Specify expected response length
jsapdu iso7816 get-data "9F36" --le 16
```

#### UPDATE BINARY Command

```bash
# Update binary data at offset 0
jsapdu iso7816 update-binary "1234567890ABCDEF"

# Update at specific offset
jsapdu iso7816 update-binary "ABCD" --offset 0x10

# Update current EF
jsapdu iso7816 update-binary "1234" --current --offset 5

# Update specific EF by short ID
jsapdu iso7816 update-binary "5678" --ef 2 --offset 0

# Use extended APDU
jsapdu iso7816 update-binary "LARGE_DATA_HERE" --extended
```

#### WRITE BINARY Command

```bash
# Write binary data at offset 0
jsapdu iso7816 write-binary "1234567890ABCDEF"

# Write at specific offset
jsapdu iso7816 write-binary "ABCD" --offset 0x10

# Write to current EF
jsapdu iso7816 write-binary "1234" --current --offset 5

# Write to specific EF by short ID
jsapdu iso7816 write-binary "5678" --ef 2

# Use extended APDU
jsapdu iso7816 write-binary "LARGE_DATA_HERE" --extended
```

#### READ RECORD Command

```bash
# Read record 1 from SFI 2
jsapdu iso7816 read-record 1 2

# Read with specific expected length
jsapdu iso7816 read-record 3 5 --le 32

# Read next record
jsapdu iso7816 read-record 0 2 --mode next

# Read previous record
jsapdu iso7816 read-record 0 2 --mode previous

# Read with absolute mode (default)
jsapdu iso7816 read-record 2 3 --mode absolute
```

#### WRITE RECORD Command

```bash
# Write new record to SFI 1
jsapdu iso7816 write-record 1 1 "1234567890ABCDEF"

# Write with specific mode
jsapdu iso7816 write-record 2 3 "AABBCCDD" --mode absolute

# Write next record
jsapdu iso7816 write-record 0 2 "FFEE" --mode next
```

#### UPDATE RECORD Command

```bash
# Update existing record in SFI 1
jsapdu iso7816 update-record 1 1 "1234567890ABCDEF"

# Update with specific mode
jsapdu iso7816 update-record 3 2 "AABBCCDD" --mode absolute

# Update next record
jsapdu iso7816 update-record 0 2 "FFEE" --mode next
```

#### APPEND RECORD Command

```bash
# Append new record to end of SFI 1
jsapdu iso7816 append-record 1 "1234567890ABCDEF"

# Append to linear/cyclic file
jsapdu iso7816 append-record 5 "DEADBEEF"
```

#### Authentication Commands

##### GET CHALLENGE Command

```bash
# Get 8-byte challenge (default)
jsapdu iso7816 get-challenge

# Get specific length challenge
jsapdu iso7816 get-challenge --le 16

# Get maximum challenge
jsapdu iso7816 get-challenge --le 255
```

##### EXTERNAL AUTHENTICATE Command

```bash
# External authentication with key ID 1
jsapdu iso7816 external-authenticate 1 "1234567890ABCDEF"

# With specific algorithm indicator
jsapdu iso7816 external-authenticate 2 "DEADBEEF" --algo 0x10

# Standard authentication
jsapdu iso7816 external-authenticate 0 "FEDCBA0987654321"
```

##### INTERNAL AUTHENTICATE Command

```bash
# Internal authentication
jsapdu iso7816 internal-authenticate "1234567890ABCDEF"

# With specific algorithm
jsapdu iso7816 internal-authenticate "DEADBEEF" --algo 0x20

# Card authentication
jsapdu iso7816 internal-authenticate "CHALLENGE_DATA"
```

#### Channel Management Commands

##### OPEN CHANNEL Command

```bash
# Open new logical channel (let card choose number)
jsapdu iso7816 open-channel

# Request specific channel number
jsapdu iso7816 open-channel --channel 2

# Open with verbose output
jsapdu iso7816 open-channel --verbose
```

##### CLOSE CHANNEL Command

```bash
# Close logical channel 1
jsapdu iso7816 close-channel 1

# Close specific channel
jsapdu iso7816 close-channel 5

# Close with JSON output
jsapdu iso7816 close-channel 2 --json
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

### APDU Command Options

- `--file <path>, -f <path>`: Read APDU commands from file (one per line)
- `--continue-on-error`: Continue execution even if an APDU command fails
- `--delay <ms>`: Delay between APDU commands in milliseconds

### ISO 7816 Command Options

#### File Selection Options
- `--df`: Select as DF (Dedicated File)
- `--ef`: Select as EF (Elementary File)
- `--fci`: Request FCI (File Control Information) for DF

#### Binary File Operations Options
- `--offset <offset>`: Offset in file (hex or decimal)
- `--length <length>`: Number of bytes to read/write
- `--ef <id>`: Short EF ID (0-31)
- `--current`: Operate on current EF
- `--full`: Read full file
- `--extended`: Use extended APDU

#### Record File Operations Options
- `--mode <mode>`: Reference mode for records (absolute, next, previous)
- `--le <length>`: Expected response length for read operations

#### Security Options
- `--ef <id>`: EF identifier for verification
- `--current`: Verify for current DF
- `--hex`: Interpret PIN/data as hex string
- `--algo <algorithm>`: Algorithm indicator for authentication

#### Data Retrieval Options
- `--ber-tlv`: Use BER-TLV encoding (2 bytes)
- `--simple-tlv`: Use Simple TLV encoding (1 byte)
- `--le <length>`: Expected response length

#### Channel Management Options
- `--channel <number>`: Channel number for open/close operations

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

# Complex automation with multiple APDU commands
jsapdu apdu --json "00A4040005A000000041" "00B0000010" | jq '.results[] | select(.success) | .data'

# Batch processing with error handling
jsapdu apdu --file batch_commands.txt --continue-on-error --json > results.json

# ISO 7816 command automation
jsapdu iso7816 select "A0000000041010" --json && jsapdu iso7816 read-binary --full --json
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
│   │   ├── apdu.ts        # Enhanced APDU command (multiple sequences)
│   │   ├── iso7816.ts     # ISO 7816 standard commands
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