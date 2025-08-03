/**
 * MynaCard command - Japanese MynaCard specific operations
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { selectDf } from '@aokiapp/apdu-utils';
import { formatMynacardInfo } from '../utils/formatters.js';

export const mynacardCommand = new Command('mynacard')
  .description('Japanese MynaCard (マイナンバーカード) operations')
  .option('-r, --reader <id>', 'Reader ID (if not specified, uses first available reader)')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --wait <timeout>', 'Wait for card presence (timeout in seconds)', '30')
  .option('-v, --verbose', 'Show detailed information');

// Add subcommands for MynaCard operations
mynacardCommand
  .command('info')
  .description('Show MynaCard information')
  .action(async (options) => {
    const parentOptions = mynacardCommand.opts();
    await handleMynacardOperation('info', { ...parentOptions, ...options });
  });

mynacardCommand
  .command('jpki')
  .description('Access JPKI (公的個人認証) application')
  .action(async (options) => {
    const parentOptions = mynacardCommand.opts();
    await handleMynacardOperation('jpki', { ...parentOptions, ...options });
  });

mynacardCommand
  .command('kenhojo')
  .description('Access Kenhojo (券面補助) application')
  .action(async (options) => {
    const parentOptions = mynacardCommand.opts();
    await handleMynacardOperation('kenhojo', { ...parentOptions, ...options });
  });

mynacardCommand
  .command('kenkaku')
  .description('Access Kenkaku (券面格納) application')
  .action(async (options) => {
    const parentOptions = mynacardCommand.opts();
    await handleMynacardOperation('kenkaku', { ...parentOptions, ...options });
  });

async function handleMynacardOperation(operation: string, options: any) {
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
          await performMynacardOperation(card, operation, options);
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
    console.error(`Error in MynaCard ${operation}:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function performMynacardOperation(card: any, operation: string, options: any) {
  switch (operation) {
    case 'info':
      await showMynacardInfo(card, options);
      break;
    case 'jpki':
      await accessJpki(card, options);
      break;
    case 'kenhojo':
      await accessKenhojo(card, options);
      break;
    case 'kenkaku':
      await accessKenkaku(card, options);
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

async function showMynacardInfo(card: any, options: any) {
  const atr = await card.getAtr();
  
  if (options.json) {
    console.log(JSON.stringify({
      type: 'mynacard',
      atr: Array.from(atr).map((b: any) => b.toString(16).padStart(2, '0')).join(''),
      detected: true
    }, null, 2));
  } else {
    console.log(formatMynacardInfo(atr, options.verbose));
  }
}

async function accessJpki(card: any, options: any) {
  if (options.verbose) {
    console.log('Accessing JPKI application...');
  }
  
  // Select JPKI application (AID: D3 92 10 00 31 00 01 01 04 08)
  const jpkiAid = new Uint8Array([0xD3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x08]);
  const selectCommand = selectDf(jpkiAid);
  const response = await card.transmit(selectCommand);
  
  if (options.json) {
    console.log(JSON.stringify({
      application: 'JPKI',
      selected: response.isSuccess(),
      response: Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join('')
    }, null, 2));
  } else {
    if (response.sw === 0x9000) {
      console.log('✓ JPKI application selected successfully');
      console.log(`Response: ${Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join(' ')}`);
    } else {
      console.log('✗ Failed to select JPKI application');
      console.log(`SW: ${response.sw1.toString(16).padStart(2, '0')}${response.sw2.toString(16).padStart(2, '0')}`);
    }
  }
}

async function accessKenhojo(card: any, options: any) {
  if (options.verbose) {
    console.log('Accessing Kenhojo application...');
  }
  
  // Select Kenhojo application (AID: D3 92 10 00 31 00 01 01 04 02)
  const kenhojoAid = new Uint8Array([0xD3, 0x92, 0x10, 0x00, 0x31, 0x00, 0x01, 0x01, 0x04, 0x02]);
  const selectCommand = selectDf(kenhojoAid);
  const response = await card.transmit(selectCommand);
  
  if (options.json) {
    console.log(JSON.stringify({
      application: 'Kenhojo',
      selected: response.isSuccess(),
      response: Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join('')
    }, null, 2));
  } else {
    if (response.sw === 0x9000) {
      console.log('✓ Kenhojo application selected successfully');
      console.log(`Response: ${Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join(' ')}`);
    } else {
      console.log('✗ Failed to select Kenhojo application');
      console.log(`SW: ${response.sw1.toString(16).padStart(2, '0')}${response.sw2.toString(16).padStart(2, '0')}`);
    }
  }
}

async function accessKenkaku(card: any, options: any) {
  if (options.verbose) {
    console.log('Accessing Kenkaku application...');
  }
  
  // Select Kenkaku application (AID: D3 92 F0 00 26)
  const kenkakuAid = new Uint8Array([0xD3, 0x92, 0xF0, 0x00, 0x26]);
  const selectCommand = selectDf(kenkakuAid);
  const response = await card.transmit(selectCommand);
  
  if (options.json) {
    console.log(JSON.stringify({
      application: 'Kenkaku',
      selected: response.isSuccess(),
      response: Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join('')
    }, null, 2));
  } else {
    if (response.sw === 0x9000) {
      console.log('✓ Kenkaku application selected successfully');
      console.log(`Response: ${Array.from(response.toUint8Array()).map((b: any) => b.toString(16).padStart(2, '0')).join(' ')}`);
    } else {
      console.log('✗ Failed to select Kenkaku application');
      console.log(`SW: ${response.sw1.toString(16).padStart(2, '0')}${response.sw2.toString(16).padStart(2, '0')}`);
    }
  }
}