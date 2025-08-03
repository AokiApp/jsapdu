/**
 * Main CLI implementation
 */

import { Command } from 'commander';
const program = new Command();
import { readersCommand } from './commands/readers.js';
import { connectCommand } from './commands/connect.js';
import { apduCommand } from './commands/apdu.js';
import { mynacardCommand } from './commands/mynacard.js';
import { iso7816Command } from './commands/iso7816.js';

export async function cli() {
  program
    .name('jsapdu')
    .description('Command line tool for smart card communication using jsapdu')
    .version('0.0.1');

  // Add subcommands
  program.addCommand(readersCommand);
  program.addCommand(connectCommand);
  program.addCommand(apduCommand);
  program.addCommand(iso7816Command);
  program.addCommand(mynacardCommand);

  await program.parseAsync(process.argv);
}