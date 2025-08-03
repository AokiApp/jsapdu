/**
 * Main CLI implementation
 */

import { program } from 'commander';
import { readersCommand } from './commands/readers.js';
import { connectCommand } from './commands/connect.js';
import { apduCommand } from './commands/apdu.js';
import { mynacardCommand } from './commands/mynacard.js';

export async function cli() {
  program
    .name('jsapdu')
    .description('Command line tool for smart card communication using jsapdu')
    .version('0.0.1');

  // Add subcommands
  program.addCommand(readersCommand);
  program.addCommand(connectCommand);
  program.addCommand(apduCommand);
  program.addCommand(mynacardCommand);

  await program.parseAsync();
}