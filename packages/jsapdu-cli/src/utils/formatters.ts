/**
 * Formatting utilities for CLI output
 */

import type { SmartCardDeviceInfo, CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';

export function formatReaderInfo(info: SmartCardDeviceInfo, index: number, verbose: boolean = false): string {
  let output = `${index + 1}. ${info.friendlyName || info.id}`;
  
  if (verbose) {
    output += `\n   ID: ${info.id}`;
    if (info.devicePath) {
      output += `\n   Path: ${info.devicePath}`;
    }
    if (info.description) {
      output += `\n   Description: ${info.description}`;
    }
    output += `\n   APDU Support: ${info.supportsApdu ? '✓' : '✗'}`;
    output += `\n   HCE Support: ${info.supportsHce ? '✓' : '✗'}`;
    output += `\n   Device Type: ${info.isIntegratedDevice ? 'Integrated' : 'Removable'}`;
    output += `\n   D2C Protocol: ${info.d2cProtocol}`;
    output += `\n   P2D Protocol: ${info.p2dProtocol}`;
    output += `\n   API: ${info.apduApi?.join(', ') || 'Unknown'}`;
  }
  
  return output + '\n';
}

export function formatCardInfo(readerInfo: SmartCardDeviceInfo, atr: Uint8Array): string {
  const atrHex = Array.from(atr).map((b: number) => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  
  let output = `Connected to card successfully!\n\n`;
  output += `Reader: ${readerInfo.friendlyName || readerInfo.id}\n`;
  output += `ATR: ${atrHex}\n`;
  output += `ATR Length: ${atr.length} bytes\n`;
  
  // Basic ATR analysis
  if (atr.length > 0) {
    output += `\nBasic ATR Analysis:\n`;
    output += `  Initial Character (TS): 0x${atr[0].toString(16).padStart(2, '0').toUpperCase()}`;
    
    if (atr[0] === 0x3B) {
      output += ` (Direct convention)\n`;
    } else if (atr[0] === 0x3F) {
      output += ` (Inverse convention)\n`;
    } else {
      output += ` (Unknown convention)\n`;
    }
    
    if (atr.length > 1) {
      const formatByte = atr[1];
      output += `  Format Character (T0): 0x${formatByte.toString(16).padStart(2, '0').toUpperCase()}\n`;
      output += `  Historical Bytes Count: ${formatByte & 0x0F}\n`;
    }
  }
  
  return output;
}

export function formatApduResponse(command: CommandApdu, response: ResponseApdu, verbose: boolean = false): string {
  const commandHex = Array.from(command.toUint8Array()).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  const responseHex = Array.from(response.toUint8Array()).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  
  let output = '';
  
  if (verbose) {
    output += `Command: ${commandHex}\n`;
  }
  
  output += `Response: ${responseHex}\n`;
  output += `SW: ${response.sw1.toString(16).padStart(2, '0')}${response.sw2.toString(16).padStart(2, '0')} `;
  
  // Status word interpretation
  const sw = response.sw;
  if (sw === 0x9000) {
    output += `(Success)\n`;
  } else if (sw === 0x6A82) {
    output += `(File not found)\n`;
  } else if (sw === 0x6A86) {
    output += `(Incorrect parameters P1-P2)\n`;
  } else if (sw === 0x6A87) {
    output += `(Lc inconsistent with P1-P2)\n`;
  } else if (sw === 0x6A88) {
    output += `(Referenced data not found)\n`;
  } else if ((sw & 0xFF00) === 0x6100) {
    output += `(Success, ${sw & 0xFF} bytes available)\n`;
  } else if ((sw & 0xFF00) === 0x6C00) {
    output += `(Wrong Le, correct Le is ${sw & 0xFF})\n`;
  } else if ((sw & 0xFF00) === 0x6300) {
    output += `(Authentication failed, ${sw & 0xFF} tries remaining)\n`;
  } else {
    output += `(Error)\n`;
  }
  
  if (response.data.length > 0) {
    const dataHex = Array.from(response.data).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
    output += `Data: ${dataHex}\n`;
    output += `Data Length: ${response.data.length} bytes\n`;
  }
  
  return output;
}

export function formatMynacardInfo(atr: Uint8Array, verbose: boolean = false): string {
  const atrHex = Array.from(atr).map((b: number) => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
  
  let output = `MynaCard (マイナンバーカード) detected!\n\n`;
  output += `ATR: ${atrHex}\n`;
  
  if (verbose) {
    output += `\nMynaCard Applications:\n`;
    output += `  • JPKI (公的個人認証): D3 92 10 00 31 00 01 01 04 08\n`;
    output += `  • Kenhojo (券面補助): D3 92 10 00 31 00 01 01 04 02\n`;
    output += `  • Kenkaku (券面格納): D3 92 F0 00 26\n`;
    output += `\nUsage:\n`;
    output += `  jsapdu mynacard jpki    - Access JPKI application\n`;
    output += `  jsapdu mynacard kenhojo - Access Kenhojo application\n`;
    output += `  jsapdu mynacard kenkaku - Access Kenkaku application\n`;
  }
  
  return output;
}

export function formatHex(data: Uint8Array, separator: string = ' '): string {
  return Array.from(data).map((b: number) => b.toString(16).padStart(2, '0')).join(separator).toUpperCase();
}

export function parseHex(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[\s:]/g, '');
  if (!/^[0-9A-Fa-f]*$/.test(cleanHex)) {
    throw new Error('Invalid hex string');
  }
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}