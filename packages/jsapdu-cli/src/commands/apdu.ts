/**
 * APDU command - Send custom APDU commands to smart card
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { CommandApdu, ResponseApdu } from '@aokiapp/jsapdu-interface';
import { formatApduResponse, parseHex } from '../utils/formatters.js';
import { readFileSync } from 'fs';

interface ApduCommandOptions {
  file?: string;
  reader?: string;
  json?: boolean;
  wait?: string;
  verbose?: boolean;
  continueOnError?: boolean;
  delay?: string;
}

interface ApduResult {
  command: string;
  commandBytes: number[];
  response: string;
  responseBytes: number[];
  sw1: number;
  sw2: number;
  sw: number;
  data: string | null;
  dataBytes: number[];
  success: boolean;
  error?: string;
}

export const apduCommand = new Command('apdu')
  .description('Send APDU command(s) to smart card')
  .arguments('[commands...]')
  .option('-f, --file <path>', 'Read APDU commands from file (one command per line)')
  .option('-r, --reader <id>', 'Reader ID (if not specified, uses first available reader)')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --wait <timeout>', 'Wait for card presence (timeout in seconds)', '30')
  .option('-v, --verbose', 'Show detailed information')
  .option('--continue-on-error', 'Continue execution even if an APDU command fails')
  .option('--delay <ms>', 'Delay between APDU commands in milliseconds', '0')
  .action(async (commands: string[], options: ApduCommandOptions) => {
    try {
      // Collect APDU commands from arguments or file
      let apduCommands: string[] = [];

      if (options.file) {
        try {
          const fileContent = readFileSync(options.file, 'utf-8');
          const fileCommands = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
          apduCommands.push(...fileCommands);
        } catch (error) {
          console.error(`Error reading file: ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      }

      if (commands && commands.length > 0) {
        apduCommands.push(...commands);
      }

      if (apduCommands.length === 0) {
        console.error('No APDU commands provided. Use arguments or --file option.');
        process.exit(1);
      }

      // Validate and parse APDU commands
      const parsedCommands: CommandApdu[] = [];
      for (let i = 0; i < apduCommands.length; i++) {
        const commandHex = apduCommands[i];
        try {
          const cleanHex = commandHex.replace(/\s+/g, '').replace(/:/g, '');
          if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
            throw new Error('Invalid hex string. Use format: 00A4040000');
          }
          
          if (cleanHex.length % 2 !== 0) {
            throw new Error('Hex string must have even length');
          }
          
          if (cleanHex.length < 8) {
            throw new Error('APDU command must be at least 4 bytes (CLA INS P1 P2)');
          }
          
          const commandBytes = parseHex(cleanHex);
          const commandApdu = CommandApdu.fromUint8Array(new Uint8Array(commandBytes));
          parsedCommands.push(commandApdu);
        } catch (error) {
          console.error(`Error parsing command ${i + 1} "${commandHex}": ${error instanceof Error ? error.message : error}`);
          process.exit(1);
        }
      }

      if (options.verbose) {
        console.log(`Parsed ${parsedCommands.length} APDU command(s)`);
      }

      // Initialize platform
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
            const timeout = parseInt(options.wait || '30') * 1000;
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
            const results: ApduResult[] = [];
            const delay = parseInt(options.delay || '0');
            
            // Execute APDU commands sequentially
            for (let i = 0; i < parsedCommands.length; i++) {
              const commandApdu = parsedCommands[i];
              const commandHex = apduCommands[i];
              
              try {
                if (options.verbose) {
                  console.log(`\nSending APDU ${i + 1}/${parsedCommands.length}: ${commandHex.toUpperCase()}`);
                }
                
                const response = await card.transmit(commandApdu);
                
                const result: ApduResult = {
                  command: commandHex.toUpperCase(),
                  commandBytes: Array.from(commandApdu.toUint8Array()),
                  response: Array.from(response.toUint8Array()).map((b: number) => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
                  responseBytes: Array.from(response.toUint8Array()),
                  sw1: response.sw1,
                  sw2: response.sw2,
                  sw: response.sw,
                  data: response.data.length > 0 ? Array.from(response.data).map((b: number) => b.toString(16).padStart(2, '0')).join('').toUpperCase() : null,
                  dataBytes: Array.from(response.data),
                  success: response.sw === 0x9000
                };
                
                results.push(result);
                
                if (!options.json) {
                  if (parsedCommands.length > 1) {
                    console.log(`\n--- Command ${i + 1}/${parsedCommands.length} ---`);
                  }
                  console.log(formatApduResponse(commandApdu, response, options.verbose));
                }
                
                // Check if command failed and should stop
                if (!result.success && !options.continueOnError) {
                  if (options.verbose) {
                    console.log(`Command ${i + 1} failed. Stopping execution.`);
                  }
                  break;
                }
                
                // Add delay between commands
                if (delay > 0 && i < parsedCommands.length - 1) {
                  if (options.verbose) {
                    console.log(`Waiting ${delay}ms before next command...`);
                  }
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                
              } catch (error) {
                const errorResult: ApduResult = {
                  command: commandHex.toUpperCase(),
                  commandBytes: Array.from(commandApdu.toUint8Array()),
                  response: '',
                  responseBytes: [],
                  sw1: 0,
                  sw2: 0,
                  sw: 0,
                  data: null,
                  dataBytes: [],
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                };
                
                results.push(errorResult);
                
                if (!options.json) {
                  console.error(`Error in command ${i + 1}: ${errorResult.error}`);
                }
                
                if (!options.continueOnError) {
                  break;
                }
              }
            }
            
            // Output JSON results if requested
            if (options.json) {
              if (results.length === 1) {
                console.log(JSON.stringify(results[0], null, 2));
              } else {
                console.log(JSON.stringify({
                  commands: results.length,
                  results: results
                }, null, 2));
              }
            } else if (results.length > 1) {
              const successCount = results.filter(r => r.success).length;
              console.log(`\n=== Summary ===`);
              console.log(`Total commands: ${results.length}`);
              console.log(`Successful: ${successCount}`);
              console.log(`Failed: ${results.length - successCount}`);
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