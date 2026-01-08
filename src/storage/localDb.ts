import * as path from 'path';
import * as fs from 'fs';
import { Session, SessionEvent, Task, Issue } from '../session/types';

interface StorageData {
  sessions: Session[];
}

export class LocalDb {
  private dbPath: string;
  private data: StorageData;

  constructor(storagePath: string) {
    this.dbPath = path.join(storagePath, 'log-close-data.json');
    this.ensureDirectoryExists(storagePath);
    this.data = this.load();
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private load(): StorageData {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Revive dates
        if (parsed.sessions) {
          parsed.sessions = parsed.sessions.map((s: any) => this.reviveSession(s));
        }
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load storage:', error);
    }
    return { sessions: [] };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save storage:', error);
    }
  }

  private reviveSession(raw: any): Session {
    return {
      ...raw,
      startTime: new Date(raw.startTime),
      endTime: raw.endTime ? new Date(raw.endTime) : undefined,
      events: (raw.events || []).map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })),
      tasks: (raw.tasks || []).map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
      })),
      issues: (raw.issues || []).map((i: any) => ({
        ...i,
        createdAt: new Date(i.createdAt),
        resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : undefined,
      })),
    };
  }

  saveSession(session: Session): void {
    const index = this.data.sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      this.data.sessions[index] = session;
    } else {
      this.data.sessions.push(session);
    }
    this.save();
  }

  getSession(sessionId: string): Session | null {
    return this.data.sessions.find((s) => s.id === sessionId) || null;
  }

  getAllSessions(): Session[] {
    return [...this.data.sessions].sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  getSessionsByDate(date: Date): Session[] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.data.sessions
      .filter((s) => s.startTime >= startOfDay && s.startTime <= endOfDay)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  deleteSession(sessionId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.id !== sessionId);
    this.save();
  }

  close(): void {
    this.save();
  }
}
