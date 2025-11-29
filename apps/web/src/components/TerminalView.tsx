import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@vibetree/ui'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'
import { X, Minimize2 } from 'lucide-react'
import type { Terminal as XTerm } from '@xterm/xterm'

// Cache for terminal states per session ID (like desktop app)
const terminalStateCache = new Map<string, string>()

interface TerminalViewProps {
  worktreePath: string
}

export function TerminalView({ worktreePath }: TerminalViewProps) {
  const {
    getActiveProject,
    addTerminalSession,
    removeTerminalSession,
    shouldRunStartup,
    clearWorktreeStartup,
    theme,
    setTerminalSplit,
    toggleTerminalFullscreen,
  } = useAppStore()

  // Use a function to get terminalSessions to avoid it in dependency arrays
  const getTerminalSession = (path: string) => useAppStore.getState().terminalSessions.get(path)

  const activeProject = getActiveProject()
  const selectedWorktree = worktreePath
  const isFullscreen = activeProject?.isTerminalFullscreen ?? false
  const isSplit = activeProject?.isTerminalSplit ?? false
  const { getAdapter } = useWebSocket()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [splitSessionId, setSplitSessionId] = useState<string | null>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const splitTerminalRef = useRef<XTerm | null>(null)
  const cleanupRef = useRef<(() => void)[]>([])
  const splitCleanupRef = useRef<(() => void)[]>([])
  const saveIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const splitSaveIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stability refs to prevent duplicate initialization and listener registration
  const initializingRef = useRef(false)
  const initializedWorktreeRef = useRef<string | null>(null)
  const splitInitializingRef = useRef(false)

  // Reset initialization state when worktree changes
  useEffect(() => {
    return () => {
      // Only reset if switching to a different worktree
      if (initializedWorktreeRef.current !== selectedWorktree) {
        initializingRef.current = false
        initializedWorktreeRef.current = null
      }
    }
  }, [selectedWorktree])

  useEffect(() => {
    if (!selectedWorktree) {
      return
    }

    const adapter = getAdapter()
    if (!adapter) {
      return
    }

    // Skip if already initialized for this worktree (prevents duplicate initialization)
    if (initializedWorktreeRef.current === selectedWorktree && cleanupRef.current.length > 0) {
      return
    }

    // Skip if initialization is in progress
    if (initializingRef.current) {
      return
    }

    // Check if we already have a session for this worktree
    const existingSessionId = getTerminalSession(selectedWorktree)
    if (existingSessionId) {
      // Skip if listeners already set up (prevents duplicate listeners from store updates)
      if (cleanupRef.current.length > 0) {
        return
      }

      // Mark as initialized for this worktree
      initializedWorktreeRef.current = selectedWorktree

      // Set up event listeners for existing session
      const unsubscribeOutput = adapter.onShellOutput(existingSessionId, (data) => {
        if (terminalRef.current) {
          terminalRef.current.write(data)
        }
      })

      const unsubscribeExit = adapter.onShellExit(existingSessionId, (code) => {
        if (terminalRef.current) {
          terminalRef.current.write(`\r\n[Process exited with code ${code}]\r\n`)
        }
        // Clear cached state when session exits
        terminalStateCache.delete(existingSessionId)
        removeTerminalSession(selectedWorktree)
        setSessionId(null)
        // Reset initialization tracking so a new session can be started
        initializedWorktreeRef.current = null
      })

      cleanupRef.current = [unsubscribeOutput, unsubscribeExit]
      setSessionId(existingSessionId)

      // Restore terminal state for existing session
      const cachedState = terminalStateCache.get(existingSessionId)
      if (cachedState && terminalRef.current) {
        setTimeout(() => {
          if (terminalRef.current && cachedState) {
            terminalRef.current.clear()
            terminalRef.current.write(cachedState)
          }
        }, 100)
      }

      return
    }

    // Start new shell session
    const startSession = async () => {
      // Prevent duplicate session starts
      if (initializingRef.current) {
        return
      }
      initializingRef.current = true

      try {
        // Check if this worktree needs startup commands (newly created from UI)
        const runStartup = shouldRunStartup(selectedWorktree)
        if (runStartup) {
          clearWorktreeStartup(selectedWorktree)
        }

        const result = await adapter.startShell(selectedWorktree, undefined, undefined, undefined, runStartup)

        if (result.success && result.processId) {
          const actualSessionId = result.processId

          // Set up event listeners using the server-provided session ID
          const unsubscribeOutput = adapter.onShellOutput(actualSessionId, (data) => {
            if (terminalRef.current) {
              terminalRef.current.write(data)
            }
          })

          const unsubscribeExit = adapter.onShellExit(actualSessionId, (code) => {
            if (terminalRef.current) {
              terminalRef.current.write(`\r\n[Process exited with code ${code}]\r\n`)
            }
            terminalStateCache.delete(actualSessionId)
            removeTerminalSession(selectedWorktree)
            setSessionId(null)
            // Reset initialization tracking so a new session can be started
            initializedWorktreeRef.current = null
            initializingRef.current = false
          })

          cleanupRef.current = [unsubscribeOutput, unsubscribeExit]

          setSessionId(actualSessionId)
          addTerminalSession(selectedWorktree, actualSessionId)

          // Mark as initialized for this worktree
          initializedWorktreeRef.current = selectedWorktree

          // Handle terminal state restoration
          if (!result.isNew) {
            const cachedState = terminalStateCache.get(actualSessionId)
            if (cachedState && terminalRef.current) {
              terminalRef.current.clear()
              setTimeout(() => {
                if (terminalRef.current && cachedState) {
                  terminalRef.current.write(cachedState)
                }
              }, 100)
            }
          }
        } else {
          console.error('Failed to start shell session:', result.error)
        }
      } catch (error) {
        console.error('Failed to start shell session:', error)
      } finally {
        initializingRef.current = false
      }
    }

    startSession()

    return () => {
      // Cleanup listeners but don't reset initializedWorktreeRef here
      // to prevent re-initialization on effect re-run
      cleanupRef.current.forEach((cleanup) => cleanup())
      cleanupRef.current = []
    }
  }, [selectedWorktree, getAdapter, addTerminalSession, removeTerminalSession, shouldRunStartup, clearWorktreeStartup])

  // Cleanup split terminal on unmount
  useEffect(() => {
    return () => {
      splitCleanupRef.current.forEach((cleanup) => cleanup())
      splitCleanupRef.current = []
      if (splitSaveIntervalRef.current) {
        clearInterval(splitSaveIntervalRef.current)
        splitSaveIntervalRef.current = null
      }
    }
  }, [])

  // Periodic state saving for split terminal
  useEffect(() => {
    if (!splitSessionId) return

    splitSaveIntervalRef.current = setInterval(() => {
      if (splitSessionId) {
        try {
          const terminalInstance = (window as any)[`terminal_${splitSessionId}`]
          if (terminalInstance?.serialize) {
            const serializedState = terminalInstance.serialize()
            if (serializedState) {
              terminalStateCache.set(splitSessionId, serializedState)
            }
          }
        } catch (error) {
          console.error('Failed to save split terminal state:', error)
        }
      }
    }, 5000)

    return () => {
      if (splitSessionId) {
        try {
          const terminalInstance = (window as any)[`terminal_${splitSessionId}`]
          if (terminalInstance?.serialize) {
            const serializedState = terminalInstance.serialize()
            if (serializedState) {
              terminalStateCache.set(splitSessionId, serializedState)
            }
          }
        } catch (error) {
          console.error('Failed to save split terminal state on unmount:', error)
        }
      }

      if (splitSaveIntervalRef.current) {
        clearInterval(splitSaveIntervalRef.current)
        splitSaveIntervalRef.current = null
      }
    }
  }, [splitSessionId])

  // Trigger resize when split state changes to ensure proper 50/50 layout
  useEffect(() => {
    const handleSplitResize = () => {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        // Trigger resize for both terminals by dispatching window resize event
        window.dispatchEvent(new Event('resize'))
      }, 100)
    }

    if (isSplit || (!isSplit && splitSessionId === null)) {
      handleSplitResize()
    }
  }, [isSplit, splitSessionId])

  // Periodic state saving and cleanup (like desktop app)
  useEffect(() => {
    if (!sessionId) return

    // Start periodic saving every 5 seconds (like desktop app)
    saveIntervalRef.current = setInterval(() => {
      if (sessionId) {
        try {
          const terminalInstance = (window as any)[`terminal_${sessionId}`]
          if (terminalInstance?.serialize) {
            const serializedState = terminalInstance.serialize()
            if (serializedState) {
              terminalStateCache.set(sessionId, serializedState)
              console.log('💾 Periodic save for session:', sessionId)
            }
          }
        } catch (error) {
          console.error('Failed to save terminal state:', error)
        }
      }
    }, 5000)

    return () => {
      // Save state before component unmount (like desktop app)
      if (sessionId) {
        try {
          const terminalInstance = (window as any)[`terminal_${sessionId}`]
          if (terminalInstance?.serialize) {
            const serializedState = terminalInstance.serialize()
            if (serializedState) {
              terminalStateCache.set(sessionId, serializedState)
              console.log('💾 Final save on unmount for session:', sessionId)
            }
          }
        } catch (error) {
          console.error('Failed to save terminal state on unmount:', error)
        }
      }

      // Clear interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current)
        saveIntervalRef.current = null
      }
    }
  }, [sessionId])

  const handleTerminalData = async (data: string) => {
    if (!sessionId) {
      return
    }

    const adapter = getAdapter()
    if (!adapter) {
      return
    }

    try {
      await adapter.writeToShell(sessionId, data)
    } catch (error) {
      console.error('Failed to write to shell:', error)
    }
  }

  const handleTerminalResize = async (cols: number, rows: number) => {
    if (!sessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.resizeShell(sessionId, cols, rows)
    } catch (error) {
      console.error('Failed to resize shell:', error)
    }
  }

  const handleTerminalReady = (terminal: XTerm) => {
    terminalRef.current = terminal
  }

  const handleSplitTerminalData = async (data: string) => {
    if (!splitSessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.writeToShell(splitSessionId, data)
    } catch (error) {
      console.error('Failed to write to split shell:', error)
    }
  }

  const handleSplitTerminalResize = async (cols: number, rows: number) => {
    if (!splitSessionId) return

    const adapter = getAdapter()
    if (!adapter) return

    try {
      await adapter.resizeShell(splitSessionId, cols, rows)
    } catch (error) {
      console.error('Failed to resize split shell:', error)
    }
  }

  const handleSplitTerminalReady = (terminal: XTerm) => {
    splitTerminalRef.current = terminal
  }

  // Handle split terminal when store state changes
  useEffect(() => {
    const startSplitTerminal = async () => {
      if (!isSplit || splitSessionId) return

      // Prevent duplicate initialization
      if (splitInitializingRef.current) return
      if (splitCleanupRef.current.length > 0) return

      splitInitializingRef.current = true

      const adapter = getAdapter()
      if (!adapter || !selectedWorktree) {
        splitInitializingRef.current = false
        return
      }

      try {
        const result = await adapter.startShell(selectedWorktree, undefined, undefined, true)
        if (result.success && result.processId) {
          const actualSessionId = result.processId

          const unsubscribeOutput = adapter.onShellOutput(actualSessionId, (data) => {
            if (splitTerminalRef.current) {
              splitTerminalRef.current.write(data)
            }
          })

          const unsubscribeExit = adapter.onShellExit(actualSessionId, (code) => {
            if (splitTerminalRef.current) {
              splitTerminalRef.current.write(`\r\n[Process exited with code ${code}]\r\n`)
            }
            terminalStateCache.delete(actualSessionId)
            removeTerminalSession(`${selectedWorktree}_split`)
            setSplitSessionId(null)
            splitInitializingRef.current = false
            if (activeProject) {
              setTerminalSplit(activeProject.id, false)
            }
          })

          splitCleanupRef.current = [unsubscribeOutput, unsubscribeExit]
          setSplitSessionId(actualSessionId)
          addTerminalSession(`${selectedWorktree}_split`, actualSessionId)
        }
      } catch (error) {
        console.error('Failed to start split shell session:', error)
        if (activeProject) {
          setTerminalSplit(activeProject.id, false)
        }
      } finally {
        splitInitializingRef.current = false
      }
    }

    if (isSplit && !splitSessionId) {
      startSplitTerminal()
    } else if (!isSplit && splitSessionId) {
      // Close split terminal
      splitCleanupRef.current.forEach((cleanup) => cleanup())
      splitCleanupRef.current = []
      terminalStateCache.delete(splitSessionId)
      removeTerminalSession(`${selectedWorktree}_split`)
      setSplitSessionId(null)
      splitInitializingRef.current = false
    }
  }, [
    isSplit,
    splitSessionId,
    selectedWorktree,
    activeProject,
    getAdapter,
    addTerminalSession,
    removeTerminalSession,
    setTerminalSplit,
  ])

  const closeSplitTerminal = () => {
    if (activeProject) {
      setTerminalSplit(activeProject.id, false)
    }
  }

  if (!selectedWorktree) return null

  return (
    <div className={`flex flex-col w-full h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {isFullscreen && activeProject && (
        <button
          onClick={() => toggleTerminalFullscreen(activeProject.id)}
          className="fixed top-4 right-4 z-[51] p-2 bg-accent hover:bg-accent/80 text-foreground rounded-md shadow-lg transition-colors"
          title="Exit Fullscreen"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}
      {/* Terminal Container */}
      <div
        className={`flex-1 flex min-h-0 ${isSplit ? 'flex-col md:flex-row' : ''} ${theme === 'light' ? 'bg-white' : 'bg-black'}`}
      >
        <div
          className={isSplit ? 'h-1/2 md:h-full w-full md:w-1/2 border-b md:border-b-0 md:border-r' : 'w-full h-full'}
        >
          {sessionId && (
            <Terminal
              id={sessionId}
              onData={handleTerminalData}
              onResize={handleTerminalResize}
              onReady={handleTerminalReady}
              config={{
                theme: theme,
                fontSize: 12,
                fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
                cursorBlink: false,
              }}
            />
          )}
          {!sessionId && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Starting terminal session...</p>
            </div>
          )}
        </div>
        {isSplit && (
          <div className="h-1/2 md:h-full w-full md:w-1/2 relative">
            <button
              onClick={closeSplitTerminal}
              className="absolute top-2 right-2 z-10 p-1 hover:bg-accent/80 rounded bg-background/50"
              title="Close Split Terminal"
            >
              <X className="h-4 w-4" />
            </button>
            {splitSessionId && (
              <Terminal
                id={splitSessionId}
                onData={handleSplitTerminalData}
                onResize={handleSplitTerminalResize}
                onReady={handleSplitTerminalReady}
                config={{
                  theme: theme,
                  fontSize: 12,
                  fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
                  cursorBlink: false,
                }}
              />
            )}
            {!splitSessionId && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Starting split terminal session...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
