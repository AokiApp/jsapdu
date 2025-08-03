#!/usr/bin/env node

/**
 * @file CLI entry point for @aokiapp/jsapdu-cli
 */

import { cli } from './cli.js';

cli().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});