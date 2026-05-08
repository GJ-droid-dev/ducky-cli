import { existsSync, readFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DUCKY_DIR = join(homedir(), '.ducky');
const SESSION_FILE = join(DUCKY_DIR, 'session.json');

export async function stop() {
  if (!existsSync(SESSION_FILE)) {
    console.log('[ducky] No active tracking session found.');
    return;
  }

  let session;
  try {
    session = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  } catch {
    console.error('[ducky] Session file is corrupted. Removing it.');
    try { unlinkSync(SESSION_FILE); } catch { /* ignore */ }
    return;
  }

  // Signal the daemon to shut down gracefully
  try {
    process.kill(session.pid, 'SIGTERM');
    console.log(`[ducky] Stopped daemon (PID ${session.pid}).`);
  } catch (err) {
    if (err.code === 'ESRCH') {
      console.log('[ducky] Daemon was not running (stale session). Cleaning up.');
    } else {
      console.error(`[ducky] Could not stop daemon: ${err.message}`);
    }
  }

  // Remove session state
  try { unlinkSync(SESSION_FILE); } catch { /* ignore */ }

  // Print session summary (full JSON report generated in M5)
  const endTime = new Date();
  const startTime = new Date(session.startTime);
  const durationSec = Math.round((endTime - startTime) / 1000);
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  console.log('\n[ducky] Session summary:');
  console.log(`        Project  : ${session.projectDir}`);
  console.log(`        Started  : ${session.startTime}`);
  console.log(`        Ended    : ${endTime.toISOString()}`);
  console.log(`        Duration : ${mins}m ${secs}s`);
  console.log(`\n[ducky] Tracking data saved to: ${DUCKY_DIR}`);
}
