# Ducky CLI — Project Action Plan

## Project Summary
Build a Node.js CLI tool (`ducky`) that passively monitors a developer's local environment for AI coding assistant usage signals, producing a structured JSON report on demand.

---

## Milestones & Goals

---

### Milestone 1 — Project Scaffolding
**Goal:** Establish a runnable project structure that satisfies the `npm link` requirement before any feature work begins.

**Tasks:**
- [x] Confirm `package.json` has correct `bin` field pointing to `src/index.js`
- [x] Create `src/` directory
- [x] Create `src/index.js` as the CLI entry point with a `#!/usr/bin/env node` shebang
- [x] Install `commander` dependency (`npm install`)
- [x] Run `npm link` and verify `ducky --help` works globally
- [x] Add a `.gitignore` (already present — verify `node_modules` is excluded)

**Acceptance Criteria:**
- `ducky` command is globally accessible after `npm link`
- Running `ducky --help` prints usage info without errors

---

### Milestone 2 — Core CLI Structure
**Goal:** Wire up the two required commands (`start`, `stop`) with Commander so the routing layer is in place before logic is written.

**Tasks:**
- [x] Register `ducky start` command with a description
- [x] Register `ducky stop` command with a description
- [x] Add a fallback for unknown commands (print help)
- [x] Create `src/commands/start.js` stub
- [x] Create `src/commands/stop.js` stub

**Acceptance Criteria:**
- `ducky start` and `ducky stop` each execute their respective handler without crashing
- Unrecognized subcommands show help text

---

### Milestone 3 — Background Process Management
**Goal:** Implement a persistent background watcher that survives after the terminal command returns, with clean start/stop lifecycle.

**Tasks:**
- [x] Create `src/daemon.js` — the long-running background process entry point
- [x] In `ducky start`: spawn `daemon.js` as a detached child process (`detached: true`, `stdio: 'ignore'`, `unref()`)
- [x] Write the daemon's PID and session start time to a state file (e.g., `~/.ducky/session.json`)
- [x] In `ducky start`: check for an existing `session.json` — if PID is alive, print "already tracking" and exit
- [x] In `ducky stop`: read `session.json`, send `SIGTERM` to the daemon PID, delete the state file
- [x] Handle edge cases: stale PID file (process no longer alive), missing state file on `stop`

**Acceptance Criteria:**
- `ducky start` returns to the prompt immediately; daemon continues running
- Running `ducky start` twice prints a warning instead of spawning a duplicate
- `ducky stop` cleanly terminates the daemon with no orphaned processes
- `ducky stop` with no active session prints a clear message

---

### Milestone 4 — Signal Tracking Implementation
**Goal:** Implement passive, local-only tracking of as many AI usage signals as possible inside the daemon.

#### 4a — File System Watcher
- [x] Watch the project directory (path stored in `session.json`) for file change events using `fs.watch` or `chokidar`
- [x] Record: timestamp, file path, event type (add/change/unlink)
- [x] Detect known AI-generated file patterns (e.g., large single-commit additions, `.cursorrules`, `.copilot/`, `AGENTS.md`, `.github/copilot-instructions.md`)

#### 4b — Process Snapshot Polling
- [x] Poll running processes every N seconds using `tasklist` (Windows) / `ps` (Unix)
- [x] Flag known AI tool processes: `copilot`, `cursor`, `claude`, `chatgpt`, `codeium`, `tabnine`, `continue`, `supermaven`
- [x] Record: process name, PID, first-seen time, last-seen time, total presence duration

#### 4c — Git Activity Monitoring
- [x] Poll `git log` and `git diff --stat` against the project directory
- [x] Detect: commit frequency, commit message patterns (e.g., "fix", "refactor", generated boilerplate phrases)
- [x] Detect unusually large diffs (high lines-added in a short time — a proxy for pasted AI output)
- [x] Record: commit hash, timestamp, message, files changed, lines added/removed

#### 4d — Clipboard Monitoring
- [x] Poll the system clipboard at a regular interval
- [x] Detect changes; record a hash (not the raw content) of each unique clipboard value and its length
- [x] Flag clipboard entries that are large (>200 chars) as potential AI-paste events

#### 4e — Network Activity Sampling (passive)
- [x] Periodically check active TCP connections using `netstat` output parsed locally
- [x] Flag connections to known AI service hostnames: `api.openai.com`, `api.anthropic.com`, `copilot.githubusercontent.com`, `api.cursor.sh`, `codeium.com`, `api.cohere.ai`
- [x] Record: timestamp, remote host/IP, local port (no request bodies — passive only)

#### 4f — Editor State (VS Code)
- [x] Check for the presence of VS Code extension directories in `~/.vscode/extensions/` matching AI tool names (`github.copilot*`, `cursor*`, `codeium*`, `continue*`, `tabnine*`)
- [x] Read VS Code settings (`settings.json`) for AI-related config keys if present
- [x] Record: installed AI extensions (name, version), relevant settings keys (values redacted for privacy)

