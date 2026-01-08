import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';
import { getConfig } from '../utils/config';

export class GitSyncer {
  private git: SimpleGit | null = null;
  private repoPath: string = '';
  private syncInterval?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  async initialize(): Promise<boolean> {
    const config = getConfig();

    if (!config.gitRepo) {
      console.log('Git sync disabled: no repository configured');
      return false;
    }

    // The repo path is the markdown output path
    this.repoPath = config.markdownOutputPath;

    // Ensure directory exists
    if (!fs.existsSync(this.repoPath)) {
      fs.mkdirSync(this.repoPath, { recursive: true });
    }

    this.git = simpleGit(this.repoPath);

    try {
      // Check if it's already a git repo
      const isRepo = await this.git.checkIsRepo();

      if (!isRepo) {
        // Initialize new repo
        await this.git.init();
        await this.git.addRemote('origin', this.buildRemoteUrl(config.gitRepo));
        vscode.window.showInformationMessage('Log Close: Initialized git repository');
      }

      this.isInitialized = true;
      this.startAutoSync();
      return true;
    } catch (error) {
      console.error('Git initialization error:', error);
      vscode.window.showErrorMessage(`Log Close: Git initialization failed - ${error}`);
      return false;
    }
  }

  private buildRemoteUrl(repo: string): string {
    // If it's already a full URL, use it
    if (repo.startsWith('https://') || repo.startsWith('git@')) {
      return repo;
    }
    // Otherwise assume it's a GitHub repo in format owner/repo
    return `https://github.com/${repo}.git`;
  }

  private startAutoSync(): void {
    const config = getConfig();
    const intervalMs = config.gitSyncIntervalMinutes * 60 * 1000;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.sync();
    }, intervalMs);
  }

  async sync(): Promise<boolean> {
    if (!this.git || !this.isInitialized) {
      return false;
    }

    try {
      // Check for changes
      const status = await this.git.status();

      if (status.files.length === 0) {
        console.log('Git sync: No changes to commit');
        return true;
      }

      // Add all files
      await this.git.add('.');

      // Commit with timestamp
      const commitMessage = `Session log update: ${new Date().toISOString()}`;
      await this.git.commit(commitMessage);

      // Try to pull first (to handle any remote changes)
      try {
        await this.git.pull('origin', 'main', { '--rebase': 'true' });
      } catch (pullError) {
        // If pull fails (e.g., no remote branch yet), that's okay
        console.log('Git pull skipped:', pullError);
      }

      // Push
      try {
        await this.git.push('origin', 'main');
        vscode.window.showInformationMessage('Log Close: Synced to GitHub');
        return true;
      } catch (pushError) {
        // If push to main fails, try creating the branch
        try {
          await this.git.push('origin', 'main', { '-u': null });
          return true;
        } catch {
          console.error('Git push error:', pushError);
          vscode.window.showWarningMessage(
            'Log Close: Could not push to GitHub. Check your repository settings.'
          );
          return false;
        }
      }
    } catch (error) {
      console.error('Git sync error:', error);
      return false;
    }
  }

  async forceSync(): Promise<boolean> {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Log Close: Syncing to GitHub...',
        cancellable: false,
      },
      async () => {
        return await this.sync();
      }
    );
    return true;
  }

  async clone(repoUrl: string, targetPath: string): Promise<boolean> {
    try {
      await simpleGit().clone(repoUrl, targetPath);
      return true;
    } catch (error) {
      console.error('Git clone error:', error);
      return false;
    }
  }

  getRepoPath(): string {
    return this.repoPath;
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    // Do a final sync on dispose
    this.sync();
  }
}
