import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';

export function FloatingAddWorktree() {
  const {
    getActiveProject,
    updateProjectWorktrees,
    setSelectedWorktree,
    connected
  } = useAppStore();

  const { getAdapter } = useWebSocket();
  const [showDialog, setShowDialog] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeProject = getActiveProject();

  const handleCreate = async () => {
    const adapter = getAdapter();
    if (!branchName.trim() || !adapter || !connected || !activeProject) return;

    setLoading(true);
    setError('');

    try {
      const result = await adapter.addWorktree(activeProject.path, branchName);
      const trees = await adapter.listWorktrees(activeProject.path);
      updateProjectWorktrees(activeProject.id, trees);
      setSelectedWorktree(activeProject.id, result.path);
      setShowDialog(false);
      setBranchName('');
    } catch (err) {
      setError('Failed to create worktree. Branch may already exist.');
      console.error('Failed to create worktree:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!activeProject || !connected) return null;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="fixed bottom-5 right-5 w-11 h-11 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center z-40"
        aria-label="Add worktree"
      >
        <Plus className="h-5 w-5" />
      </button>

      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">Create New Worktree</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new git worktree for parallel development
              </p>

              <input
                type="text"
                placeholder="branch-name"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value.replace(/[^a-zA-Z0-9/\-\.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && branchName.trim()) {
                    handleCreate();
                  }
                  if (e.key === 'Escape') {
                    setShowDialog(false);
                    setBranchName('');
                    setError('');
                  }
                }}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={loading}
              />

              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowDialog(false);
                    setBranchName('');
                    setError('');
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
  );
}