**Acceptance Criteria:**
- All trackers run inside the daemon without throwing unhandled exceptions
- No data is sent to any external service
- Tracking does not noticeably degrade system performance

---

### Milestone 5 — Report Generation
**Goal:** On `ducky stop`, produce a valid, well-structured `ducky-report.json` in the project root.

**Tasks:**
- [ ] Daemon writes accumulated tracking data to a temp log file (e.g., `~/.ducky/tracking.json`) incrementally
- [ ] On `ducky stop`, read the temp log and the session state file
- [ ] Compute derived metrics: total AI process time, total clipboard paste events, git diff anomaly count, network AI calls count
- [ ] Build the report object with required structure (see below)
- [ ] Write `ducky-report.json` to the project root directory (path from `session.json`)
- [ ] Print a human-readable summary to stdout before exiting

**Report Structure:**
```json
{
  "metadata": {
    "sessionStart": "<ISO 8601>",
    "sessionEnd": "<ISO 8601>",
    "durationSeconds": 0,
    "projectDirectory": "<path>"
  },
  "tracking": {
    "fileSystem": { "events": [] },
    "processes": { "aiToolsDetected": [], "snapshots": [] },
    "git": { "commits": [], "largeDiffEvents": [] },
    "clipboard": { "changeCount": 0, "largePasteEvents": [] },
    "network": { "aiConnectionEvents": [] },
    "editorState": { "aiExtensions": [], "relevantSettings": {} }
  }
}
```

**Acceptance Criteria:**
- `ducky-report.json` is valid JSON (passes `JSON.parse`)
- `metadata` section contains all four required fields
- `tracking` section contains all six signal categories
- Summary printed to terminal is human-readable

---

### Milestone 6 — Robustness & Edge Cases
**Goal:** Ensure the tool handles failure gracefully without leaving stale state.

**Tasks:**
- [ ] Daemon catches and logs all unhandled promise rejections / exceptions to `~/.ducky/error.log` instead of crashing
- [ ] `ducky start` handles permissions errors on the watch directory
- [ ] `ducky stop` handles a stale PID (process already dead) gracefully
- [ ] On daemon startup, validate the project directory still exists
- [ ] Ensure all file handles and watchers are closed before the daemon exits

**Acceptance Criteria:**
- No zombie processes under any tested scenario
- Error messages are informative without exposing stack traces to the user

---

### Milestone 7 — WRITEUP.md
**Goal:** Deliver the required written reflection covering tracking approach, signal value, and limitations.

**Tasks:**
- [ ] Section 1: Document each signal tracked, the rationale, and what it reveals about AI usage
- [ ] Section 2: Argue why AI usage tracking provides signal about developer ability that traditional assessments miss
- [ ] Section 3: Propose at least 3 additional signals/services (e.g., keystroke dynamics, LLM API key presence, browser history analysis, IDE telemetry APIs) with justifications and integration approach

**Acceptance Criteria:**
- `WRITEUP.md` addresses all three required sections
- Each section is substantive (not bullet-point filler)

---

### Milestone 8 — Final Verification
**Goal:** End-to-end smoke test confirming all deliverables meet the README requirements.

**Tasks:**
- [ ] Fresh `npm install` + `npm link` in a clean shell
- [ ] Run `ducky start` — verify confirmation message and data path are printed
- [ ] Run `ducky start` again — verify "already tracking" message
- [ ] Perform some actions (edit a file, make a git commit)
- [ ] Run `ducky stop` — verify summary is printed and `ducky-report.json` is created
- [ ] Validate `ducky-report.json` against the required schema
- [ ] Run `ducky stop` again — verify "no active session" message
- [ ] Confirm no orphaned processes remain
- [ ] Confirm `WRITEUP.md` is present and complete

---

## Dependency Order

```
M1 (Scaffolding)
  └── M2 (CLI Structure)
        └── M3 (Process Management)
              └── M4 (Signal Tracking)
                    └── M5 (Report Generation)
                          └── M6 (Robustness)
                                └── M8 (Final Verification)
M7 (WRITEUP.md) — parallel, can be written any time after M4
```

---

## Tech Stack Decisions

| Concern | Choice | Reason |
|---|---|---|
| Language | JavaScript (ESM) | `"type": "module"` already set; no build step needed |
| CLI framework | `commander` | Already in `package.json` |
| File watching | `chokidar` | Cross-platform, reliable, better than raw `fs.watch` |
| Process listing | `ps-list` | Cross-platform process enumeration |
| Clipboard | `clipboardy` | Cross-platform clipboard read |
| Background process | Node detached child process | Native, no extra daemon manager needed |

---

## Out of Scope
- Publishing to npm registry
- UI / dashboard
- Sending data to any external service
- Authentication or multi-user support
