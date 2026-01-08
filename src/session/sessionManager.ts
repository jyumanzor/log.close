import * as vscode from 'vscode';
import { Session, SessionEvent, Task, Issue, generateId } from './types';
import { EventBuffer } from './eventBuffer';
import { getConfig } from '../utils/config';

export class SessionManager {
  private currentSession: Session | null = null;
  private sessions: Session[] = [];
  private eventBuffer: EventBuffer;
  private lastActivityTime: Date = new Date();
  private sessionTimeoutTimer?: NodeJS.Timeout;
  private onSessionEndCallbacks: ((session: Session) => void)[] = [];
  private onEventCallbacks: ((event: SessionEvent) => void)[] = [];

  constructor() {
    this.eventBuffer = new EventBuffer(50);
    this.eventBuffer.onFlush((events) => {
      if (this.currentSession) {
        this.currentSession.events.push(...events);
      }
    });
  }

  startSession(): Session {
    if (this.currentSession?.isActive) {
      this.endSession();
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;

    this.currentSession = {
      id: generateId(),
      startTime: new Date(),
      workspacePath: workspaceFolders?.[0]?.uri.fsPath,
      events: [],
      tasks: [],
      issues: [],
      isActive: true,
    };

    this.lastActivityTime = new Date();
    this.resetSessionTimeout();

    vscode.window.showInformationMessage('Log Close: Session started');
    return this.currentSession;
  }

  endSession(): Session | null {
    if (!this.currentSession) {
      return null;
    }

    this.eventBuffer.flush();
    this.currentSession.endTime = new Date();
    this.currentSession.isActive = false;

    const endedSession = this.currentSession;
    this.sessions.push(endedSession);

    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
    }

    this.onSessionEndCallbacks.forEach((cb) => cb(endedSession));

    vscode.window.showInformationMessage('Log Close: Session ended');
    this.currentSession = null;

    return endedSession;
  }

  addEvent(event: SessionEvent): void {
    if (!this.currentSession) {
      this.startSession();
    }

    this.lastActivityTime = new Date();
    this.resetSessionTimeout();
    this.eventBuffer.push(event);
    this.onEventCallbacks.forEach((cb) => cb(event));
  }

  private resetSessionTimeout(): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
    }

    const config = getConfig();
    const timeoutMs = config.sessionTimeoutMinutes * 60 * 1000;

    this.sessionTimeoutTimer = setTimeout(() => {
      if (this.currentSession?.isActive) {
        vscode.window.showInformationMessage(
          'Log Close: Session ended due to inactivity'
        );
        this.endSession();
      }
    }, timeoutMs);
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getAllSessions(): Session[] {
    return [...this.sessions];
  }

  getTodaySessions(): Session[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.sessions.filter((s) => s.startTime >= today);
  }

  onSessionEnd(callback: (session: Session) => void): void {
    this.onSessionEndCallbacks.push(callback);
  }

  onEvent(callback: (event: SessionEvent) => void): void {
    this.onEventCallbacks.push(callback);
  }

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'sessionId'>): Task | null {
    if (!this.currentSession) {
      return null;
    }

    const newTask: Task = {
      ...task,
      id: generateId(),
      createdAt: new Date(),
      sessionId: this.currentSession.id,
    };

    this.currentSession.tasks.push(newTask);
    return newTask;
  }

  addIssue(issue: Omit<Issue, 'id' | 'createdAt' | 'sessionId'>): Issue | null {
    if (!this.currentSession) {
      return null;
    }

    const newIssue: Issue = {
      ...issue,
      id: generateId(),
      createdAt: new Date(),
      sessionId: this.currentSession.id,
    };

    this.currentSession.issues.push(newIssue);
    return newIssue;
  }

  updateSummary(sessionId: string, summary: Session['summary']): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.summary = summary;
    }
    if (this.currentSession?.id === sessionId) {
      this.currentSession.summary = summary;
    }
  }

  loadSessions(sessions: Session[]): void {
    this.sessions = sessions;
  }

  dispose(): void {
    if (this.sessionTimeoutTimer) {
      clearTimeout(this.sessionTimeoutTimer);
    }
    if (this.currentSession?.isActive) {
      this.endSession();
    }
  }
}
