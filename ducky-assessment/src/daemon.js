#!/usr/bin/env node

import { writeFileSync, appendFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import { startFileSystemTracker } from './trackers/fileSystem.js';
import { pollProcesses } from './trackers/processes.js';
import { pollGit } from './trackers/git.js';
import { pollClipboard } from './trackers/clipboard.js';
import { pollNetwork } from './trackers/network.js';
import { snapshotEditorState } from './trackers/editorState.js';

const DUCKY_DIR = join(homedir(), '.ducky');
const TRACKING_FILE = join(DUCKY_DIR, 'tracking.json');
const ERROR_LOG = join(DUCKY_DIR, 'error.log');

// Project dir passed from start command via env
const projectDir = process.env.DUCKY_PROJECT_DIR || process.cwd();

// Ensure state directory exists
mkdirSync(DUCKY_DIR, { recursive: true });

// M6: Global error handler — log to file instead of crashing
function logError(label, err) {
  try {
    const entry = `[${new Date().toISOString()}] ${label}: ${err?.stack || err}\n`;
    appendFileSync(ERROR_LOG, entry);
  } catch { /* nothing we can do */ }
}

process.on('uncaughtException', err => logError('uncaughtException', err));
process.on('unhandledRejection', reason => logError('unhandledRejection', reason));

// M6: Validate project directory exists before starting trackers
if (!existsSync(projectDir)) {
  logError('startup', new Error(`Project directory not found: ${projectDir}`));
  process.exit(1);
}

// Shared tracking accumulator — all trackers write into this object
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

// --- 4f: One-time editor state snapshot on startup ---
snapshotEditorState(tracking);

// --- 4a: File system watcher (event-driven via chokidar) ---
const fsWatcher = startFileSystemTracker(projectDir, tracking);

// --- 4b–4e: Polling trackers ---
// Run each tracker immediately on start, then on their respective intervals
pollProcesses(tracking);
pollGit(projectDir, tracking);
pollClipboard(tracking);
pollNetwork(tracking);

const intervals = [
  setInterval(() => pollProcesses(tracking),          10_000),  // every 10s
  setInterval(() => pollGit(projectDir, tracking),    30_000),  // every 30s
  setInterval(() => pollClipboard(tracking),           2_000),  // every 2s
  setInterval(() => pollNetwork(tracking),            15_000),  // every 15s
  setInterval(persistTracking,                         5_000),  // flush to disk every 5s
];

function shutdown() {
  for (const id of intervals) clearInterval(id);
  if (fsWatcher) fsWatcher.close();
  persistTracking();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Write initial snapshot
persistTracking();
