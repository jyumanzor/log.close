# Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Log Close Extension                    │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │  Terminal   │  │    File     │  │  Clipboard  │       │   │
│  │  │  Watcher    │  │   Watcher   │  │   Watcher   │       │   │
│  │  │  (future)   │  │             │  │             │       │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │   │
│  │         │                │                │              │   │
│  │         └────────────────┼────────────────┘              │   │
│  │                          ▼                               │   │
│  │                 ┌─────────────────┐                      │   │
│  │                 │  Event Buffer   │                      │   │
│  │                 └────────┬────────┘                      │   │
│  │                          ▼                               │   │
│  │                 ┌─────────────────┐                      │   │
│  │                 │ Session Manager │                      │   │
│  │                 └────────┬────────┘                      │   │
│  │                          │                               │   │
│  │         ┌────────────────┼────────────────┐              │   │
│  │         ▼                ▼                ▼              │   │
│  │  ┌───────────┐   ┌───────────┐   ┌───────────────┐      │   │
│  │  │  Local DB │   │  Claude   │   │   Markdown    │      │   │
│  │  │  (JSON)   │   │   API     │   │   Exporter    │      │   │
│  │  └─────┬─────┘   └─────┬─────┘   └───────┬───────┘      │   │
│  │        │               │                 │              │   │
│  │        │               ▼                 ▼              │   │
│  │        │        ┌───────────┐     ┌───────────┐         │   │
│  │        │        │Summarizer │     │Git Syncer │         │   │
│  │        │        │  + Task   │     │           │         │   │
│  │        │        │ Extractor │     └─────┬─────┘         │   │
│  │        │        └───────────┘           │              │   │
│  │        │                                ▼              │   │
│  │        │                         ┌───────────┐         │   │
│  │        │                         │  GitHub   │         │   │
│  │        │                         │   Repo    │         │   │
│  │        │                         └───────────┘         │   │
│  │        ▼                                               │   │
│  │  ┌─────────────────────────────────────────────┐       │   │
│  │  │                  UI Layer                    │       │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │       │   │
│  │  │  │ Sessions │ │  Tasks   │ │   Timeline   │ │       │   │
│  │  │  │TreeView  │ │TreeView  │ │  TreeView    │ │       │   │
│  │  │  └──────────┘ └──────────┘ └──────────────┘ │       │   │
│  │  │              ┌──────────────┐                │       │   │
│  │  │              │ Detail Panel │                │       │   │
│  │  │              │  (Webview)   │                │       │   │
│  │  │              └──────────────┘                │       │   │
│  │  └─────────────────────────────────────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Watchers Layer

**Purpose:** Capture activity from VS Code

| Component | File | What it captures |
|-----------|------|------------------|
| TerminalWatcher | `watchers/terminalWatcher.ts` | Terminal output (disabled - proposed API) |
| FileWatcher | `watchers/fileWatcher.ts` | File creates, edits, saves, deletes |
| ClipboardWatcher | `watchers/clipboardWatcher.ts` | Clipboard contents (polls every 2s) |

### Session Layer

**Purpose:** Manage session lifecycle and buffer events

| Component | File | Responsibility |
|-----------|------|----------------|
| SessionManager | `session/sessionManager.ts` | Start/end sessions, track events |
| EventBuffer | `session/eventBuffer.ts` | Batch events before processing |
| Types | `session/types.ts` | TypeScript interfaces |

### AI Layer

**Purpose:** Generate summaries using Claude API

| Component | File | Responsibility |
|-----------|------|----------------|
| ClaudeClient | `ai/claudeClient.ts` | API wrapper, key management |
| Summarizer | `ai/summarizer.ts` | Generate session summaries |
| TaskExtractor | `ai/taskExtractor.ts` | Extract tasks and issues |

### Storage Layer

**Purpose:** Persist session data

| Component | File | Storage Type |
|-----------|------|--------------|
| LocalDb | `storage/localDb.ts` | JSON file (fast queries) |
| MarkdownExporter | `storage/markdownExporter.ts` | .md files (human readable) |
| GitSyncer | `storage/gitSyncer.ts` | GitHub (backup/sync) |

### UI Layer

**Purpose:** Display data to user

| Component | File | VS Code API |
|-----------|------|-------------|
| SessionsTreeProvider | `ui/sidebarProvider.ts` | TreeDataProvider |
| TasksTreeProvider | `ui/sidebarProvider.ts` | TreeDataProvider |
| TimelineTreeProvider | `ui/timelineView.ts` | TreeDataProvider |
| DetailPanel | `ui/detailPanel.ts` | WebviewPanel |

---

## Data Flow

### 1. Event Capture
```
User action → Watcher detects → Event created → Buffer queues → Session stores
```

### 2. Session End
```
Timeout/Manual → Session ends → Summarizer runs → DB saves → Markdown exports → Git syncs
```

### 3. UI Update
```
Session changes → TreeProvider.refresh() → VS Code redraws sidebar
```

---

## File Storage Format

### JSON Database (`log-close-data.json`)
```json
{
  "sessions": [
    {
      "id": "1704567890-abc123",
      "startTime": "2026-01-07T10:30:00.000Z",
      "endTime": "2026-01-07T11:45:00.000Z",
      "workspacePath": "/Users/jenn/project",
      "isActive": false,
      "events": [...],
      "tasks": [...],
      "issues": [...],
      "summary": {
        "summary": "Implemented user auth...",
        "tasksCompleted": [...],
        "issuesResolved": [...],
        "filesModified": [...]
      }
    }
  ]
}
```

### Markdown Export (`2026-01-07.md`)
```markdown
# Session Log: 2026-01-07

## Session 1 (10:30 - 11:45)
**Summary**: Implemented user authentication...

### Tasks Completed
- [x] Set up JWT tokens
- [x] Created login endpoint

### Issues & Resolutions
- **Issue**: CORS errors
  - **Resolution**: Added middleware

### Files Modified
- src/auth/login.ts
- src/middleware/cors.ts
```

---

## Extension Lifecycle

```
VS Code starts
    │
    ▼
activate() called
    │
    ├── Initialize SessionManager
    ├── Initialize LocalDb
    ├── Initialize Watchers
    ├── Register TreeDataProviders
    ├── Register Commands
    ├── Load existing sessions
    └── Auto-start new session
    │
    ▼
User works (events captured)
    │
    ▼
Session timeout OR manual end
    │
    ├── Save to LocalDb
    ├── Run AI summarization
    ├── Export to Markdown
    └── Sync to GitHub
    │
    ▼
VS Code closes
    │
    ▼
deactivate() called
    │
    ├── End active session
    ├── Final git sync
    └── Close database
```

---

## Extension Points

### Adding a New Watcher
1. Create file in `src/watchers/`
2. Implement `onData()` or `onChange()` callback pattern
3. Register in `extension.ts` activate function

### Adding New Storage Backend
1. Create file in `src/storage/`
2. Implement same interface as `LocalDb`
3. Swap in `extension.ts`

### Adding New UI View
1. Add view to `package.json` contributes.views
2. Create TreeDataProvider in `src/ui/`
3. Register in `extension.ts`

---

*See KEY_DECISIONS.md for rationale behind these choices.*
