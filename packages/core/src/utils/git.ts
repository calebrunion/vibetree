import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Worktree, GitStatus, GitCommit, CommitFile, WorktreeAddResult, WorktreeRemoveResult, ProjectValidationResult } from '../types';
import { parseWorktrees, parseGitStatus } from './git-parser';

/**
 * Expand path to absolute path
 * - ~ expands to home directory
 * - Relative paths (not starting with / or ~) are relative to home directory
 * @param filePath - Path that may be relative or contain ~
 * @returns Expanded absolute path
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === '~') {
    return os.homedir();
  }
  if (!filePath.startsWith('/')) {
    return path.join(os.homedir(), filePath);
  }
  return filePath;
}

/**
 * Execute a git command and return the output
 * @param args - Git command arguments
 * @param cwd - Working directory for the command
 * @returns Promise with command output
 */
export function executeGitCommand(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Try 'git' first, fallback to absolute path if not found
    const gitCommand = process.env.PATH?.includes('/usr/bin') ? 'git' : '/usr/bin/git';
    const child = spawn(gitCommand, args, { 
      cwd,
      env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin' }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Git command failed: git ${args.join(' ')}`));
      }
    });
  });
}

/**
 * List all git worktrees for a project
 * @param projectPath - Path to the main git repository
 * @returns Array of worktree information
 */
export async function listWorktrees(projectPath: string): Promise<Worktree[]> {
  const expandedPath = expandPath(projectPath);
  const output = await executeGitCommand(['worktree', 'list', '--porcelain'], expandedPath);
  return parseWorktrees(output);
}

/**
 * Get git status for a worktree
 * @param worktreePath - Path to the git worktree
 * @returns Array of file status information
 */
export async function getGitStatus(worktreePath: string): Promise<GitStatus[]> {
  const expandedPath = expandPath(worktreePath);
  const output = await executeGitCommand(['status', '--porcelain=v1'], expandedPath);
  return parseGitStatus(output);
}

/**
 * Get git diff for unstaged changes
 * @param worktreePath - Path to the git worktree
 * @param filePath - Optional specific file to diff
 * @returns Diff output as string
 */
export async function getGitDiff(worktreePath: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath);
  const args = ['diff'];
  if (filePath) {
    args.push('--', filePath);
  }
  return executeGitCommand(args, expandedPath);
}

/**
 * Get git diff for staged changes
 * @param worktreePath - Path to the git worktree
 * @param filePath - Optional specific file to diff
 * @returns Staged diff output as string
 */
export async function getGitDiffStaged(worktreePath: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath);
  const args = ['diff', '--staged'];
  if (filePath) {
    args.push('--', filePath);
  }
  return executeGitCommand(args, expandedPath);
}

/**
 * Get git commit log
 * @param worktreePath - Path to the git worktree
 * @param limit - Maximum number of commits to return (default 20)
 * @returns Array of commit information
 */
export async function getGitLog(worktreePath: string, limit: number = 20, unpushedOnly: boolean = true): Promise<GitCommit[]> {
  const expandedPath = expandPath(worktreePath);
  const separator = '|||';
  const format = `%H${separator}%h${separator}%s${separator}%an${separator}%ai${separator}%ar`;

  let revRange = '';
  if (unpushedOnly) {
    try {
      const trackingBranch = await executeGitCommand(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], expandedPath);
      if (trackingBranch.trim()) {
        revRange = `${trackingBranch.trim()}..HEAD`;
      }
    } catch {
      // No upstream tracking branch, show all commits
    }
  }

  const args = ['log', `--format=${format}`, `-n`, `${limit}`];
  if (revRange) {
    args.push(revRange);
  }

  const output = await executeGitCommand(args, expandedPath);

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  return lines.map(line => {
    const [hash, shortHash, subject, author, date, relativeDate] = line.split(separator);
    return { hash, shortHash, subject, author, date, relativeDate };
  });
}

/**
 * Get files changed in a specific commit
 * @param worktreePath - Path to the git worktree
 * @param commitHash - The commit hash to get files for
 * @returns Array of files changed in the commit
 */
