/**
 * APDU command - Send custom APDU commands to smart card
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { CommandApdu } from '@aokiapp/jsapdu-interface';
import { formatApduResponse } from '../utils/formatters.js';

export const apduCommand = new Command('apdu')
  .description('Send APDU command to smart card')
  .argument('<command>', 'APDU command as hex string (e.g., "00A4040000")')
  .option('-r, --reader <id>', 'Reader ID (if not specified, uses first available reader)')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --wait <timeout>', 'Wait for card presence (timeout in seconds)', '30')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (commandHex: string, options) => {
    try {
      // Parse APDU command
      const cleanHex = commandHex.replace(/\s+/g, '').replace(/:/g, '');
      if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
        console.error('Invalid hex string. Use format: 00A4040000');
        process.exit(1);
      }
      
      if (cleanHex.length % 2 !== 0) {
        console.error('Hex string must have even length.');
        process.exit(1);
      }
      
      if (cleanHex.length < 8) {
        console.error('APDU command must be at least 4 bytes (CLA INS P1 P2).');
        process.exit(1);
      }
      
      const commandBytes = new Uint8Array(cleanHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      // Parse command bytes
      const commandApdu = CommandApdu.fromUint8Array(commandBytes);
      
      const platformManager = PcscPlatformManager.getInstance();
      const platform = platformManager.getPlatform();
      
      await platform.init();
      
      try {
        const deviceInfos = await platform.getDeviceInfo();
        
        if (deviceInfos.length === 0) {
          console.error('No smart card readers found.');
          process.exit(1);
        }
        
        // Select reader
        let selectedReader = deviceInfos[0];
        if (options.reader) {
          const found = deviceInfos.find((info: any) => info.id === options.reader);
          if (!found) {
            console.error(`Reader '${options.reader}' not found.`);
            process.exit(1);
          }
          selectedReader = found;
        }
        
        if (options.verbose) {
          console.log(`Using reader: ${selectedReader.friendlyName || selectedReader.id}`);
        }
        
        const device = await platform.acquireDevice(selectedReader.id);
        
        try {
          // Check if card is present
          let isCardPresent = await device.isCardPresent();
          
          if (!isCardPresent) {
            if (options.verbose) {
              console.log('No card present. Waiting for card...');
            }
            const timeout = parseInt(options.wait) * 1000;
            await device.waitForCardPresence(timeout);
            isCardPresent = await device.isCardPresent();
          }
          
          if (!isCardPresent) {
            console.error('No card detected after waiting.');
            process.exit(1);
          }
          
          // Start session
          const card = await device.startSession();
          
          try {
            if (options.verbose) {
              console.log(`Sending APDU: ${commandHex.toUpperCase()}`);
            }
            
            const response = await card.transmit(commandApdu);
            
            if (options.json) {
              console.log(JSON.stringify({
                command: Array.from(commandApdu.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
                response: Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
                sw1: response.sw1,
                sw2: response.sw2,
                data: response.data.length > 0 ? Array.from(response.data).map((b: any) => b.toString(16).padStart(2, '0')).join('').toUpperCase() : null,
                success: response.sw === 0x9000
              }, null, 2));
            } else {
              console.log(formatApduResponse(commandApdu, response, options.verbose));
            }
          } finally {
            await card.release();
          }
        } finally {
          await device.release();
        }
      } finally {
        await platform.release();
      }
    } catch (error) {
      console.error('Error sending APDU:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });