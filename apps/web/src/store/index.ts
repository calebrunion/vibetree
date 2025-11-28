import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Worktree } from '@vibetree/core';

interface Project {
  id: string;
  path: string;
  name: string;
  worktrees: Worktree[];
  selectedWorktree: string | null;
  selectedTab: 'terminal' | 'changes';
  isTerminalSplit: boolean;
  isTerminalFullscreen: boolean;
}

interface AppState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;
  
  // Project state
  projects: Project[];
  activeProjectId: string | null;
  
  // Terminal state
  terminalSessions: Map<string, string>; // worktreePath -> sessionId
  
  // Theme state
  theme: 'light' | 'dark';

  // UI state
  showAddWorktreeDialog: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  addProject: (path: string) => string;
  addProjects: (paths: string[]) => string[];
  removeProject: (id: string) => void;
  setActiveProject: (id: string) => void;
  updateProjectWorktrees: (id: string, worktrees: Worktree[]) => void;
  setSelectedWorktree: (projectId: string, worktreePath: string | null) => void;
  setSelectedTab: (projectId: string, tab: 'terminal' | 'changes') => void;
  getProject: (id: string) => Project | undefined;
  getActiveProject: () => Project | undefined;
  addTerminalSession: (worktreePath: string, sessionId: string) => void;
  removeTerminalSession: (worktreePath: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setShowAddWorktreeDialog: (show: boolean) => void;
  toggleTerminalSplit: (projectId: string) => void;
  toggleTerminalFullscreen: (projectId: string) => void;
  setTerminalSplit: (projectId: string, isSplit: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // Initial state
  connected: false,
  connecting: false,
  error: null,
  projects: [],
  activeProjectId: null,
  terminalSessions: new Map(),
  theme: 'light',
  showAddWorktreeDialog: false,

  // Actions
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  
  addProject: (path: string) => {
    const state = get();
    // Check if project already exists
    const existing = state.projects.find(p => p.path === path);
    if (existing) {
      set({ activeProjectId: existing.id });
      return existing.id;
    }

    const id = `project-${Date.now()}`;
    const name = path.split('/').pop() || 'Unnamed Project';
    
    const newProject: Project = {
      id,
      path,
      name,
      worktrees: [],
      selectedWorktree: null,
      selectedTab: 'terminal',
      isTerminalSplit: false,
      isTerminalFullscreen: false
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      activeProjectId: id
    }));
    return id;
  },

  addProjects: (paths: string[]) => {
    const state = get();
    const newProjects: Project[] = [];
    const addedIds: string[] = [];

    paths.forEach(path => {
      // Check if project already exists
      const existing = state.projects.find(p => p.path === path);
      if (existing) {
        addedIds.push(existing.id);
        return;
      }

      const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const name = path.split('/').pop() || 'Unnamed Project';
      
      const newProject: Project = {
        id,
        path,
        name,
        worktrees: [],
        selectedWorktree: null,
        selectedTab: 'terminal',
        isTerminalSplit: false,
        isTerminalFullscreen: false
      };

      newProjects.push(newProject);
      addedIds.push(id);
    });

    if (newProjects.length > 0) {
      set((state) => ({
        projects: [...state.projects, ...newProjects]
      }));
    }

    return addedIds;
  },

  removeProject: (id: string) => {
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
    }));
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  },

  updateProjectWorktrees: (id: string, worktrees: Worktree[]) => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === id ? { ...project, worktrees } : project
      )
    }));
  },

  setSelectedWorktree: (projectId: string, worktreePath: string | null) => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === projectId 
          ? { ...project, selectedWorktree: worktreePath }
          : project
      )
    }));
  },

  setSelectedTab: (projectId: string, tab: 'terminal' | 'changes') => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === projectId 
          ? { ...project, selectedTab: tab }
          : project
      )
    }));
  },

  getProject: (id: string) => {
    return get().projects.find(p => p.id === id);
  },

  getActiveProject: () => {
    const state = get();
    return state.activeProjectId ? state.projects.find(p => p.id === state.activeProjectId) : undefined;
  },

  addTerminalSession: (worktreePath, sessionId) => 
    set((state) => {
      const sessions = new Map(state.terminalSessions);
      sessions.set(worktreePath, sessionId);
      return { terminalSessions: sessions };
    }),
    
  removeTerminalSession: (worktreePath) =>
    set((state) => {
      const sessions = new Map(state.terminalSessions);
      sessions.delete(worktreePath);
      return { terminalSessions: sessions };
    }),
    
  setTheme: (theme) => set({ theme }),
  setShowAddWorktreeDialog: (show) => set({ showAddWorktreeDialog: show }),

  toggleTerminalSplit: (projectId: string) => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === projectId
          ? { ...project, isTerminalSplit: !project.isTerminalSplit }
          : project
      )
    }));
  },

  toggleTerminalFullscreen: (projectId: string) => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === projectId
          ? { ...project, isTerminalFullscreen: !project.isTerminalFullscreen }
          : project
      )
    }));
  },

  setTerminalSplit: (projectId: string, isSplit: boolean) => {
    set((state) => ({
      projects: state.projects.map(project =>
        project.id === projectId
          ? { ...project, isTerminalSplit: isSplit }
          : project
      )
    }));
  },
}),
    {
      name: 'vibetree-web-storage',
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        theme: state.theme,
      }),
    }
  )
);