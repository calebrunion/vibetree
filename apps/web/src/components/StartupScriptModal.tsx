import { useState, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

interface StartupScriptModalProps {
  projectPath: string
  onClose: () => void
}

export default function StartupScriptModal({ projectPath, onClose }: StartupScriptModalProps) {
  const { getAdapter } = useWebSocket()
  const [startupCommand, setStartupCommand] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      const adapter = getAdapter()
      if (!adapter) return

      try {
        const settings = await adapter.readProjectSettings(projectPath)
        const commands = settings.startupCommands || []
        setStartupCommand(commands.join('\n'))
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [projectPath, getAdapter])

  const handleSave = async () => {
    const adapter = getAdapter()
    if (!adapter) return

    setSaving(true)
    try {
      const commands = startupCommand
        .split('\n')
        .map((cmd) => cmd.trim())
        .filter((cmd) => cmd.length > 0)

      await adapter.writeProjectSettings(projectPath, {
        startupCommands: commands,
      })
      onClose()
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">Project Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure startup commands that run when a new worktree is created.
          </p>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <label className="block text-sm font-medium mb-2">Startup Command</label>
              <textarea
                value={startupCommand}
                onChange={(e) => setStartupCommand(e.target.value)}
                placeholder="e.g., pnpm install && pnpm dev"
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-none h-32"
                autoFocus
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter one command per line. Commands run in order when a new terminal session starts in a worktree.
              </p>
            </>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
