import * as vscode from 'vscode';
import { Session, Task } from '../session/types';
import { SessionManager } from '../session/sessionManager';

export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SessionTreeItem | undefined | null | void> =
    new vscode.EventEmitter<SessionTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SessionTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private sessionManager: SessionManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SessionTreeItem): Thenable<SessionTreeItem[]> {
    if (!element) {
      // Root level - show today's sessions
      return Promise.resolve(this.getTodaySessions());
    }

    if (element.contextValue === 'session') {
      // Session level - show events summary
      return Promise.resolve(this.getSessionChildren(element.session!));
    }

    return Promise.resolve([]);
  }

  private getTodaySessions(): SessionTreeItem[] {
    const sessions = this.sessionManager.getTodaySessions();
    const currentSession = this.sessionManager.getCurrentSession();

    const items: SessionTreeItem[] = [];

    // Add current session if active
    if (currentSession?.isActive) {
      items.push(
        new SessionTreeItem(
          `Active Session (${this.formatTime(currentSession.startTime)})`,
          vscode.TreeItemCollapsibleState.Expanded,
          'session-active',
          currentSession
        )
      );
    }

    // Add completed sessions
    for (const session of sessions) {
      if (!session.isActive) {
        const label = this.formatSessionLabel(session);
        items.push(
          new SessionTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            'session',
            session
          )
        );
      }
    }

    if (items.length === 0) {
      items.push(
        new SessionTreeItem(
          'No sessions today',
          vscode.TreeItemCollapsibleState.None,
          'empty'
        )
      );
    }

    return items;
  }

  private getSessionChildren(session: Session): SessionTreeItem[] {
    const items: SessionTreeItem[] = [];

    // Summary
    if (session.summary) {
      items.push(
        new SessionTreeItem(
          `Summary: ${this.truncate(session.summary.summary, 50)}`,
          vscode.TreeItemCollapsibleState.None,
          'summary'
        )
      );
    }

    // Event count
    items.push(
      new SessionTreeItem(
        `${session.events.length} events captured`,
        vscode.TreeItemCollapsibleState.None,
        'info'
      )
    );

    // Tasks
    if (session.tasks.length > 0) {
      items.push(
        new SessionTreeItem(
          `${session.tasks.length} tasks`,
          vscode.TreeItemCollapsibleState.None,
          'tasks'
        )
      );
    }

    // Issues
    const resolvedIssues = session.issues.filter((i) => i.resolved).length;
    if (session.issues.length > 0) {
      items.push(
        new SessionTreeItem(
          `${resolvedIssues}/${session.issues.length} issues resolved`,
          vscode.TreeItemCollapsibleState.None,
          'issues'
        )
      );
    }

    return items;
  }

  private formatSessionLabel(session: Session): string {
    const start = this.formatTime(session.startTime);
    const end = session.endTime ? this.formatTime(session.endTime) : 'ongoing';
    return `${start} - ${end}`;
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
}

export class TasksTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> =
    new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private sessionManager: SessionManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TaskTreeItem[]> {
    const sessions = this.sessionManager.getTodaySessions();
    const currentSession = this.sessionManager.getCurrentSession();

    const allTasks: Task[] = [];

    // Get tasks from all today's sessions
    for (const session of sessions) {
      allTasks.push(...session.tasks);
    }

    // Add current session tasks
    if (currentSession?.isActive) {
      allTasks.push(...currentSession.tasks);
    }

    if (allTasks.length === 0) {
      return Promise.resolve([
        new TaskTreeItem('No tasks today', vscode.TreeItemCollapsibleState.None, 'empty'),
      ]);
    }

    return Promise.resolve(
      allTasks.map(
        (task) =>
          new TaskTreeItem(
            task.description,
            vscode.TreeItemCollapsibleState.None,
            task.status,
            task
          )
      )
    );
  }
}

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly session?: Session
  ) {
    super(label, collapsibleState);

    this.tooltip = label;

    // Set icons based on context
    switch (contextValue) {
      case 'session-active':
        this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.green'));
        break;
      case 'session':
        this.iconPath = new vscode.ThemeIcon('history');
        break;
      case 'summary':
        this.iconPath = new vscode.ThemeIcon('note');
        break;
      case 'tasks':
        this.iconPath = new vscode.ThemeIcon('tasklist');
        break;
      case 'issues':
        this.iconPath = new vscode.ThemeIcon('issues');
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
      case 'empty':
        this.iconPath = new vscode.ThemeIcon('circle-slash');
        break;
    }
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly status: string,
    public readonly task?: Task
  ) {
    super(label, collapsibleState);

    this.tooltip = label;

    // Set icons and colors based on status
    switch (status) {
      case 'completed':
        this.iconPath = new vscode.ThemeIcon(
          'check',
          new vscode.ThemeColor('charts.green')
        );
        break;
      case 'in_progress':
        this.iconPath = new vscode.ThemeIcon(
          'sync~spin',
          new vscode.ThemeColor('charts.yellow')
        );
        break;
      case 'pending':
        this.iconPath = new vscode.ThemeIcon('circle-outline');
        break;
      case 'empty':
        this.iconPath = new vscode.ThemeIcon('circle-slash');
        break;
    }
  }
}
