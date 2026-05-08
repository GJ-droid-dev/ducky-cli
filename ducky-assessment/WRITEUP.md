# WRITEUP.md — Ducky AI Usage Tracker

---

## 1. Tracking Approach — What Signals Were Chosen and Why

Ducky monitors six distinct signal categories, each chosen because it leaves a durable, inspectable trace without requiring privileged access or active interception.

### File System Events
The file system is the most reliable record of AI tool activity. AI assistants leave configuration artifacts that are unambiguous: `.cursorrules` (Cursor IDE rules), `.github/copilot-instructions.md` (Copilot custom instructions), `.copilot/`, `.codeium/`, `.tabnine/`, `.continuerc.json`, and `AGENTS.md`. Unlike process names or network traffic, these files persist even after the AI tool has closed. Ducky uses `chokidar` to watch the project directory for `add`, `change`, and `unlink` events, flags any event whose path matches a known AI config pattern, and records the event type, path, and timestamp. This reveals not just that an AI tool is installed, but that it was actively configured for this project.

### Process Snapshots
Running processes are a real-time indicator of which AI tools are open. Ducky polls `tasklist` (Windows) or `ps` (Unix) every 10 seconds and checks process names against a list of 15 AI tool keywords: `copilot`, `cursor`, `claude`, `chatgpt`, `codeium`, `tabnine`, `continue`, `supermaven`, `windsurf`, `gemini`, `aider`, `ollama`, `github-copilot`, `cody`, `sourcegraph`. When a process is found, its name, PID, and first/last-seen timestamps are recorded. Sustained process presence over a session (e.g., Cursor running for 90 minutes) is meaningful signal that cannot be fabricated after the fact.

### Git Activity
Version control history is a high-fidelity proxy for AI-assisted development. Ducky polls `git log` every 30 seconds and uses `git show --stat` to inspect each new commit's diff statistics. Two patterns are particularly diagnostic:

- **Large single-commit additions** (≥50 lines added): human developers rarely type 200+ lines in one commit; AI completions or paste-from-ChatGPT produce exactly this pattern.
- **Commit message style**: future versions can flag generic messages like "fix", "update", or "add feature" that AI tools often suggest.

Ducky records every commit's hash, timestamp, author, message, files changed, and lines added/removed, flagging large-addition commits with an explanatory note.

### Clipboard Monitoring
The clipboard is the primary transfer mechanism for AI-generated code. When a developer copies output from ChatGPT, Claude, or any chat-based assistant and pastes it into the editor, the clipboard briefly holds that content. Ducky polls the clipboard every 2 seconds using `clipboardy`, hashes each unique value (SHA-256, truncated to 16 hex characters — never storing raw content), and flags paste events where the clipboard content exceeded 200 characters. Large paste events are a strong signal: no developer types 200+ characters in under 2 seconds, but they routinely paste AI completions that size.

### Network Activity
Outgoing TCP connections to known AI API endpoints are definitive evidence of AI tool usage during the session. Ducky parses `netstat` output every 15 seconds, matching remote addresses against a list of 16 AI service hostnames: `api.openai.com`, `api.anthropic.com`, `copilot.githubusercontent.com`, `api.cursor.sh`, `codeium.com`, `api.cohere.ai`, `generativelanguage.googleapis.com`, `api.mistral.ai`, `api.groq.com`, `openrouter.ai`, `api.together.xyz`, `api.deepseek.com`, `aistudio.google.com`, `claude.ai`, `chat.openai.com`, `copilot.microsoft.com`. Only ESTABLISHED/CLOSE_WAIT/TIME_WAIT connections are recorded, reducing noise from listen sockets. A connection to `api.openai.com` during a coding session is unambiguous — the developer used the OpenAI API, whether via IDE plugin, curl, or browser.

### Editor State (VS Code)
The IDE extension registry is a persistent record of which AI tools a developer has installed. Ducky scans `~/.vscode/extensions/` at daemon startup for directories matching 16 AI tool patterns (e.g., `github.copilot`, `anysphere` for Cursor, `codeium`, `continue`, `tabnine`, `rooveterinaryinc` for Roo Code, `saoudrizwan` for Cline). It also reads VS Code's `settings.json` for keys beginning with known AI-tool prefixes, recording only the key names (values are redacted to `[redacted]` to protect user privacy). An installed `github.copilot` extension is meaningful baseline context; the presence of AI-specific settings (e.g., `github.copilot.enable`, `codeium.enableConfig`) indicates active, configured usage rather than a stale installation.

---

## 2. Signal Value — Why AI Usage Tracking Reveals What Traditional Assessments Miss

