import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

export interface LogCloseConfig {
  captureTerminal: boolean;
  captureFileChanges: boolean;
  captureClipboard: boolean;
  sessionTimeoutMinutes: number;
  gitRepo: string;
  gitSyncIntervalMinutes: number;
  markdownOutputPath: string;
  clipboardPollIntervalSeconds: number;
}

export function getConfig(): LogCloseConfig {
  const config = vscode.workspace.getConfiguration('logClose');

  return {
    captureTerminal: config.get<boolean>('captureTerminal', true),
    captureFileChanges: config.get<boolean>('captureFileChanges', true),
    captureClipboard: config.get<boolean>('captureClipboard', true),
    sessionTimeoutMinutes: config.get<number>('sessionTimeoutMinutes', 10),
    gitRepo: config.get<string>('gitRepo', ''),
    gitSyncIntervalMinutes: config.get<number>('gitSyncIntervalMinutes', 30),
    markdownOutputPath: expandPath(config.get<string>('markdownOutputPath', '~/session-logs')),
    clipboardPollIntervalSeconds: config.get<number>('clipboardPollIntervalSeconds', 2),
  };
}

export function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return inputPath;
}

export function getStoragePath(context: vscode.ExtensionContext): string {
  return context.globalStorageUri.fsPath;
}
