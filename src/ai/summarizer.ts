import { ClaudeClient } from './claudeClient';
import { Session, SessionSummary, SessionEvent } from '../session/types';

export class Summarizer {
  private claudeClient: ClaudeClient;

  constructor(claudeClient: ClaudeClient) {
    this.claudeClient = claudeClient;
  }

  async summarizeSession(session: Session): Promise<SessionSummary> {
    const eventsSummary = this.prepareEventsForSummary(session.events);

    const systemPrompt = `You are an AI assistant that summarizes coding sessions.
Analyze the session data and provide a structured summary including:
- A brief overall summary (2-3 sentences)
- Tasks that were completed
- Issues encountered and how they were resolved
- Key conversations or decisions made
- Files that were modified

Respond in JSON format with the following structure:
{
  "summary": "Brief overall summary",
  "tasksCompleted": ["task1", "task2"],
  "issuesResolved": [{"description": "issue", "resolution": "how it was fixed"}],
  "keyConversations": ["Notable exchange or decision"],
  "filesModified": ["file1.ts", "file2.ts"]
}`;

    const userPrompt = `Please summarize this coding session:

Session Duration: ${this.formatDuration(session.startTime, session.endTime)}
Workspace: ${session.workspacePath || 'Unknown'}

Events:
${eventsSummary}`;

    try {
      const response = await this.claudeClient.complete(systemPrompt, userPrompt);
      const parsed = this.parseJsonResponse(response);

      return {
        summary: parsed.summary || 'No summary available',
        tasksCompleted: parsed.tasksCompleted || [],
        issuesResolved: (parsed.issuesResolved || []).map((issue: { description: string; resolution?: string }) => ({
          id: `issue-${Date.now()}`,
          description: issue.description,
          resolution: issue.resolution,
          resolved: !!issue.resolution,
          sessionId: session.id,
          createdAt: new Date(),
          resolvedAt: issue.resolution ? new Date() : undefined,
        })),
        keyConversations: parsed.keyConversations || [],
        filesModified: parsed.filesModified || [],
      };
    } catch (error) {
      console.error('Summarization error:', error);
      return this.createFallbackSummary(session);
    }
  }

  private prepareEventsForSummary(events: SessionEvent[]): string {
    // Limit events to avoid token limits
    const maxEvents = 50;
    const selectedEvents = events.slice(-maxEvents);

    return selectedEvents
      .map((event) => {
        const timestamp = event.timestamp.toLocaleTimeString();
        switch (event.type) {
          case 'terminal':
            return `[${timestamp}] Terminal: ${this.truncate(event.content, 200)}`;
          case 'file':
            const fileEvent = event as SessionEvent & { filePath: string; changeType: string };
            return `[${timestamp}] File ${fileEvent.changeType}: ${fileEvent.filePath}`;
          case 'clipboard':
            return `[${timestamp}] Clipboard: ${this.truncate(event.content, 100)}`;
          default:
            return `[${timestamp}] ${event.type}: ${this.truncate(event.content, 100)}`;
        }
      })
      .join('\n');
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
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

  private parseJsonResponse(response: string): {
    summary?: string;
    tasksCompleted?: string[];
    issuesResolved?: Array<{ description: string; resolution?: string }>;
    keyConversations?: string[];
    filesModified?: string[];
  } {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Failed to parse JSON response');
      }
    }
    return {};
  }

  private createFallbackSummary(session: Session): SessionSummary {
    const fileEvents = session.events.filter((e) => e.type === 'file') as (SessionEvent & { filePath: string })[];
    const uniqueFiles = [...new Set(fileEvents.map((e) => e.filePath))];

    return {
      summary: `Session with ${session.events.length} events over ${this.formatDuration(session.startTime, session.endTime)}`,
      tasksCompleted: [],
      issuesResolved: [],
      keyConversations: [],
      filesModified: uniqueFiles.slice(0, 10),
    };
  }
}
