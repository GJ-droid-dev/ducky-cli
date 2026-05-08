import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = (cmd, opts) => promisify(exec)(cmd, { windowsHide: true, ...opts });

// Known AI service hostnames to match against resolved netstat output
const AI_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'copilot.githubusercontent.com',
  'api.cursor.sh',
  'codeium.com',
  'api.cohere.ai',
  'generativelanguage.googleapis.com',
  'api.mistral.ai',
  'api.groq.com',
  'openrouter.ai',
  'api.together.xyz',
  'api.deepseek.com',
  'aistudio.google.com',
  'claude.ai',
  'chat.openai.com',
  'copilot.microsoft.com',
];

// Deduplicate: don't re-log same host within this window (ms)
const DEDUP_WINDOW_MS = 30_000;

export async function pollNetwork(tracking) {
  try {
    let output = '';
    // Use without -n so the OS resolves hostnames from its cache (passive — no new DNS queries)
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('netstat -a -p TCP', { timeout: 6000 });
      output = stdout;
    } else {
      const { stdout } = await execAsync('netstat -t', { timeout: 6000 });
      output = stdout;
    }

    const now = Date.now();
    const lines = output
      .split('\n')
      .filter(l =>
        l.includes('ESTABLISHED') ||
        l.includes('CLOSE_WAIT') ||
        l.includes('TIME_WAIT')
      );

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      // Windows:  Proto  LocalAddr  ForeignAddr  State
      // Unix:     Proto  RecvQ SendQ  LocalAddr  ForeignAddr  State
      const foreignAddr = process.platform === 'win32' ? parts[2] : parts[4];
      if (!foreignAddr) continue;

      const colonIdx = foreignAddr.lastIndexOf(':');
      const remoteHost = foreignAddr.substring(0, colonIdx).toLowerCase();

      const matchedHost = AI_HOSTS.find(h => remoteHost.includes(h));
      if (!matchedHost) continue;

      // Dedup: skip if we already recorded this host recently
      const recent = tracking.network.aiConnectionEvents.find(
        e => e.matchedAiHost === matchedHost && now - new Date(e.timestamp).getTime() < DEDUP_WINDOW_MS
      );
      if (recent) continue;

      tracking.network.aiConnectionEvents.push({
        timestamp: new Date().toISOString(),
        remoteHost,
        remotePort: foreignAddr.substring(colonIdx + 1),
        matchedAiHost: matchedHost,
        note: `Active TCP connection to known AI service: ${matchedHost}`,
      });
    }
  } catch {
    // netstat may not be available or may time out — non-fatal
  }
}
