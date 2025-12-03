import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  CornerDownLeft,
  Delete,
  Eraser,
  Mic,
  Rewind,
} from 'lucide-react'
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
  PAGE_UP: '\x1b[5~',
  PAGE_DOWN: '\x1b[6~',
  TAB: '\t',
  SHIFT_TAB: '\x1b[Z',
  CTRL_C: '\x03',
  ENTER: '\r',
  BACKSPACE: '\x7f',
}

export default function MobileTerminalToolbar() {
  const { getActiveProject, terminalSessions } = useAppStore()
  const { getAdapter } = useWebSocket()
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false)
  const [inputText, setInputText] = useState('')

  const sendKey = useCallback(
    async (key: string) => {
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
    },
    [getActiveProject, terminalSessions, getAdapter]
  )

  const sendTextToTerminal = useCallback(
    async (text: string) => {
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

  const sendRewind = useCallback(async () => {
    const activeProject = getActiveProject()
    if (!activeProject?.selectedWorktree) return

    const sessionId = terminalSessions.get(activeProject.selectedWorktree)
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(sessionId, '/rewind')
      await new Promise((resolve) => setTimeout(resolve, 50))
      await adapter.writeToShell(sessionId, KEYS.ENTER)
    } catch (error) {
      console.error('Failed to send rewind:', error)
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
            onClick={() => sendKey(KEYS.CTRL_C)}
            className="px-4 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent text-red-600 dark:text-red-400 flex-shrink-0 mr-2"
          >
            ^C
          </button>
          <button
            onClick={launchClaude}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Launch Claude"
          >
            <Bot className="h-5 w-5" />
          </button>
          <button
            onClick={sendRewind}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Rewind"
          >
            <Rewind className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendTextToTerminal('clear\n')}
            className="p-3 bg-muted border rounded-md active:bg-accent flex-shrink-0 mr-2"
            title="Clear Terminal"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_LEFT)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_DOWN)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_UP)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.ARROW_RIGHT)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.PAGE_DOWN)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0"
            title="Page Down"
          >
            <ChevronsDown className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.PAGE_UP)}
            className="h-11 w-11 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center flex-shrink-0 mr-2"
            title="Page Up"
          >
            <ChevronsUp className="h-5 w-5" />
          </button>
          <button
            onClick={() => sendKey(KEYS.SHIFT_TAB)}
            className="px-3 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent flex-shrink-0"
          >
            ⇧TAB
          </button>
          <button
            onClick={() => sendKey(KEYS.TAB)}
            className="px-4 py-2.5 text-sm font-medium bg-muted border rounded-md active:bg-accent flex-shrink-0"
          >
            TAB
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
            className="p-3 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Paste"
          >
            <Clipboard className="h-4 w-4" />
          </button>
          <button
            onClick={() => sendKey(KEYS.BACKSPACE)}
            className="p-2.5 bg-muted border rounded-md active:bg-accent flex-shrink-0"
            title="Backspace"
          >
            <Delete className="h-5 w-5 -ml-px" />
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 px-2 pt-1 pb-3">
        <button
          onClick={() => sendKey(KEYS.ESC)}
          className="h-14 w-20 rounded-md border border-border bg-muted active:scale-95 transition-transform flex items-center justify-center text-sm font-medium"
        >
          ESC
        </button>
        <button
          type="button"
          onClick={() => setIsVoiceDialogOpen(true)}
          className={`h-14 flex-1 min-w-0 px-3 text-sm bg-muted border border-border rounded-md text-left cursor-pointer active:scale-95 transition-transform flex items-center gap-2 ${inputText ? 'text-white' : 'text-muted-foreground'}`}
        >
          <Mic className={`h-4 w-4 flex-shrink-0 ${inputText ? 'text-white' : ''}`} />
          <span className="truncate">{inputText || 'Type or use voice input...'}</span>
        </button>
        <button
          onClick={() => sendKey(KEYS.ENTER)}
          className="h-14 w-20 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center justify-center"
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
        text={inputText}
        setText={setInputText}
      />
    </div>
  )
}
