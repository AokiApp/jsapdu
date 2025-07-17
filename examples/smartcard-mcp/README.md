# Smart Card MCP Server

A Model Context Protocol (MCP) server for interacting with smart cards using the PC/SC API. This server provides tools and resources for performing smart card operations through AI assistants.

## Features

- List available smart card readers
- Connect to smart card readers
- Transmit APDU commands to smart cards
- Get card information (ATR)
- Reset smart cards
- Access smart card resources

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- PC/SC middleware installed on your system:
  - Windows: PC/SC is included in the OS
  - macOS: PC/SC is included in the OS
  - Linux: Install `pcscd` and `libpcsclite-dev`

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/smartcard-mcp.git
cd smartcard-mcp
```

2. Install dependencies:

```bash
npm install
```

## Usage

### Starting the Server

You can start the server using one of the following methods:

#### Using stdio (for Claude Desktop or other MCP clients)

```bash
npm start
```

#### Using HTTP streaming (for web-based clients)

```bash
TRANSPORT_TYPE=httpStream PORT=8080 npm start
```

### Connecting to the Server

#### From Claude Desktop

1. Open Claude Desktop
2. Go to Settings > MCP Servers
3. Add a new MCP server with the following configuration:
   ```json
   {
     "mcpServers": {
       "smartcard-mcp": {
         "command": "npm",
         "args": ["start"],
         "cwd": "/path/to/smartcard-mcp"
       }
     }
   }
   ```
4. Save the configuration
5. In Claude, type `/mcp smartcard-mcp` to connect to the server

#### From Other MCP Clients

Follow the client-specific instructions for connecting to an MCP server.

## Available Tools

### `listReaders`

Lists all available smart card readers connected to the system.

**Example:**

```
/mcp smartcard-mcp listReaders
```

### `connect`

Connects to a smart card reader and establishes a session with the card.

**Parameters:**

- `readerId` (optional): ID of the reader to connect to. If not provided, connects to the first available reader.

**Example:**

```
/mcp smartcard-mcp connect
```

### `getCardInfo`

Gets information about the connected smart card, including the ATR (Answer To Reset).

**Example:**

```
/mcp smartcard-mcp getCardInfo
```

### `transmitApdu`

Transmits an APDU command to the smart card.

**Parameters:**

- `cla`: Class byte (CLA) in hexadecimal format (e.g., '00')
- `ins`: Instruction byte (INS) in hexadecimal format (e.g., 'A4')
- `p1`: Parameter 1 (P1) in hexadecimal format (e.g., '04')
- `p2`: Parameter 2 (P2) in hexadecimal format (e.g., '00')
- `data` (optional): Command data in hexadecimal format (e.g., '3F00')
- `le` (optional): Expected response length (Le). If not provided, no Le is sent.

**Example:**

```
/mcp smartcard-mcp transmitApdu --cla 00 --ins A4 --p1 04 --p2 00 --data 3F00
```

### `resetCard`

Resets the smart card.

**Example:**

```
/mcp smartcard-mcp resetCard
```

### `disconnect`

Disconnects from the smart card.

**Example:**

```
/mcp smartcard-mcp disconnect
```

### `release`

Releases all smart card resources.

**Example:**

```
/mcp smartcard-mcp release
```

## Available Resources

### `smartcard://info`

Information about the connected smart card.

**Example:**

```
/mcp smartcard-mcp access smartcard://info
```

### `smartcard://readers`

List of available smart card readers.

**Example:**

```
/mcp smartcard-mcp access smartcard://readers
```

### `smartcard://reader/{readerId}`

Information about a specific reader.

**Parameters:**

- `readerId`: ID of the reader

**Example:**

```
/mcp smartcard-mcp access smartcard://reader/MyReader
```

### `smartcard://apdu-history/{count}`

APDU command/response history.

**Parameters:**

- `count`: Number of history entries to retrieve (5, 10, 20, or all)

**Example:**

```
/mcp smartcard-mcp access smartcard://apdu-history/10
```

## Common Operations

### Select MF (Master File)

```
/mcp smartcard-mcp transmitApdu --cla 00 --ins A4 --p1 00 --p2 00
```

### Select File by ID

```
/mcp smartcard-mcp transmitApdu --cla 00 --ins A4 --p1 00 --p2 00 --data 3F00
```

### Read Binary

```
/mcp smartcard-mcp transmitApdu --cla 00 --ins B0 --p1 00 --p2 00 --le 256
```

## Troubleshooting

### No Readers Found

- Ensure your smart card reader is properly connected to your computer
- Check if the PC/SC service is running on your system
- Try restarting the PC/SC service

### Connection Failed

- Ensure a smart card is properly inserted into the reader
- Check if the card is supported by your reader
- Try reinserting the card or using a different card

### Command Failed

- Verify that the APDU command is correctly formatted
- Check if the card supports the command you're trying to send
- Ensure you've selected the appropriate application or file before sending commands

## License

MIT
