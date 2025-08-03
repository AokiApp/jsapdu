/**
 * Readers command - Lists available smart card readers
 */

import { Command } from 'commander';
import { PcscPlatformManager } from '@aokiapp/jsapdu-pcsc';
import { formatReaderInfo } from '../utils/formatters.js';

export const readersCommand = new Command('readers')
  .description('List available smart card readers')
  .option('-j, --json', 'Output as JSON')
  .option('-v, --verbose', 'Show detailed information')
  .action(async (options) => {
    try {
      const platformManager = PcscPlatformManager.getInstance();
      const platform = platformManager.getPlatform();
      
      await platform.init();
      
      try {
        const deviceInfos = await platform.getDeviceInfo();
        
        if (options.json) {
          console.log(JSON.stringify(deviceInfos, null, 2));
        } else {
          if (deviceInfos.length === 0) {
            console.log('No smart card readers found.');
          } else {
            console.log(`Found ${deviceInfos.length} reader(s):\n`);
            deviceInfos.forEach((info: any, index: number) => {
              console.log(formatReaderInfo(info, index, options.verbose));
            });
          }
        }
      } finally {
        await platform.release();
      }
    } catch (error) {
      console.error('Error listing readers:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });