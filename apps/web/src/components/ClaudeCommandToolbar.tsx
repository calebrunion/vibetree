import { BarChart3, Bot, Eye, GitCommit, Minimize2, Play, RefreshCw, Rewind, SquarePen } from 'lucide-react'
import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

const KEYS = {
  CTRL_C: '\x03',
  ENTER: '\r',
}

export default function ClaudeCommandToolbar() {
  const { getActiveProject, terminalSessions } = useAppStore()
  const { getAdapter } = useWebSocket()

  const sendCommand = useCallback(
    async (command: string) => {
      const activeProject = getActiveProject()
      if (!activeProject?.selectedWorktree) return

      const sessionId = terminalSessions.get(activeProject.selectedWorktree)
      if (!sessionId) return

      const adapter = getAdapter()
      if (!adapter) return

      try {
        await adapter.writeToShell(sessionId, command)
        await new Promise((resolve) => setTimeout(resolve, 50))
        await adapter.writeToShell(sessionId, KEYS.ENTER)
      } catch (error) {
        console.error('Failed to send command:', error)
      }
    },
    [getActiveProject, terminalSessions, getAdapter]
  )

  const launchClaude = useCallback(async () => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, KEYS.CTRL_C)
      await new Promise((resolve) => setTimeout(resolve, 100))
      await adapter.writeToShell(
        sessionId,
        'claude -c --permission-mode bypassPermissions || claude --permission-mode bypassPermissions\n'
      )
    } catch (error) {
      console.error('Failed to launch Claude:', error)
    }
  }, [getActiveProject, terminalSessions, getAdapter])

  const activeProject = getActiveProject()

  if (!activeProject?.selectedWorktree) {
    return null
  }

  return (
    <div className="hidden md:flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-hide border-b border-border bg-background">
      <button
        onClick={launchClaude}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Launch Claude"
      >
        <Bot className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">claude</span>
      </button>
      <button
        onClick={() => sendCommand('commit')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Commit"
      >
        <GitCommit className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">commit</span>
      </button>
      <button
        onClick={() => sendCommand('/new')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="New Chat"
      >
        <SquarePen className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">/new</span>
      </button>
      <button
        onClick={() => sendCommand('/rewind')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Rewind"
      >
        <Rewind className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">rewind</span>
      </button>
      <button
        onClick={() => sendCommand('/compact')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Compact"
      >
        <Minimize2 className="h-4 w-4 text-white -rotate-45" />
        <span className="font-mono text-sm text-muted-foreground">/compact</span>
      </button>
      <button
        onClick={() => sendCommand('push')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Push"
      >
        <RefreshCw className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">push</span>
      </button>
      <button
        onClick={() => sendCommand('/usage')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Usage"
      >
        <BarChart3 className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">/usage</span>
      </button>
      <button
        onClick={() => sendCommand('start dev server')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Start Dev Server"
      >
        <Play className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">dev</span>
      </button>
      <button
        onClick={() => sendCommand('/review')}
        className="h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0"
        title="Review"
      >
        <Eye className="h-4 w-4 text-white" />
        <span className="font-mono text-sm text-muted-foreground">/review</span>
      </button>
    </div>
  )
}
