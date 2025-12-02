import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@buddy/ui'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { RotateCcw } from 'lucide-react'
import type { Terminal as XTerm } from '@xterm/xterm'

interface ClaudeTerminalViewProps {
  worktreePath: string
}

export function ClaudeTerminalView({ worktreePath }: ClaudeTerminalViewProps) {
  const { theme, addClaudeTerminalSession, removeClaudeTerminalSession } = useAppStore()
  const { getAdapter } = useWebSocket()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)
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

  const reloadTerminal = async () => {
    if (isReloading) return

    setIsReloading(true)
    const adapter = getAdapter()
    if (!adapter || !worktreePath) {
      setIsReloading(false)
      return
    }

    try {
      // Cleanup existing listeners
      cleanupRef.current.forEach((cleanup) => cleanup())
      cleanupRef.current = []

      // Terminate existing session if any
      if (sessionId) {
        try {
          await adapter.terminateShell(sessionId)
        } catch {
          // Ignore errors when terminating
        }
        removeClaudeTerminalSession(worktreePath)
      }

      // Clear terminal display
      if (terminalRef.current) {
        terminalRef.current.clear()
        terminalRef.current.write('\x1b[2J\x1b[H')
      }

      // Reset state
      setSessionId(null)
      hasStartedClaudeRef.current = false

      // Start a new session
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

        // Wait for shell to be ready, then run claude command
        if (!hasStartedClaudeRef.current) {
          hasStartedClaudeRef.current = true
          setTimeout(() => {
            adapter.writeToShell(actualSessionId, 'claude --continue --permission-mode bypassPermissions\n')
          }, 500)
        }
      } else {
        console.error('Failed to reload Claude terminal session:', result.error)
      }
    } catch (error) {
      console.error('Failed to reload Claude terminal:', error)
    } finally {
      setIsReloading(false)
    }
  }

  return (
    <div className="w-full h-full relative">
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
          <p>{isReloading ? 'Reloading Claude session...' : 'Starting Claude session...'}</p>
        </div>
      )}
      <button
        onClick={reloadTerminal}
        disabled={isReloading}
        className="absolute top-2 right-2 z-10 group size-[34px] p-0 bg-black hover:bg-accent rounded-md transition-colors border border-border inline-flex items-center justify-center disabled:opacity-50"
        title="Reload Claude Terminal"
      >
        <RotateCcw className={`h-4 w-4 text-[#999] group-hover:text-white ${isReloading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
