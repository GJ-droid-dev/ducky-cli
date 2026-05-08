import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const DUCKY_DIR = join(homedir(), '.ducky');
const SESSION_FILE = join(DUCKY_DIR, 'session.json');
const TRACKING_FILE = join(DUCKY_DIR, 'tracking.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const EMPTY_TRACKING = () => ({
  fileSystem: { events: [] },
  processes: { aiToolsDetected: [], snapshots: [] },
  git: { commits: [], largeDiffEvents: [] },
  clipboard: { changeCount: 0, largePasteEvents: [] },
  network: { aiConnectionEvents: [] },
  editorState: { aiExtensions: [], relevantSettings: {} },
});

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

  // Allow daemon time to write its final tracking.json before we read it
  await sleep(700);

  const endTime = new Date();
  const startTime = new Date(session.startTime);
  const durationSec = Math.round((endTime - startTime) / 1000);

  // Read accumulated tracking data
  let tracking = EMPTY_TRACKING();
  try {
    tracking = JSON.parse(readFileSync(TRACKING_FILE, 'utf8'));
  } catch { /* use defaults if file missing or unreadable */ }

  // --- Build ducky-report.json ---
  const report = {
    metadata: {
      sessionStart: session.startTime,
      sessionEnd: endTime.toISOString(),
      durationSeconds: durationSec,
      projectDirectory: session.projectDir,
    },
    tracking,
  };

  const reportPath = join(session.projectDir, 'ducky-report.json');
  try {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  } catch (err) {
    console.error(`[ducky] Could not write report: ${err.message}`);
  }

  // --- Human-readable summary ---
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;

  const fsEvents     = tracking.fileSystem.events;
  const aiFileEvents = fsEvents.filter(e => e.isAiRelatedFile).length;
  const aiTools      = tracking.processes.aiToolsDetected;
  const commits      = tracking.git.commits;
  const largeDiffs   = tracking.git.largeDiffEvents;
  const clipChanges  = tracking.clipboard.changeCount;
  const largePastes  = tracking.clipboard.largePasteEvents.length;
  const netAI        = tracking.network.aiConnectionEvents;
  const aiExts       = tracking.editorState.aiExtensions;

  const mins2 = Math.floor(durationSec / 60);
  const secs2 = durationSec % 60;

  console.log('\n[ducky] Session summary:');
  console.log(`        Project  : ${session.projectDir}`);
  console.log(`        Started  : ${session.startTime}`);
  console.log(`        Ended    : ${endTime.toISOString()}`);
  console.log(`        Duration : ${mins2}m ${secs2}s`);

  console.log('\n[ducky] AI Signal Summary:');
  console.log(`        File events      : ${fsEvents.length} total, ${aiFileEvents} AI-related`);
  console.log(`        AI processes     : ${aiTools.length} detected`);
  console.log(`        Git commits      : ${commits.length} captured, ${largeDiffs.length} large diffs flagged`);
  console.log(`        Clipboard        : ${clipChanges} changes, ${largePastes} large paste(s) (>=200 chars)`);
  console.log(`        Network AI calls : ${netAI.length} connection(s) to known AI services`);
  console.log(`        AI extensions    : ${aiExts.length} installed`);

  console.log(`\n[ducky] Report written to: ${reportPath}`);
}
