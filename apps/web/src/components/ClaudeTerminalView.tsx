import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@vibetree/ui'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import type { Terminal as XTerm } from '@xterm/xterm'

interface ClaudeTerminalViewProps {
  worktreePath: string
}

export function ClaudeTerminalView({ worktreePath }: ClaudeTerminalViewProps) {
  const { theme, addClaudeTerminalSession, removeClaudeTerminalSession } = useAppStore()
  const { getAdapter } = useWebSocket()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const hasStartedClaudeRef = useRef(false)

  useEffect(() => {
    if (!worktreePath) return

    const adapter = getAdapter()
    if (!adapter) return

    const startSession = async () => {
      try {
        const result = await adapter.startShell(worktreePath, undefined, undefined, true)

        if (result.success && result.processId) {
          const actualSessionId = result.processId

          const unsubscribeOutput = adapter.onShellOutput(actualSessionId, (data) => {
            if (terminalRef.current) {
              terminalRef.current.write(data)
            }
          })

          const unsubscribeExit = adapter.onShellExit(actualSessionId, (code) => {
            if (terminalRef.current) {
              terminalRef.current.write(`\r\n[Process exited with code ${code}]\r\n`)
            }
            setSessionId(null)
            removeClaudeTerminalSession(worktreePath)
            hasStartedClaudeRef.current = false
          })

          cleanupRef.current = [unsubscribeOutput, unsubscribeExit]
          setSessionId(actualSessionId)
          addClaudeTerminalSession(worktreePath, actualSessionId)

          // Wait a bit for the shell to be ready, then run claude command
          if (!hasStartedClaudeRef.current) {
            hasStartedClaudeRef.current = true
            setTimeout(() => {
              adapter.writeToShell(actualSessionId, 'claude --continue --permission-mode bypassPermissions\n')
            }, 500)
          }
        }
      } catch (error) {
        console.error('Failed to start Claude terminal session:', error)
      }
    }

    startSession()

    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup())
      cleanupRef.current = []
    }
  }, [worktreePath, getAdapter])

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal
  }

  const handleTerminalData = (data: string) => {
    if (sessionId) {
      const adapter = getAdapter()
      adapter?.writeToShell(sessionId, data)
    }
  }

  const handleTerminalResize = (cols: number, rows: number) => {
    if (sessionId) {
      const adapter = getAdapter()
      adapter?.resizeShell(sessionId, cols, rows)
    }
  }

  return (
    <div className="w-full h-full">
      {sessionId ? (
        <Terminal
          id={sessionId}
          config={{ theme }}
          onReady={handleTerminalReady}
          onData={handleTerminalData}
          onResize={handleTerminalResize}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>Starting Claude session...</p>
        </div>
      )}
    </div>
  )
}
