import { useAppStore } from '../store'
import ClaudeCommandButtons from './ClaudeCommandButtons'

export default function ClaudeCommandToolbar() {
  const { getActiveProject } = useAppStore()
  const activeProject = getActiveProject()

  if (!activeProject?.selectedWorktree) {
    return null
  }

  return (
    <div className="hidden md:flex items-center gap-2 px-2 py-2 overflow-x-auto scrollbar-hide border-b border-border bg-background">
      <ClaudeCommandButtons size="desktop" />
    </div>
  )
}
