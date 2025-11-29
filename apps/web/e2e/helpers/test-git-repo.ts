import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import os from 'os'

export interface CreateTestRepoOptions {
  nameSuffix?: string
  createWorktree?: boolean
  worktreeBranch?: string
}

export interface TestRepoResult {
  repoPath: string
  worktreePath?: string
}

export function createTestGitRepo(options: CreateTestRepoOptions = {}): TestRepoResult {
  const { nameSuffix = 'repo', createWorktree = false, worktreeBranch = 'test-branch' } = options

  const timestamp = Date.now()
  const repoPath = path.join(os.tmpdir(), `vibetree-web-test-${nameSuffix}-${timestamp}`)

  fs.mkdirSync(repoPath, { recursive: true })
  execSync('git init -q', { cwd: repoPath })
  execSync('git config user.email "test@example.com"', { cwd: repoPath })
  execSync('git config user.name "Test User"', { cwd: repoPath })

  fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test Repository\n')
  execSync('git add .', { cwd: repoPath })
  execSync('git commit -q -m "Initial commit"', { cwd: repoPath })

  try {
    execSync('git branch -M main', { cwd: repoPath })
  } catch {
    // Branch may already exist
  }

  console.log('Created dummy repo at:', repoPath)

  const result: TestRepoResult = { repoPath }

  if (createWorktree) {
    const worktreePath = path.join(os.tmpdir(), `vibetree-web-test-${worktreeBranch}-${timestamp}`)
    execSync(`git worktree add -b ${worktreeBranch} "${worktreePath}"`, { cwd: repoPath })
    console.log('Created worktree at:', worktreePath)
    result.worktreePath = worktreePath
  }

  return result
}

export function cleanupTestGitRepo(repoPath: string | undefined, worktreePath?: string): void {
  if (worktreePath && fs.existsSync(worktreePath)) {
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true })
      console.log('Cleaned up test worktree')
    } catch (e) {
      console.error('Failed to clean up test worktree:', e)
    }
  }

  if (repoPath && fs.existsSync(repoPath)) {
    try {
      fs.rmSync(repoPath, { recursive: true, force: true })
      console.log('Cleaned up dummy repo')
    } catch (e) {
      console.error('Failed to clean up dummy repo:', e)
    }
  }
}
