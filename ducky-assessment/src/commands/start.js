import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUCKY_DIR = join(homedir(), '.ducky');
const SESSION_FILE = join(DUCKY_DIR, 'session.json');
const DAEMON_PATH = join(__dirname, '../daemon.js');

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM means process exists but we lack permission — treat as alive
    return err.code === 'EPERM';
  }
}

export async function start() {
  const projectDir = process.cwd();

  // Check for an existing active session
  if (existsSync(SESSION_FILE)) {
    try {
      const session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      if (isProcessAlive(session.pid)) {
        console.log(`[ducky] Already tracking — session is active.`);
        console.log(`        Project : ${session.projectDir}`);
        console.log(`        Started : ${session.startTime}`);
        console.log(`        PID     : ${session.pid}`);
        return;
      }
      // Stale PID — clean up before starting fresh
      console.log('[ducky] Stale session detected. Cleaning up and restarting...');
      unlinkSync(SESSION_FILE);
    } catch {
      // Corrupt state file — remove and proceed
      try { unlinkSync(SESSION_FILE); } catch { /* ignore */ }
    }
  }

  mkdirSync(DUCKY_DIR, { recursive: true });

  // Spawn daemon as a fully detached background process
  const child = spawn(process.execPath, [DAEMON_PATH], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DUCKY_PROJECT_DIR: projectDir },
  });
  child.unref();

  const session = {
    pid: child.pid,
    startTime: new Date().toISOString(),
    projectDir,
  };
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

  console.log(`[ducky] Tracking started.`);
  console.log(`        Project : ${projectDir}`);
  console.log(`        Data    : ${DUCKY_DIR}`);
  console.log(`        PID     : ${child.pid}`);
}
