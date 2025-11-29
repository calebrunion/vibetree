import { GitBranch, PanelLeftOpen, Plus, RefreshCw, Sliders } from 'lucide-react'
import type { Worktree } from '@vibetree/core'
import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAppStore } from '../store'

interface MobileWorktreeTabsProps {
  worktrees: Worktree[]
  selectedWorktree: string | null
  onSelectWorktree: (path: string) => void
  projectPath: string
  onOpenSettings?: () => void
  onRefresh?: () => void
  showOnDesktop?: boolean
  onExpandSidebar?: () => void
}

export function MobileWorktreeTabs({
  worktrees,
  selectedWorktree,
  onSelectWorktree,
  projectPath,
  onOpenSettings,
  onRefresh,
  showOnDesktop = false,
  onExpandSidebar,
}: MobileWorktreeTabsProps) {
  const { getAdapter } = useWebSocket()
  const setShowAddWorktreeDialog = useAppStore((state) => state.setShowAddWorktreeDialog)
  const [worktreesWithChanges, setWorktreesWithChanges] = useState<Set<string>>(new Set())
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

  if (worktrees.length === 0) return null

  const sortedWorktrees = [...worktrees].sort((a, b) => {
    const getBranchName = (wt: Worktree) => {
      if (!wt.branch) return wt.head.substring(0, 8)
      return wt.branch.replace('refs/heads/', '')
    }

    const branchA = getBranchName(a)
    const branchB = getBranchName(b)

    if (branchA === 'main' || branchA === 'master') return -1
    if (branchB === 'main' || branchB === 'master') return 1

    return branchA.localeCompare(branchB)
  })

  return (
    <div
      className={`${showOnDesktop ? '' : 'md:hidden'} overflow-x-auto flex-shrink-0 max-w-full`}
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="inline-flex items-center gap-1 px-2 pt-4">
        {onExpandSidebar && (
          <button
            onClick={onExpandSidebar}
            className="hidden md:flex items-center justify-center size-12 flex-shrink-0 rounded-md transition-colors border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center size-12 flex-shrink-0 rounded-md transition-colors border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Project settings"
            title="Project settings"
          >
            <Sliders className="h-5 w-5" />
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center justify-center size-12 flex-shrink-0 rounded-md transition-colors border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Refresh worktrees"
            title="Refresh worktrees"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        )}
        {sortedWorktrees.map((worktree) => {
          const branchName = worktree.branch
            ? worktree.branch.replace('refs/heads/', '')
            : `${worktree.head.substring(0, 8)}`
          const worktreeName = worktree.path.split('/').pop() || branchName
          const isSelected = selectedWorktree === worktree.path
          const isMainWorktree = worktree.path === projectPath

          const hasChanges = worktreesWithChanges.has(worktree.path)

          return (
            <button
              key={worktree.path}
              ref={isSelected ? selectedButtonRef : null}
              onClick={() => onSelectWorktree(worktree.path)}
              className={`
                flex flex-col items-start justify-center h-12 px-3 rounded-md whitespace-nowrap transition-colors border
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
