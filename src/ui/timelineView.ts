import * as vscode from 'vscode';
import { LocalDb } from '../storage/localDb';
import { DailyLog, Session } from '../session/types';

export class TimelineTreeProvider implements vscode.TreeDataProvider<TimelineItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TimelineItem | undefined | null | void> =
    new vscode.EventEmitter<TimelineItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TimelineItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private db: LocalDb) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TimelineItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TimelineItem): Thenable<TimelineItem[]> {
    if (!element) {
      // Root level - show last 7 days
      return Promise.resolve(this.getRecentDays());
    }

    if (element.contextValue === 'day') {
      // Day level - show sessions for that day
      return Promise.resolve(this.getSessionsForDay(element.date!));
    }

    if (element.contextValue === 'session-summary') {
      // Session level - show details
      return Promise.resolve(this.getSessionDetails(element.session!));
    }

    return Promise.resolve([]);
  }

  private getRecentDays(): TimelineItem[] {
    const items: TimelineItem[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const sessions = this.db.getSessionsByDate(date);
      const label = this.formatDayLabel(date, i);
      const description = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;

      items.push(
        new TimelineItem(
          label,
          sessions.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None,
          'day',
          description,
          date
        )
      );
    }

    return items;
  }

  private getSessionsForDay(date: Date): TimelineItem[] {
    const sessions = this.db.getSessionsByDate(date);

    if (sessions.length === 0) {
      return [
        new TimelineItem(
          'No sessions',
          vscode.TreeItemCollapsibleState.None,
          'empty'
        ),
      ];
    }

    return sessions.map((session, index) => {
      const startTime = this.formatTime(session.startTime);
      const endTime = session.endTime ? this.formatTime(session.endTime) : 'ongoing';
      const label = `Session ${index + 1}: ${startTime} - ${endTime}`;

      let description = '';
      if (session.summary) {
        description = this.truncate(session.summary.summary, 40);
      } else {
        description = `${session.events.length} events`;
      }

      return new TimelineItem(
        label,
        vscode.TreeItemCollapsibleState.Collapsed,
        'session-summary',
        description,
        undefined,
        session
      );
    });
  }

  private getSessionDetails(session: Session): TimelineItem[] {
    const items: TimelineItem[] = [];

    // Summary
    if (session.summary) {
      items.push(
        new TimelineItem(
          session.summary.summary,
          vscode.TreeItemCollapsibleState.None,
          'summary-text'
        )
      );

      // Tasks completed
      if (session.summary.tasksCompleted.length > 0) {
        items.push(
          new TimelineItem(
            `Tasks: ${session.summary.tasksCompleted.length} completed`,
            vscode.TreeItemCollapsibleState.None,
            'tasks-count'
          )
        );
      }

      // Issues resolved
      if (session.summary.issuesResolved.length > 0) {
        items.push(
          new TimelineItem(
            `Issues: ${session.summary.issuesResolved.length} resolved`,
            vscode.TreeItemCollapsibleState.None,
            'issues-count'
          )
        );
      }

      // Files modified
      if (session.summary.filesModified.length > 0) {
        items.push(
          new TimelineItem(
            `Files: ${session.summary.filesModified.length} modified`,
            vscode.TreeItemCollapsibleState.None,
            'files-count'
          )
        );
      }
    } else {
      items.push(
        new TimelineItem(
          `${session.events.length} events captured`,
          vscode.TreeItemCollapsibleState.None,
          'events-count'
        )
      );
    }

    return items;
  }

  private formatDayLabel(date: Date, daysAgo: number): string {
    if (daysAgo === 0) {
      return 'Today';
    }
    if (daysAgo === 1) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  getDailyLog(date: Date): DailyLog {
    const sessions = this.db.getSessionsByDate(date);

    let totalTasks = 0;
    let completedTasks = 0;
    let issuesEncountered = 0;
    let issuesResolved = 0;

    for (const session of sessions) {
      totalTasks += session.tasks.length;
      completedTasks += session.tasks.filter((t) => t.status === 'completed').length;
      issuesEncountered += session.issues.length;
      issuesResolved += session.issues.filter((i) => i.resolved).length;
    }

    return {
      date: date.toISOString().split('T')[0],
      sessions,
      totalTasks,
      completedTasks,
      issuesEncountered,
      issuesResolved,
    };
  }
}

export class TimelineItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    description?: string,
    public readonly date?: Date,
    public readonly session?: Session
  ) {
    super(label, collapsibleState);

    this.description = description;
    this.tooltip = description ? `${label}: ${description}` : label;

    // Set icons based on context
    switch (contextValue) {
      case 'day':
        this.iconPath = new vscode.ThemeIcon('calendar');
        break;
      case 'session-summary':
        this.iconPath = new vscode.ThemeIcon('history');
        break;
      case 'summary-text':
        this.iconPath = new vscode.ThemeIcon('note');
        break;
      case 'tasks-count':
        this.iconPath = new vscode.ThemeIcon('tasklist');
        break;
      case 'issues-count':
        this.iconPath = new vscode.ThemeIcon('issues');
        break;
      case 'files-count':
        this.iconPath = new vscode.ThemeIcon('files');
        break;
      case 'events-count':
        this.iconPath = new vscode.ThemeIcon('pulse');
        break;
      case 'empty':
        this.iconPath = new vscode.ThemeIcon('circle-slash');
        break;
    }
  }
}
