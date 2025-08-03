/**
 * ISO 7816 basic commands
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import {
  selectDf,
  selectEf,
  readBinary,
  readCurrentEfBinaryFull,
  readEfBinaryFull,
  verify,
  getData,
  getDataBerTlv,
  getDataSimpleTlv,
  updateBinary,
  updateCurrentEfBinary,
  updateEfBinary,
  writeBinary,
  readRecord,
  writeRecord,
  updateRecord,
  appendRecord,
  RecordRefMode,
  getChallenge,
  externalAuthenticate,
  internalAuthenticate,
  openLogicalChannel,
  closeLogicalChannel
} from '@aokiapp/apdu-utils';
import { formatApduResponse, parseHex } from '../utils/formatters.js';

interface Iso7816Options {
  reader?: string;
  json?: boolean;
  wait?: string;
  verbose?: boolean;
}

/**
 * 複数APDUを同一セッションで順次送信し、状態を維持する
 */
async function executeIso7816Sequence(
  apdus: any[],
  options: Iso7816Options,
  descriptions: string[]
) {
  try {
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
          for (let i = 0; i < apdus.length; i++) {
            const apdu = apdus[i];
            const desc = descriptions[i] || `APDU ${i + 1}`;
            if (options.verbose) {
              console.log(`\n[${desc}]`);
            }
            const response = await card.transmit(apdu);

            if (options.json) {
              console.log(JSON.stringify({
                command: Array.from(apdu.toUint8Array()).map((b) => (b as number).toString(16).padStart(2, '0')).join('').toUpperCase(),
                response: Array.from(response.toUint8Array()).map((b) => (b as number).toString(16).padStart(2, '0')).join('').toUpperCase(),
                sw1: response.sw1,
                sw2: response.sw2,
                data: response.data.length > 0 ? Array.from(response.data).map((b) => (b as number).toString(16).padStart(2, '0')).join('').toUpperCase() : null,
                success: response.sw === 0x9000
              }, null, 2));
            } else {
              console.log(formatApduResponse(apdu, response, options.verbose));
            }
            // 状態維持のため、エラーでもbreakしない
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
    console.error(`Error executing APDU sequence:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export const iso7816Command = new Command('iso7816')
  .description('ISO 7816 basic commands')
  .option('-r, --reader <id>', 'Reader ID (if not specified, uses first available reader)')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --wait <timeout>', 'Wait for card presence (timeout in seconds)', '30')
  .option('-v, --verbose', 'Show detailed information');

// SELECT command
iso7816Command
  .command('select')
  .description('Select file (DF or EF)')
  .arguments('<aid>')
  .option('--df', 'Select as DF (Dedicated File)')
  .option('--ef', 'Select as EF (Elementary File)')
  .option('--fci', 'Request FCI (File Control Information) for DF')
  .action(async (aid: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const aidBytes = parseHex(aid);
      let command;
      
      if (cmdOptions.ef) {
        if (aidBytes.length !== 2) {
          console.error('EF identifier must be 2 bytes');
          process.exit(1);
        }
        command = selectEf(new Uint8Array(aidBytes));
      } else {
        // Default to DF
        if (aidBytes.length < 1 || aidBytes.length > 16) {
          console.error('DF identifier must be 1-16 bytes');
          process.exit(1);
        }
        command = selectDf(new Uint8Array(aidBytes), cmdOptions.fci);
      }
      
      await executeIso7816Sequence([command], options, [`SELECT ${cmdOptions.ef ? 'EF' : 'DF'} ${aid}`]);
    } catch (error) {
      console.error('Error parsing AID:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// READ BINARY command
iso7816Command
  .command('read-binary')
  .description('Read binary data from file')
  .option('--offset <offset>', 'Offset in file (hex or decimal)', '0')
  .option('--length <length>', 'Number of bytes to read (hex or decimal)', '256')
  .option('--ef <id>', 'Short EF ID (0-31)')
  .option('--current', 'Read from current EF')
  .option('--full', 'Read full file (ignore offset and length)')
  .option('--extended', 'Use extended APDU')
  .action(async (cmdOptions) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      let command;
      
      if (cmdOptions.full) {
        if (cmdOptions.ef !== undefined) {
          const shortEfId = parseInt(cmdOptions.ef);
          if (shortEfId < 0 || shortEfId > 31) {
            console.error('Short EF ID must be 0-31');
            process.exit(1);
          }
          command = readEfBinaryFull(shortEfId);
        } else {
          command = readCurrentEfBinaryFull();
        }
      } else {
        const offset = cmdOptions.offset.startsWith('0x') 
          ? parseInt(cmdOptions.offset, 16) 
          : parseInt(cmdOptions.offset);
        const length = cmdOptions.length.startsWith('0x')
          ? parseInt(cmdOptions.length, 16)
          : parseInt(cmdOptions.length);
        
        const readOptions: any = {};
        if (cmdOptions.current) {
          readOptions.isCurrentEF = true;
        }
        if (cmdOptions.ef !== undefined) {
          readOptions.shortEfId = parseInt(cmdOptions.ef);
        }
        
        command = readBinary(offset, length, cmdOptions.extended, readOptions);
      }
      
      await executeIso7816Sequence([command], options, ['READ BINARY']);
    } catch (error) {
      console.error('Error creating READ BINARY command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// VERIFY command
iso7816Command
  .command('verify')
  .description('Verify PIN/password')
  .arguments('<pin>')
  .option('--ef <id>', 'EF identifier')
  .option('--current', 'Verify for current DF')
  .option('--hex', 'Interpret PIN as hex string')
  .action(async (pin: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const pinData = cmdOptions.hex ? parseHex(pin) : pin;
      const verifyOptions: any = {};
      
      if (cmdOptions.ef !== undefined) {
        verifyOptions.ef = parseInt(cmdOptions.ef);
      }
      if (cmdOptions.current) {
        verifyOptions.isCurrent = true;
      }
      
      const command = verify(typeof pinData === 'string' ? pinData : new Uint8Array(pinData), verifyOptions);
      await executeIso7816Sequence([command], options, ['VERIFY PIN']);
    } catch (error) {
      console.error('Error creating VERIFY command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// GET DATA command
iso7816Command
  .command('get-data')
  .description('Get data using tag')
  .arguments('<tag>')
  .option('--ber-tlv', 'Use BER-TLV encoding (2 bytes)')
  .option('--simple-tlv', 'Use Simple TLV encoding (1 byte)')  
  .option('--le <length>', 'Expected response length', '0')
  .action(async (tag: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const tagValue = tag.startsWith('0x') ? parseInt(tag, 16) : parseInt(tag, 16);
      const le = parseInt(cmdOptions.le);
      
      let command;
      if (cmdOptions.simpleTlv) {
        if (tagValue > 0xFF) {
          console.error('Simple TLV tag must be 1 byte (0x00-0xFF)');
          process.exit(1);
        }
        command = getDataSimpleTlv(tagValue, le);
      } else {
        // Default to BER-TLV
        if (tagValue > 0xFFFF) {
          console.error('BER-TLV tag must be 2 bytes (0x0000-0xFFFF)');
          process.exit(1);
        }
        command = getDataBerTlv(tagValue, le);
      }
      
      await executeIso7816Sequence([command], options, [`GET DATA ${tag}`]);
    } catch (error) {
      console.error('Error creating GET DATA command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// UPDATE BINARY command
iso7816Command
  .command('update-binary')
  .description('Update binary data in file')
  .arguments('<data>')
  .option('--offset <offset>', 'Offset in file (hex or decimal)', '0')
  .option('--ef <id>', 'Short EF ID (0-31)')
  .option('--current', 'Update current EF')
  .option('--extended', 'Use extended APDU')
  .action(async (data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const dataBytes = parseHex(data);
      const offset = cmdOptions.offset.startsWith('0x') 
        ? parseInt(cmdOptions.offset, 16) 
        : parseInt(cmdOptions.offset);
      
      let command;
      
      if (cmdOptions.current) {
        command = updateCurrentEfBinary(offset, new Uint8Array(dataBytes));
      } else if (cmdOptions.ef !== undefined) {
        const shortEfId = parseInt(cmdOptions.ef);
        if (shortEfId < 0 || shortEfId > 31) {
          console.error('Short EF ID must be 0-31');
          process.exit(1);
        }
        command = updateEfBinary(shortEfId, offset, new Uint8Array(dataBytes));
      } else {
        const updateOptions: any = {};
        command = updateBinary(offset, new Uint8Array(dataBytes), cmdOptions.extended, updateOptions);
      }
      
      await executeIso7816Sequence([command], options, ['UPDATE BINARY']);
    } catch (error) {
      console.error('Error creating UPDATE BINARY command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }

// WRITE BINARY command
iso7816Command
  .command('write-binary')
  .description('Write binary data to file')
  .argument('<data>', 'Data to write as hex string')
  .option('--offset <offset>', 'Offset in file (hex or decimal)', '0')
  .option('--ef <id>', 'Short EF ID (0-31)')
  .option('--current', 'Write to current EF')
  .option('--extended', 'Use extended APDU')
  .action(async (data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const dataBytes = parseHex(data);
      const offset = cmdOptions.offset.startsWith('0x') 
        ? parseInt(cmdOptions.offset, 16) 
        : parseInt(cmdOptions.offset);
      
      const writeOptions: any = {};
      if (cmdOptions.current) {
        writeOptions.isCurrentEF = true;
      }
      if (cmdOptions.ef !== undefined) {
        const shortEfId = parseInt(cmdOptions.ef);
        if (shortEfId < 0 || shortEfId > 31) {
          console.error('Short EF ID must be 0-31');
          process.exit(1);
        }
        writeOptions.shortEfId = shortEfId;
      }
      
      const command = writeBinary(offset, new Uint8Array(dataBytes), cmdOptions.extended, writeOptions);
      await executeIso7816Sequence([command], options, ['WRITE BINARY']);
    } catch (error) {
      console.error('Error creating WRITE BINARY command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// READ RECORD command
iso7816Command
  .command('read-record')
  .description('Read record from linear/cyclic EF')
  .arguments('<record> <sfi>')
  .option('--le <length>', 'Expected response length', '0')
  .option('--mode <mode>', 'Reference mode: absolute, next, previous', 'absolute')
  .action(async (recordStr: string, sfiStr: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const recordNo = parseInt(recordStr);
      const sfi = parseInt(sfiStr);
      const le = parseInt(cmdOptions.le);
      
      if (recordNo < 0 || recordNo > 255) {
        console.error('Record number must be 0-255');
        process.exit(1);
      }
      if (sfi < 0 || sfi > 31) {
        console.error('SFI must be 0-31');
        process.exit(1);
      }
      
      let mode = RecordRefMode.ABSOLUTE;
      switch (cmdOptions.mode.toLowerCase()) {
        case 'absolute': mode = RecordRefMode.ABSOLUTE; break;
        case 'next': mode = RecordRefMode.NEXT; break;
        case 'previous': mode = RecordRefMode.PREVIOUS; break;
        default:
          console.error('Mode must be: absolute, next, or previous');
          process.exit(1);
      }
      
      const command = readRecord(recordNo, sfi, le, mode);
      await executeIso7816Sequence([command], options, [`READ RECORD ${recordNo} SFI ${sfi}`]);
    } catch (error) {
      console.error('Error creating READ RECORD command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// WRITE RECORD command
iso7816Command
  .command('write-record')
  .description('Write record to linear/cyclic EF')
  .arguments('<record> <sfi> <data>')
  .option('--mode <mode>', 'Reference mode: absolute, next, previous', 'absolute')
  .action(async (recordStr: string, sfiStr: string, data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const recordNo = parseInt(recordStr);
      const sfi = parseInt(sfiStr);
      const dataBytes = parseHex(data);
      
      if (recordNo < 1 || recordNo > 255) {
        console.error('Record number must be 1-255');
        process.exit(1);
      }
      if (sfi < 0 || sfi > 31) {
        console.error('SFI must be 0-31');
        process.exit(1);
      }
      
      let mode = RecordRefMode.ABSOLUTE;
      switch (cmdOptions.mode.toLowerCase()) {
        case 'absolute': mode = RecordRefMode.ABSOLUTE; break;
        case 'next': mode = RecordRefMode.NEXT; break;
        case 'previous': mode = RecordRefMode.PREVIOUS; break;
        default:
          console.error('Mode must be: absolute, next, or previous');
          process.exit(1);
      }
      
      const command = writeRecord(recordNo, sfi, new Uint8Array(dataBytes), mode);
      await executeIso7816Sequence([command], options, [`WRITE RECORD ${recordNo} SFI ${sfi}`]);
    } catch (error) {
      console.error('Error creating WRITE RECORD command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// UPDATE RECORD command
iso7816Command
  .command('update-record')
  .description('Update existing record in linear/cyclic EF')
  .arguments('<record> <sfi> <data>')
  .option('--mode <mode>', 'Reference mode: absolute, next, previous', 'absolute')
  .action(async (recordStr: string, sfiStr: string, data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const recordNo = parseInt(recordStr);
      const sfi = parseInt(sfiStr);
      const dataBytes = parseHex(data);
      
      if (recordNo < 1 || recordNo > 255) {
        console.error('Record number must be 1-255');
        process.exit(1);
      }
      if (sfi < 0 || sfi > 31) {
        console.error('SFI must be 0-31');
        process.exit(1);
      }
      
      let mode = RecordRefMode.ABSOLUTE;
      switch (cmdOptions.mode.toLowerCase()) {
        case 'absolute': mode = RecordRefMode.ABSOLUTE; break;
        case 'next': mode = RecordRefMode.NEXT; break;
        case 'previous': mode = RecordRefMode.PREVIOUS; break;
        default:
          console.error('Mode must be: absolute, next, or previous');
          process.exit(1);
      }
      
      const command = updateRecord(recordNo, sfi, new Uint8Array(dataBytes), mode);
      await executeIso7816Sequence([command], options, [`UPDATE RECORD ${recordNo} SFI ${sfi}`]);
    } catch (error) {
      console.error('Error creating UPDATE RECORD command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// APPEND RECORD command
iso7816Command
  .command('append-record')
  .description('Append new record to end of linear/cyclic EF')
  .arguments('<sfi> <data>')
  .action(async (sfiStr: string, data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const sfi = parseInt(sfiStr);
      const dataBytes = parseHex(data);
      
      if (sfi < 0 || sfi > 31) {
        console.error('SFI must be 0-31');
        process.exit(1);
      }
      
      const command = appendRecord(sfi, new Uint8Array(dataBytes));
      await executeIso7816Sequence([command], options, [`APPEND RECORD SFI ${sfi}`]);
    } catch (error) {
      console.error('Error creating APPEND RECORD command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// GET CHALLENGE command
iso7816Command
  .command('get-challenge')
  .description('Get random challenge from card')
  .option('--le <length>', 'Expected challenge length', '8')
  .action(async (cmdOptions) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const le = parseInt(cmdOptions.le);
      if (le <= 0 || le > 255) {
        console.error('Challenge length must be 1-255 bytes');
        process.exit(1);
      }
      
      const command = getChallenge(le);
      await executeIso7816Sequence([command], options, [`GET CHALLENGE (${le} bytes)`]);
    } catch (error) {
      console.error('Error creating GET CHALLENGE command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// EXTERNAL AUTHENTICATE command
iso7816Command
  .command('external-authenticate')
  .description('Perform external authentication')
  .arguments('<keyid> <data>')
  .option('--algo <algorithm>', 'Algorithm indicator', '0')
  .action(async (keyIdStr: string, data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const keyId = parseInt(keyIdStr);
      const algo = parseInt(cmdOptions.algo);
      const authData = parseHex(data);
      
      if (keyId < 0 || keyId > 255) {
        console.error('Key ID must be 0-255');
        process.exit(1);
      }
      if (algo < 0 || algo > 255) {
        console.error('Algorithm indicator must be 0-255');
        process.exit(1);
      }
      
      const command = externalAuthenticate(keyId, new Uint8Array(authData), algo);
      await executeIso7816Sequence([command], options, [`EXTERNAL AUTHENTICATE KeyID ${keyId}`]);
    } catch (error) {
      console.error('Error creating EXTERNAL AUTHENTICATE command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// INTERNAL AUTHENTICATE command
iso7816Command
  .command('internal-authenticate')
  .description('Perform internal authentication')
  .arguments('<data>')
  .option('--algo <algorithm>', 'Algorithm indicator', '0')
  .action(async (data: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const algo = parseInt(cmdOptions.algo);
      const authData = parseHex(data);
      
      if (algo < 0 || algo > 255) {
        console.error('Algorithm indicator must be 0-255');
        process.exit(1);
      }
      
      const command = internalAuthenticate(new Uint8Array(authData), algo);
      await executeIso7816Sequence([command], options, ['INTERNAL AUTHENTICATE']);
    } catch (error) {
      console.error('Error creating INTERNAL AUTHENTICATE command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// MANAGE CHANNEL commands
iso7816Command
  .command('open-channel')
  .description('Open logical channel')
  .option('--channel <number>', 'Desired channel number (0 = let card choose)', '0')
  .action(async (cmdOptions) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const channelNumber = parseInt(cmdOptions.channel);
      if (channelNumber < 0 || channelNumber > 19) {
        console.error('Channel number must be 0-19');
        process.exit(1);
      }
      
      const command = openLogicalChannel(channelNumber);
      await executeIso7816Sequence([command], options, [`OPEN LOGICAL CHANNEL ${channelNumber || 'auto'}`]);
    } catch (error) {
      console.error('Error creating OPEN CHANNEL command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

iso7816Command
  .command('close-channel')
  .description('Close logical channel')
  .arguments('<channel>')
  .action(async (channelStr: string, cmdOptions: any) => {
    const options = { ...iso7816Command.opts(), ...cmdOptions };
    
    try {
      const channelNumber = parseInt(channelStr);
      if (channelNumber < 1 || channelNumber > 19) {
        console.error('Channel number must be 1-19');
        process.exit(1);
      }
      
      const command = closeLogicalChannel(channelNumber);
      await executeIso7816Sequence([command], options, [`CLOSE LOGICAL CHANNEL ${channelNumber}`]);
    } catch (error) {
      console.error('Error creating CLOSE CHANNEL command:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
  });