import { useState } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

export function FloatingAddWorktree() {
  const updateProjectWorktrees = useAppStore((state) => state.updateProjectWorktrees)
  const setSelectedWorktree = useAppStore((state) => state.setSelectedWorktree)
  const markWorktreeForStartup = useAppStore((state) => state.markWorktreeForStartup)
  const connected = useAppStore((state) => state.connected)
  const showDialog = useAppStore((state) => state.showAddWorktreeDialog)
  const setShowDialog = useAppStore((state) => state.setShowAddWorktreeDialog)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const projects = useAppStore((state) => state.projects)

  const { getAdapter } = useWebSocket()
  const [branchName, setBranchName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) : undefined

  const handleCreate = async () => {
    const adapter = getAdapter()
    if (!branchName.trim() || !adapter || !connected || !activeProject) return

    setLoading(true)
    setError('')

    try {
      const result = await adapter.addWorktree(activeProject.path, branchName)
      const trees = await adapter.listWorktrees(activeProject.path)
      updateProjectWorktrees(activeProject.id, trees)
      markWorktreeForStartup(result.path)
      setSelectedWorktree(activeProject.id, result.path)
      setShowDialog(false)
      setBranchName('')
    } catch (err) {
      setError('Failed to create worktree. Branch may already exist.')
      console.error('Failed to create worktree:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {showDialog && activeProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Create New Worktree</h3>
              <p className="text-sm text-muted-foreground mb-4">Create a new git worktree for parallel development</p>

              <input
                type="text"
                placeholder="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value.replace(/[^a-zA-Z0-9/\-\.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && branchName.trim()) {
                    handleCreate()
                  }
                  if (e.key === 'Escape') {
                    setShowDialog(false)
                    setBranchName('')
                    setError('')
                  }
                }}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
              />

              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowDialog(false)
                    setBranchName('')
                    setError('')
                  }}
                  className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!branchName.trim() || loading}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
