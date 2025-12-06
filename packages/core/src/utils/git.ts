import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import {
  Worktree,
  GitStatus,
  GitCommit,
  CommitFile,
  WorktreeAddResult,
  WorktreeRemoveResult,
  ProjectValidationResult,
} from '../types'
import { parseWorktrees, parseGitStatus } from './git-parser'

/**
 * Expand path to absolute path
 * - ~ expands to home directory
 * - Relative paths (not starting with / or ~) are relative to home directory
 * @param filePath - Path that may be relative or contain ~
 * @returns Expanded absolute path
 */
export function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }
  if (filePath === '~') {
    return os.homedir()
  }
  if (!filePath.startsWith('/')) {
    return path.join(os.homedir(), filePath)
  }
  return filePath
}

/**
 * Execute a git command and return the output
 * @param args - Git command arguments
 * @param cwd - Working directory for the command
 * @returns Promise with command output
 */
export function executeGitCommand(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(cwd)) {
      reject(new Error(`Directory does not exist: ${cwd}`))
      return
    }

    const defaultPath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
    const envPath = process.env.PATH || ''
    const fullPath = envPath ? `${defaultPath}:${envPath}` : defaultPath

    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, PATH: fullPath },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Git command failed: git ${args.join(' ')}`))
      }
    })
  })
}

/**
 * List all git worktrees for a project
 * @param projectPath - Path to the main git repository
 * @returns Array of worktree information
 */
export async function listWorktrees(projectPath: string): Promise<Worktree[]> {
  const expandedPath = expandPath(projectPath)
  const output = await executeGitCommand(['worktree', 'list', '--porcelain'], expandedPath)
  return parseWorktrees(output)
}

/**
 * Get git status for a worktree
 * @param worktreePath - Path to the git worktree
 * @returns Array of file status information
 */
export async function getGitStatus(worktreePath: string): Promise<GitStatus[]> {
  const expandedPath = expandPath(worktreePath)
  const output = await executeGitCommand(['status', '--porcelain=v1'], expandedPath)
  return parseGitStatus(output)
}

/**
 * Get git diff for unstaged changes
 * @param worktreePath - Path to the git worktree
 * @param filePath - Optional specific file to diff
 * @returns Diff output as string
 */
export async function getGitDiff(worktreePath: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const args = ['diff']
  if (filePath) {
    args.push('--', filePath)
  }
  return executeGitCommand(args, expandedPath)
}

/**
 * Get git diff for staged changes
 * @param worktreePath - Path to the git worktree
 * @param filePath - Optional specific file to diff
 * @returns Staged diff output as string
 */
export async function getGitDiffStaged(worktreePath: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const args = ['diff', '--staged']
  if (filePath) {
    args.push('--', filePath)
  }
  return executeGitCommand(args, expandedPath)
}

/**
 * Get diff for an untracked file (shows full file as additions)
 * @param worktreePath - Path to the git worktree
 * @param filePath - Path to the untracked file
 * @returns Diff output showing the file as new additions
 */
export async function getGitDiffUntracked(worktreePath: string, filePath: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const fullFilePath = path.join(expandedPath, filePath)

  if (!fs.existsSync(fullFilePath)) {
    return ''
  }

  const content = fs.readFileSync(fullFilePath, 'utf-8')
  const hasTrailingNewline = content.endsWith('\n')
  const lines = content.split('\n')

  if (hasTrailingNewline && lines[lines.length - 1] === '') {
    lines.pop()
  }

  const lineCount = lines.length

  const header = [
    `diff --git a/${filePath} b/${filePath}`,
    'new file mode 100644',
    'index 0000000..1234567',
    '--- /dev/null',
    `+++ b/${filePath}`,
    `@@ -0,0 +1,${lineCount} @@`,
  ].join('\n')

  const body = lines.map((line) => `+${line}`).join('\n')
  const noNewlineMarker = hasTrailingNewline ? '' : '\n\\ No newline at end of file'

  return `${header}\n${body}${noNewlineMarker}`
}

/**
 * Get git commit log
 * @param worktreePath - Path to the git worktree
 * @param limit - Maximum number of commits to return (default 20)
 * @returns Array of commit information
 */
export async function getGitLog(
  worktreePath: string,
  limit: number = 20,
  fromBranchBase: boolean = true
): Promise<GitCommit[]> {
  const expandedPath = expandPath(worktreePath)
  const separator = '|||'
  const format = `%H${separator}%h${separator}%s${separator}%an${separator}%ai${separator}%ar${separator}%P${separator}%D`

  let revRange = ''
  if (fromBranchBase) {
    try {
      revRange = 'origin/HEAD..HEAD'
    } catch {
      // Fallback to showing all commits
    }
  }

  const args = ['log', `--format=${format}`, `-n`, `${limit}`]
  if (revRange) {
    args.push(revRange)
  }

  const output = await executeGitCommand(args, expandedPath)

  const lines = output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
  return lines.map((line) => {
    const [hash, shortHash, subject, author, date, relativeDate, parentStr, refStr] = line.split(separator)
    const parents = parentStr ? parentStr.split(' ').filter((p) => p.length > 0) : []
    const refs = refStr ? refStr.split(', ').filter((r) => r.length > 0) : []
    return { hash, shortHash, subject, author, date, relativeDate, parents, refs }
  })
}

/**
 * Get the current git user name
 * @param worktreePath - Path to the git worktree
 * @returns Current git user name
 */
export async function getGitUserName(worktreePath: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const output = await executeGitCommand(['config', 'user.name'], expandedPath)
  return output.trim()
}

/**
 * Get git commit log for graph visualization (all branches)
 * @param worktreePath - Path to the git worktree
 * @param limit - Maximum number of commits to return (default 50)
 * @param authorFilter - Optional author name to filter commits by
 * @returns Array of commit information with parent hashes and refs
 */
export async function getGitLogGraph(
  worktreePath: string,
  limit: number = 50,
  authorFilter?: string
): Promise<GitCommit[]> {
  const expandedPath = expandPath(worktreePath)
  const separator = '|||'
  const format = `%H${separator}%h${separator}%s${separator}%an${separator}%ai${separator}%ar${separator}%P${separator}%D`

  const args = ['log', '--all', `--format=${format}`, `-n`, `${limit}`]

  if (authorFilter) {
    args.push(`--author=${authorFilter}`)
  }

  const output = await executeGitCommand(args, expandedPath)

  const lines = output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
  const commits = lines.map((line) => {
    const [hash, shortHash, subject, author, date, relativeDate, parentStr, refStr] = line.split(separator)
    const parents = parentStr ? parentStr.split(' ').filter((p) => p.length > 0) : []
    const refs = refStr ? refStr.split(', ').filter((r) => r.length > 0) : []
    return { hash, shortHash, subject, author, date, relativeDate, parents, refs }
  })

  // If filtering by author, also include origin/HEAD commit for context
  if (authorFilter && commits.length > 0) {
    try {
      const originHeadOutput = await executeGitCommand(['log', 'origin/HEAD', '-1', `--format=${format}`], expandedPath)
      const originHeadLine = originHeadOutput.trim()
      if (originHeadLine) {
        const [hash, shortHash, subject, author, date, relativeDate, parentStr, refStr] =
          originHeadLine.split(separator)
        const originHeadCommit = {
          hash,
          shortHash,
          subject,
          author,
          date,
          relativeDate,
          parents: parentStr ? parentStr.split(' ').filter((p) => p.length > 0) : [],
          refs: refStr ? refStr.split(', ').filter((r) => r.length > 0) : [],
        }
        // Only add if not already in the list
        if (!commits.some((c) => c.hash === originHeadCommit.hash)) {
          // Find the right position to insert based on date
          const originDate = new Date(originHeadCommit.date)
          let insertIndex = commits.findIndex((c) => new Date(c.date) < originDate)
          if (insertIndex === -1) {
            commits.push(originHeadCommit)
          } else {
            commits.splice(insertIndex, 0, originHeadCommit)
          }
        }
      }
    } catch {
      // origin/HEAD may not exist, ignore
    }
  }

  return commits
}

/**
 * Get files changed in a specific commit
 * @param worktreePath - Path to the git worktree
 * @param commitHash - The commit hash to get files for
 * @returns Array of files changed in the commit
 */
export async function getCommitFiles(worktreePath: string, commitHash: string): Promise<CommitFile[]> {
  const expandedPath = expandPath(worktreePath)
  const output = await executeGitCommand(['show', '--name-status', '--format=', commitHash], expandedPath)

  const lines = output
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
  return lines.map((line) => {
    const [status, ...pathParts] = line.split('\t')
    return {
      path: pathParts.join('\t'),
      status: status[0] as CommitFile['status'],
    }
  })
}

/**
 * Get diff for a specific commit
 * @param worktreePath - Path to the git worktree
 * @param commitHash - The commit hash to get diff for
 * @param filePath - Optional specific file to diff
 * @returns Diff output as string
 */
export async function getCommitDiff(worktreePath: string, commitHash: string, filePath?: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const args = ['show', '--format=', commitHash]
  if (filePath) {
    args.push('--', filePath)
  }
  return executeGitCommand(args, expandedPath)
}

/**
 * Get diff against a base branch (e.g., origin/main)
 * @param worktreePath - Path to the git worktree
 * @param baseBranch - Base branch to diff against (default: origin/HEAD)
 * @returns Diff output as string
 */
export async function getDiffAgainstBase(
  worktreePath: string,
  baseBranch: string = 'origin/HEAD',
  filePath?: string
): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  try {
    const mergeBase = await executeGitCommand(['merge-base', baseBranch, 'HEAD'], expandedPath)
    const args = ['diff', mergeBase.trim(), 'HEAD']
    if (filePath) {
      args.push('--', filePath)
    }
    return executeGitCommand(args, expandedPath)
  } catch {
    try {
      const mergeBase = await executeGitCommand(['merge-base', 'origin/master', 'HEAD'], expandedPath)
      const args = ['diff', mergeBase.trim(), 'HEAD']
      if (filePath) {
        args.push('--', filePath)
      }
      return executeGitCommand(args, expandedPath)
    } catch {
      const args = ['diff', 'HEAD']
      if (filePath) {
        args.push('--', filePath)
      }
      return executeGitCommand(args, expandedPath)
    }
  }
}

/**
 * Get list of files changed against a base branch
 * @param worktreePath - Path to the git worktree
 * @param baseBranch - Base branch to compare against (default: origin/HEAD)
 * @returns Array of changed files with their status
 */
export async function getFilesChangedAgainstBase(
  worktreePath: string,
  baseBranch: string = 'origin/HEAD'
): Promise<CommitFile[]> {
  const expandedPath = expandPath(worktreePath)
  try {
    const mergeBase = await executeGitCommand(['merge-base', baseBranch, 'HEAD'], expandedPath)
    const output = await executeGitCommand(['diff', '--name-status', mergeBase.trim(), 'HEAD'], expandedPath)

    const lines = output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
    return lines.map((line) => {
      const [status, ...pathParts] = line.split('\t')
      return {
        path: pathParts.join('\t'),
        status: status[0] as CommitFile['status'],
      }
    })
  } catch {
    try {
      const mergeBase = await executeGitCommand(['merge-base', 'origin/master', 'HEAD'], expandedPath)
      const output = await executeGitCommand(['diff', '--name-status', mergeBase.trim(), 'HEAD'], expandedPath)

      const lines = output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
      return lines.map((line) => {
        const [status, ...pathParts] = line.split('\t')
        return {
          path: pathParts.join('\t'),
          status: status[0] as CommitFile['status'],
        }
      })
    } catch {
      return []
    }
  }
}

/**
 * Create a new git worktree for an existing or new branch
 * @param projectPath - Path to the main git repository
 * @param branchName - Name for the branch
 * @returns Result with new worktree path and branch name
 */
export async function addWorktree(projectPath: string, branchName: string): Promise<WorktreeAddResult> {
  const expandedPath = expandPath(projectPath)
  const treesDir = path.join(expandedPath, '.trees')
  const worktreePath = path.join(treesDir, branchName)

  if (!fs.existsSync(treesDir)) {
    fs.mkdirSync(treesDir, { recursive: true })
  }

  const worktrees = await listWorktrees(expandedPath)
  const branchInUse = worktrees.some((wt) => wt.branch === branchName)
  if (branchInUse) {
    throw new Error(`Branch '${branchName}' is already checked out in another worktree`)
  }

  let localBranchExists = false
  try {
    await executeGitCommand(['rev-parse', '--verify', branchName], expandedPath)
    localBranchExists = true
  } catch {
    localBranchExists = false
  }

  if (localBranchExists) {
    await executeGitCommand(['worktree', 'add', worktreePath, branchName], expandedPath)
    return { path: worktreePath, branch: branchName }
  }

  let remoteBranchExists = false
  try {
    await executeGitCommand(['rev-parse', '--verify', `origin/${branchName}`], expandedPath)
    remoteBranchExists = true
  } catch {
    remoteBranchExists = false
  }

  if (remoteBranchExists) {
    await executeGitCommand(['worktree', 'add', '-b', branchName, worktreePath, `origin/${branchName}`], expandedPath)
  } else {
    await executeGitCommand(['worktree', 'add', '-b', branchName, worktreePath, 'origin/HEAD'], expandedPath)
  }

  return { path: worktreePath, branch: branchName }
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
  const expandedProjectPath = expandPath(projectPath)
  const expandedWorktreePath = expandPath(worktreePath)
  try {
    // Remove the worktree directory only, preserve the branch
    await executeGitCommand(['worktree', 'remove', expandedWorktreePath, '--force'], expandedProjectPath)
    return { success: true }
  } catch (error) {
    throw new Error(`Failed to remove worktree: ${error}`)
  }
}

/**
 * Discard changes for a specific file
 * For tracked files: runs `git checkout -- <file>`
 * For untracked files: deletes the file
 * For staged files: unstages first, then discards
 * @param worktreePath - Path to the git worktree
 * @param filePath - Path to the file to discard
 * @param status - Git status of the file (e.g., "M ", " M", "??", "A ")
 * @returns Success status
 */
export async function discardFileChanges(
  worktreePath: string,
  filePath: string,
  status: string
): Promise<{ success: boolean }> {
  const expandedPath = expandPath(worktreePath)
  const fullFilePath = path.join(expandedPath, filePath)

  const isUntracked = status === '??'
  const isStaged = status[0] !== ' ' && status[0] !== '?'
  const isModified = status[1] !== ' ' && status[1] !== '?'
  const isNewFile = status[0] === 'A'

  if (isUntracked) {
    if (fs.existsSync(fullFilePath)) {
      const stat = fs.statSync(fullFilePath)
      if (stat.isDirectory()) {
        fs.rmSync(fullFilePath, { recursive: true })
      } else {
        fs.unlinkSync(fullFilePath)
      }
    }
    return { success: true }
  }

  if (isStaged) {
    await executeGitCommand(['reset', 'HEAD', '--', filePath], expandedPath)
  }

  if (isNewFile && !isModified) {
    if (fs.existsSync(fullFilePath)) {
      fs.unlinkSync(fullFilePath)
    }
    return { success: true }
  }

  await executeGitCommand(['checkout', '--', filePath], expandedPath)
  return { success: true }
}

/**
 * Discard all changes in a worktree (reset to HEAD)
 * This will:
 * - Unstage all staged changes
 * - Discard all modified files
 * - Remove all untracked files and directories
 * @param worktreePath - Path to the git worktree
 * @returns Success status
 */
export async function discardAllChanges(worktreePath: string): Promise<{ success: boolean }> {
  const expandedPath = expandPath(worktreePath)

  // Reset staged changes and restore working directory to HEAD
  await executeGitCommand(['reset', '--hard', 'HEAD'], expandedPath)

  // Remove untracked files and directories
  await executeGitCommand(['clean', '-fd'], expandedPath)

  return { success: true }
}

/**
 * Check if a file is a binary file type that should be shown with a special viewer
 * @param filePath - Path to the file
 * @returns Object with file type info
 */
export function getFileViewerType(filePath: string): {
  type: 'image' | 'pdf' | 'svg' | 'text'
  mimeType?: string
} {
  const ext = path.extname(filePath).toLowerCase()
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif']
  const svgExtension = '.svg'
  const pdfExtension = '.pdf'

  if (imageExtensions.includes(ext)) {
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.avif': 'image/avif',
    }
    return { type: 'image', mimeType: mimeTypes[ext] }
  }

  if (ext === svgExtension) {
    return { type: 'svg', mimeType: 'image/svg+xml' }
  }

  if (ext === pdfExtension) {
    return { type: 'pdf', mimeType: 'application/pdf' }
  }

  return { type: 'text' }
}

/**
 * Get file content from working directory or from a specific commit
 * Returns base64 encoded content for binary files
 * @param worktreePath - Path to the git worktree
 * @param filePath - Path to the file relative to worktree
 * @param ref - Git ref (commit hash, branch, HEAD, etc.) - if not provided, reads from working directory
 * @returns File content as base64 string
 */
export async function getFileContent(
  worktreePath: string,
  filePath: string,
  ref?: string
): Promise<{ content: string; encoding: 'base64' | 'utf8' }> {
  const expandedPath = expandPath(worktreePath)

  if (ref) {
    // Get file content from git object
    try {
      const output = await executeGitCommand(['show', `${ref}:${filePath}`], expandedPath)
      // Try to detect if it's binary by checking for null bytes
      if (output.includes('\0')) {
        // Use git show with binary-safe approach
        const buffer = await executeGitCommandBuffer(['show', `${ref}:${filePath}`], expandedPath)
        return { content: buffer.toString('base64'), encoding: 'base64' }
      }
      return { content: output, encoding: 'utf8' }
    } catch {
      // File doesn't exist in this ref
      return { content: '', encoding: 'utf8' }
    }
  }

  // Read from working directory
  const fullFilePath = path.join(expandedPath, filePath)

  if (!fs.existsSync(fullFilePath)) {
    return { content: '', encoding: 'utf8' }
  }

  const buffer = fs.readFileSync(fullFilePath)
  const viewerType = getFileViewerType(filePath)

  if (viewerType.type !== 'text') {
    // Binary file - return base64
    return { content: buffer.toString('base64'), encoding: 'base64' }
  }

  // Text file
  return { content: buffer.toString('utf8'), encoding: 'utf8' }
}

/**
 * Execute a git command and return raw buffer output (for binary files)
 */
export function executeGitCommandBuffer(args: string[], cwd: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(cwd)) {
      reject(new Error(`Directory does not exist: ${cwd}`))
      return
    }

    const defaultPath = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
    const envPath = process.env.PATH || ''
    const fullPath = envPath ? `${defaultPath}:${envPath}` : defaultPath

    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, PATH: fullPath },
    })

    const chunks: Buffer[] = []
    let stderr = ''

    child.stdout.on('data', (data) => {
      chunks.push(Buffer.from(data))
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks))
      } else {
        reject(new Error(stderr || `Git command failed: git ${args.join(' ')}`))
      }
    })
  })
}

/**
 * Check if a path is a git repository
 * @param path - Path to check
 * @returns True if path is a git repository
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  const expandedPath = expandPath(repoPath)
  try {
    await executeGitCommand(['rev-parse', '--git-dir'], expandedPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get the current branch name
 * @param worktreePath - Path to the git worktree
 * @returns Current branch name
 */
export async function getCurrentBranch(worktreePath: string): Promise<string> {
  const expandedPath = expandPath(worktreePath)
  const output = await executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], expandedPath)
  return output.trim()
}

/**
 * Validate multiple project paths
 * @param projectPaths - Array of project paths to validate
 * @returns Array of validation results
 */
export async function validateProjects(projectPaths: string[]): Promise<ProjectValidationResult[]> {
  const results = await Promise.allSettled(
    projectPaths.map(async (inputPath) => {
      const projectPath = expandPath(inputPath)
      try {
        // Check if directory exists by trying to access it
        const isGitRepo = await isGitRepository(projectPath)
        if (!isGitRepo) {
          return {
            path: projectPath,
            valid: false,
            error: 'Not a git repository',
          } as ProjectValidationResult
        }

        // Get repository name from path
        const name = path.basename(projectPath)

        return {
          path: projectPath,
          name,
          valid: true,
        } as ProjectValidationResult
      } catch (error) {
        return {
          path: projectPath,
          valid: false,
          error: `Directory not accessible: ${(error as Error).message}`,
        } as ProjectValidationResult
      }
    })
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        path: projectPaths[index],
        valid: false,
        error: `Validation failed: ${result.reason}`,
      }
    }
  })
}
