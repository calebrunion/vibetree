import { LoginPage, useAuth } from '@vibetree/auth'
import { ConfirmDialog, Tabs, TabsContent, TabsList, TabsTrigger } from '@vibetree/ui'
import { Bot, CheckCircle, Columns2, GitBranch, Maximize2, Minimize2, Moon, Plus, RefreshCw, Rows2, Sun, Terminal, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ClaudeTerminalView } from './components/ClaudeTerminalView'
import { ConnectionStatus } from './components/ConnectionStatus'
import { GitDiffView, GitDiffViewRef } from './components/GitDiffView'
import MobileTerminalToolbar from './components/MobileTerminalToolbar'
import { MobileWorktreeTabs } from './components/MobileWorktreeTabs'
import { ProjectSelector } from './components/ProjectSelector'
import { TerminalManager } from './components/TerminalManager'
import { WorktreePanel } from './components/WorktreePanel'
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
    toggleTerminalSplit,
    toggleTerminalFullscreen,
  } = useAppStore()
  const { connect, getAdapter } = useWebSocket()
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [changedFilesCount, setChangedFilesCount] = useState(0)
  const [projectToRemove, setProjectToRemove] = useState<string | null>(null)
  const [worktreeToDelete, setWorktreeToDelete] = useState<{ projectId: string; path: string; branch: string } | null>(null)
  const [deletingWorktree, setDeletingWorktree] = useState(false)
  const gitDiffRef = useRef<GitDiffViewRef>(null)

  // const activeProject = getActiveProject();

  useEffect(() => {
    // Auto-connect on mount
    connect()
  }, [])

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

  const cycleProject = useCallback((direction: 'next' | 'prev') => {
    if (projects.length <= 1) return
    const currentIndex = projects.findIndex(p => p.id === activeProjectId)
    if (currentIndex === -1) return

    let newIndex: number
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % projects.length
    } else {
      newIndex = (currentIndex - 1 + projects.length) % projects.length
    }
    setActiveProject(projects[newIndex].id)
  }, [projects, activeProjectId, setActiveProject])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        cycleProject(e.shiftKey ? 'prev' : 'next')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleProject])

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

  const projectToRemoveData = projectToRemove ? projects.find(p => p.id === projectToRemove) : null

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
    const project = projects.find(p => p.id === worktreeToDelete.projectId)
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
        const remainingWorktree = project.worktrees.find(wt => wt.path !== worktreeToDelete.path)
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

  const getSelectedWorktreeInfo = (project: typeof projects[0]) => {
    if (!project.selectedWorktree) return null
    return project.worktrees.find(wt => wt.path === project.selectedWorktree)
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
        <header className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0">
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
        <div className="border-b flex items-center gap-2 bg-muted/50 h-10 overflow-hidden">
          <TabsList className="h-full bg-transparent p-0 rounded-none gap-1 min-w-0 overflow-x-auto scrollbar-hide">
            {projects.map((project) => (
              <TabsTrigger
                key={project.id}
                value={project.id}
                className="relative pr-8 h-full min-w-[100px] lg:min-w-[150px] border border-border rounded-md"
              >
                {project.name}
                <span
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0.5 hover:bg-muted rounded cursor-pointer inline-flex items-center justify-center"
                  onClick={(e) => handleCloseProject(e, project.id)}
                >
                  <X className="h-3 w-3" />
                  {/* Need this to generate the following text-black class */}
                  <br className="hidden !text-black" />
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          <button
            onClick={() => setShowProjectSelector(true)}
            className="h-8 w-8 p-0 hover:bg-accent rounded transition-colors inline-flex items-center justify-center flex-shrink-0 ml-auto"
            aria-label="Add project"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {projects.map((project) => (
          <TabsContent key={project.id} value={project.id} className="flex-1 m-0 h-0">
            <div className="flex h-full overflow-hidden">
              {/* Worktree Panel - Always visible on desktop, conditional on mobile */}
              <div
                className={`
                ${project.selectedWorktree ? 'hidden md:flex' : 'flex'} 
                w-full md:w-80 border-r flex-shrink-0
              `}
              >
                <WorktreePanel projectId={project.id} />
              </div>

              {/* Main Content Area with Tabs - Only shown when worktree is selected */}
              {project.selectedWorktree ? (
                <div className="flex-1 flex flex-col h-full min-w-0">
                  {/* Mobile Worktree Tabs */}
                  <MobileWorktreeTabs
                    worktrees={project.worktrees}
                    selectedWorktree={project.selectedWorktree}
                    onSelectWorktree={(path) => setSelectedWorktree(project.id, path)}
                    projectPath={project.path}
                  />

                  {/* Tab Navigation */}
                  <div className="h-10 border-b flex items-center justify-between px-2 bg-muted/30 flex-shrink-0">
                    <div className="flex">
                      <button
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 border ${
                          project.selectedTab === 'claude'
                            ? 'bg-background text-foreground border-border shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                        }`}
                        onClick={() => setSelectedTab(project.id, 'claude')}
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Claude
                      </button>
                      <button
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ml-1 border ${
                          project.selectedTab === 'changes'
                            ? 'bg-background text-foreground border-border shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                        }`}
                        onClick={() => {
                          if (project.selectedTab !== 'changes') {
                            setSelectedTab(project.id, 'changes')
                          }
                          gitDiffRef.current?.refresh()
                        }}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        Changes
                        {changedFilesCount > 0 && (
                          <span className={`ml-auto -mr-1.5 px-1.5 py-0.5 text-xs font-medium rounded min-w-[1.25rem] text-center ${
                            project.selectedTab === 'changes'
                              ? 'text-gray-700 bg-gray-400/40 dark:text-gray-300 dark:bg-gray-400/30'
                              : 'text-gray-500 bg-gray-500/30'
                          }`}>
                            {changedFilesCount}
                          </span>
                        )}
                      </button>
                      <button
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ml-1 border ${
                          project.selectedTab === 'terminal'
                            ? 'bg-background text-foreground border-border shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                        }`}
                        onClick={() => setSelectedTab(project.id, 'terminal')}
                      >
                        <Terminal className="h-3.5 w-3.5" />
                        Terminal
                      </button>
                    </div>
                    {project.selectedTab === 'terminal' ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleTerminalSplit(project.id)}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title="Split Terminal"
                        >
                          <Columns2 className="h-4 w-4 hidden md:block" />
                          <Rows2 className="h-4 w-4 md:hidden" />
                        </button>
                        <button
                          onClick={() => toggleTerminalFullscreen(project.id)}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
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
                          const canDelete = worktreeInfo?.branch &&
                            !isProtectedBranch(worktreeInfo.branch) &&
                            project.worktrees.length > 1 &&
                            worktreeInfo.path !== project.path
                          if (!canDelete) return null
                          return (
                            <button
                              onClick={() => handleDeleteWorktree(project.id, worktreeInfo.path, worktreeInfo.branch!)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Delete worktree"
                            >
                              <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </button>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => gitDiffRef.current?.refresh()}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title="Refresh"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        {(() => {
                          const worktreeInfo = getSelectedWorktreeInfo(project)
                          const canDelete = worktreeInfo?.branch &&
                            !isProtectedBranch(worktreeInfo.branch) &&
                            project.worktrees.length > 1 &&
                            worktreeInfo.path !== project.path
                          if (!canDelete) return null
                          return (
                            <button
                              onClick={() => handleDeleteWorktree(project.id, worktreeInfo.path, worktreeInfo.branch!)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
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
                  <div className="flex-1 overflow-hidden relative">
                    {/* Terminal Tab - Managed terminals with lifecycle control */}
                    <div className={`absolute inset-0 flex flex-col overflow-hidden ${project.selectedTab === 'terminal' ? 'flex' : 'hidden'}`}>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <TerminalManager
                          worktrees={project.worktrees || []}
                          selectedWorktree={project.selectedWorktree}
                        />
                      </div>
                      <div className="flex-shrink-0">
                        <MobileTerminalToolbar />
                      </div>
                      <div className="md:hidden h-24 bg-background flex-shrink-0" />
                    </div>

                    {/* Claude Tab - Claude Code terminal */}
                    <div className={`absolute inset-0 flex flex-col overflow-hidden ${project.selectedTab === 'claude' ? 'flex' : 'hidden'}`}>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        {project.selectedWorktree && (
                          <ClaudeTerminalView worktreePath={project.selectedWorktree} />
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <MobileTerminalToolbar />
                      </div>
                      <div className="md:hidden h-24 bg-background flex-shrink-0" />
                    </div>

                    {/* Keep GitDiffView mounted but hidden to preserve state */}
                    <div className={`absolute inset-0 ${project.selectedTab === 'changes' ? 'block' : 'hidden'}`}>
                      <GitDiffView
                        ref={gitDiffRef}
                        worktreePath={project.selectedWorktree}
                        theme={theme}
                        onFileCountChange={setChangedFilesCount}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state when no worktree selected */
                <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p className="text-lg mb-2">Select a worktree to start</p>
                    <p className="text-sm">Choose from the panel on the left</p>
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
        description={`Are you sure you want to delete the worktree "${worktreeToDelete?.branch.replace('refs/heads/', '')}"? The worktree directory will be removed but the branch will be preserved.`}
        confirmLabel={deletingWorktree ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmDeleteWorktree}
        onCancel={() => setWorktreeToDelete(null)}
      />
    </div>
  )
}

export default App
