import * as fs from 'fs';
import * as path from 'path';
import { Session, DailyLog, SessionEvent } from '../session/types';
import { getConfig } from '../utils/config';

export class MarkdownExporter {
  private outputPath: string;

  constructor() {
    this.outputPath = getConfig().markdownOutputPath;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  exportSession(session: Session): string {
    const dateStr = this.formatDate(session.startTime);
    const filePath = path.join(this.outputPath, `${dateStr}.md`);

    let content = '';

    // Check if file exists and read existing content
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    } else {
      content = `# Session Log: ${dateStr}\n\n`;
    }

    // Append this session
    content += this.formatSession(session);

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  exportDailyLog(dailyLog: DailyLog): string {
    const filePath = path.join(this.outputPath, `${dailyLog.date}.md`);

    let content = `# Session Log: ${dailyLog.date}\n\n`;
    content += `## Daily Summary\n`;
    content += `- **Sessions**: ${dailyLog.sessions.length}\n`;
    content += `- **Tasks**: ${dailyLog.completedTasks}/${dailyLog.totalTasks} completed\n`;
    content += `- **Issues**: ${dailyLog.issuesResolved}/${dailyLog.issuesEncountered} resolved\n\n`;
    content += `---\n\n`;

    for (let i = 0; i < dailyLog.sessions.length; i++) {
      content += this.formatSession(dailyLog.sessions[i], i + 1);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  private formatSession(session: Session, sessionNumber?: number): string {
    const startTime = this.formatTime(session.startTime);
    const endTime = session.endTime ? this.formatTime(session.endTime) : 'ongoing';
    const title = sessionNumber
      ? `## Session ${sessionNumber} (${startTime} - ${endTime})`
      : `## Session (${startTime} - ${endTime})`;

    let content = `${title}\n\n`;

    // Summary
    if (session.summary) {
      content += `**Summary**: ${session.summary.summary}\n\n`;

      // Tasks Completed
      if (session.summary.tasksCompleted.length > 0) {
        content += `### Tasks Completed\n`;
        for (const task of session.summary.tasksCompleted) {
          content += `- [x] ${task}\n`;
        }
        content += '\n';
      }

      // Issues & Resolutions
      if (session.summary.issuesResolved.length > 0) {
        content += `### Issues & Resolutions\n`;
        for (const issue of session.summary.issuesResolved) {
          content += `- **Issue**: ${issue.description}\n`;
          if (issue.resolution) {
            content += `  - **Resolution**: ${issue.resolution}\n`;
          }
        }
        content += '\n';
      }

      // Key Conversations
      if (session.summary.keyConversations.length > 0) {
        content += `### Key Conversations\n`;
        for (const convo of session.summary.keyConversations) {
          content += `> ${convo}\n\n`;
        }
      }

      // Files Modified
      if (session.summary.filesModified.length > 0) {
        content += `### Files Modified\n`;
        for (const file of session.summary.filesModified) {
          content += `- ${file}\n`;
        }
        content += '\n';
      }
    } else {
      // No summary, show basic stats
      content += `*Session with ${session.events.length} events*\n\n`;

      // Show tasks from session
      if (session.tasks.length > 0) {
        content += `### Tasks\n`;
        for (const task of session.tasks) {
          const checkbox = task.status === 'completed' ? '[x]' : '[ ]';
          content += `- ${checkbox} ${task.description}\n`;
        }
        content += '\n';
      }

      // Show issues from session
      if (session.issues.length > 0) {
        content += `### Issues\n`;
        for (const issue of session.issues) {
          const status = issue.resolved ? '(Resolved)' : '(Open)';
          content += `- ${issue.description} ${status}\n`;
          if (issue.resolution) {
            content += `  - ${issue.resolution}\n`;
          }
        }
        content += '\n';
      }

      // Show file changes
      const fileEvents = session.events.filter((e) => e.type === 'file') as (SessionEvent & { filePath: string })[];
      const uniqueFiles = [...new Set(fileEvents.map((e) => e.filePath))];
      if (uniqueFiles.length > 0) {
        content += `### Files Modified\n`;
        for (const file of uniqueFiles.slice(0, 20)) {
          content += `- ${file}\n`;
        }
        if (uniqueFiles.length > 20) {
          content += `- ... and ${uniqueFiles.length - 20} more\n`;
        }
        content += '\n';
      }
    }

    content += `---\n\n`;
    return content;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  getOutputPath(): string {
    return this.outputPath;
  }

  setOutputPath(newPath: string): void {
    this.outputPath = newPath;
    this.ensureDirectoryExists();
  }
}
