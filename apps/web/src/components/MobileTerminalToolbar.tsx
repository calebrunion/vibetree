import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

const KEYS = {
  ESC: '\x1b',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
  TAB: '\t',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
}

export default function MobileTerminalToolbar() {
  const { getActiveProject, terminalSessions } = useAppStore()
  const { getAdapter } = useWebSocket()

  const sendKey = async (key: string) => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, key)
    } catch (error) {
      console.error('Failed to send key:', error)
    }
  }

  return (
    <div className="md:hidden flex items-center justify-between gap-1 px-2 py-1.5 bg-muted/50 border-b">
      <button
        onClick={() => sendKey(KEYS.ESC)}
        className="px-3 py-2 text-xs font-medium bg-background border rounded-md active:bg-accent"
      >
        ESC
      </button>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => sendKey(KEYS.ARROW_LEFT)}
          className="p-2 bg-background border rounded-md active:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => sendKey(KEYS.ARROW_UP)}
          className="p-2 bg-background border rounded-md active:bg-accent"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => sendKey(KEYS.ARROW_DOWN)}
          className="p-2 bg-background border rounded-md active:bg-accent"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
        <button
          onClick={() => sendKey(KEYS.ARROW_RIGHT)}
          className="p-2 bg-background border rounded-md active:bg-accent"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => sendKey(KEYS.SHIFT_TAB)}
          className="px-2 py-2 text-xs font-medium bg-background border rounded-md active:bg-accent"
        >
          ⇧TAB
        </button>
        <button
          onClick={() => sendKey(KEYS.TAB)}
          className="px-3 py-2 text-xs font-medium bg-background border rounded-md active:bg-accent"
        >
          TAB
        </button>
      </div>

      <button
        onClick={() => sendKey(KEYS.CTRL_C)}
        className="px-2 py-2 text-xs font-medium bg-background border rounded-md active:bg-accent text-red-600 dark:text-red-400"
      >
        ^C
      </button>
    </div>
  )
}
