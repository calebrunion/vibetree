import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bot, Clipboard, CornerDownLeft, GitCommit, MessageSquare, MessageSquarePlus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import VoiceInputDialog from './VoiceInputDialog'

const KEYS = {
  ESC: '\x1b',
  ARROW_UP: '\x1b[A',
  ARROW_DOWN: '\x1b[B',
  ARROW_RIGHT: '\x1b[C',
  ARROW_LEFT: '\x1b[D',
  TAB: '\t',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
  ENTER: '\r',
}

export default function MobileTerminalToolbar() {
  const { getActiveProject, terminalSessions } = useAppStore()
  const { getAdapter } = useWebSocket()
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false)

  const sendKey = useCallback(async (key: string) => {
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
  }, [getActiveProject, terminalSessions, getAdapter])

  const sendTextToTerminal = useCallback(async (text: string) => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, text)
    } catch (error) {
      console.error('Failed to send text:', error)
    }
  }, [getActiveProject, terminalSessions, getAdapter])

  const launchClaude = useCallback(async () => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, KEYS.CTRL_C)
      await new Promise(resolve => setTimeout(resolve, 100))
      await adapter.writeToShell(sessionId, 'claude -c --permission-mode bypassPermissions\n')
    } catch (error) {
      console.error('Failed to launch Claude:', error)
    }
  }, [getActiveProject, terminalSessions, getAdapter])

  const activeProject = getActiveProject()

  if (!activeProject?.selectedWorktree) {
    return null
  }

  return (
    <div className="md:hidden flex flex-col">
      <div className="overflow-x-auto scrollbar-hide bg-background py-2 px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => sendKey(KEYS.ESC)}
            className="px-4 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent flex-shrink-0"
          >
            ESC
          </button>
          <button
            onClick={launchClaude}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Launch Claude"
          >
            <Bot className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendTextToTerminal('commit')}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Commit"
          >
            <GitCommit className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendTextToTerminal('/clear')}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Clear"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.SHIFT_TAB)}
            className="px-3 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent flex-shrink-0"
          >
            ⇧TAB
          </button>
          <button
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText()
                if (text) sendTextToTerminal(text)
              } catch (err) {
                console.error('Failed to read clipboard:', err)
              }
            }}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Paste"
          >
            <Clipboard className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.TAB)}
            className="px-4 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent flex-shrink-0"
          >
            TAB
          </button>
          <button
            onClick={() => sendKey(KEYS.CTRL_C)}
            className="px-4 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent text-red-600 dark:text-red-400 flex-shrink-0"
          >
            ^C
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between px-2 pt-4 pb-0">
        <button
          onClick={() => setIsVoiceDialogOpen(true)}
          className="h-11 w-20 rounded-md border border-border bg-muted active:scale-95 transition-transform flex items-center justify-center"
          title="Open voice input"
          aria-label="Open voice input"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => sendKey(KEYS.ARROW_LEFT)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_DOWN)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_UP)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_RIGHT)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={() => sendKey(KEYS.ENTER)}
          className="h-11 w-20 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
          title="Send Enter"
          aria-label="Send Enter"
        >
          <CornerDownLeft className="h-6 w-6" />
        </button>
      </div>

      <VoiceInputDialog
        isOpen={isVoiceDialogOpen}
        onClose={() => setIsVoiceDialogOpen(false)}
        onSend={sendTextToTerminal}
        onEnter={() => sendKey(KEYS.ENTER)}
      />
    </div>
  )
}
