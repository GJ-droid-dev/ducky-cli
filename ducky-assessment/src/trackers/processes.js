import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = (cmd, opts) => promisify(exec)(cmd, { windowsHide: true, ...opts });

// Known AI tool process name keywords (case-insensitive substring match)
const AI_PROCESS_KEYWORDS = [
  'copilot',
  'cursor',
  'claude',
  'chatgpt',
  'codeium',
  'tabnine',
  'continue',
  'supermaven',
  'windsurf',
  'gemini',
  'aider',
  'ollama',
  'github-copilot',
  'cody',
  'sourcegraph',
];

// Track which pid+name combos we've seen to compute durations
const seenProcesses = new Map();

async function listProcesses() {
  if (process.platform === 'win32') {
    const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 8000 });
    return stdout
      .split('\n')
      .filter(l => l.trim())
      .map(line => {
        const parts = line.split('","');
        return {
          name: (parts[0] || '').replace(/^"|"$/g, '').toLowerCase(),
          pid: parseInt((parts[1] || '0').replace(/"/g, '')),
        };
      })
      .filter(p => p.name && !isNaN(p.pid));
  } else {
    const { stdout } = await execAsync('ps -eo pid,comm', { timeout: 8000 });
    return stdout
      .split('\n')
      .slice(1)
      .filter(l => l.trim())
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: (parts[1] || '').toLowerCase(), pid: parseInt(parts[0]) };
      })
      .filter(p => p.name && !isNaN(p.pid));
  }
}

export async function pollProcesses(tracking) {
  try {
    const processes = await listProcesses();
    const now = new Date().toISOString();
    const snapshot = { timestamp: now, aiProcesses: [] };

    for (const { name, pid } of processes) {
      const matchedKeyword = AI_PROCESS_KEYWORDS.find(kw => name.includes(kw));
      if (!matchedKeyword) continue;

      const key = `${name}-${pid}`;
      snapshot.aiProcesses.push({ name, pid, keyword: matchedKeyword });

      if (!seenProcesses.has(key)) {
        seenProcesses.set(key, { firstSeen: now });
        tracking.processes.aiToolsDetected.push({
          name,
          pid,
          keyword: matchedKeyword,
          firstSeen: now,
          lastSeen: now,
        });
      } else {
        const det = tracking.processes.aiToolsDetected.find(
          t => t.name === name && t.pid === pid
        );
        if (det) det.lastSeen = now;
      }
    }

    if (snapshot.aiProcesses.length > 0) {
      tracking.processes.snapshots.push(snapshot);
    }
  } catch {
    // Non-fatal — process listing may fail transiently
  }
}
