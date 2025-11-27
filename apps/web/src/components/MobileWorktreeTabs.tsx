import { GitBranch } from 'lucide-react';
import type { Worktree } from '@vibetree/core';

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
          const isSelected = selectedWorktree === worktree.path;

          return (
            <button
              key={worktree.path}
              onClick={() => onSelectWorktree(worktree.path)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors
                ${isSelected
                  ? 'bg-background text-foreground border shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
              `}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {branchName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
