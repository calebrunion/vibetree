import { GitBranch } from 'lucide-react';
import type { Worktree } from '@vibetree/core';
import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface MobileWorktreeTabsProps {
  worktrees: Worktree[];
  selectedWorktree: string | null;
  onSelectWorktree: (path: string) => void;
}

export function MobileWorktreeTabs({
  worktrees,
  selectedWorktree,
  onSelectWorktree
}: MobileWorktreeTabsProps) {
  const { getAdapter } = useWebSocket();
  const [worktreesWithChanges, setWorktreesWithChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchChanges = async () => {
      const adapter = getAdapter();
      if (!adapter || worktrees.length === 0) return;

      const changesSet = new Set<string>();
      await Promise.all(
        worktrees.map(async (wt) => {
          try {
            const status = await adapter.getGitStatus(wt.path);
            if (status.length > 0) {
              changesSet.add(wt.path);
            }
          } catch {
            // Ignore errors
          }
        })
      );
      setWorktreesWithChanges(changesSet);
    };

    fetchChanges();
  }, [worktrees, getAdapter]);

  if (worktrees.length === 0) return null;

  const sortedWorktrees = [...worktrees].sort((a, b) => {
    const getBranchName = (wt: Worktree) => {
      if (!wt.branch) return wt.head.substring(0, 8);
      return wt.branch.replace('refs/heads/', '');
    };

    const branchA = getBranchName(a);
    const branchB = getBranchName(b);

    if (branchA === 'main' || branchA === 'master') return -1;
    if (branchB === 'main' || branchB === 'master') return 1;

    return branchA.localeCompare(branchB);
  });

  return (
    <div
      className="md:hidden border-b bg-muted/30 overflow-x-auto flex-shrink-0 max-w-full"
      style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="inline-flex gap-1 p-2">
        {sortedWorktrees.map((worktree) => {
          const branchName = worktree.branch
            ? worktree.branch.replace('refs/heads/', '')
            : `${worktree.head.substring(0, 8)}`;
          const worktreeName = worktree.path.split('/').pop() || branchName;
          const isSelected = selectedWorktree === worktree.path;

          const hasChanges = worktreesWithChanges.has(worktree.path);

          return (
            <button
              key={worktree.path}
              onClick={() => onSelectWorktree(worktree.path)}
              className={`
                flex flex-col items-start px-3 py-1.5 rounded-md whitespace-nowrap transition-colors border
                ${isSelected
                  ? 'bg-background text-foreground border-border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                }
              `}
            >
              <span className="text-sm font-medium flex items-center gap-1.5">
                {worktreeName}
                {hasChanges && (
                  <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                )}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {branchName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
