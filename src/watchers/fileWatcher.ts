import * as vscode from 'vscode';
import { FileEvent, generateId } from '../session/types';

export class FileWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private onChangeCallbacks: ((event: FileEvent) => void)[] = [];
  private recentChanges: Map<string, { content: string; timestamp: number }> = new Map();
  private readonly DEBOUNCE_MS = 1000;

  constructor() {
    this.setupWatchers();
  }

  private setupWatchers(): void {
    // Watch for file saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.handleFileChange(document.uri.fsPath, 'save', document.getText());
      })
    );

    // Watch for file changes (edits)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0) {
          const changes = e.contentChanges
            .map((c) => c.text)
            .filter((t) => t.length > 0)
            .join('\n');

          if (changes.length > 0) {
            this.handleFileChange(e.document.uri.fsPath, 'modify', changes);
          }
        }
      })
    );

    // Watch for file creation
    this.disposables.push(
      vscode.workspace.onDidCreateFiles((e) => {
        e.files.forEach((uri) => {
          this.handleFileChange(uri.fsPath, 'create', '');
        });
      })
    );

    // Watch for file deletion
    this.disposables.push(
      vscode.workspace.onDidDeleteFiles((e) => {
        e.files.forEach((uri) => {
          this.handleFileChange(uri.fsPath, 'delete', '');
        });
      })
    );
  }

  private handleFileChange(
    filePath: string,
    changeType: FileEvent['changeType'],
    content: string
  ): void {
    // Skip non-file URIs
    if (!filePath.startsWith('/')) {
      return;
    }

    // Skip certain files
    const ignoredPatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      'package-lock.json',
      'yarn.lock',
      '.log-close', // Our own storage
    ];

    if (ignoredPatterns.some((pattern) => filePath.includes(pattern))) {
      return;
    }

    // Debounce rapid changes to same file
    const key = `${filePath}:${changeType}`;
    const now = Date.now();
    const recent = this.recentChanges.get(key);

    if (recent && now - recent.timestamp < this.DEBOUNCE_MS) {
      // Update content but don't emit new event
      this.recentChanges.set(key, {
        content: recent.content + '\n' + content,
        timestamp: now,
      });
      return;
    }

    this.recentChanges.set(key, { content, timestamp: now });

    // Clean up old entries
    this.cleanupRecentChanges();

    const event: FileEvent = {
      id: generateId(),
      timestamp: new Date(),
      type: 'file',
      content: this.truncateContent(content),
      filePath: filePath,
      changeType: changeType,
      metadata: {
        fileExtension: this.getFileExtension(filePath),
        relativePath: this.getRelativePath(filePath),
      },
    };

    this.onChangeCallbacks.forEach((cb) => cb(event));
  }

  private truncateContent(content: string, maxLength: number = 1000): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '\n... (truncated)';
  }

  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private getRelativePath(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return filePath;
    }

    for (const folder of workspaceFolders) {
      if (filePath.startsWith(folder.uri.fsPath)) {
        return filePath.replace(folder.uri.fsPath + '/', '');
      }
    }

    return filePath;
  }

  private cleanupRecentChanges(): void {
    const now = Date.now();
    const cutoff = now - this.DEBOUNCE_MS * 2;

    for (const [key, value] of this.recentChanges.entries()) {
      if (value.timestamp < cutoff) {
        this.recentChanges.delete(key);
      }
    }
  }

  onChange(callback: (event: FileEvent) => void): void {
    this.onChangeCallbacks.push(callback);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
