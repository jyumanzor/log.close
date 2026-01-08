import * as vscode from 'vscode';
import { TerminalEvent, generateId } from '../session/types';

// Strip ANSI escape codes from terminal output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return str.replace(ansiRegex, '');
}

export class TerminalWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private onDataCallbacks: ((event: TerminalEvent) => void)[] = [];
  private terminalBuffers: Map<string, string> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BUFFER_FLUSH_DELAY = 500; // ms

  constructor() {
    this.setupWatchers();
  }

  private setupWatchers(): void {
    // Terminal data capture is disabled for now (requires proposed API)
    // Will be enabled when the API becomes stable
    console.log('Terminal capture: using fallback mode (shell integration)');

    // Watch for terminal creation
    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => {
        this.terminalBuffers.set(terminal.name, '');
      })
    );

    // Watch for terminal close
    this.disposables.push(
      vscode.window.onDidCloseTerminal((terminal) => {
        this.flushBuffer(terminal.name);
        this.terminalBuffers.delete(terminal.name);
        const timer = this.flushTimers.get(terminal.name);
        if (timer) {
          clearTimeout(timer);
          this.flushTimers.delete(terminal.name);
        }
      })
    );

    // Initialize existing terminals
    vscode.window.terminals.forEach((terminal) => {
      this.terminalBuffers.set(terminal.name, '');
    });
  }

  private handleTerminalData(terminal: vscode.Terminal, data: string): void {
    const terminalName = terminal.name;

    // Accumulate data in buffer
    const currentBuffer = this.terminalBuffers.get(terminalName) || '';
    this.terminalBuffers.set(terminalName, currentBuffer + data);

    // Debounce flush to batch rapid output
    const existingTimer = this.flushTimers.get(terminalName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.flushBuffer(terminalName);
    }, this.BUFFER_FLUSH_DELAY);

    this.flushTimers.set(terminalName, timer);
  }

  private flushBuffer(terminalName: string): void {
    const buffer = this.terminalBuffers.get(terminalName);
    if (!buffer || buffer.trim().length === 0) {
      return;
    }

    const cleanContent = stripAnsi(buffer).trim();
    if (cleanContent.length === 0) {
      this.terminalBuffers.set(terminalName, '');
      return;
    }

    const event: TerminalEvent = {
      id: generateId(),
      timestamp: new Date(),
      type: 'terminal',
      content: cleanContent,
      terminalName: terminalName,
      metadata: {
        isClaudeCode: this.isClaudeCodeTerminal(terminalName, cleanContent),
      },
    };

    this.terminalBuffers.set(terminalName, '');
    this.onDataCallbacks.forEach((cb) => cb(event));
  }

  private isClaudeCodeTerminal(name: string, content: string): boolean {
    // Heuristics to detect Claude Code terminals
    const claudeIndicators = [
      'claude',
      'anthropic',
      '> ',  // Claude Code prompt
      'Human:',
      'Assistant:',
    ];

    const nameLower = name.toLowerCase();
    const contentLower = content.toLowerCase();

    return claudeIndicators.some(
      (indicator) =>
        nameLower.includes(indicator.toLowerCase()) ||
        contentLower.includes(indicator.toLowerCase())
    );
  }

  onData(callback: (event: TerminalEvent) => void): void {
    this.onDataCallbacks.push(callback);
  }

  dispose(): void {
    this.flushTimers.forEach((timer) => clearTimeout(timer));
    this.flushTimers.clear();
    this.disposables.forEach((d) => d.dispose());
  }
}
