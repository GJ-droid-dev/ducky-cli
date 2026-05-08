#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

program
  .name('ducky')
  .description('Passively monitors your dev environment for AI coding assistant usage signals')
  .version(pkg.version);

program
  .command('start')
  .description('Begin tracking AI usage in the current project directory')
  .action(async () => {
    const { start } = await import('./commands/start.js');
    await start();
  });

program
  .command('stop')
  .description('Stop tracking and save a summary report to the project root')
  .action(async () => {
    const { stop } = await import('./commands/stop.js');
    await stop();
  });

program.on('command:*', () => {
  console.error(`Unknown command: ${program.args.join(' ')}\n`);
  program.help();
});

program.parse(process.argv);
