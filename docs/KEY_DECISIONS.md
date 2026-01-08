# Key Decisions - Log Close Extension

*Inspired by Jenn's Builder Kit*

---

## Overview

Log Close is a VS Code extension that captures coding sessions, tracks conversations with AI assistants (like Claude Code), and provides AI-powered summaries of your work.

---

## Architecture Decisions

### 1. Layered Architecture

**Decision:** Organize code into distinct layers (Watchers → Session → AI → Storage → UI)

**Why:**
- Separation of concerns makes each piece testable
- Easy to swap implementations (e.g., change storage from JSON to SQLite)
- New features can be added without touching unrelated code

**Structure:**
```
src/
├── watchers/     # Data capture (terminal, files, clipboard)
├── session/      # Session management and event buffering
├── ai/           # Claude API integration
├── storage/      # Persistence (JSON, markdown, git)
└── ui/           # VS Code sidebar and webviews
```

---

### 2. JSON Storage over SQLite

**Decision:** Use simple JSON file storage instead of SQLite

**Why:**
- `better-sqlite3` requires native compilation for VS Code's Electron version
- Native modules cause installation failures across different platforms
- JSON is human-readable and debuggable
- Performance is fine for session data (not millions of records)

**Trade-off:** Less efficient queries, but simplicity wins for this use case.

**File:** `src/storage/localDb.ts`

---

### 3. Terminal Capture - Deferred

**Decision:** Disable real-time terminal capture for initial release

**Why:**
- `onDidWriteTerminalData` API is a "proposed API" in VS Code
- Proposed APIs require special flags and aren't stable
- Would prevent publishing to VS Code Marketplace
- File and clipboard capture provide enough value initially

**Future:** Re-enable when the API becomes stable or find alternative approach (shell integration, reading history files).

**File:** `src/watchers/terminalWatcher.ts`

---

### 4. AI Summarization via Claude API

**Decision:** Use Anthropic's Claude API for session summaries

**Why:**
- High-quality summaries that understand code context
- Can extract tasks, issues, and resolutions automatically
- User already uses Claude Code, so familiar with quality

**Trade-off:** Requires API key and incurs costs. Made optional - extension works without it.

**File:** `src/ai/claudeClient.ts`, `src/ai/summarizer.ts`

---

### 5. Session Boundaries by Inactivity

**Decision:** Auto-end sessions after 10 minutes of inactivity (configurable)

**Why:**
- Users forget to manually end sessions
- Natural work patterns have breaks
- Prevents one giant session per day

**Configuration:** `logClose.sessionTimeoutMinutes`

**File:** `src/session/sessionManager.ts`

---

### 6. Dual Storage - Local + GitHub

**Decision:** Store sessions both locally (JSON) and sync to GitHub (markdown)

**Why:**
- Local JSON for fast querying and UI
- Markdown on GitHub for:
  - Human-readable history
  - Backup across machines
  - Searchable via GitHub
  - Shareable if needed

**Files:** `src/storage/localDb.ts`, `src/storage/markdownExporter.ts`, `src/storage/gitSyncer.ts`

---

### 7. Sidebar UI with Tree Views

**Decision:** Use VS Code's TreeDataProvider for sidebar instead of full webview

**Why:**
- Native VS Code look and feel
- Lightweight and fast
- Keyboard accessible
- Detail panel uses webview only when needed

**Trade-off:** Less visual customization, but consistency with VS Code UX.

**File:** `src/ui/sidebarProvider.ts`

---

### 8. Event Buffering

**Decision:** Buffer events before adding to session (50 events or 500ms debounce)

**Why:**
- Rapid file saves or clipboard changes would flood the session
- Batching improves performance
- Debouncing terminal output gives complete lines

**File:** `src/session/eventBuffer.ts`

---

### 9. Clipboard Polling vs Events

**Decision:** Poll clipboard every 2 seconds instead of event-based

**Why:**
- VS Code clipboard API doesn't have change events
- Polling is the only option
- 2 seconds balances responsiveness vs battery/CPU

**Configuration:** `logClose.clipboardPollIntervalSeconds`

**File:** `src/watchers/clipboardWatcher.ts`

---

### 10. API Key in Secret Storage

**Decision:** Store Anthropic API key in VS Code's SecretStorage, not settings

**Why:**
- Settings sync across machines and are visible in JSON
- SecretStorage is encrypted and secure
- Follows VS Code security best practices

**File:** `src/ai/claudeClient.ts`

---

## Configuration Decisions

| Setting | Default | Rationale |
|---------|---------|-----------|
| `sessionTimeoutMinutes` | 10 | Long enough for bathroom break, short enough to segment work |
| `clipboardPollIntervalSeconds` | 2 | Balance responsiveness vs resource usage |
| `gitSyncIntervalMinutes` | 30 | Often enough to not lose work, rare enough to not spam |
| `markdownOutputPath` | `~/session-logs` | User's home directory, easy to find |

---

## What We Didn't Build (Yet)

1. **Terminal capture** - Waiting for stable API
2. **Search across sessions** - Would need indexing
3. **Team sharing** - Privacy concerns, would need opt-in
4. **Auto-tagging** - AI could categorize sessions
5. **Time tracking** - Could integrate with tools like Toggl

---

## Lessons Learned

1. **Native modules in VS Code extensions are painful** - Avoid if possible
2. **Proposed APIs look great but block marketplace publishing**
3. **Start simple** - JSON > SQLite for MVP
4. **User's existing workflow matters** - Don't force new habits

---

*Last updated: January 2026*
