import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

export default function DeleteWorktreeDialog() {
  const { getAdapter } = useWebSocket()
  const deleteWorktreeConfirm = useAppStore((state) => state.deleteWorktreeConfirm)
  const setDeleteWorktreeConfirm = useAppStore((state) => state.setDeleteWorktreeConfirm)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!deleteWorktreeConfirm) return null

  const handleClose = () => {
    setDeleteWorktreeConfirm(null)
    setDeleteConfirmed(false)
  }

  const handleDelete = async () => {
    const adapter = getAdapter()
    if (!adapter) return

    setDeleting(true)
    try {
      await adapter.removeWorktree(
        deleteWorktreeConfirm.projectPath,
        deleteWorktreeConfirm.path,
        deleteWorktreeConfirm.branch.replace('refs/heads/', '')
      )
      deleteWorktreeConfirm.onDeleted?.()
      handleClose()
    } catch (error) {
      console.error('Failed to delete worktree:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">Delete Worktree?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete this worktree? This action cannot be undone.
          </p>
          <p className="text-sm font-medium mb-4 p-2 bg-muted rounded">
            {deleteWorktreeConfirm.branch.replace('refs/heads/', '')}
          </p>

          {deleteWorktreeConfirm.hasChanges && (
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
              onClick={handleClose}
              disabled={deleting}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || (deleteWorktreeConfirm.hasChanges && !deleteConfirmed)}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
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
  )
}
