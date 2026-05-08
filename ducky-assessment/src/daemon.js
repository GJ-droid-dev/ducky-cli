#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DUCKY_DIR = join(homedir(), '.ducky');
const TRACKING_FILE = join(DUCKY_DIR, 'tracking.json');

// Project dir passed from start command via env
const projectDir = process.env.DUCKY_PROJECT_DIR || process.cwd();

// Ensure state directory exists
mkdirSync(DUCKY_DIR, { recursive: true });

// Tracking accumulator — populated by M4 trackers
const tracking = {
  fileSystem: { events: [] },
  processes: { aiToolsDetected: [], snapshots: [] },
  git: { commits: [], largeDiffEvents: [] },
  clipboard: { changeCount: 0, largePasteEvents: [] },
  network: { aiConnectionEvents: [] },
  editorState: { aiExtensions: [], relevantSettings: {} },
};

function persistTracking() {
  try {
    writeFileSync(TRACKING_FILE, JSON.stringify(tracking, null, 2));
  } catch {
    // Non-fatal — will retry on next interval
  }
}

// Persist every 5 seconds so stop can read latest data
const persistInterval = setInterval(persistTracking, 5000);

// Keep event loop alive even before M4 trackers are wired in
const keepAlive = setInterval(() => {}, 60_000);

function shutdown() {
  clearInterval(persistInterval);
  clearInterval(keepAlive);
  persistTracking();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Write initial snapshot
persistTracking();