export async function getCommitFiles(worktreePath: string, commitHash: string): Promise<CommitFile[]> {
  const expandedPath = expandPath(worktreePath);
  const output = await executeGitCommand(
    ['show', '--name-status', '--format=', commitHash],
    expandedPath
  );

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  return lines.map(line => {
    const [status, ...pathParts] = line.split('\t');
    return {
      path: pathParts.join('\t'),
      status: status[0] as CommitFile['status']
    };
  });
}

/**
 * Get diff for a specific commit
 * @param worktreePath - Path to the git worktree
 * @param commitHash - The commit hash to get diff for
 * @param filePath - Optional specific file to diff
 * @returns Diff output as string
 */
export async function getCommitDiff(worktreePath: string, commitHash: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath);
  const args = ['show', '--format=', commitHash];
  if (filePath) {
    args.push('--', filePath);
  }
  return executeGitCommand(args, expandedPath);
}

/**
 * Create a new git worktree with a new branch
 * @param projectPath - Path to the main git repository
 * @param branchName - Name for the new branch
 * @returns Result with new worktree path and branch name
 */
export async function addWorktree(projectPath: string, branchName: string): Promise<WorktreeAddResult> {
  const expandedPath = expandPath(projectPath);
  const treesDir = path.join(expandedPath, '.trees');
  const worktreePath = path.join(treesDir, branchName);

  if (!fs.existsSync(treesDir)) {
    fs.mkdirSync(treesDir, { recursive: true });
  }

  await executeGitCommand(['worktree', 'add', '-b', branchName, worktreePath], expandedPath);

  return { path: worktreePath, branch: branchName };
}

/**
 * Remove a git worktree (branch is preserved)
 * @param projectPath - Path to the main git repository
 * @param worktreePath - Path to the worktree to remove
 * @param _branchName - Unused, kept for API compatibility
 * @returns Result indicating success and any warnings
 */
export async function removeWorktree(
  projectPath: string,
  worktreePath: string,
  _branchName: string
): Promise<WorktreeRemoveResult> {
  const expandedProjectPath = expandPath(projectPath);
  const expandedWorktreePath = expandPath(worktreePath);
  try {
    // Remove the worktree directory only, preserve the branch
    await executeGitCommand(['worktree', 'remove', expandedWorktreePath, '--force'], expandedProjectPath);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to remove worktree: ${error}`);
  }
}

/**
 * Check if a path is a git repository
 * @param path - Path to check
 * @returns True if path is a git repository
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  const expandedPath = expandPath(repoPath);
  try {
    await executeGitCommand(['rev-parse', '--git-dir'], expandedPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name
 * @param worktreePath - Path to the git worktree
 * @returns Current branch name
 */
export async function getCurrentBranch(worktreePath: string): Promise<string> {
  const expandedPath = expandPath(worktreePath);
  const output = await executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], expandedPath);
  return output.trim();
}

/**
 * Validate multiple project paths
 * @param projectPaths - Array of project paths to validate
 * @returns Array of validation results
 */
export async function validateProjects(projectPaths: string[]): Promise<ProjectValidationResult[]> {
  const results = await Promise.allSettled(
    projectPaths.map(async (inputPath) => {
      const projectPath = expandPath(inputPath);
      try {
        // Check if directory exists by trying to access it
        const isGitRepo = await isGitRepository(projectPath);
        if (!isGitRepo) {
          return {
            path: projectPath,
            valid: false,
            error: 'Not a git repository'
          } as ProjectValidationResult;
        }

        // Get repository name from path
        const name = path.basename(projectPath);

        return {
          path: projectPath,
          name,
          valid: true
        } as ProjectValidationResult;
      } catch (error) {
        return {
          path: projectPath,
          valid: false,
          error: `Directory not accessible: ${(error as Error).message}`
        } as ProjectValidationResult;
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        path: projectPaths[index],
        valid: false,
        error: `Validation failed: ${result.reason}`
      };
    }
  });
}