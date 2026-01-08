export interface SessionEvent {
  id: string;
  timestamp: Date;
  type: 'terminal' | 'file' | 'clipboard';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface TerminalEvent extends SessionEvent {
  type: 'terminal';
  terminalName: string;
}

export interface FileEvent extends SessionEvent {
  type: 'file';
  filePath: string;
  changeType: 'create' | 'modify' | 'delete' | 'save';
}

export interface ClipboardEvent extends SessionEvent {
  type: 'clipboard';
  contentPreview: string;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date;
  completedAt?: Date;
  sessionId: string;
}

export interface Issue {
  id: string;
  description: string;
  resolution?: string;
  resolved: boolean;
  sessionId: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface SessionSummary {
  summary: string;
  tasksCompleted: string[];
  issuesResolved: Issue[];
  keyConversations: string[];
  filesModified: string[];
}

export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  workspacePath?: string;
  events: SessionEvent[];
  summary?: SessionSummary;
  tasks: Task[];
  issues: Issue[];
  isActive: boolean;
}

export interface DailyLog {
  date: string;
  sessions: Session[];
  totalTasks: number;
  completedTasks: number;
  issuesEncountered: number;
  issuesResolved: number;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
