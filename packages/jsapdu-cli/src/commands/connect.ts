/**
 * Connect command - Connect to a smart card and show basic information
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { formatCardInfo } from '../utils/formatters.js';

export const connectCommand = new Command('connect')
  .description('Connect to a smart card and show basic information')
  .option('-r, --reader <id>', 'Reader ID (if not specified, uses first available reader)')
  .option('-j, --json', 'Output as JSON')
  .option('-w, --wait <timeout>', 'Wait for card presence (timeout in seconds)', '30')
  .action(async (options) => {
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
            console.error('Available readers:', deviceInfos.map((info: any) => info.id).join(', '));
            process.exit(1);
          }
          selectedReader = found;
        }
        
        console.log(`Using reader: ${selectedReader.friendlyName || selectedReader.id}`);
        
        const device = await platform.acquireDevice(selectedReader.id);
        
        try {
          // Check if card is present
          let isCardPresent = await device.isCardPresent();
          
          if (!isCardPresent) {
            console.log('No card present. Waiting for card...');
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
            const atr = await card.getAtr();
            
            if (options.json) {
              console.log(JSON.stringify({
                reader: selectedReader,
                atr: Array.from(atr).map((b: any) => b.toString(16).padStart(2, '0')).join(''),
                atrBytes: Array.from(atr)
              }, null, 2));
            } else {
              console.log(formatCardInfo(selectedReader, atr));
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
      console.error('Error connecting to card:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });