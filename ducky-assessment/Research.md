# Research.md — Competitive Landscape, Customer Requirements & Gap Analysis

---

## 1. Competitor Analysis

### 1.1 Direct Competitors — AI Usage Monitoring Tools

#### Litmus CLI (Assessment Context)
- **What it does**: The Litmus CLI (running alongside ducky in this assessment) watches a developer's session activity and writes events to a local `.litmus/activity.jsonl` log. It is assessment-scoped — designed to observe candidate behaviour during a controlled evaluation, not to track AI tool usage specifically.
- **Strengths**: Lightweight, passive, already integrated into the assessment pipeline.
- **Weaknesses**: Single-purpose (assessment only), no AI-signal classification, no report output, not developer-facing.
- **Ducky's differentiation**: Ducky produces a structured, developer-readable report (`ducky-report.json`) with six categorised signal streams and derived metrics. It is a general-purpose developer tool, not an assessor-side observer.

#### WakaTime
- **What it does**: IDE plugin that tracks file edit time per language, project, and editor. Sends telemetry to a cloud dashboard.
- **Strengths**: Wide IDE support (VS Code, JetBrains, Vim, etc.), polished dashboard, team/org-level analytics, public API.
- **Weaknesses**: Cloud-dependent (all data sent to WakaTime servers — violates ducky's local-only requirement), no AI-specific classification, tracks time-on-file not AI signal origin, subscription pricing ($9/month for full features).
- **Ducky's differentiation**: Fully local, purpose-built for AI usage signal, no subscription, no data exfiltration.

#### GitClear
- **What it does**: Analyses git history to detect AI-generated code via statistical patterns (copy-paste churn, unusually high lines-added rates, commit message genericness).
- **Strengths**: Sophisticated diff analysis, team-level trend dashboards, integrates with GitHub/GitLab.
- **Weaknesses**: Post-hoc only (analyses existing history, not live sessions), cloud SaaS, no real-time tracking, no process/clipboard/network signals.
- **Ducky's differentiation**: Real-time live tracking during a session, multi-signal (not git-only), local.

#### Gretel.ai / Codeium Enterprise Analytics
- **What it does**: Enterprise AI coding tools that include usage dashboards showing which developers use AI suggestions and acceptance rates.
- **Strengths**: Deeply integrated with specific AI tools, high-fidelity acceptance data (knows exactly which completions were accepted).
- **Weaknesses**: Vendor-locked (only works if the org mandates that specific AI tool), requires cloud infrastructure, does not detect usage of competing AI tools, expensive.
- **Ducky's differentiation**: Vendor-neutral (detects Copilot, Cursor, Claude, Codeium, Tabnine, etc. simultaneously), no vendor lock-in.

#### ActivityWatch
- **What it does**: Open-source, local-first time-tracking tool that monitors active window titles and AFK status. Stores data locally.
- **Strengths**: Local-only, open-source, cross-platform, extensible with watchers, good UI.
- **Weaknesses**: General purpose (not AI-focused), no git/clipboard/network AI analysis, requires watcher configuration, no AI signal classification logic.
- **Ducky's differentiation**: AI-specific signal classification built in, git diff analysis, clipboard large-paste detection, network AI endpoint matching.

#### CodeClimate / SonarQube
- **What it does**: Static analysis and code quality platforms — detect code smells, duplication, complexity.
- **Strengths**: Deep code quality insight, CI/CD integration, wide language support.
- **Weaknesses**: Analyse code quality, not authorship process; no AI usage detection; post-commit only; no behavioural signals.
- **Ducky's differentiation**: Behavioural/process-oriented rather than code-quality-oriented.

---

### 1.2 Indirect Competitors — Assessment Platforms

| Platform | Approach | AI Detection? | Local? |
|----------|----------|--------------|--------|
| HackerRank | Browser-based coding tests, plagiarism detection | Partial (copy-paste detection only) | No |
| Codility | Timed challenges with keystroke playback | No explicit AI detection | No |
| CoderPad | Collaborative coding, screen sharing | Human review only | No |
| GitHub Copilot for Business | Shows Copilot acceptance rates per repo | Copilot only | No (cloud) |
| Cursor Pro Analytics | Usage stats within Cursor | Cursor only | No (cloud) |

None of these offer multi-signal, vendor-neutral, local-only AI usage tracking at the session level.

---

## 2. Customer Requirements

### 2.1 Primary Customer: Technical Hiring Teams

**Jobs to be done:**
- Determine whether a candidate's take-home submission reflects their own capabilities or AI-generated work.
- Generate defensible evidence to use in follow-up interviews ("walk me through your approach to this commit").
- Compare AI usage patterns across candidates on the same task.

**Key requirements:**
- **Zero-friction setup**: Must install in under 2 minutes. `npm link` and run — no account creation, no cloud credentials, no configuration files.
- **Local data only**: Legal and HR cannot approve tools that exfiltrate candidate data to third-party servers.
- **Structured machine-readable output**: The report must be parseable by downstream assessment pipelines without custom scraping.
- **Vendor-neutral detection**: Candidates use different AI tools; the tracker must detect Copilot, Cursor, Claude, Codeium, and ChatGPT-via-browser equally.
- **Non-intrusive**: Must not slow the developer's machine, pop up windows, or interfere with the coding environment.
- **Clear signal, not raw noise**: The report should surface derived conclusions (e.g., "3 large-paste events", "Cursor process active for 45 minutes"), not just raw event logs.

### 2.2 Secondary Customer: Developers (Self-Assessment)

**Jobs to be done:**
- Understand their own AI dependency patterns over time.
- Build evidence of their workflow for portfolio or job applications.
- Identify which parts of their coding workflow are AI-assisted vs. independently produced.

**Key requirements:**
- **Human-readable output**: The terminal summary must be immediately useful without opening the JSON file.
- **Privacy-respecting**: No content of clipboard pastes stored — only hashes and lengths. Settings values redacted.
- **Cross-project comparability**: Session data format must be stable enough to compare across multiple projects and sessions.
- **Low overhead**: Must not consume noticeable CPU or memory during an active coding session.

### 2.3 Tertiary Customer: Engineering Managers / Team Leads

**Jobs to be done:**
- Understand team-level AI tool adoption trends.
- Identify developers who may be over-reliant on AI for tasks that require deep understanding.
- Make informed decisions about AI tool licensing and training investment.

**Key requirements:**
- **Aggregatable data**: Individual session reports must share a consistent schema so they can be merged across team members.
- **Trend visibility over time**: Point-in-time snapshots are less useful than longitudinal data.
- **Configurable thresholds**: What counts as a "large diff" or "significant AI usage" should be tunable per team context.

---

## 3. Gap Analysis — Current Ducky vs. Market Needs

### 3.1 Feature Gaps

| Gap | Customer Impact | Priority |
|-----|----------------|----------|
| **No keystroke/typing cadence tracking** | Cannot distinguish between pasted vs. typed code within a file — the most granular and hardest-to-fake signal | High |
| **No browser history analysis** | Misses ChatGPT/Claude usage via browser entirely when no IDE plugin is installed | High |
| **No LLM API key detection** | Cannot confirm API-based AI usage vs. IDE plugin usage | Medium |
| **No longitudinal / multi-session aggregation** | Each `ducky stop` overwrites `ducky-report.json`; no history across sessions | High |
| **No `ducky status` command** | Developer cannot check what is being tracked mid-session without reading raw JSON | Medium |
| **No configurable thresholds** | `LARGE_DIFF_THRESHOLD=50` and `LARGE_PASTE_THRESHOLD=200` are hardcoded — cannot tune per project | Medium |
| **Network tracker is polling-based** | Connections shorter than 15 seconds (e.g., fast API calls) may be missed entirely | High |
| **No JetBrains / other IDE support** | Editor state only checks `~/.vscode/extensions/`; JetBrains, Neovim, Zed users are invisible | Medium |
| **Single project directory only** | Cannot track a session that spans multiple directories (e.g., monorepo with separate frontend/backend) | Low |
| **No diff content analysis** | Large commit size is flagged, but no analysis of whether added code resembles LLM output patterns (e.g., verbose docstrings, generic variable names) | Medium |
| **Report is overwritten on each stop** | Running `ducky start` / `ducky stop` twice loses the first session's data | High |
| **No summary scoring / AI-dependency index** | Raw signal counts are presented but no single "AI usage score" is computed for quick ranking across candidates | Medium |

### 3.2 Technical Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No Windows service / LaunchAgent** | Daemon is a detached Node process — killed if the user logs out or the terminal crashes | Medium |
| **No daemon auto-restart on crash** | If the daemon throws an unhandled error after startup, tracking silently stops with no alert to the user | Medium |
| **chokidar v3 function-based `ignored` unreliable on Windows** | Worked around with regex-only ignored array, but limits dotfile exclusion granularity | Low |
| **`netstat` hostname resolution is passive but incomplete** | On Windows, `netstat -a` may show IPs without hostnames for connections that resolved via non-system DNS | Medium |
| **No test suite** | All verification is manual; regressions in any tracker will not be caught automatically | High |
| **No TypeScript / type safety** | Tracking object shape is implicit; changes to one tracker can silently break the report schema | Low |

### 3.3 Business / Positioning Gaps

| Gap | Impact |
|-----|--------|
| **No published npm package** | Requires `npm link` — adds friction for assessors who want to distribute it to candidates pre-interview |
| **No multi-platform CI validation** | Only verified on Windows; macOS/Linux behaviour of `ps`, `netstat`, clipboard, and path handling is untested |
| **No data retention / session history UI** | Competing tools (WakaTime, ActivityWatch) offer visual dashboards; ducky is JSON-only |
| **No team aggregation workflow** | No tooling to merge multiple candidates' `ducky-report.json` files for side-by-side comparison |
| **No documentation beyond README** | No API reference for the report schema, no contributor guide, no changelog |

---

## 4. Prioritised Roadmap (derived from gap analysis)

### Near-term (highest customer impact)
1. **Multi-session history** — append sessions to `~/.ducky/history.jsonl` instead of overwriting; keep `ducky-report.json` per-session with a timestamp suffix.
2. **`ducky status` command** — print a live summary of the current session's captured signals without stopping tracking.
3. **Browser history snapshot** — read Chrome/Edge/Firefox SQLite history at `ducky start` and `ducky stop`, diff for visits to known AI service URLs.
4. **Network polling → connection counting** — increase poll frequency to 5s and deduplicate by remote host per-interval to reduce missed short-lived connections.
5. **Automated test suite** — Jest unit tests for each tracker's parsing logic; integration test for the full start→signal→stop→report flow.

### Medium-term
6. **Typing cadence via VS Code extension** — companion extension that records `TextDocumentChangeEvent` insertion sizes and timestamps, writes to `~/.ducky/keystrokes.jsonl`.
7. **LLM API key detection** — scan `.env`, shell profiles, and `process.env` at startup for known AI key names.
8. **Configurable thresholds** — `ducky.config.json` in project root for `largeDiffThreshold`, `largePasteThreshold`, AI keyword lists.
9. **JetBrains extension directory support** — add `~/.config/JetBrains/` and per-product plugin directories to the editor state scanner.
10. **AI-dependency index** — compute a single 0–100 score from weighted signal counts for easy candidate comparison.

### Long-term
11. **npm publish** — make `npx ducky start` work without any installation step.
12. **Report diff content analysis** — run a lightweight heuristic (docstring density, generic identifier ratio) over added lines in large commits to score LLM-likeness.
13. **Team aggregation CLI** — `ducky compare <report1.json> <report2.json> ...` to output a ranked candidate summary table.
