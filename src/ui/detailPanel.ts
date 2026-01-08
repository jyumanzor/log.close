import * as vscode from 'vscode';
import { Session, DailyLog } from '../session/types';

export class DetailPanel {
  public static currentPanel: DetailPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri): DetailPanel {
    const column = vscode.ViewColumn.Beside;

    if (DetailPanel.currentPanel) {
      DetailPanel.currentPanel._panel.reveal(column);
      return DetailPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'logCloseDetail',
      'Session Details',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DetailPanel.currentPanel = new DetailPanel(panel, extensionUri);
    return DetailPanel.currentPanel;
  }

  public showSession(session: Session): void {
    this._panel.title = `Session: ${this.formatTime(session.startTime)}`;
    this._panel.webview.html = this.getSessionHtml(session);
  }

  public showDailyLog(dailyLog: DailyLog): void {
    this._panel.title = `Daily Review: ${dailyLog.date}`;
    this._panel.webview.html = this.getDailyLogHtml(dailyLog);
  }

  private getSessionHtml(session: Session): string {
    const startTime = this.formatDateTime(session.startTime);
    const endTime = session.endTime ? this.formatDateTime(session.endTime) : 'Ongoing';
    const duration = this.formatDuration(session.startTime, session.endTime);

    let summaryHtml = '';
    if (session.summary) {
      summaryHtml = `
        <section class="summary">
          <h2>Summary</h2>
          <p>${this.escapeHtml(session.summary.summary)}</p>
        </section>

        ${
          session.summary.tasksCompleted.length > 0
            ? `
        <section class="tasks">
          <h2>Tasks Completed</h2>
          <ul>
            ${session.summary.tasksCompleted.map((t) => `<li class="completed">${this.escapeHtml(t)}</li>`).join('')}
          </ul>
        </section>
        `
            : ''
        }

        ${
          session.summary.issuesResolved.length > 0
            ? `
        <section class="issues">
          <h2>Issues & Resolutions</h2>
          ${session.summary.issuesResolved
            .map(
              (i) => `
            <div class="issue">
              <strong>Issue:</strong> ${this.escapeHtml(i.description)}
              ${i.resolution ? `<br><strong>Resolution:</strong> ${this.escapeHtml(i.resolution)}` : ''}
            </div>
          `
            )
            .join('')}
        </section>
        `
            : ''
        }

        ${
          session.summary.filesModified.length > 0
            ? `
        <section class="files">
          <h2>Files Modified</h2>
          <ul>
            ${session.summary.filesModified.map((f) => `<li><code>${this.escapeHtml(f)}</code></li>`).join('')}
          </ul>
        </section>
        `
            : ''
        }
      `;
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Session Details</title>
        <style>
          ${this.getStyles()}
        </style>
      </head>
      <body>
        <header>
          <h1>Session Details</h1>
          <div class="meta">
            <span><strong>Start:</strong> ${startTime}</span>
            <span><strong>End:</strong> ${endTime}</span>
            <span><strong>Duration:</strong> ${duration}</span>
            <span><strong>Events:</strong> ${session.events.length}</span>
          </div>
        </header>

        ${summaryHtml}

        <section class="stats">
          <h2>Activity</h2>
          <div class="stat-grid">
            <div class="stat">
              <span class="number">${session.events.filter((e) => e.type === 'terminal').length}</span>
              <span class="label">Terminal Events</span>
            </div>
            <div class="stat">
              <span class="number">${session.events.filter((e) => e.type === 'file').length}</span>
              <span class="label">File Changes</span>
            </div>
            <div class="stat">
              <span class="number">${session.events.filter((e) => e.type === 'clipboard').length}</span>
              <span class="label">Clipboard Captures</span>
            </div>
          </div>
        </section>
      </body>
      </html>
    `;
  }

  private getDailyLogHtml(dailyLog: DailyLog): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Review</title>
        <style>
          ${this.getStyles()}
        </style>
      </head>
      <body>
        <header>
          <h1>Daily Review: ${dailyLog.date}</h1>
        </header>

        <section class="stats">
          <h2>Overview</h2>
          <div class="stat-grid">
            <div class="stat">
              <span class="number">${dailyLog.sessions.length}</span>
              <span class="label">Sessions</span>
            </div>
            <div class="stat">
              <span class="number">${dailyLog.completedTasks}/${dailyLog.totalTasks}</span>
              <span class="label">Tasks Completed</span>
            </div>
            <div class="stat">
              <span class="number">${dailyLog.issuesResolved}/${dailyLog.issuesEncountered}</span>
              <span class="label">Issues Resolved</span>
            </div>
          </div>
        </section>

        <section class="sessions">
          <h2>Sessions</h2>
          ${dailyLog.sessions
            .map(
              (session, index) => `
            <div class="session-card">
              <h3>Session ${index + 1}</h3>
              <p class="time">${this.formatTime(session.startTime)} - ${session.endTime ? this.formatTime(session.endTime) : 'ongoing'}</p>
              ${session.summary ? `<p>${this.escapeHtml(session.summary.summary)}</p>` : `<p>${session.events.length} events captured</p>`}
            </div>
          `
            )
            .join('')}
        </section>
      </body>
      </html>
    `;
  }

  private getStyles(): string {
    return `
      body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background-color: var(--vscode-editor-background);
        padding: 20px;
        line-height: 1.6;
      }

      header {
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--vscode-panel-border);
      }

      h1 {
        margin: 0 0 10px 0;
        color: var(--vscode-foreground);
      }

      h2 {
        color: var(--vscode-foreground);
        margin-top: 25px;
        margin-bottom: 10px;
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        font-size: 0.9em;
        color: var(--vscode-descriptionForeground);
      }

      section {
        margin-bottom: 25px;
      }

      .stat-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 15px;
      }

      .stat {
        background: var(--vscode-badge-background);
        padding: 15px;
        border-radius: 8px;
        text-align: center;
      }

      .stat .number {
        display: block;
        font-size: 1.8em;
        font-weight: bold;
        color: var(--vscode-badge-foreground);
      }

      .stat .label {
        font-size: 0.85em;
        color: var(--vscode-descriptionForeground);
      }

      ul {
        padding-left: 20px;
      }

      li {
        margin-bottom: 5px;
      }

      li.completed {
        color: var(--vscode-charts-green);
      }

      li.completed::marker {
        content: "✓ ";
      }

      .issue {
        background: var(--vscode-textBlockQuote-background);
        padding: 10px 15px;
        border-left: 3px solid var(--vscode-textBlockQuote-border);
        margin-bottom: 10px;
        border-radius: 0 4px 4px 0;
      }

      .session-card {
        background: var(--vscode-editor-inactiveSelectionBackground);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
      }

      .session-card h3 {
        margin: 0 0 5px 0;
      }

      .session-card .time {
        font-size: 0.9em;
        color: var(--vscode-descriptionForeground);
        margin: 0 0 10px 0;
      }

      code {
        background: var(--vscode-textCodeBlock-background);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
      }
    `;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private formatDuration(start: Date, end?: Date): string {
    const endTime = end || new Date();
    const durationMs = endTime.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  public dispose(): void {
    DetailPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
