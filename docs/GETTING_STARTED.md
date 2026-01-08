# Getting Started with Log Close

## What is Log Close?

Log Close is a VS Code extension that watches your coding sessions and helps you:
- Track what you worked on each day
- Capture conversations with AI assistants (Claude Code)
- Get AI-powered summaries of your sessions
- Review your work history day by day

---

## Installation

### Option 1: Install from VSIX (Local)

1. Open VS Code
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type: **"Install from VSIX"**
4. Select the `.vsix` file from the project folder

### Option 2: Development Mode

1. Open the project folder in VS Code
2. Press `F5` to launch Extension Development Host
3. The extension runs in the new window that opens

---

## First Use

### 1. Find the Extension

Look for the **Log Close icon** in your left sidebar (activity bar). It looks like a document with lines.

### 2. See Your Session

Click the icon to see:
- **Sessions** - Your active and past sessions today
- **Tasks** - Extracted tasks from your work
- **Timeline** - Last 7 days of sessions

### 3. Work Normally

The extension automatically captures:
- Files you edit and save
- Text you copy to clipboard

### 4. End Your Session

When done working:
1. Press `Cmd+Shift+P`
2. Type: **"Log Close: End Current Session"**
3. This triggers AI summarization (if configured)

---

## Setting Up AI Summaries

To get AI-powered summaries, you need an Anthropic API key:

1. Go to: https://console.anthropic.com/
2. Create an account or sign in
3. Generate an API key
4. When you run "End Session" or "Summarize Now", the extension will prompt for your key
5. The key is stored securely in VS Code's secret storage

---

## Commands

| Command | What it does |
|---------|--------------|
| `Log Close: Start New Session` | Manually start a new session |
| `Log Close: End Current Session` | End session and generate summary |
| `Log Close: Summarize Current Session` | Generate summary without ending |
| `Log Close: Open Daily Review` | See today's full summary |
| `Log Close: Export to Markdown` | Export today to a .md file |
| `Log Close: Sync to GitHub` | Push logs to your GitHub repo |

---

## Settings

Open VS Code settings (`Cmd+,`) and search for "logClose":

| Setting | Default | Description |
|---------|---------|-------------|
| `captureFileChanges` | true | Track file edits |
| `captureClipboard` | true | Monitor clipboard |
| `sessionTimeoutMinutes` | 10 | Auto-end after inactivity |
| `markdownOutputPath` | ~/session-logs | Where to save markdown logs |
| `gitRepo` | (empty) | GitHub repo for sync (e.g., `username/repo`) |

---

## GitHub Sync Setup

To sync your session logs to GitHub:

1. Create a GitHub repo (e.g., `vscode.capture`)
2. In VS Code settings, set `logClose.gitRepo` to `yourusername/reponame`
3. The extension will auto-commit and push every 30 minutes
4. Or run **"Log Close: Sync to GitHub"** manually

---

## Tips

- **Sessions auto-start** when you open VS Code
- **Sessions auto-end** after 10 minutes of no activity
- **Daily Review** gives you a nice summary of your whole day
- **Markdown exports** are great for sharing or archiving

---

## Troubleshooting

### Extension not showing in sidebar
1. Check Extensions panel (`Cmd+Shift+X`)
2. Search "log close"
3. Make sure it's installed and enabled

### AI summaries not working
1. Check you have an API key set
2. Run "Summarize Now" to test
3. Check Output panel for errors

### GitHub sync failing
1. Make sure repo exists on GitHub
2. Check you have push access
3. Try manual sync first

---

*Questions? Issues? Open a GitHub issue at: github.com/jyumanzor/log.close*
