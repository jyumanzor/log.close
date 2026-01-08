import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';

export class ClaudeClient {
  private client: Anthropic | null = null;
  private secretStorage: vscode.SecretStorage;

  constructor(secretStorage: vscode.SecretStorage) {
    this.secretStorage = secretStorage;
  }

  async initialize(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return false;
    }

    this.client = new Anthropic({ apiKey });
    return true;
  }

  private async getApiKey(): Promise<string | undefined> {
    // First check secret storage
    let apiKey = await this.secretStorage.get('logClose.anthropicApiKey');

    if (!apiKey) {
      // Check environment variable
      apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      // Prompt user to enter API key
      apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Anthropic API key for AI-powered summaries',
        password: true,
        ignoreFocusOut: true,
      });

      if (apiKey) {
        await this.secretStorage.store('logClose.anthropicApiKey', apiKey);
      }
    }

    return apiKey;
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.secretStorage.store('logClose.anthropicApiKey', apiKey);
    this.client = new Anthropic({ apiKey });
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!this.client) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Claude API not initialized. Please set your API key.');
      }
    }

    try {
      const message = await this.client!.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === 'text');
      return textContent ? textContent.text : '';
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.client !== null;
  }
}
