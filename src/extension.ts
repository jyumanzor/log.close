import * as vscode from 'vscode';
import { SessionManager } from './session/sessionManager';
import { TerminalWatcher } from './watchers/terminalWatcher';
import { FileWatcher } from './watchers/fileWatcher';
import { ClipboardWatcher } from './watchers/clipboardWatcher';
import { ClaudeClient } from './ai/claudeClient';
import { Summarizer } from './ai/summarizer';
import { TaskExtractor } from './ai/taskExtractor';
import { LocalDb } from './storage/localDb';
import { MarkdownExporter } from './storage/markdownExporter';
import { GitSyncer } from './storage/gitSyncer';
import { SessionsTreeProvider, TasksTreeProvider } from './ui/sidebarProvider';
import { TimelineTreeProvider } from './ui/timelineView';
import { DetailPanel } from './ui/detailPanel';
import { getConfig, getStoragePath } from './utils/config';

let sessionManager: SessionManager;
let terminalWatcher: TerminalWatcher;
let fileWatcher: FileWatcher;
let clipboardWatcher: ClipboardWatcher;
let claudeClient: ClaudeClient;
let summarizer: Summarizer;
let taskExtractor: TaskExtractor;
let db: LocalDb;
let markdownExporter: MarkdownExporter;
let gitSyncer: GitSyncer;
let sessionsTreeProvider: SessionsTreeProvider;
let tasksTreeProvider: TasksTreeProvider;
let timelineTreeProvider: TimelineTreeProvider;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Log Close extension is now active');

  const config = getConfig();
  const storagePath = getStoragePath(context);

  // Initialize core components
  sessionManager = new SessionManager();
  db = new LocalDb(storagePath);
  markdownExporter = new MarkdownExporter();
  gitSyncer = new GitSyncer();

  // Initialize AI components
  claudeClient = new ClaudeClient(context.secrets);
  summarizer = new Summarizer(claudeClient);
  taskExtractor = new TaskExtractor(claudeClient);

  // Initialize watchers based on config
  if (config.captureTerminal) {
    terminalWatcher = new TerminalWatcher();
    terminalWatcher.onData((event) => {
      sessionManager.addEvent(event);
      refreshViews();
    });
  }

  if (config.captureFileChanges) {
    fileWatcher = new FileWatcher();
    fileWatcher.onChange((event) => {
      sessionManager.addEvent(event);
      refreshViews();
    });
  }

  if (config.captureClipboard) {
    clipboardWatcher = new ClipboardWatcher();
    clipboardWatcher.onChange((event) => {
      sessionManager.addEvent(event);
      refreshViews();
    });
  }

  // Initialize UI
  sessionsTreeProvider = new SessionsTreeProvider(sessionManager);
  tasksTreeProvider = new TasksTreeProvider(sessionManager);
  timelineTreeProvider = new TimelineTreeProvider(db);

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('logClose.sessions', sessionsTreeProvider),
    vscode.window.registerTreeDataProvider('logClose.tasks', tasksTreeProvider),
    vscode.window.registerTreeDataProvider('logClose.timeline', timelineTreeProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('logClose.startSession', () => {
      sessionManager.startSession();
      refreshViews();
    }),

    vscode.commands.registerCommand('logClose.endSession', async () => {
      const session = sessionManager.endSession();
      if (session) {
        // Save to database
        db.saveSession(session);

        // Generate summary
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Log Close: Generating session summary...',
            cancellable: false,
          },
          async () => {
            try {
              const summary = await summarizer.summarizeSession(session);
              sessionManager.updateSummary(session.id, summary);

              const extracted = await taskExtractor.extractFromSession(session);
              session.tasks.push(...extracted.tasks);
              session.issues.push(...extracted.issues);

              db.saveSession(session);
            } catch (error) {
              console.error('Summarization failed:', error);
            }
          }
        );

        // Export to markdown
        markdownExporter.exportSession(session);

        refreshViews();
      }
    }),

    vscode.commands.registerCommand('logClose.summarizeNow', async () => {
      const session = sessionManager.getCurrentSession();
      if (!session) {
        vscode.window.showWarningMessage('Log Close: No active session to summarize');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Log Close: Generating summary...',
          cancellable: false,
        },
        async () => {
          try {
            const summary = await summarizer.summarizeSession(session);
            sessionManager.updateSummary(session.id, summary);

            const extracted = await taskExtractor.extractFromSession(session);
            session.tasks.push(...extracted.tasks);
            session.issues.push(...extracted.issues);

            vscode.window.showInformationMessage('Log Close: Summary generated');
            refreshViews();
          } catch (error) {
            vscode.window.showErrorMessage(`Log Close: Summarization failed - ${error}`);
          }
        }
      );
    }),

    vscode.commands.registerCommand('logClose.syncToGithub', async () => {
      if (!gitSyncer.isReady()) {
        const initialized = await gitSyncer.initialize();
        if (!initialized) {
          vscode.window.showErrorMessage(
            'Log Close: GitHub sync not configured. Set logClose.gitRepo in settings.'
          );
          return;
        }
      }
      await gitSyncer.forceSync();
    }),

    vscode.commands.registerCommand('logClose.openDailyReview', () => {
      const panel = DetailPanel.createOrShow(context.extensionUri);
      const today = new Date();
      const dailyLog = timelineTreeProvider.getDailyLog(today);
      panel.showDailyLog(dailyLog);
    }),

    vscode.commands.registerCommand('logClose.exportMarkdown', async () => {
      const session = sessionManager.getCurrentSession();
      const sessions = sessionManager.getTodaySessions();

      if (!session && sessions.length === 0) {
        vscode.window.showWarningMessage('Log Close: No sessions to export');
        return;
      }

      const today = new Date();
      const dailyLog = timelineTreeProvider.getDailyLog(today);
      const filePath = markdownExporter.exportDailyLog(dailyLog);

      vscode.window.showInformationMessage(`Log Close: Exported to ${filePath}`);
    }),

    vscode.commands.registerCommand('logClose.refreshViews', () => {
      refreshViews();
    })
  );

  // Session end handler - auto summarize and save
  sessionManager.onSessionEnd(async (session) => {
    // Save to database
    db.saveSession(session);

    // Try to summarize if Claude client is initialized
    if (claudeClient.isInitialized()) {
      try {
        const summary = await summarizer.summarizeSession(session);
        sessionManager.updateSummary(session.id, summary);

        const extracted = await taskExtractor.extractFromSession(session);
        session.tasks.push(...extracted.tasks);
        session.issues.push(...extracted.issues);

        db.saveSession(session);
      } catch (error) {
        console.error('Auto-summarization failed:', error);
      }
    }

    // Export to markdown
    markdownExporter.exportSession(session);

    refreshViews();
  });

  // Initialize git syncer if configured
  if (config.gitRepo) {
    await gitSyncer.initialize();
  }

  // Load existing sessions from database
  const existingSessions = db.getAllSessions();
  sessionManager.loadSessions(existingSessions);

  // Auto-start a session
  sessionManager.startSession();

  // Refresh views
  refreshViews();

  // Register disposables
  context.subscriptions.push({
    dispose: () => {
      sessionManager.dispose();
      terminalWatcher?.dispose();
      fileWatcher?.dispose();
      clipboardWatcher?.dispose();
      gitSyncer?.dispose();
      db?.close();
    },
  });
}

function refreshViews(): void {
  sessionsTreeProvider?.refresh();
  tasksTreeProvider?.refresh();
  timelineTreeProvider?.refresh();
}

export function deactivate() {
  // End current session if active
  if (sessionManager) {
    const session = sessionManager.getCurrentSession();
    if (session?.isActive) {
      sessionManager.endSession();
    }
    sessionManager.dispose();
  }

  // Final git sync
  if (gitSyncer?.isReady()) {
    gitSyncer.sync();
  }

  db?.close();
}
