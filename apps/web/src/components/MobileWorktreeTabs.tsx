import { GitBranch, Plus, Trash2 } from 'lucide-react'
import type { Worktree } from '@buddy/core'
import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

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
  const setDeleteWorktreeConfirm = useAppStore((state) => state.setDeleteWorktreeConfirm)
  const deleteWorktreeConfirm = useAppStore((state) => state.deleteWorktreeConfirm)
  const unreadBellWorktrees = useAppStore((state) => state.unreadBellWorktrees)
  const clearWorktreeBell = useAppStore((state) => state.clearWorktreeBell)
  const [worktreeChangeCounts, setWorktreeChangeCounts] = useState<Map<string, number>>(new Map())
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

      const countsMap = new Map<string, number>()
      await Promise.all(
        worktrees.map(async (wt) => {
          try {
            const status = await adapter.getGitStatus(wt.path)
            if (status.length > 0) {
              countsMap.set(wt.path, status.length)
            }
          } catch {
            // Ignore errors
          }
        })
      )
      setWorktreeChangeCounts(countsMap)
    }

    fetchChanges()
  }, [worktrees, getAdapter])

  const handleDeleteWorktree = (worktreePath: string, branch: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProtectedBranch(branch)) return
    const hasChanges = worktreeChangeCounts.has(worktreePath)
    setDeleteWorktreeConfirm({
      path: worktreePath,
      branch,
      hasChanges,
      projectPath,
      onDeleted: () => {
        if (selectedWorktree === worktreePath) {
          const remainingWorktree = worktrees.find((wt) => wt.path !== worktreePath)
          if (remainingWorktree) {
            onSelectWorktree(remainingWorktree.path)
          }
        }
        onWorktreesChanged?.()
      },
    })
  }

  const isDeleting = deleteWorktreeConfirm !== null

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

          const changeCount = worktreeChangeCounts.get(worktree.path) || 0
          const hasUnreadBell = unreadBellWorktrees.has(worktree.path)
          const canDelete =
            worktrees.length > 1 && worktree.branch && !isProtectedBranch(worktree.branch) && !isMainWorktree

          return (
            <div key={worktree.path} className="relative group">
              <button
                ref={isSelected ? selectedButtonRef : null}
                onClick={() => {
                  clearWorktreeBell(worktree.path)
                  onSelectWorktree(worktree.path)
                }}
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
                  {changeCount > 0 && (
                    <span className="size-3.5 text-[9px] font-medium rounded-full flex items-center justify-center bg-yellow-500 text-black">
                      {changeCount}
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  {branchName}
                  {hasUnreadBell && <span className="size-2 rounded-full bg-blue-500 animate-pulse" />}
                </span>
              </button>
              {canDelete && (
                <button
                  onClick={(e) => handleDeleteWorktree(worktree.path, worktree.branch!, e)}
                  disabled={isDeleting}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-100"
                  title="Delete worktree"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
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
    </div>
  )
}
