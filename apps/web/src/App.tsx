import { LoginPage, useAuth } from '@buddy/auth'
import { ConfirmDialog, Tabs, TabsContent, TabsList, TabsTrigger } from '@buddy/ui'
import {
  CheckCircle,
  Columns2,
  GitBranch,
  GitCommitHorizontal,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Rows2,
  Sliders,
  Sun,
  Terminal,
  X,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import AddProjectModal from './components/AddProjectModal'
import { ConnectionStatus } from './components/ConnectionStatus'
import { FloatingAddWorktree } from './components/FloatingAddWorktree'
import DeleteWorktreeDialog from './components/DeleteWorktreeDialog'
import type { GitDiffViewRef } from './components/GitDiffView'

const GitDiffView = lazy(() => import('./components/GitDiffView').then((m) => ({ default: m.GitDiffView })))
import type { GitGraphViewRef } from './components/GitGraphView'

const GitGraphView = lazy(() => import('./components/GitGraphView').then((m) => ({ default: m.GitGraphView })))
import ClaudeCommandToolbar from './components/ClaudeCommandToolbar'
import MobileTerminalToolbar from './components/MobileTerminalToolbar'
import { MobileWorktreeTabs } from './components/MobileWorktreeTabs'
import { ProjectSelector } from './components/ProjectSelector'
import ReconnectingModal from './components/ReconnectingModal'
import StartupScriptModal from './components/StartupScriptModal'
import { TerminalManager } from './components/TerminalManager'
import { WorktreePanel } from './components/WorktreePanel'
import { useKeepAwake } from './hooks/useKeepAwake'
import { useWebSocket } from './hooks/useWebSocket'
import { autoLoadProjects, validateProjectPaths } from './services/projectValidation'
import { useAppStore } from './store'

function App() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const {
    projects,
    activeProjectId,
    addProject,
    addProjects,
    removeProject,
    setActiveProject,
    setSelectedTab,
    setSelectedWorktree,
    updateProjectWorktrees,
    theme,
    setTheme,
    connected,
    reconnecting,
    toggleTerminalSplit,
    toggleTerminalFullscreen,
    toggleDiffFullscreen,
    toggleGraphFullscreen,
    setShowAddWorktreeDialog,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    unreadBellWorktrees,
    clearWorktreeBell,
  } = useAppStore()
  const { connect, getAdapter } = useWebSocket()
  const { request: requestKeepAwake } = useKeepAwake()
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [projectToRemove, setProjectToRemove] = useState<string | null>(null)
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false)
  const [isRefreshingTerminal, setIsRefreshingTerminal] = useState(false)
  const [isRefreshingChanges, setIsRefreshingChanges] = useState(false)
  const [isRefreshingGraph, setIsRefreshingGraph] = useState(false)
  const gitDiffRefs = useRef<Map<string, GitDiffViewRef>>(new Map())
  const gitGraphRefs = useRef<Map<string, GitGraphViewRef>>(new Map())
  const activeProjectTabRef = useRef<HTMLButtonElement>(null)

  // const activeProject = getActiveProject();

  useEffect(() => {
    // Auto-connect on mount
    connect()
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const hasActiveWorktree = activeProject?.selectedWorktree != null

  useEffect(() => {
    if (hasActiveWorktree) {
      requestKeepAwake()
    }
  }, [hasActiveWorktree, requestKeepAwake])

  // Auto-load projects when connection is established
  useEffect(() => {
    if (connected && !autoLoadAttempted && projects.length === 0) {
      const loadProjects = async () => {
        try {
          // Get auto-load configuration from backend
          const autoLoadResponse = await autoLoadProjects()

          if (autoLoadResponse.validationResults.length > 0) {
            const validPaths = autoLoadResponse.validationResults
              .filter((result) => result.valid)
              .map((result) => result.path)

            if (validPaths.length > 0) {
              // Add valid projects
              const addedIds = addProjects(validPaths)

              // Set default project if specified by backend
              if (autoLoadResponse.defaultProjectPath) {
                const defaultIndex = validPaths.indexOf(autoLoadResponse.defaultProjectPath)
                if (defaultIndex >= 0) {
                  const defaultId = addedIds[defaultIndex]
                  setActiveProject(defaultId)
                }
              }

              console.log(`Auto-loaded ${validPaths.length} projects`)

              // Show success notification
              setSuccessMessage(
                `Successfully auto-loaded ${validPaths.length} project${validPaths.length === 1 ? '' : 's'}`
              )
              setShowSuccessNotification(true)

              // Auto-hide notification after 3 seconds
              setTimeout(() => {
                setShowSuccessNotification(false)
              }, 3000)
            }

            // Log validation errors for invalid paths
            const invalidResults = autoLoadResponse.validationResults.filter((result) => !result.valid)
            if (invalidResults.length > 0) {
              console.warn('Some projects failed validation:', invalidResults)
            }
          }
        } catch (error) {
          console.error('Auto-load failed:', error)
        }

        setAutoLoadAttempted(true)
      }

      loadProjects()
    }
  }, [connected, autoLoadAttempted, projects.length, addProjects, setActiveProject])

  useEffect(() => {
    // Initialize theme from localStorage or system preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      setTheme(systemTheme)
    }
  }, [setTheme])

  useEffect(() => {
    // Apply theme class to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    requestAnimationFrame(() => {
      if (activeProjectTabRef.current) {
        activeProjectTabRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
      }
    })
  }, [activeProjectId, projects.length])

  const cycleProject = useCallback(
    (direction: 'next' | 'prev') => {
      if (projects.length <= 1) return
      const currentIndex = projects.findIndex((p) => p.id === activeProjectId)
      if (currentIndex === -1) return

      let newIndex: number
      if (direction === 'next') {
        newIndex = (currentIndex + 1) % projects.length
      } else {
        newIndex = (currentIndex - 1 + projects.length) % projects.length
      }
      setActiveProject(projects[newIndex].id)
    },
    [projects, activeProjectId, setActiveProject]
  )

  const getCurrentTab = useCallback((project: (typeof projects)[0]): 'terminal' | 'changes' | 'graph' => {
    if (!project.selectedWorktree) return 'terminal'
    return project.selectedTabs?.[project.selectedWorktree] || 'terminal'
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        cycleProject(e.key === 'ArrowLeft' ? 'prev' : 'next')
      }

      // Opt+Tab to toggle between terminal and changes tabs (if on graph, switch to terminal)
      if (e.altKey && e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const activeProject = projects.find((p) => p.id === activeProjectId)
        if (activeProject?.selectedWorktree) {
          e.preventDefault()
          const currentTab = getCurrentTab(activeProject)
          if (currentTab === 'graph') {
            setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'terminal')
          } else if (currentTab === 'terminal') {
            setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'changes')
          } else {
            setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'terminal')
          }
        }
      }

      if (e.metaKey && !e.altKey && !e.shiftKey && !e.ctrlKey) {
        const num = parseInt(e.key, 10)
        const activeProject = projects.find((p) => p.id === activeProjectId)
        if (num >= 1 && num <= 9 && activeProject) {
          const sortedWorktrees = [...activeProject.worktrees].sort((a, b) => {
            const getBranchName = (wt: typeof a) => {
              if (!wt.branch) return wt.head.substring(0, 8)
              return wt.branch.replace('refs/heads/', '')
            }
            const branchA = getBranchName(a)
            const branchB = getBranchName(b)
            if (branchA === 'main' || branchA === 'master') return -1
            if (branchB === 'main' || branchB === 'master') return 1
            return branchA.localeCompare(branchB)
          })
          if (sortedWorktrees[num - 1]) {
            e.preventDefault()
            setSelectedWorktree(activeProject.id, sortedWorktrees[num - 1].path)
          }
        }

        if (e.key === 'n' && activeProjectId) {
          e.preventDefault()
          setShowAddWorktreeDialog(true)
        }

        if (e.key === 't') {
          e.preventDefault()
          setShowAddProjectModal(true)
        }

        if (e.key === 'e' && activeProject?.selectedWorktree) {
          e.preventDefault()
          setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'terminal')
          setTimeout(() => window.dispatchEvent(new CustomEvent('focus-terminal')), 50)
        }

        if (e.key === 's' && activeProject?.selectedWorktree) {
          e.preventDefault()
          setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'changes')
        }

        if (e.key === 'g' && activeProject?.selectedWorktree) {
          e.preventDefault()
          setSelectedTab(activeProject.id, activeProject.selectedWorktree, 'graph')
        }

        if (e.key === 'd' && activeProject?.selectedWorktree) {
          e.preventDefault()
          toggleTerminalSplit(activeProject.id)
        }

        if (e.key === 'f' && activeProject?.selectedWorktree) {
          e.preventDefault()
          const currentTab = getCurrentTab(activeProject)
          if (currentTab === 'terminal') {
            toggleTerminalFullscreen(activeProject.id)
          } else if (currentTab === 'changes') {
            toggleDiffFullscreen(activeProject.id)
          } else if (currentTab === 'graph') {
            toggleGraphFullscreen(activeProject.id)
          }
        }

        // Vim-style navigation: Cmd+H/L for projects, Cmd+J/K for worktrees
        if (e.key === 'h') {
          e.preventDefault()
          cycleProject('prev')
        }

        if (e.key === 'l') {
          e.preventDefault()
          cycleProject('next')
        }

        if ((e.key === 'j' || e.key === 'k') && activeProject) {
          const sortedWorktrees = [...activeProject.worktrees].sort((a, b) => {
            const getBranchName = (wt: typeof a) => {
              if (!wt.branch) return wt.head.substring(0, 8)
              return wt.branch.replace('refs/heads/', '')
            }
            const branchA = getBranchName(a)
            const branchB = getBranchName(b)
            if (branchA === 'main' || branchA === 'master') return -1
            if (branchB === 'main' || branchB === 'master') return 1
            return branchA.localeCompare(branchB)
          })

          if (sortedWorktrees.length > 0) {
            e.preventDefault()
            const currentIndex = sortedWorktrees.findIndex((wt) => wt.path === activeProject.selectedWorktree)
            let newIndex: number
            if (e.key === 'j') {
              newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % sortedWorktrees.length
            } else {
              newIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + sortedWorktrees.length) % sortedWorktrees.length
            }
            setSelectedWorktree(activeProject.id, sortedWorktrees[newIndex].path)
          }
        }

        // Cmd+B to toggle sidebar
        if (e.key === 'b') {
          e.preventDefault()
          toggleSidebarCollapsed()
        }

        // Cmd+, to show project settings
        if (e.key === ',' && activeProject) {
          e.preventDefault()
          setShowMobileSettingsModal(true)
        }

        // Cmd+R to reload current tab
        if (e.key === 'r' && activeProject?.selectedWorktree) {
          e.preventDefault()
          const currentTab = getCurrentTab(activeProject)
          if (currentTab === 'terminal') {
            handleRefreshTerminal()
          } else if (currentTab === 'changes') {
            handleRefreshChanges(activeProject, true)
          } else if (currentTab === 'graph') {
            handleRefreshGraph(activeProject)
          }
        }

        // Cmd+W to close current project tab
        if (e.key === 'w' && activeProject) {
          e.preventDefault()
          setProjectToRemove(activeProject.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    cycleProject,
    getCurrentTab,
    projects,
    activeProjectId,
    setSelectedWorktree,
    setShowAddWorktreeDialog,
    setSelectedTab,
    toggleTerminalSplit,
    toggleTerminalFullscreen,
    toggleDiffFullscreen,
    toggleGraphFullscreen,
    toggleSidebarCollapsed,
  ])

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const handleSelectProject = async (path: string) => {
    const results = await validateProjectPaths([path])
    if (results.length > 0 && results[0].valid) {
      addProject(results[0].path)
      setShowProjectSelector(false)
    } else {
      console.error('Invalid project path:', results[0]?.error)
    }
  }

  const handleAddProject = async (path: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const results = await validateProjectPaths([path])
      if (results.length > 0 && results[0].valid) {
        addProject(results[0].path)
        return { success: true }
      } else {
        const errorMessage = results[0]?.error || 'Project not found or is not a valid git repository'
        return { success: false, error: errorMessage }
      }
    } catch {
      return { success: false, error: 'Failed to validate project path' }
    }
  }

  const handleCloseProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    setProjectToRemove(projectId)
  }

  const handleConfirmRemoveProject = () => {
    if (projectToRemove) {
      removeProject(projectToRemove)
      setProjectToRemove(null)
    }
  }

  const projectToRemoveData = projectToRemove ? projects.find((p) => p.id === projectToRemove) : null

  const handleRefreshChanges = async (project: (typeof projects)[0], showSpinner = false) => {
    if (showSpinner) setIsRefreshingChanges(true)
    const minSpinTime = showSpinner ? new Promise((resolve) => setTimeout(resolve, 1000)) : Promise.resolve()
    const diffRef = gitDiffRefs.current.get(project.id)
    diffRef?.refresh()
    const adapter = getAdapter()
    if (adapter && connected) {
      try {
        const trees = await adapter.listWorktrees(project.path)
        updateProjectWorktrees(project.id, trees)
      } catch (error) {
        console.error('Failed to refresh worktrees:', error)
      }
    }
    await minSpinTime
    if (showSpinner) setIsRefreshingChanges(false)
  }

  const handleRefreshGraph = async (project: (typeof projects)[0]) => {
    setIsRefreshingGraph(true)
    const minSpinTime = new Promise((resolve) => setTimeout(resolve, 1000))
    const graphRef = gitGraphRefs.current.get(project.id)
    await Promise.all([graphRef?.refresh(), minSpinTime])
    setIsRefreshingGraph(false)
  }

  const handleRefreshTerminal = async (worktreePath?: string) => {
    const targetWorktree = worktreePath || activeProject?.selectedWorktree
    if (!targetWorktree) return

    setIsRefreshingTerminal(true)
    window.dispatchEvent(new CustomEvent('reload-terminal', { detail: { worktreePath: targetWorktree } }))
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsRefreshingTerminal(false)
  }

  // Show login page if not authenticated and not loading
  if (!authLoading && !isAuthenticated) {
    return <LoginPage />
  }

  // Show project selector if no projects exist or explicitly requested
  if (projects.length === 0 || showProjectSelector) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <header
          className="border-b flex items-center justify-between pl-1 pr-2 sm:pr-3 h-12 flex-shrink-0"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 512 512" className="h-9 w-9">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3fb950" />
                  <stop offset="50%" stopColor="#79c0ff" />
                  <stop offset="100%" stopColor="#a371f7" />
                </linearGradient>
                <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="12" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M165 145 L347 256 L165 367"
                stroke="url(#logoGrad)"
                strokeWidth="40"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#logoGlow)"
              />
              <circle cx="165" cy="145" r="28" fill="#3fb950" filter="url(#logoGlow)" />
              <circle cx="347" cy="256" r="28" fill="#79c0ff" filter="url(#logoGlow)" />
              <circle cx="165" cy="367" r="28" fill="#a371f7" filter="url(#logoGlow)" />
            </svg>
            <h1 className="text-lg font-semibold">Buddy</h1>
          </div>
          <div className="flex items-center gap-2 app-region-no-drag pr-2">
            <ConnectionStatus />
          </div>
        </header>

        {/* Project Selector */}
        <ProjectSelector
          onSelectProject={handleSelectProject}
          onClose={projects.length > 0 ? () => setShowProjectSelector(false) : undefined}
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Success Notification Banner */}
      {showSuccessNotification && (
        <div className="bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 px-4 py-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{successMessage}</span>
            <button
              onClick={() => setShowSuccessNotification(false)}
              className="ml-auto hover:bg-green-100 dark:hover:bg-green-800/30 rounded p-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Header - hidden */}
      <header className="hidden h-14 border-b flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Buddy</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">Web Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <ConnectionStatus />
        </div>
      </header>

      {/* Project Tabs and Content */}
      <Tabs value={activeProjectId || ''} onValueChange={setActiveProject} className="flex-1 flex flex-col">
        <div className="relative flex items-end justify-start bg-secondary titlebar-area titlebar-area-inset pt-2">
          <button
            onClick={toggleSidebarCollapsed}
            className="group hidden md:inline-flex size-[30px] p-0 hover:bg-accent rounded-full transition-colors items-center justify-center app-region-no-drag self-center ml-2 mr-1 z-20"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            ) : (
              <PanelLeftClose className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            )}
          </button>
          {activeProject && (
            <button
              onClick={() => setShowMobileSettingsModal(true)}
              className="group absolute left-1 bottom-0.5 size-[30px] p-0 hover:bg-accent/80 rounded-md transition-colors inline-flex md:hidden items-center justify-center app-region-no-drag z-30 bg-transparent backdrop-blur-sm"
              aria-label="Project settings"
              title="Project settings"
            >
              <Sliders className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          )}
          <div
            className="flex-1 overflow-x-auto min-w-0 pl-10 pr-9 md:pl-0 md:pr-2 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <TabsList className="h-auto bg-transparent p-0 rounded-none gap-0 min-w-0 app-region-no-drag items-end !justify-start">
              {projects.map((project, index) => (
                <TabsTrigger
                  key={project.id}
                  value={project.id}
                  ref={project.id === activeProjectId ? activeProjectTabRef : null}
                  className="project-tab group/tab relative pl-3 pr-7 h-[34px] min-w-[120px] md:min-w-[140px] max-w-[240px] rounded-t-xl text-[13px] bg-transparent text-muted-foreground transition-colors duration-100 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:z-10 data-[state=active]:hover:!bg-background app-region-no-drag"
                  onClick={() => {
                    // Clear unread bells for all worktrees in this project when tab is clicked
                    project.worktrees?.forEach((wt) => clearWorktreeBell(wt.path))
                  }}
                >
                  <span className="truncate flex items-center gap-1.5">
                    {project.name}
                    {project.id !== activeProjectId &&
                      project.worktrees?.some((wt) => unreadBellWorktrees.has(wt.path)) && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                  </span>
                  <span
                    className="group/close absolute right-2 top-1/2 -translate-y-1/2 h-[18px] w-[18px] opacity-0 group-hover/tab:opacity-100 data-[state=active]:opacity-100 cursor-pointer inline-flex items-center justify-center app-region-no-drag transition-opacity"
                    onClick={(e) => handleCloseProject(e, project.id)}
                  >
                    <X className="h-3 w-3 text-muted-foreground group-hover/close:text-foreground transition-colors" />
                  </span>
                  {index === 0 && project.id !== activeProjectId && (
                    <span className="absolute -left-px top-1/2 -translate-y-1/2 w-0.5 h-4 bg-border z-20 transition-opacity group-hover/tab:opacity-0 tab-divider-left" />
                  )}
                  {index < projects.length - 1 &&
                    project.id !== activeProjectId &&
                    projects[index + 1].id !== activeProjectId && (
                      <span className="absolute -right-px top-1/2 -translate-y-1/2 w-0.5 h-4 bg-border z-20 transition-opacity group-hover/tab:opacity-0 tab-divider-right" />
                    )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <button
            onClick={() => setShowAddProjectModal(true)}
            className="group absolute right-0 bottom-0.5 md:relative md:right-auto md:bottom-auto size-[28px] p-0 hover:bg-accent/80 rounded-md transition-colors inline-flex items-center justify-center app-region-no-drag self-center ml-1 mr-1 flex-shrink-0 bg-transparent backdrop-blur-sm z-30"
            aria-label="Add project"
          >
            <Plus className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          </button>
          {activeProject && (
            <button
              onClick={() => setShowMobileSettingsModal(true)}
              className="group hidden md:inline-flex size-[28px] p-0 hover:bg-accent/80 rounded-md transition-colors items-center justify-center app-region-no-drag self-center mr-2 flex-shrink-0"
              aria-label="Project settings"
              title="Project settings"
            >
              <Sliders className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </button>
          )}
        </div>

        {projects.map((project) => (
          <TabsContent key={project.id} value={project.id} className="flex-1 m-0 h-0" forceMount>
            <div className="flex h-full overflow-hidden">
              {/* Worktree Panel - Always visible on desktop (unless collapsed), conditional on mobile */}
              <div
                className={`
                ${project.selectedWorktree ? 'hidden' : 'flex'}
                ${!sidebarCollapsed ? 'md:flex' : 'md:hidden'}
                w-full md:w-80 md:border-r flex-shrink-0
              `}
              >
                <WorktreePanel projectId={project.id} />
              </div>

              {/* Main Content Area with Tabs - Only shown when worktree is selected */}
              {project.selectedWorktree ? (
                <div className="flex-1 flex flex-col h-full min-w-0">
                  {/* Mobile Worktree Tabs (also shown on desktop when sidebar is collapsed) */}
                  <MobileWorktreeTabs
                    worktrees={project.worktrees}
                    selectedWorktree={project.selectedWorktree}
                    onSelectWorktree={(path) => setSelectedWorktree(project.id, path)}
                    projectPath={project.path}
                    showOnDesktop={sidebarCollapsed}
                    onWorktreesChanged={() => handleRefreshChanges(project)}
                  />

                  {/* Tab Navigation */}
                  <div className="flex items-center justify-between px-1 py-2 md:px-2 flex-shrink-0">
                    <div className="flex">
                      {/* Mobile: Single segmented button */}
                      <div className="flex md:hidden border border-border rounded-md overflow-hidden">
                        <button
                          className={`py-2 transition-colors flex items-center gap-1.5 ${
                            getCurrentTab(project) === 'terminal'
                              ? 'pl-3 pr-3 bg-accent text-accent-foreground'
                              : 'px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'terminal')
                            handleRefreshChanges(project)
                          }}
                        >
                          <Terminal className="h-4 w-4" />
                          {getCurrentTab(project) === 'terminal' && <span className="text-sm">Terminal</span>}
                        </button>
                        <button
                          className={`py-2 border-l border-border transition-colors flex items-center gap-1.5 ${
                            getCurrentTab(project) === 'changes'
                              ? 'pl-3 pr-3 bg-accent text-accent-foreground'
                              : 'px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'changes')
                            handleRefreshChanges(project)
                          }}
                        >
                          <GitBranch className="h-4 w-4" />
                          {getCurrentTab(project) === 'changes' && <span className="text-sm">Changes</span>}
                        </button>
                        <button
                          className={`py-2 border-l border-border transition-colors flex items-center gap-1.5 ${
                            getCurrentTab(project) === 'graph'
                              ? 'pl-3 pr-3 bg-accent text-accent-foreground'
                              : 'px-4 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'graph')
                            handleRefreshChanges(project)
                            gitGraphRefs.current.get(project.id)?.refresh()
                          }}
                        >
                          <GitCommitHorizontal className="h-4 w-4" />
                          {getCurrentTab(project) === 'graph' && <span className="text-sm">Graph</span>}
                        </button>
                      </div>
                      {/* Desktop: Separate buttons with labels */}
                      <div className="hidden md:flex">
                        <button
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 border ${
                            getCurrentTab(project) === 'terminal'
                              ? 'bg-accent text-accent-foreground border-border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'terminal')
                            handleRefreshChanges(project)
                          }}
                        >
                          <Terminal className="h-3.5 w-3.5 -ml-1" />
                          Terminal
                        </button>
                        <button
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ml-1 border ${
                            getCurrentTab(project) === 'changes'
                              ? 'bg-accent text-accent-foreground border-border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'changes')
                            handleRefreshChanges(project)
                          }}
                        >
                          <GitBranch className="h-3.5 w-3.5 -ml-1" />
                          Changes
                        </button>
                        <button
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ml-1 border ${
                            getCurrentTab(project) === 'graph'
                              ? 'bg-accent text-accent-foreground border-border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                          }`}
                          onClick={() => {
                            setSelectedTab(project.id, project.selectedWorktree!, 'graph')
                            handleRefreshChanges(project)
                            gitGraphRefs.current.get(project.id)?.refresh()
                          }}
                        >
                          <GitCommitHorizontal className="h-3.5 w-3.5 -ml-1" />
                          Graph
                        </button>
                      </div>
                    </div>
                    {getCurrentTab(project) === 'terminal' ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRefreshTerminal()}
                          className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                          title="Reload Terminal"
                        >
                          <RotateCcw
                            className={`h-4 w-4 text-[#999] group-hover:text-white ${isRefreshingTerminal ? 'animate-spin [animation-direction:reverse]' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => toggleTerminalSplit(project.id)}
                          className={`group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center ${project.isTerminalSplit ? 'bg-muted' : ''}`}
                          title={project.isTerminalSplit ? 'Close Split' : 'Split Terminal'}
                        >
                          {project.isTerminalSplit ? (
                            <>
                              <Columns2 className="h-4 w-4 hidden md:block group-hover:hidden text-white" />
                              <Rows2 className="h-4 w-4 md:hidden group-hover:hidden text-white" />
                              <X className="h-4 w-4 hidden group-hover:block text-white" />
                            </>
                          ) : (
                            <>
                              <Columns2 className="h-4 w-4 hidden md:block text-[#999] group-hover:text-white" />
                              <Rows2 className="h-4 w-4 md:hidden text-[#999] group-hover:text-white" />
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => toggleTerminalFullscreen(project.id)}
                          className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                          title={project.isTerminalFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                          {project.isTerminalFullscreen ? (
                            <Minimize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                          ) : (
                            <Maximize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {getCurrentTab(project) === 'changes' && (
                          <>
                            <button
                              onClick={() => handleRefreshChanges(project, true)}
                              className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                              title="Reload Changes"
                            >
                              <RotateCcw
                                className={`h-4 w-4 text-[#999] group-hover:text-white ${isRefreshingChanges ? 'animate-spin [animation-direction:reverse]' : ''}`}
                              />
                            </button>
                            <button
                              onClick={() => toggleDiffFullscreen(project.id)}
                              className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                              title={project.isDiffFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                              {project.isDiffFullscreen ? (
                                <Minimize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                              ) : (
                                <Maximize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                              )}
                            </button>
                          </>
                        )}
                        {getCurrentTab(project) === 'graph' && (
                          <>
                            <button
                              onClick={() => handleRefreshGraph(project)}
                              className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                              title="Reload Graph"
                            >
                              <RotateCcw
                                className={`h-4 w-4 text-[#999] group-hover:text-white ${isRefreshingGraph ? 'animate-spin [animation-direction:reverse]' : ''}`}
                              />
                            </button>
                            <button
                              onClick={() => toggleGraphFullscreen(project.id)}
                              className="group size-8 p-0 hover:bg-muted/50 rounded-md transition-colors border border-border inline-flex items-center justify-center"
                              title={project.isGraphFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                            >
                              {project.isGraphFullscreen ? (
                                <Minimize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                              ) : (
                                <Maximize2 className="h-4 w-4 text-[#999] group-hover:text-white" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-hidden relative bg-black">
                    {/* Terminal Tab - Managed terminals with lifecycle control */}
                    <div
                      className={`absolute inset-0 flex flex-col overflow-hidden ${
                        getCurrentTab(project) === 'terminal' ? 'flex' : 'hidden'
                      }`}
                    >
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <TerminalManager
                          worktrees={project.worktrees || []}
                          selectedWorktree={project.selectedWorktree}
                        />
                      </div>
                      <div className="flex-shrink-0">
                        <ClaudeCommandToolbar />
                        <MobileTerminalToolbar />
                      </div>
                      <div className="md:hidden h-14 bg-background flex-shrink-0" />
                    </div>

                    {/* Keep GitDiffView mounted but hidden to preserve state */}
                    <div className={`absolute inset-0 ${getCurrentTab(project) === 'changes' ? 'block' : 'hidden'}`}>
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading diff viewer...
                          </div>
                        }
                      >
                        <GitDiffView
                          ref={(ref) => {
                            if (ref) {
                              gitDiffRefs.current.set(project.id, ref)
                            } else {
                              gitDiffRefs.current.delete(project.id)
                            }
                          }}
                          worktreePath={project.selectedWorktree}
                          theme={theme}
                          isFullscreen={project.isDiffFullscreen}
                          onExitFullscreen={() => toggleDiffFullscreen(project.id)}
                        />
                      </Suspense>
                    </div>

                    {/* Git Graph View */}
                    <div className={`absolute inset-0 ${getCurrentTab(project) === 'graph' ? 'block' : 'hidden'}`}>
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading graph...
                          </div>
                        }
                      >
                        <GitGraphView
                          ref={(ref) => {
                            if (ref) {
                              gitGraphRefs.current.set(project.id, ref)
                            } else {
                              gitGraphRefs.current.delete(project.id)
                            }
                          }}
                          worktreePath={project.selectedWorktree}
                          theme={theme}
                          isFullscreen={project.isGraphFullscreen}
                          onExitFullscreen={() => toggleGraphFullscreen(project.id)}
                        />
                      </Suspense>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state when no worktree selected */
                <div
                  className={`${
                    sidebarCollapsed ? 'flex' : 'hidden md:flex'
                  } flex-1 flex-col items-center justify-center text-muted-foreground`}
                >
                  {sidebarCollapsed && (
                    <div className="w-full">
                      <MobileWorktreeTabs
                        worktrees={project.worktrees}
                        selectedWorktree={project.selectedWorktree}
                        onSelectWorktree={(path) => setSelectedWorktree(project.id, path)}
                        projectPath={project.path}
                        showOnDesktop={true}
                        onWorktreesChanged={() => handleRefreshChanges(project)}
                      />
                    </div>
                  )}
                  <div className="text-center flex-1 flex flex-col items-center justify-center">
                    <p className="text-lg mb-2">Select a worktree to start</p>
                    <p className="text-sm">
                      {sidebarCollapsed ? 'Choose from the tabs above' : 'Choose from the panel on the left'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog
        open={!!projectToRemove}
        title="Remove Project"
        description={`Are you sure you want to remove "${projectToRemoveData?.name}"? This will close all terminals and tabs associated with this project.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmRemoveProject}
        onCancel={() => setProjectToRemove(null)}
      />

      <FloatingAddWorktree />
      <DeleteWorktreeDialog />

      {/* Mobile Settings Modal */}
      {showMobileSettingsModal && activeProject && (
        <StartupScriptModal projectPath={activeProject.path} onClose={() => setShowMobileSettingsModal(false)} />
      )}

      {/* Reconnecting Modal */}
      {reconnecting && <ReconnectingModal />}

      {/* Add Project Modal */}
      <AddProjectModal
        open={showAddProjectModal}
        onAddProject={handleAddProject}
        onClose={() => setShowAddProjectModal(false)}
      />
    </div>
  )
}

export default App
