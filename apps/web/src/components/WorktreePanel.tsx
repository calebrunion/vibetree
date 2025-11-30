import { GitBranch, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAppStore } from '../store'

function isProtectedBranch(branch: string): boolean {
  const branchName = branch.replace('refs/heads/', '')
  return branchName === 'main' || branchName === 'master'
}

interface WorktreePanelProps {
  projectId: string
}

export function WorktreePanel({ projectId }: WorktreePanelProps) {
  const {
    getProject,
    updateProjectWorktrees,
    setSelectedWorktree,
    markWorktreeForStartup,
    connected,
    showAddWorktreeDialog,
    setShowAddWorktreeDialog,
  } = useAppStore()

  const { getAdapter } = useWebSocket()
  const [loading, setLoading] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [worktreesWithChanges, setWorktreesWithChanges] = useState<Set<string>>(new Set())
  const [deleteConfirmWorktree, setDeleteConfirmWorktree] = useState<{ path: string; branch: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)
  const [discardConfirmWorktree, setDiscardConfirmWorktree] = useState<{ path: string; branch: string } | null>(null)
  const [discardingPath, setDiscardingPath] = useState<string | null>(null)

  const project = getProject(projectId)
  const adapter = getAdapter() // Get adapter once per render

  const fetchWorktreeChanges = async (worktrees: { path: string }[]) => {
    const currentAdapter = getAdapter()
    if (!currentAdapter) return

    const changesSet = new Set<string>()
    await Promise.all(
      worktrees.map(async (wt) => {
        try {
          const status = await currentAdapter.getGitStatus(wt.path)
          if (status.length > 0) {
            changesSet.add(wt.path)
          }
        } catch {
          // Ignore errors for individual worktrees
        }
      })
    )
    setWorktreesWithChanges(changesSet)
  }

  const handleSelectWorktree = (path: string) => {
    console.log('🎯 WorktreePanel: Selecting worktree:', {
      projectId,
      path,
      currentSelection: project?.selectedWorktree,
    })
    setSelectedWorktree(projectId, path)
  }

  const handleCreateBranch = async () => {
    const adapter = getAdapter()
    if (!newBranchName.trim() || !adapter || !connected || !project) return

    setLoading(true)
    try {
      const result = await adapter.addWorktree(project.path, newBranchName)
      console.log('✅ Created worktree:', result)

      setShowAddWorktreeDialog(false)
      setNewBranchName('')

      // Refresh worktrees to show the new one
      const trees = await adapter.listWorktrees(project.path)
      updateProjectWorktrees(projectId, trees)
      await fetchWorktreeChanges(trees)

      // Mark for startup commands and select the newly created worktree
      markWorktreeForStartup(result.path)
      setSelectedWorktree(projectId, result.path)
    } catch (error) {
      console.error('❌ Failed to create worktree:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWorktree = async (worktreePath: string, branch: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isProtectedBranch(branch)) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      const status = await adapter.getGitStatus(worktreePath)
      if (status.length > 0) {
        setDeleteConfirmWorktree({ path: worktreePath, branch })
      } else {
        performDelete(worktreePath, branch)
      }
    } catch {
      performDelete(worktreePath, branch)
    }
  }

  const performDelete = async (worktreePath: string, branch: string) => {
    if (isProtectedBranch(branch)) return

    const adapter = getAdapter()
    if (!adapter || !connected || !project) return

    setDeleting(true)
    setDeletingPath(worktreePath)
    try {
      await adapter.removeWorktree(project.path, worktreePath, branch.replace('refs/heads/', ''))
      console.log('✅ Deleted worktree:', worktreePath)

      // If we deleted the selected worktree, select the first available one
      if (project.selectedWorktree === worktreePath) {
        const remainingWorktree = project.worktrees.find((wt) => wt.path !== worktreePath)
        if (remainingWorktree) {
          setSelectedWorktree(projectId, remainingWorktree.path)
        }
      }

      // Refresh worktrees
      const trees = await adapter.listWorktrees(project.path)
      updateProjectWorktrees(projectId, trees)
      await fetchWorktreeChanges(trees)
    } catch (error) {
      console.error('❌ Failed to delete worktree:', error)
    } finally {
      setDeleting(false)
      setDeletingPath(null)
      setDeleteConfirmWorktree(null)
    }
  }

  const handleDiscardChanges = (worktreePath: string, branch: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDiscardConfirmWorktree({ path: worktreePath, branch })
  }

  const performDiscard = async (worktreePath: string) => {
    const adapter = getAdapter()
    if (!adapter || !connected || !project) return

    setDiscardingPath(worktreePath)
    try {
      await adapter.discardAllChanges(worktreePath)
      console.log('✅ Discarded all changes for:', worktreePath)

      // Refresh worktree changes status
      await fetchWorktreeChanges(project.worktrees)
    } catch (error) {
      console.error('❌ Failed to discard changes:', error)
    } finally {
      setDiscardingPath(null)
      setDiscardConfirmWorktree(null)
    }
  }

  // Auto-load worktrees when component mounts or project changes
  useEffect(() => {
    console.log('🔄 WorktreePanel useEffect triggered:', {
      projectId,
      connected,
      loading,
      hasProject: !!project,
      hasAdapter: !!adapter,
      projectPath: project?.path,
      currentWorktrees: project?.worktrees?.length || 0,
    })

    if (!project || !connected || loading || !adapter) {
      console.log('❌ Early return from useEffect:', {
        hasProject: !!project,
        connected,
        loading,
        hasAdapter: !!adapter,
      })
      return
    }

    // Inline refresh logic with stable dependencies
    const loadWorktrees = async () => {
      console.log('🚀 Starting worktree load for:', project.path)
      setLoading(true)

      try {
        const trees = await adapter.listWorktrees(project.path)
        console.log('✅ Worktrees loaded:', trees)
        updateProjectWorktrees(projectId, trees)
        console.log('✅ Project worktrees updated')
        await fetchWorktreeChanges(trees)
      } catch (error) {
        console.error('❌ Failed to load worktrees:', error)
      } finally {
        setLoading(false)
        console.log('🏁 Loading finished')
      }
    }

    loadWorktrees()
  }, [projectId, connected, adapter?.constructor?.name]) // Stable dependency on adapter presence

  if (!project) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Project not found</div>
  }

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Worktree List */}
      <div className="flex-1 overflow-y-auto">
        {!connected ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Not connected to server</p>
          </div>
        ) : project.worktrees.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No worktrees found</p>
            <p className="text-xs mt-2">Click the + button to create worktrees</p>
          </div>
        ) : (
          <div className="p-2">
            {[...project.worktrees]
              .sort((a, b) => {
                // HEAD worktree (main project path) always first
                const isHeadA = a.path === project.path
                const isHeadB = b.path === project.path
                if (isHeadA) return -1
                if (isHeadB) return 1

                // Extract branch names, handling refs/heads/ prefix and detached HEAD
                const getBranchName = (wt: typeof a) => {
                  if (!wt.branch) return wt.head.substring(0, 8) // detached HEAD
                  return wt.branch.replace('refs/heads/', '')
                }

                const branchA = getBranchName(a)
                const branchB = getBranchName(b)

                // Sort alphabetically for the rest
                return branchA.localeCompare(branchB)
              })
              .map((worktree) => {
                const branchName = worktree.branch
                  ? worktree.branch.replace('refs/heads/', '')
                  : `Detached (${worktree.head.substring(0, 8)})`
                const worktreeName = worktree.path.split('/').pop() || branchName

                const hasChanges = worktreesWithChanges.has(worktree.path)

                const isMainWorktree = worktree.path === project.path
                const canDelete =
                  project.worktrees.length > 1 &&
                  worktree.branch &&
                  !isProtectedBranch(worktree.branch) &&
                  !isMainWorktree

                return (
                  <div key={worktree.path} className="relative group">
                    <button
                      onClick={() => handleSelectWorktree(worktree.path)}
                      className={`
                      w-full text-left p-3 rounded-md mb-1 transition-colors
                      ${project.selectedWorktree === worktree.path ? 'bg-accent' : 'hover:bg-accent/50'}
                    `}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          {isMainWorktree ? (
                            <span className="truncate">HEAD</span>
                          ) : (
                            <span className="truncate">{worktreeName}</span>
                          )}
                          {hasChanges && (
                            <span
                              className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"
                              title="Has uncommitted changes"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <GitBranch className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{branchName}</span>
                        </div>
                      </div>
                    </button>
                    {hasChanges && (
                      <button
                        onClick={(e) => handleDiscardChanges(worktree.path, worktree.branch || '', e)}
                        disabled={discardingPath === worktree.path}
                        className={`absolute top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md transition-opacity bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 disabled:cursor-not-allowed ${discardingPath === worktree.path ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${canDelete ? 'right-10' : 'right-2'}`}
                        title="Discard all changes"
                      >
                        {discardingPath === worktree.path ? (
                          <Loader2 className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                        )}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteWorktree(worktree.path, worktree.branch!, e)}
                        disabled={deletingPath === worktree.path}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md transition-opacity bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:cursor-not-allowed ${deletingPath === worktree.path ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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
            {/* Add Worktree Button - inline at bottom of list */}
            <button
              onClick={() => setShowAddWorktreeDialog(true)}
              disabled={!connected}
              className="w-full flex items-center justify-center p-3 rounded-md mb-1 transition-colors border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
              aria-label="Add worktree"
            >
              <Plus className="h-4 w-4 mr-2" />
              <span className="text-sm">New worktree</span>
            </button>
          </div>
        )}
      </div>

      {/* Create New Branch Dialog */}
      {showAddWorktreeDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Create New Feature Branch</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will create a new git worktree for parallel development
              </p>

              <input
                type="text"
                placeholder="branch-name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value.replace(/[^a-zA-Z0-9/\-\.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateBranch()
                  }
                  if (e.key === 'Escape') {
                    setShowAddWorktreeDialog(false)
                    setNewBranchName('')
                  }
                }}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
              />

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAddWorktreeDialog(false)
                    setNewBranchName('')
                  }}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || loading}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmWorktree && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Delete Worktree?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This worktree has uncommitted changes that will be lost. Are you sure you want to delete it?
              </p>
              <p className="text-sm font-medium mb-4 p-2 bg-muted rounded">
                {deleteConfirmWorktree.branch.replace('refs/heads/', '')}
              </p>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setDeleteConfirmWorktree(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performDelete(deleteConfirmWorktree.path, deleteConfirmWorktree.branch)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Changes Confirmation Dialog */}
      {discardConfirmWorktree && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2 text-yellow-600 dark:text-yellow-400">Discard All Changes?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently discard all uncommitted changes in this worktree. This action cannot be undone.
              </p>
              <p className="text-sm font-medium mb-4 p-2 bg-muted rounded">
                {discardConfirmWorktree.branch.replace('refs/heads/', '') || 'Detached HEAD'}
              </p>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setDiscardConfirmWorktree(null)}
                  disabled={discardingPath !== null}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => performDiscard(discardConfirmWorktree.path)}
                  disabled={discardingPath !== null}
                  className="px-4 py-2 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50"
                >
                  {discardingPath !== null ? 'Discarding...' : 'Discard Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
