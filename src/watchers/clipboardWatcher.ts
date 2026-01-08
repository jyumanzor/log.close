import * as vscode from 'vscode';
import { ClipboardEvent, generateId } from '../session/types';
import { getConfig } from '../utils/config';

export class ClipboardWatcher implements vscode.Disposable {
  private pollInterval?: NodeJS.Timeout;
  private lastClipboardContent: string = '';
  private onChangeCallbacks: ((event: ClipboardEvent) => void)[] = [];
  private isDisposed: boolean = false;

  constructor() {
    this.startPolling();
  }

  private startPolling(): void {
    const config = getConfig();
    const intervalMs = config.clipboardPollIntervalSeconds * 1000;

    // Initial read to establish baseline
    this.readClipboard().then((content) => {
      this.lastClipboardContent = content;
    });

    this.pollInterval = setInterval(async () => {
      if (this.isDisposed) {
        return;
      }

      try {
        await this.checkClipboard();
      } catch (error) {
        // Silently ignore clipboard read errors
        console.error('Clipboard read error:', error);
      }
    }, intervalMs);
  }

  private async readClipboard(): Promise<string> {
    try {
      return await vscode.env.clipboard.readText();
    } catch {
      return '';
    }
  }

  private async checkClipboard(): Promise<void> {
    const currentContent = await this.readClipboard();

    // Skip if content hasn't changed
    if (currentContent === this.lastClipboardContent) {
      return;
    }

    // Skip empty clipboard
    if (!currentContent || currentContent.trim().length === 0) {
      this.lastClipboardContent = currentContent;
      return;
    }

    // Skip if content is too short (likely not code)
    if (currentContent.length < 10) {
      this.lastClipboardContent = currentContent;
      return;
    }

    // Detect if this looks like code
    const looksLikeCode = this.looksLikeCode(currentContent);

    const event: ClipboardEvent = {
      id: generateId(),
      timestamp: new Date(),
      type: 'clipboard',
      content: this.truncateContent(currentContent),
      contentPreview: this.createPreview(currentContent),
      metadata: {
        looksLikeCode,
        contentLength: currentContent.length,
        lineCount: currentContent.split('\n').length,
      },
    };

    this.lastClipboardContent = currentContent;
    this.onChangeCallbacks.forEach((cb) => cb(event));
  }

  private looksLikeCode(content: string): boolean {
    const codeIndicators = [
      /function\s+\w+/,        // function declarations
      /const\s+\w+\s*=/,       // const declarations
      /let\s+\w+\s*=/,         // let declarations
      /var\s+\w+\s*=/,         // var declarations
      /import\s+.*from/,       // import statements
      /export\s+(default\s+)?/, // export statements
      /class\s+\w+/,           // class declarations
      /if\s*\(.+\)\s*{/,       // if statements
      /for\s*\(.+\)\s*{/,      // for loops
      /=>\s*{/,                // arrow functions
      /\{\s*\n.*\n\s*\}/s,     // object literals
      /^\s*\/\/.*/m,           // single line comments
      /^\s*\/\*.*\*\//s,       // multi-line comments
      /def\s+\w+\s*\(/,        // Python functions
      /async\s+(function|def)/, // async functions
    ];

    return codeIndicators.some((pattern) => pattern.test(content));
  }

  private truncateContent(content: string, maxLength: number = 2000): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '\n... (truncated)';
  }

  private createPreview(content: string, maxLength: number = 100): string {
    const firstLine = content.split('\n')[0];
    if (firstLine.length <= maxLength) {
      return firstLine;
    }
    return firstLine.substring(0, maxLength) + '...';
  }

  onChange(callback: (event: ClipboardEvent) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
