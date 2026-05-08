import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = (cmd, opts) => promisify(exec)(cmd, { windowsHide: true, ...opts });

// Lines-added threshold above which a commit is flagged as suspiciously large
const LARGE_DIFF_THRESHOLD = 50;

// Commits we've already recorded (avoid duplicates across polls)
const seenCommits = new Set();

export async function pollGit(projectDir, tracking) {
  try {
    // Fetch recent commits — hash, ISO date, subject, author
    const { stdout: logOut } = await execAsync(
      'git log --format="%H|%aI|%s|%an" -30',
      { cwd: projectDir, timeout: 8000 }
    );

    const lines = logOut.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const firstPipe = line.indexOf('|');
      const rest1 = line.slice(firstPipe + 1);
      const secondPipe = rest1.indexOf('|');
      const rest2 = rest1.slice(secondPipe + 1);
      const thirdPipe = rest2.indexOf('|');

      const hash = line.slice(0, firstPipe).trim();
      const date = rest1.slice(0, secondPipe).trim();
      const msg = rest2.slice(0, thirdPipe).trim();
      const author = rest2.slice(thirdPipe + 1).trim();

      if (!hash || seenCommits.has(hash)) continue;
      seenCommits.add(hash);

      let linesAdded = 0;
      let linesRemoved = 0;
      let filesChanged = 0;

      try {
        const { stdout: diffOut } = await execAsync(
          `git show --stat --format="" ${hash}`,
          { cwd: projectDir, timeout: 8000 }
        );
        const summary = diffOut.split('\n').find(l => l.includes('changed'));
        if (summary) {
          const addMatch = summary.match(/(\d+) insertion/);
          const delMatch = summary.match(/(\d+) deletion/);
          const fileMatch = summary.match(/(\d+) file/);
          linesAdded = addMatch ? parseInt(addMatch[1]) : 0;
          linesRemoved = delMatch ? parseInt(delMatch[1]) : 0;
          filesChanged = fileMatch ? parseInt(fileMatch[1]) : 0;
        }
      } catch { /* diff unavailable — still record the commit */ }

      const commit = {
        hash,
        timestamp: date,
        message: msg,
        author,
        filesChanged,
        linesAdded,
        linesRemoved,
      };

      tracking.git.commits.push(commit);

      if (linesAdded >= LARGE_DIFF_THRESHOLD) {
        tracking.git.largeDiffEvents.push({
          ...commit,
          flag: 'large_addition',
          note: `${linesAdded} lines added in a single commit — possible AI-generated content`,
        });
      }
    }
  } catch {
    // Not a git repo, or git not on PATH — skip silently
  }
}
