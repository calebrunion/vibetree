import { GitBranch, Loader2, Plus, Trash2 } from 'lucide-react'
import type { Worktree } from '@buddy/core'
import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAppStore } from '../store'

function isProtectedBranch(branch: string): boolean {
  const branchName = branch.replace('refs/heads/', '')
  return branchName === 'main' || branchName === 'master'
}

interface MobileWorktreeTabsProps {
  worktrees: Worktree[]
  selectedWorktree: string | null
  onSelectWorktree: (path: string) => void
  projectPath: string
  showOnDesktop?: boolean
  onWorktreesChanged?: () => void
}

export function MobileWorktreeTabs({
  worktrees,
  selectedWorktree,
  onSelectWorktree,
  projectPath,
  showOnDesktop = false,
  onWorktreesChanged,
}: MobileWorktreeTabsProps) {
  const { getAdapter } = useWebSocket()
  const setShowAddWorktreeDialog = useAppStore((state) => state.setShowAddWorktreeDialog)
  const [worktreesWithChanges, setWorktreesWithChanges] = useState<Set<string>>(new Set())
  const [deleteConfirmWorktree, setDeleteConfirmWorktree] = useState<{
    path: string
    branch: string
    hasChanges: boolean
  } | null>(null)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const selectedButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (selectedButtonRef.current) {
        selectedButtonRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    })
  }, [selectedWorktree, worktrees])

  useEffect(() => {
    const fetchChanges = async () => {
      const adapter = getAdapter()
      if (!adapter || worktrees.length === 0) return

      const changesSet = new Set<string>()
      await Promise.all(
        worktrees.map(async (wt) => {
          try {
            const status = await adapter.getGitStatus(wt.path)
            if (status.length > 0) {
              changesSet.add(wt.path)
            }
          } catch {
            // Ignore errors
          }
        })
      )
      setWorktreesWithChanges(changesSet)
    }

    fetchChanges()
  }, [worktrees, getAdapter])

  const handleDeleteWorktree = async (worktreePath: string, branch: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProtectedBranch(branch)) return
    const hasChanges = worktreesWithChanges.has(worktreePath)
    setDeleteConfirmed(false)
    setDeleteConfirmWorktree({ path: worktreePath, branch, hasChanges })
  }

  const performDelete = async (worktreePath: string, branch: string) => {
    if (isProtectedBranch(branch)) return

    const adapter = getAdapter()
    if (!adapter) return

    setDeletingPath(worktreePath)
    try {
      await adapter.removeWorktree(projectPath, worktreePath, branch.replace('refs/heads/', ''))

      if (selectedWorktree === worktreePath) {
        const remainingWorktree = worktrees.find((wt) => wt.path !== worktreePath)
        if (remainingWorktree) {
          onSelectWorktree(remainingWorktree.path)
        }
      }

      onWorktreesChanged?.()
    } catch (error) {
      console.error('Failed to delete worktree:', error)
    } finally {
      setDeletingPath(null)
      setDeleteConfirmWorktree(null)
    }
  }

  if (worktrees.length === 0) return null

  const sortedWorktrees = [...worktrees].sort((a, b) => {
    // HEAD/main worktree always first
    if (a.path === projectPath) return -1
    if (b.path === projectPath) return 1

    const getBranchName = (wt: Worktree) => {
      if (!wt.branch) return wt.head.substring(0, 8)
      return wt.branch.replace('refs/heads/', '')
    }

    return getBranchName(a).localeCompare(getBranchName(b))
  })

  return (
    <div
      className={`${showOnDesktop ? '' : 'md:hidden'} overflow-x-auto flex-shrink-0 max-w-full`}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="inline-flex items-center gap-1 px-1 pt-3 md:px-2">
        {sortedWorktrees.map((worktree) => {
          const branchName = worktree.branch
            ? worktree.branch.replace('refs/heads/', '')
            : `${worktree.head.substring(0, 8)}`
          const worktreeName = worktree.path.split('/').pop() || branchName
          const isSelected = selectedWorktree === worktree.path
          const isMainWorktree = worktree.path === projectPath

          const hasChanges = worktreesWithChanges.has(worktree.path)
          const canDelete =
            worktrees.length > 1 && worktree.branch && !isProtectedBranch(worktree.branch) && !isMainWorktree

          return (
            <div key={worktree.path} className="relative group">
              <button
                ref={isSelected ? selectedButtonRef : null}
                onClick={() => onSelectWorktree(worktree.path)}
                className={`
                  flex flex-col items-start justify-center h-12 px-3 rounded-md whitespace-nowrap transition-colors border
                  ${canDelete ? 'pr-12' : ''}
                  ${
                    isSelected
                      ? 'bg-accent text-accent-foreground border-border shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                  }
                `}
              >
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {isMainWorktree ? 'HEAD' : worktreeName}
                  {hasChanges && <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {branchName}
                </span>
              </button>
              {canDelete && (
                <button
                  onClick={(e) => handleDeleteWorktree(worktree.path, worktree.branch!, e)}
                  disabled={deletingPath === worktree.path}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-100"
                  title="Delete worktree"
                >
                  {deletingPath === worktree.path ? (
                    <Loader2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                  )}
                </button>
              )}
            </div>
          )
        })}
        <button
          onClick={() => setShowAddWorktreeDialog(true)}
          className="flex items-center justify-center size-12 flex-shrink-0 rounded-md transition-colors border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
          aria-label="Add worktree"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {deleteConfirmWorktree && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Delete Worktree?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to delete this worktree? This action cannot be undone.
              </p>
              <p className="text-sm font-medium mb-4 p-2 bg-muted rounded">
                {deleteConfirmWorktree.branch.replace('refs/heads/', '')}
              </p>

              {deleteConfirmWorktree.hasChanges && (
                <label className="flex items-start gap-3 p-3 bg-muted border border-border rounded-md mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded"
                  />
                  <span className="text-sm text-muted-foreground">
                    I understand this worktree has uncommitted changes that will be lost
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setDeleteConfirmWorktree(null)}
                  disabled={!!deletingPath}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performDelete(deleteConfirmWorktree.path, deleteConfirmWorktree.branch)}
                  disabled={!!deletingPath || (deleteConfirmWorktree.hasChanges && !deleteConfirmed)}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingPath ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
