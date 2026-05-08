import { readdirSync, readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// VS Code extension folder name patterns that indicate AI tools
const AI_EXTENSION_PATTERNS = [
  'github.copilot',
  'anysphere',       // Cursor is published as anysphere.cursorai
  'cursor',
  'codeium',
  'continue',
  'tabnine',
  'supermaven',
  'sourcegraph.cody',
  'amazonwebservices.aws-toolkit',
  'google.cloudcode',
  'google.gemini',
  'windsurf',
  'ollama',
  'rooveterinaryinc',  // Roo Code
  'saoudrizwan',       // Claude Dev / Cline
  'kodu-ai',
];

// settings.json key prefixes that are AI-tool related (values are redacted)
const AI_SETTINGS_PREFIXES = [
  'github.copilot',
  'cursor.',
  'codeium.',
  'continue.',
  'tabnine.',
  'editor.inlineSuggest',
  'editor.suggest',
  'windsurf.',
  'ollama.',
];

// Platform-specific VS Code settings.json locations
function getSettingsPaths() {
  const home = homedir();
  return [
    join(home, 'AppData', 'Roaming', 'Code', 'User', 'settings.json'),           // Windows
    join(home, 'AppData', 'Roaming', 'Code - Insiders', 'User', 'settings.json'), // Insiders
    join(home, '.config', 'Code', 'User', 'settings.json'),                        // Linux
    join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json'), // macOS
  ];
}

export function snapshotEditorState(tracking) {
  // --- Installed extensions ---
  const extDir = join(homedir(), '.vscode', 'extensions');
  if (existsSync(extDir)) {
    try {
      const entries = readdirSync(extDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const nameLower = entry.name.toLowerCase();
        const matched = AI_EXTENSION_PATTERNS.find(p => nameLower.includes(p.toLowerCase()));
        if (!matched) continue;

        let version = 'unknown';
        try {
          const pkgRaw = readFileSync(join(extDir, entry.name, 'package.json'), 'utf8');
          version = JSON.parse(pkgRaw).version || 'unknown';
        } catch { /* version unavailable */ }

        tracking.editorState.aiExtensions.push({
          extensionId: entry.name,
          matchedPattern: matched,
          version,
        });
      }
    } catch { /* extension dir unreadable */ }
  }

  // --- Relevant settings.json keys (values redacted for privacy) ---
  for (const settingsPath of getSettingsPaths()) {
    if (!existsSync(settingsPath)) continue;
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
      for (const key of Object.keys(settings)) {
        const keyLower = key.toLowerCase();
        if (AI_SETTINGS_PREFIXES.some(p => keyLower.startsWith(p.toLowerCase()))) {
          tracking.editorState.relevantSettings[key] = '[redacted]';
        }
      }
    } catch { /* settings unreadable */ }
    break; // use the first path that exists
  }
}
