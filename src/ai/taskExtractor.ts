import { ClaudeClient } from './claudeClient';
import { Session, Task, Issue, SessionEvent, generateId } from '../session/types';

interface ExtractedData {
  tasks: Array<{
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  issues: Array<{
    description: string;
    resolution?: string;
  }>;
}

export class TaskExtractor {
  private claudeClient: ClaudeClient;

  constructor(claudeClient: ClaudeClient) {
    this.claudeClient = claudeClient;
  }

  async extractFromSession(session: Session): Promise<{ tasks: Task[]; issues: Issue[] }> {
    const terminalEvents = session.events.filter(
      (e) => e.type === 'terminal' && (e.metadata?.isClaudeCode as boolean)
    );

    if (terminalEvents.length === 0) {
      return { tasks: [], issues: [] };
    }

    const conversationText = this.prepareConversation(terminalEvents);

    const systemPrompt = `You are an AI that extracts tasks and issues from coding conversations.
Analyze the conversation and identify:
1. Tasks that were mentioned, requested, or worked on
2. Issues/bugs/errors that were encountered and how they were resolved

Respond in JSON format:
{
  "tasks": [
    {"description": "Task description", "status": "completed|in_progress|pending"}
  ],
  "issues": [
    {"description": "Issue description", "resolution": "How it was resolved (if resolved)"}
  ]
}

Only include tasks and issues that are clearly identifiable from the conversation.
Mark a task as "completed" only if there's clear evidence it was finished.`;

    const userPrompt = `Extract tasks and issues from this coding session conversation:

${conversationText}`;

    try {
      const response = await this.claudeClient.complete(systemPrompt, userPrompt);
      const extracted = this.parseResponse(response);

      return {
        tasks: extracted.tasks.map((t) => ({
          id: generateId(),
          description: t.description,
          status: t.status,
          createdAt: new Date(),
          completedAt: t.status === 'completed' ? new Date() : undefined,
          sessionId: session.id,
        })),
        issues: extracted.issues.map((i) => ({
          id: generateId(),
          description: i.description,
          resolution: i.resolution,
          resolved: !!i.resolution,
          sessionId: session.id,
          createdAt: new Date(),
          resolvedAt: i.resolution ? new Date() : undefined,
        })),
      };
    } catch (error) {
      console.error('Task extraction error:', error);
      return { tasks: [], issues: [] };
    }
  }

  async extractFromConversation(conversation: string): Promise<ExtractedData> {
    const systemPrompt = `You are an AI that extracts tasks and issues from coding conversations.
Respond only in JSON format:
{
  "tasks": [{"description": "...", "status": "completed|in_progress|pending"}],
  "issues": [{"description": "...", "resolution": "..."}]
}`;

    try {
      const response = await this.claudeClient.complete(systemPrompt, conversation);
      return this.parseResponse(response);
    } catch {
      return { tasks: [], issues: [] };
    }
  }

  private prepareConversation(events: SessionEvent[]): string {
    // Combine terminal events into a readable conversation
    const maxLength = 8000; // Leave room for prompt
    let result = '';

    for (const event of events) {
      const entry = `[${event.timestamp.toLocaleTimeString()}]\n${event.content}\n\n`;
      if (result.length + entry.length > maxLength) {
        break;
      }
      result += entry;
    }

    return result;
  }

  private parseResponse(response: string): ExtractedData {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        };
      } catch {
        console.error('Failed to parse extraction response');
      }
    }
    return { tasks: [], issues: [] };
  }
}
