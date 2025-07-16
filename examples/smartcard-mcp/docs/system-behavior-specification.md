# Smart Card MCP Server - System Behavior Specification

**Document Version:** 2.0  
**Last Updated:** July 16, 2025  
**Purpose:** Natural language description of system behavior and user interactions  

---

## What is the Smart Card MCP Server?

The Smart Card MCP Server is a bridge that allows AI agents (like Claude, ChatGPT, or other AI assistants) to interact with physical smart cards through your computer's card readers. Think of it as a translator that converts AI requests into smart card operations and returns the results in a format the AI can understand.

## How Does It Work?

### The Big Picture

When you're chatting with an AI agent and need to read data from a smart card (like a government ID card, credit card, or security token), the AI can now:

1. **Ask for available card readers** on your computer
2. **Connect to a specific card** in a reader  
3. **Send commands to the card** to read or write data
4. **Understand the card's responses** and explain what they mean
5. **Disconnect cleanly** when finished

### Real-World Example

Imagine you're asking Claude to help you read your national ID card:

**You:** "Can you read the certificate from my ID card?"

**Claude uses the MCP server to:**
1. Check what card readers you have connected
2. Connect to the card in your reader
3. Send the appropriate commands to read the certificate
4. Interpret any error codes if something goes wrong
5. Show you the certificate information in a readable format
6. Disconnect from the card properly

## What Operations Can Be Performed?

### 1. **List Card Readers** (`listReaders`)
**What it does:** Shows all the smart card readers connected to your computer.

**When you'd use it:** When you want to see what readers are available, or when you have multiple readers and need to choose one.

**What you get back:** A list showing each reader's name, whether it's working, and whether it has a card inserted.

### 2. **Connect to Card** (`connectToCard`)
**What it does:** Establishes a connection to the smart card in a specific reader.

**When you'd use it:** This is always the first step before you can do anything with a card.

**What happens:** The system talks to the card, gets its basic information (called ATR - Answer To Reset), and prepares for further communication.

55 | **What you get back:** The card's ATR and information about how to communicate with the card.
   | (Session management is handled automatically by FastMCP for each client.)
56 |
### 3. **Send Commands to Card** (`transmitApdu`)
**What it does:** Sends specific commands to the smart card and receives responses.

**When you'd use it:** This is how you actually read data from or write data to the card. Every interaction with the card happens through these commands.

**Two ways to send commands:**
- **Simple way:** Just provide the command as a string of hexadecimal numbers
- **Structured way:** Specify each part of the command separately (class, instruction, parameters, data)

**What you get back:** The card's response data, a status code indicating success or failure, and timing information.

### 4. **Reset Card** (`resetCard`)
**What it does:** Performs a hardware reset of the smart card, like unplugging and plugging it back in.

**When you'd use it:** When the card gets into a bad state or stops responding properly.

**What happens:** The card restarts from its initial state and provides fresh ATR information.

### 5. **Disconnect from Card** (`disconnectFromCard`)
**What it does:** Properly ends the session with the smart card and frees up the reader.

**When you'd use it:** When you're finished working with the card. This is important for allowing other applications to use the reader.

### 6. **Understand Status Codes** (`lookupStatusCode`)
**What it does:** Translates the cryptic status codes that cards return into human-readable explanations.

**When you'd use it:** When something goes wrong and you get an error code from the card.

**What you get back:** An explanation of what the code means, whether it's an error or success, and suggestions for what to do next.

### 7. **Force Release Reader** (`forceReleaseReader`)
**What it does:** Forcibly unlocks a card reader that's stuck or being held by a crashed application.

**When you'd use it:** When a reader appears to be "in use" but no application is actually using it.

## How Does the System Handle Multiple Users?

### Reader Locking Behavior

The system follows these rules:

1. **One user per reader:** When someone connects to a card reader, that reader becomes exclusively theirs until they disconnect.

2. **Multiple readers work simultaneously:** If you have multiple card readers, different AI agents can use different readers at the same time without interfering with each other.

3. **Automatic cleanup:** If an AI agent disconnects unexpectedly (like if you close your chat), the system automatically releases any readers it was using.

