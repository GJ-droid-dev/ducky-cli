import chokidar from 'chokidar';
import { join } from 'path';

// Known AI-tool configuration / generated file patterns (used for isAiRelatedFile flag)
const AI_FILE_PATTERNS = [
  '.cursorrules',
  'agents.md',
  '.github/copilot-instructions.md',
  '.copilot/',
  '.cursor/',
  '.continuerc.json',
  '.codeium/',
  'cursor.json',
  'supermaven.json',
  '.tabnine/',
  'windsurf',
];

export function startFileSystemTracker(projectDir, tracking) {
  // Exclude noise patterns; dotfile filtering is NOT done here because
  // chokidar v3 function-based ignored has reliability issues on Windows.
  // All files reach recordEvent(), which correctly sets isAiRelatedFile.
  const watcher = chokidar.watch(projectDir, {
    ignored: [
      /[/\\]node_modules[/\\]/,
      /[/\\]\.git[/\\]/,
      /ducky-report\.json$/,
    ],
    persistent: true,
    ignoreInitial: true,
    usePolling: false,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
    depth: 6,
  });

  function recordEvent(type, filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    const projectNorm = projectDir.replace(/\\/g, '/');
    const rel = normalized.startsWith(projectNorm)
      ? normalized.slice(projectNorm.length).replace(/^\//, '')
      : normalized;
    const relLower = rel.toLowerCase();
    const isAiRelatedFile = AI_FILE_PATTERNS.some(p => relLower.includes(p.toLowerCase()));

    tracking.fileSystem.events.push({
      timestamp: new Date().toISOString(),
      type,
      path: rel,
      isAiRelatedFile,
    });
  }

  watcher.on('add', p => recordEvent('add', p));
  watcher.on('change', p => recordEvent('change', p));
  watcher.on('unlink', p => recordEvent('unlink', p));

  return watcher;
}

