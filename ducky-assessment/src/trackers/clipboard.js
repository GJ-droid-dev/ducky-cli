import { createHash } from 'crypto';
import clipboardy from 'clipboardy';

// Minimum character count to flag a clipboard entry as a potential AI paste
const LARGE_PASTE_THRESHOLD = 200;

let lastHash = null;

export async function pollClipboard(tracking) {
  try {
    const text = await clipboardy.read();
    if (!text || !text.trim()) return;

    const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    if (hash === lastHash) return;  // no change since last poll

    lastHash = hash;
    tracking.clipboard.changeCount++;

    if (text.length >= LARGE_PASTE_THRESHOLD) {
      tracking.clipboard.largePasteEvents.push({
        timestamp: new Date().toISOString(),
        contentHash: hash,       // privacy-safe: hash not raw content
        length: text.length,
        flag: 'large_paste',
        note: `Clipboard entry of ${text.length} chars — possible AI output paste`,
      });
    }
  } catch {
    // Clipboard access may be unavailable in some environments — non-fatal
  }
}