4. **Clear error messages:** If you try to use a reader that someone else is using, you get a clear message explaining the situation.

### Example Scenarios

**Scenario 1: Single User**
- You ask Claude to read your ID card
- Claude connects to your card reader
- Claude reads the data and shows it to you
- Claude disconnects automatically when done

**Scenario 2: Multiple Users**
- You have two card readers connected
- You're using one reader with Claude
- A colleague uses the other reader with ChatGPT
- Both work fine because they're using different readers

**Scenario 3: Conflict**
- You're using a reader with Claude
- A colleague tries to use the same reader with ChatGPT
- ChatGPT gets an error: "Reader is currently in use by another client"
- Your colleague waits for you to finish or uses a different reader

## What Happens When Things Go Wrong?

The system is designed to handle problems gracefully and give you useful information about what went wrong.

### Common Error Situations

**No card readers found:**
- **What you see:** "No smart card readers found on the system"
- **What to do:** Connect a card reader and make sure its drivers are installed

**No card in reader:**
- **What you see:** "No smart card detected in the reader"
- **What to do:** Insert a smart card and try again

**Card not responding:**
- **What you see:** "Failed to communicate with the smart card"
- **What to do:** Try removing and reinserting the card, or use the reset function

**Reader busy:**
- **What you see:** "Reader is currently in use by another client"
- **What to do:** Wait for the other user to finish, or use a different reader

**Card removed during operation:**
- **What you see:** "Card was removed from reader during operation"
- **What to do:** Reinsert the card and start over

### Error Recovery

The system automatically:
- Cleans up connections when clients disconnect
- Releases readers when operations complete
- Provides specific suggestions for each type of error
- Logs important events for troubleshooting

## Security and Safety Features

### What the System Does to Stay Safe

1. **No permanent storage:** The system never saves sensitive card data to disk

2. **Minimal access:** By default, operations are read-only unless specifically requested otherwise

3. **Automatic cleanup:** Resources are automatically released to prevent them from being left in unsafe states

4. **Clear permissions:** The system only requires the minimum permissions needed to access card readers

### What You Should Know

- The system can read data from cards, but most smart cards protect sensitive operations with PINs or other security measures
- The AI agent will only be able to perform operations that the card allows without additional authentication
- Always disconnect properly when finished to ensure the card is left in a safe state

## Performance Expectations

### How Fast Things Should Be

- **Listing readers:** Less than half a second
- **Connecting to a card:** Less than one second  
- **Sending commands:** Less than 100 milliseconds for most operations
- **Cleaning up:** Less than 200 milliseconds

### What Might Be Slower

- Cards with slow processors might take longer to respond
- Complex operations involving multiple commands will take more time
- Network issues (if using remote access) can add delays

## Setup and Requirements

### What You Need

1. **A computer** running Windows, macOS, or Linux
2. **Smart card reader** connected via USB, Bluetooth, or built-in
3. **Card reader drivers** properly installed
4. **PC/SC service** running (usually automatic on modern systems)
5. **Node.js 18 or newer** installed

### What Gets Installed

- The MCP server software
- Connection to your AI agent of choice
- Automatic integration with your system's card reader infrastructure

## Troubleshooting Common Issues

### "PC/SC service not available"
**Problem:** The system service that manages card readers isn't running  
**Solution:** Restart the smart card service or reboot your computer

### "Reader not found"
**Problem:** The system can't see your card reader  
**Solution:** Check connections, reinstall drivers, or try a different USB port

### "Operation timed out"
**Problem:** The card didn't respond within the expected time  
**Solution:** Remove and reinsert the card, or try the reset function

### "Access denied"
**Problem:** Your user account doesn't have permission to access card readers  
**Solution:** Run as administrator/root, or check your user permissions

## Future Possibilities

While this version focuses on basic smart card operations, future versions might include:
- Support for additional card types and protocols
- Enhanced security features
- Better performance monitoring
- Integration with cloud-based card services
- Support for virtual smart cards

---

This specification describes how the Smart Card MCP Server behaves from a user's perspective, focusing on what you can expect when AI agents interact with your smart cards through this system.