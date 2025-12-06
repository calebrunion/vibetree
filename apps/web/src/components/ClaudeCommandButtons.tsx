import {
  BarChart3,
  Bot,
  Eye,
  GitCommit,
  ListTodo,
  LucideIcon,
  Minimize2,
  Play,
  RefreshCw,
  Rewind,
  SquarePen,
} from 'lucide-react'
import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useWebSocket } from '../hooks/useWebSocket'

const KEYS = {
  CTRL_C: '\x03',
  ENTER: '\r',
}

interface Command {
  id: string
  label: string
  title: string
  icon: LucideIcon
  isLaunch?: boolean
  command?: string
  iconClass?: string
}

const COMMANDS: Command[] = [
  { id: 'claude', label: 'claude', title: 'Launch Claude', icon: Bot, isLaunch: true },
  { id: 'commit', label: 'commit', title: 'Commit', icon: GitCommit, command: 'commit' },
  { id: 'dev', label: 'dev', title: 'Start Dev Server', icon: Play, command: 'start dev server' },
  {
    id: 'tasks',
    label: 'tasks',
    title: 'Show Notion Tasks',
    icon: ListTodo,
    command: 'show me my unchecked tasks from the Buddy list in Notion',
  },
  { id: 'new', label: '/new', title: 'New Chat', icon: SquarePen, command: '/new' },
  { id: 'rewind', label: 'rewind', title: 'Rewind', icon: Rewind, command: '/rewind' },
  { id: 'compact', label: '/compact', title: 'Compact', icon: Minimize2, command: '/compact', iconClass: '-rotate-45' },
  { id: 'push', label: 'push', title: 'Push', icon: RefreshCw, command: 'push' },
  { id: 'usage', label: '/usage', title: 'Usage', icon: BarChart3, command: '/usage' },
  { id: 'review', label: '/review', title: 'Review', icon: Eye, command: '/review' },
]

export default function ClaudeCommandButtons({ size = 'desktop' }: { size?: 'desktop' | 'mobile' }) {
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

  const isMobile = size === 'mobile'
  const buttonClass = isMobile
    ? 'h-11 px-3 rounded-md bg-muted border border-border active:scale-95 transition-transform flex items-center gap-2 flex-shrink-0'
    : 'h-8 px-3 rounded-md bg-muted border border-border hover:bg-accent active:scale-95 transition-all flex items-center gap-2 flex-shrink-0'
  const iconClass = isMobile ? 'h-5 w-5 text-white' : 'h-4 w-4 text-white'

  return (
    <>
      {COMMANDS.map((cmd) => {
        const Icon = cmd.icon
        return (
          <button
            key={cmd.id}
            onClick={cmd.isLaunch ? launchClaude : () => sendCommand(cmd.command!)}
            className={buttonClass}
            title={cmd.title}
          >
            <Icon className={`${iconClass} ${cmd.iconClass || ''}`} />
            <span className="font-mono text-sm text-muted-foreground">{cmd.label}</span>
          </button>
        )
      })}
    </>
  )
}