Traditional technical assessments measure outputs: does the code compile, do the tests pass, is the algorithm correct? They cannot distinguish between a developer who understood the problem deeply and one who prompted their way to a solution without understanding it.

AI usage tracking addresses this gap directly.

**It captures process, not just product.** A developer who pastes a 300-line class from ChatGPT and submits it may produce identical output to one who wrote it from scratch. The file system (no `.cursorrules`), process log (no `cursor` process), clipboard (300-char paste event at 14:32), and network log (`api.openai.com` ESTABLISHED at 14:31) tell completely different stories. The signals are difficult to spoof and expensive to suppress across all six channels simultaneously.

**It measures cognitive engagement.** A developer using AI as a reasoning partner — asking targeted questions, iterating on small completions, and modifying the output — will show a different pattern from one outsourcing entire modules. The former shows many small clipboard events interspersed with file edits; the latter shows a single large paste followed by a commit with hundreds of added lines. Git history makes this distinction permanent.

**It identifies dependency on AI for basic tasks.** If a developer triggers AI API calls for every function they write, the network log will show dozens of connections to `api.openai.com` during a 30-minute task. A developer solving the same problem without AI assistance will show zero. This is a direct measure of independence — the ability to reason through problems without a crutch.

**It reveals honesty under implicit conditions.** Assessments that do not explicitly prohibit AI usage create an implicit expectation of disclosure. Developers who use AI tools without acknowledging it, in contexts where originality is expected, are demonstrating a willingness to misrepresent their work. This is itself a signal about professional character.

**It complements, not replaces, the technical interview.** Tracking data surfaces questions: "I see a 450-line commit with no prior incremental edits — can you walk me through your approach?" Candidates who understood what they submitted will answer fluently; those who pasted and submitted will not. The tracking data turns a binary pass/fail into a starting point for calibrated conversation.

---

## 3. Limitations and Extensions

### Limitation: DNS-Level Tracking Misses Cached Connections
The current `netstat` approach only sees active TCP connections. If an AI IDE plugin batches requests, reuses keep-alive connections, or if DNS responses are cached and the connection appears under an IP rather than a hostname, the network tracker may miss it. A more robust approach would use a **local DNS sinkhole or proxy** (e.g., a loopback `dnsmasq` instance or `mitmproxy` running on localhost) to intercept all DNS queries during the session. Every lookup for `api.openai.com` would be logged regardless of whether a TCP connection was still ESTABLISHED at polling time. This requires elevated privileges but is entirely passive and does not intercept content.

### Extension: Keystroke Dynamics and Typing Cadence
AI-pasted code arrives instantaneously; human-typed code arrives in bursts with pauses. **Keystroke timing analysis** via an IDE plugin (VS Code extension API: `TextDocumentChangeEvent`) could record insertion lengths and inter-keystroke intervals. A 400-character insertion that took 0ms is almost certainly a paste; a 400-character insertion that took 90 seconds with realistic inter-key delays is almost certainly typed. This signal is extremely hard to spoof at scale without automated typing simulation. Commercial tools like `WakaTime` expose some of this via their API, though raw keystroke data would require a custom VS Code extension that writes locally.

### Extension: LLM API Key Presence in Environment
Many developers store API keys in `.env` files or shell profiles (`~/.zshrc`, `~/.bash_profile`). Ducky could scan for environment variable names matching `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `COHERE_API_KEY`, etc. — recording only the key name and whether it is set (not the value). The presence of a populated `OPENAI_API_KEY` alongside heavy clipboard activity is stronger evidence of AI usage than either signal alone. This is fully local, requires no elevated privileges, and is a one-time scan at session start.

### Extension: Browser History and Tab Activity
AI usage often begins in the browser: a developer opens `chat.openai.com`, copies a response, and pastes it into their IDE. Browser history and currently-open tabs are inspectable on most platforms without elevated privileges:
- **Chrome/Edge**: `~/AppData/Local/Google/Chrome/User Data/Default/History` (SQLite) on Windows
- **Firefox**: `~/AppData/Roaming/Mozilla/Firefox/Profiles/*/places.sqlite`

A tracker that queries these SQLite databases at session start and stop and diffs the `urls` table for visits to `chat.openai.com`, `claude.ai`, `v0.dev`, `copilot.microsoft.com`, `aistudio.google.com`, or `perplexity.ai` during the session window would add a channel that process + network tracking cannot fully cover (e.g., when using the browser-based ChatGPT interface while the IDE has no AI extension). This approach is read-only and passive — it does not modify browser history or intercept requests.
