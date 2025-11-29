import { LoginPage, useAuth } from '@vibetree/auth'
import { ConfirmDialog, Tabs, TabsContent, TabsList, TabsTrigger } from '@vibetree/ui'
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
  Rows2,
  Sliders,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AddProjectModal from './components/AddProjectModal'
import { ConnectionStatus } from './components/ConnectionStatus'
import { FloatingAddWorktree } from './components/FloatingAddWorktree'
import { GitDiffView, GitDiffViewRef } from './components/GitDiffView'
import { GitGraphView, GitGraphViewRef } from './components/GitGraphView'
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
    setShowAddWorktreeDialog,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useAppStore()
  const { connect, getAdapter } = useWebSocket()
  const { request: requestKeepAwake } = useKeepAwake()
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [showAddProjectModal, setShowAddProjectModal] = useState(false)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [changedFilesCount, setChangedFilesCount] = useState(0)
  const [projectToRemove, setProjectToRemove] = useState<string | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = useState<{ projectId: string; path: string; branch: string } | null>(
    null
  )
  const [deletingWorktree, setDeletingWorktree] = useState(false)
  const [showMobileSettingsModal, setShowMobileSettingsModal] = useState(false)
  const gitDiffRef = useRef<GitDiffViewRef>(null)
  const gitGraphRef = useRef<GitGraphViewRef>(null)

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

  const isProtectedBranch = (branch: string) => {
    const branchName = branch.replace('refs/heads/', '')
    return branchName === 'main' || branchName === 'master'
  }

  const handleDeleteWorktree = (projectId: string, worktreePath: string, branch: string) => {
    if (isProtectedBranch(branch)) return
    setWorktreeToDelete({ projectId, path: worktreePath, branch })
  }

  const handleConfirmDeleteWorktree = async () => {
    if (!worktreeToDelete) return

    const adapter = getAdapter()
    const project = projects.find((p) => p.id === worktreeToDelete.projectId)
    if (!adapter || !connected || !project) {
      setWorktreeToDelete(null)
      return
    }

    setDeletingWorktree(true)
    try {
      await adapter.removeWorktree(
        project.path,
        worktreeToDelete.path,
        worktreeToDelete.branch.replace('refs/heads/', '')
      )

      if (project.selectedWorktree === worktreeToDelete.path) {
        const remainingWorktree = project.worktrees.find((wt) => wt.path !== worktreeToDelete.path)
        if (remainingWorktree) {
          setSelectedWorktree(worktreeToDelete.projectId, remainingWorktree.path)
        } else {
          setSelectedWorktree(worktreeToDelete.projectId, null)
        }
      }

      const trees = await adapter.listWorktrees(project.path)
      updateProjectWorktrees(worktreeToDelete.projectId, trees)
    } catch (error) {
      console.error('Failed to delete worktree:', error)
    } finally {
      setDeletingWorktree(false)
      setWorktreeToDelete(null)
    }
  }

  const getSelectedWorktreeInfo = (project: (typeof projects)[0]) => {
    if (!project.selectedWorktree) return null
    return project.worktrees.find((wt) => wt.path === project.selectedWorktree)
  }

  const handleRefreshChanges = async (project: (typeof projects)[0]) => {
    gitDiffRef.current?.refresh()
    const adapter = getAdapter()
    if (adapter && connected) {
      try {
        const trees = await adapter.listWorktrees(project.path)
        updateProjectWorktrees(project.id, trees)
      } catch (error) {
        console.error('Failed to refresh worktrees:', error)
      }
    }
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
        <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0 titlebar-area titlebar-area-inset">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">VibeTree</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">Web Terminal</span>
          </div>
          <div className="flex items-center gap-2 app-region-no-drag">
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
          <h1 className="text-lg font-semibold">VibeTree</h1>
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
        <div className="flex items-center h-10 overflow-hidden bg-black titlebar-area titlebar-area-inset">
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:inline-flex h-[30px] w-[30px] p-0 hover:bg-accent rounded transition-colors items-center justify-center flex-shrink-0 border border-border app-region-no-drag"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {activeProject && (
            <button
              onClick={() => setShowMobileSettingsModal(true)}
              className="h-[30px] w-[30px] p-0 hover:bg-accent rounded transition-colors inline-flex items-center justify-center flex-shrink-0 border border-border app-region-no-drag ml-1"
              aria-label="Project settings"
              title="Project settings"
            >
              <Sliders className="h-4 w-4" />
            </button>
          )}
          <TabsList className="h-full bg-transparent p-0 rounded-none gap-1 min-w-0 overflow-x-auto scrollbar-hide app-region-no-drag">
            {projects.map((project) => (
              <TabsTrigger
                key={project.id}
                value={project.id}
                className="relative pr-8 h-full min-w-[100px] lg:min-w-[150px] border border-border rounded-md app-region-no-drag"
              >
                {project.name}
                <span
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0.5 hover:bg-muted rounded cursor-pointer inline-flex items-center justify-center app-region-no-drag"
                  onClick={(e) => handleCloseProject(e, project.id)}
                >
                  <X className="h-3 w-3" />
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            onClick={() => setShowAddProjectModal(true)}
            className="h-[30px] w-[30px] p-0 hover:bg-accent rounded transition-colors inline-flex items-center justify-center flex-shrink-0 border border-border app-region-no-drag"
            aria-label="Add project"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {projects.map((project) => (
          <TabsContent key={project.id} value={project.id} className="flex-1 m-0 h-0" forceMount>
            <div className="flex h-full overflow-hidden">
              {/* Worktree Panel - Always visible on desktop (unless collapsed), conditional on mobile */}
              <div
                className={`
                ${project.selectedWorktree ? 'hidden' : 'flex'}
                ${!sidebarCollapsed ? 'md:flex' : 'md:hidden'}
                w-full md:w-80 border-r flex-shrink-0
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
                  />

                  {/* Tab Navigation */}
                  <div className="flex items-center justify-between p-2 flex-shrink-0">
                    <div className="flex">
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
                        {changedFilesCount > 0 && (
                          <span className="ml-auto -mr-1.5 px-1.5 py-0.5 text-xs font-medium rounded min-w-[1.25rem] text-center text-muted-foreground bg-muted">
                            {changedFilesCount}
                          </span>
                        )}
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
                          gitGraphRef.current?.refresh()
                        }}
                      >
                        <GitCommitHorizontal className="h-3.5 w-3.5 -ml-1" />
                        Graph
                      </button>
                    </div>
                    {getCurrentTab(project) === 'terminal' ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleTerminalSplit(project.id)}
                          className="p-1.5 hover:bg-accent rounded transition-colors border border-border"
                          title="Split Terminal"
                        >
                          <Columns2 className="h-4 w-4 hidden md:block" />
                          <Rows2 className="h-4 w-4 md:hidden" />
                        </button>
                        <button
                          onClick={() => toggleTerminalFullscreen(project.id)}
                          className="p-1.5 hover:bg-accent rounded transition-colors border border-border"
                          title={project.isTerminalFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                          {project.isTerminalFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </button>
                        {(() => {
                          const worktreeInfo = getSelectedWorktreeInfo(project)
                          const canDelete =
                            worktreeInfo?.branch &&
                            !isProtectedBranch(worktreeInfo.branch) &&
                            project.worktrees.length > 1 &&
                            worktreeInfo.path !== project.path
                          if (!canDelete) return null
                          return (
                            <button
                              onClick={() => handleDeleteWorktree(project.id, worktreeInfo.path, worktreeInfo.branch!)}
                              className="md:hidden p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors border border-border"
                              title="Delete worktree"
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {getCurrentTab(project) === 'changes' && (
                          <button
                            onClick={() => toggleDiffFullscreen(project.id)}
                            className="p-1.5 hover:bg-accent rounded transition-colors border border-border"
                            title={project.isDiffFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                          >
                            {project.isDiffFullscreen ? (
                              <Minimize2 className="h-4 w-4" />
                            ) : (
                              <Maximize2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {(() => {
                          const worktreeInfo = getSelectedWorktreeInfo(project)
                          const canDelete =
                            worktreeInfo?.branch &&
                            !isProtectedBranch(worktreeInfo.branch) &&
                            project.worktrees.length > 1 &&
                            worktreeInfo.path !== project.path
                          if (!canDelete) return null
                          return (
                            <button
                              onClick={() => handleDeleteWorktree(project.id, worktreeInfo.path, worktreeInfo.branch!)}
                              className="md:hidden p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors border border-border"
                              title="Delete worktree"
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )
                        })()}
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
                        <MobileTerminalToolbar />
                      </div>
                      <div className="md:hidden h-6 bg-background flex-shrink-0" />
                    </div>

                    {/* Keep GitDiffView mounted but hidden to preserve state */}
                    <div className={`absolute inset-0 ${getCurrentTab(project) === 'changes' ? 'block' : 'hidden'}`}>
                      <GitDiffView
                        ref={gitDiffRef}
                        worktreePath={project.selectedWorktree}
                        theme={theme}
                        onFileCountChange={setChangedFilesCount}
                        isFullscreen={project.isDiffFullscreen}
                        onExitFullscreen={() => toggleDiffFullscreen(project.id)}
                      />
                    </div>

                    {/* Git Graph View */}
                    <div className={`absolute inset-0 ${getCurrentTab(project) === 'graph' ? 'block' : 'hidden'}`}>
                      <GitGraphView ref={gitGraphRef} worktreePath={project.selectedWorktree} theme={theme} />
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

      <ConfirmDialog
        open={!!worktreeToDelete}
        title="Delete Worktree"
        description={`Are you sure you want to delete the worktree "${worktreeToDelete?.branch.replace(
          'refs/heads/',
          ''
        )}"? The worktree directory will be removed but the branch will be preserved.`}
        confirmLabel={deletingWorktree ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDeleteWorktree}
        onCancel={() => setWorktreeToDelete(null)}
      />

      <FloatingAddWorktree />

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
