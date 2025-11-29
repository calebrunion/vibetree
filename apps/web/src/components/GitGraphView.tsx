import { useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { Minimize2, RefreshCw, Users, User } from 'lucide-react'
import GitGraph from './GitGraph'
import { useWebSocket } from '../hooks/useWebSocket'
import type { GitCommit } from '@vibetree/core'

interface GitGraphViewProps {
  worktreePath: string
  theme?: 'light' | 'dark'
  isFullscreen?: boolean
  onExitFullscreen?: () => void
}

export interface GitGraphViewRef {
  refresh: () => void
}

export const GitGraphView = forwardRef<GitGraphViewRef, GitGraphViewProps>(function GitGraphView(
  { worktreePath, theme = 'dark', isFullscreen = false, onExitFullscreen },
  ref
) {
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllAuthors, setShowAllAuthors] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const { getAdapter } = useWebSocket()

  useEffect(() => {
    const fetchUserName = async () => {
      const adapter = getAdapter()
      if (!adapter || !('getGitUserName' in adapter)) return
      try {
        const name = await (adapter as any).getGitUserName(worktreePath)
        setUserName(name)
      } catch (err) {
        console.error('Failed to get git user name:', err)
      }
    }
    fetchUserName()
  }, [worktreePath, getAdapter])

  const loadGitLog = useCallback(async () => {
    const adapter = getAdapter()
    if (!adapter || !('getGitLogGraph' in adapter)) return

    try {
      setLoading(true)
      setError(null)
      const authorFilter = showAllAuthors ? undefined : userName
      const gitCommits = await (adapter as any).getGitLogGraph(worktreePath, 100, authorFilter)
      setCommits(gitCommits)
    } catch (err) {
      console.error('Failed to load git log:', err)
      setError(err instanceof Error ? err.message : 'Failed to load git log')
      setCommits([])
    } finally {
      setLoading(false)
    }
  }, [worktreePath, getAdapter, showAllAuthors, userName])

  useEffect(() => {
    if (worktreePath) {
      loadGitLog()
    }
  }, [worktreePath, loadGitLog])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && onExitFullscreen) {
        onExitFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isFullscreen, onExitFullscreen])

  useImperativeHandle(
    ref,
    () => ({
      refresh: loadGitLog,
    }),
    [loadGitLog]
  )

  if (loading && commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={loadGitLog}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={`h-full overflow-hidden bg-background flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {isFullscreen && onExitFullscreen && (
        <button
          onClick={onExitFullscreen}
          className="fixed bottom-4 right-4 z-[51] p-2 bg-accent hover:bg-accent/80 text-foreground rounded-md shadow-lg transition-colors"
          title="Exit Fullscreen"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          onClick={() => setShowAllAuthors(!showAllAuthors)}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
            showAllAuthors ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
          }`}
          title={showAllAuthors ? 'Showing all authors' : `Showing commits by ${userName || 'you'}`}
        >
          {showAllAuthors ? (
            <>
              <Users className="h-3 w-3" />
              All
            </>
          ) : (
            <>
              <User className="h-3 w-3" />
              Mine
            </>
          )}
        </button>
        {userName && !showAllAuthors && <span className="text-xs text-muted-foreground">{userName}</span>}
      </div>
      <div className="flex-1 overflow-hidden">
        <GitGraph
          commits={commits}
          theme={theme}
          isFullscreen={isFullscreen}
          onCommitClick={(commit) => {
            console.log('Clicked commit:', commit)
          }}
        />
      </div>
    </div>
  )
})
