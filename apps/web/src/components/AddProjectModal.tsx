import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Plus, X } from 'lucide-react'

interface AddProjectModalProps {
  open: boolean
  onAddProject: (path: string) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}

export default function AddProjectModal({ open, onAddProject, onClose }: AddProjectModalProps) {
  const [projectPath, setProjectPath] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProjectPath('')
        setError('')
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectPath.trim()) {
      setError('Please enter a project path')
      inputRef.current?.focus()
      return
    }

    setError('')
    setIsLoading(true)

    try {
      const result = await onAddProject(projectPath.trim())
      if (result.success) {
        setProjectPath('')
        onClose()
      } else {
        setError(result.error || 'Failed to add project')
        inputRef.current?.focus()
      }
    } catch {
      setError('Failed to add project. Please try again.')
      inputRef.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setProjectPath('')
    setError('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 hover:bg-accent rounded-md transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center space-y-2 mb-6">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Add Project</h2>
          <p className="text-sm text-muted-foreground">Enter the path to your git repository</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="projectPath" className="text-sm font-medium">
              Project Path
            </label>
            <input
              ref={inputRef}
              id="projectPath"
              type="text"
              value={projectPath}
              onChange={(e) => {
                setProjectPath(e.target.value.replace(/[^a-zA-Z0-9.\/\-~_]/g, ''))
                if (error) setError('')
              }}
              placeholder="~/project/path"
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              disabled={isLoading}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !projectPath.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              {isLoading ? 'Adding...' : 'Add Project'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Make sure the path points to a valid git repository
        </p>
      </div>
    </div>
  )
}
