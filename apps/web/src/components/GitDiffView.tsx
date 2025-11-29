import { useEffect, useState, useCallback, useImperativeHandle, forwardRef, Component, ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, GitCommit, RefreshCw } from 'lucide-react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
import { useWebSocket } from '../hooks/useWebSocket';
import type { GitStatus, GitCommit as GitCommitType, CommitFile } from '@vibetree/core';

class DiffErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
  modified: boolean;
}

interface GitDiffViewProps {
  worktreePath: string;
  theme?: 'light' | 'dark';
  onLoadingChange?: (loading: boolean) => void;
  onFileCountChange?: (count: number) => void;
}

export interface GitDiffViewRef {
  refresh: () => void;
}

export const GitDiffView = forwardRef<GitDiffViewRef, GitDiffViewProps>(function GitDiffView(
  { worktreePath, theme = 'light', onLoadingChange, onFileCountChange },
  ref
) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'current' | 'commit' | 'all'>('current');
  const [selectedCommit, setSelectedCommit] = useState<GitCommitType | null>(null);
  const [commitFilesMap, setCommitFilesMap] = useState<Record<string, CommitFile[]>>({});
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [diffText, setDiffText] = useState<string>('');
  const [allChangesFiles, setAllChangesFiles] = useState<CommitFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allChangesCollapsed, setAllChangesCollapsed] = useState(true);
  const [currentCollapsed, setCurrentCollapsed] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);

  const { getAdapter } = useWebSocket();

  const loadGitStatus = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter) return;

    try {
      setLoading(true);
      setError(null);

      const status: GitStatus[] = await adapter.getGitStatus(worktreePath);

      const gitFiles: GitFile[] = status.map(file => ({
        path: file.path,
        status: file.status,
        staged: file.status[0] !== ' ' && file.status[0] !== '?',
        modified: file.status[1] !== ' ' && file.status[1] !== '?'
      }));

      setFiles(gitFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load git status');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter]);

  const loadGitLog = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter || !('getGitLog' in adapter)) return;

    try {
      const gitCommits = await (adapter as any).getGitLog(worktreePath, 20);
      setCommits(gitCommits);
    } catch (err) {
      console.error('Failed to load git log:', err);
      setCommits([]);
    }
  }, [worktreePath, getAdapter]);

  const loadDiff = useCallback(async (filePath: string, staged: boolean = false) => {
    const adapter = getAdapter();
    if (!adapter) return;

    try {
      setLoading(true);
      setError(null);

      const diffTextResult = staged
        ? await adapter.getGitDiffStaged(worktreePath, filePath)
        : await adapter.getGitDiff(worktreePath, filePath);

      setDiffText(diffTextResult ? diffTextResult.trim() : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
      setDiffText('');
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter]);

  const toggleCommitExpanded = useCallback(async (commit: GitCommitType) => {
    const adapter = getAdapter();
    if (!adapter || !('getCommitFiles' in adapter)) return;

    const isExpanded = expandedCommits.has(commit.hash);

    if (isExpanded) {
      setExpandedCommits(prev => {
        const next = new Set(prev);
        next.delete(commit.hash);
        return next;
      });
      return;
    }

    setExpandedCommits(prev => new Set(prev).add(commit.hash));

    if (commitFilesMap[commit.hash]) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const files = await (adapter as any).getCommitFiles(worktreePath, commit.hash);
      setCommitFilesMap(prev => ({ ...prev, [commit.hash]: files }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commit files');
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter, expandedCommits, commitFilesMap]);

  const loadCommitDiff = useCallback(async (commitHash: string, filePath?: string) => {
    const adapter = getAdapter();
    if (!adapter || !('getCommitDiff' in adapter)) return;

    try {
      setLoading(true);
      setError(null);

      const diffTextResult = await (adapter as any).getCommitDiff(worktreePath, commitHash, filePath);
      setDiffText(diffTextResult ? diffTextResult.trim() : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commit diff');
      setDiffText('');
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter]);

  const loadAllChangesFiles = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter || !('getFilesChangedAgainstBase' in adapter)) return;

    try {
      setLoading(true);
      setError(null);

      const files = await (adapter as any).getFilesChangedAgainstBase(worktreePath);
      setAllChangesFiles(files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load all changes');
      setAllChangesFiles([]);
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter]);

  const loadDiffAgainstBase = useCallback(async (filePath: string) => {
    const adapter = getAdapter();
    if (!adapter || !('getDiffAgainstBase' in adapter)) return;

    try {
      setLoading(true);
      setError(null);

      const diffTextResult = await (adapter as any).getDiffAgainstBase(worktreePath, undefined, filePath);
      setDiffText(diffTextResult ? diffTextResult.trim() : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
      setDiffText('');
    } finally {
      setLoading(false);
    }
  }, [worktreePath, getAdapter]);

  useEffect(() => {
    if (worktreePath) {
      loadGitStatus();
      loadGitLog();
      loadAllChangesFiles();
    }
  }, [worktreePath, loadGitStatus, loadGitLog, loadAllChangesFiles]);

  useEffect(() => {
    if (selectedFile && selectedSection === 'all') {
      loadDiffAgainstBase(selectedFile);
    } else if (selectedFile && selectedSection === 'current') {
      const file = files.find(f => f.path === selectedFile);
      const isStaged = file?.staged && !file?.modified;
      loadDiff(selectedFile, isStaged);
    } else if (selectedFile && selectedSection === 'commit' && selectedCommit) {
      loadCommitDiff(selectedCommit.hash, selectedFile);
    }
  }, [selectedFile, selectedSection, selectedCommit, files, loadDiff, loadCommitDiff, loadDiffAgainstBase]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onFileCountChange?.(files.length);
  }, [files.length, onFileCountChange]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      loadGitStatus();
      loadGitLog();
      loadAllChangesFiles();
    }
  }), [loadGitStatus, loadGitLog, loadAllChangesFiles]);

  const handleAllChangesFileClick = (file: CommitFile) => {
    setSelectedFile(file.path);
    setSelectedSection('all');
    setSelectedCommit(null);
  };

  const getCommitFileStatusIcon = (status: CommitFile['status']) => {
    const baseClass = "px-1.5 py-0.5 rounded text-xs font-medium inline-flex items-center justify-center min-w-[20px]";
    switch (status) {
      case 'M': return <span className={`${baseClass} text-amber-500 bg-amber-500/20`}>M</span>;
      case 'A': return <span className={`${baseClass} text-green-500 bg-green-500/20`}>A</span>;
      case 'D': return <span className={`${baseClass} text-red-500 bg-red-500/20`}>D</span>;
      case 'R': return <span className={`${baseClass} text-yellow-500 bg-yellow-500/20`}>R</span>;
      case 'C': return <span className={`${baseClass} text-cyan-500 bg-cyan-500/20`}>C</span>;
      default: return <span className={`${baseClass} text-gray-400`}>{status}</span>;
    }
  };

  const handleCommitFileClick = (commit: GitCommitType, file: CommitFile) => {
    setSelectedFile(file.path);
    setSelectedCommit(commit);
    setSelectedSection('commit');
  };

  const handleCurrentFileClick = (file: GitFile) => {
    setSelectedFile(file.path);
    setSelectedSection('current');
    setSelectedCommit(null);
  };

  const getCurrentFileStatusIcon = (file: GitFile) => {
    const baseClass = "px-1.5 py-0.5 rounded text-xs font-medium inline-flex items-center justify-center min-w-[20px]";
    if (file.staged && file.modified) {
      return <span className={`${baseClass} text-amber-500 bg-amber-500/20`}>SM</span>;
    }
    if (file.staged) {
      return <span className={`${baseClass} text-green-500 bg-green-500/20`}>S</span>;
    }
    const char = file.status[1];
    switch (char) {
      case 'M': return <span className={`${baseClass} text-amber-500 bg-amber-500/20`}>M</span>;
      case 'D': return <span className={`${baseClass} text-red-500 bg-red-500/20`}>D</span>;
      case '?': return <span className={`${baseClass} text-gray-500 bg-gray-500/20`}>?</span>;
      default: return <span className={`${baseClass} text-gray-400`}>{char || ' '}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File List - Full width on mobile, fixed width on desktop */}
        <div className={`
          ${selectedFile ? 'hidden md:flex' : 'flex'}
          w-full md:w-80 border-r flex-col min-w-0
        `}>
          <div className="flex-1 overflow-auto">
            {/* Current Section - only show if dirty working directory */}
            {files.length > 0 && (
              <div className="border-b">
                <button
                  onClick={() => setCurrentCollapsed(!currentCollapsed)}
                  className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors"
                >
                  {currentCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Current</span>
                  <span className="ml-auto text-xs text-muted-foreground">{files.length}</span>
                </button>
                {!currentCollapsed && (
                  <div className="px-2 pb-2">
                    <div className="space-y-1">
                      {files.map((file) => (
                        <div
                          key={`current-${file.path}`}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedFile === file.path && selectedSection === 'current' ? 'bg-muted' : ''
                          }`}
                          onClick={() => handleCurrentFileClick(file)}
                        >
                          {getCurrentFileStatusIcon(file)}
                          <span className="text-sm truncate flex-1 text-left" title={file.path}>
                            {file.path}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All Changes Section */}
            <div className="border-b">
              <button
                onClick={() => setAllChangesCollapsed(!allChangesCollapsed)}
                className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors"
              >
                {allChangesCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">All Changes</span>
                <span className="ml-auto text-xs text-muted-foreground">{allChangesFiles.length}</span>
              </button>
              {!allChangesCollapsed && (
                <div className="px-2 pb-2">
                  {allChangesFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No changes against origin</p>
                  ) : (
                    <div className="space-y-1">
                      {allChangesFiles.map((file) => (
                        <div
                          key={`all-${file.path}`}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedFile === file.path && selectedSection === 'all' ? 'bg-muted' : ''
                          }`}
                          onClick={() => handleAllChangesFileClick(file)}
                        >
                          {getCommitFileStatusIcon(file.status)}
                          <span className="text-sm truncate flex-1 text-left" title={file.path}>
                            {file.path}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* History Section */}
            <div>
              <button
                onClick={() => setHistoryCollapsed(!historyCollapsed)}
                className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors"
              >
                {historyCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">History</span>
                <span className="ml-auto text-xs text-muted-foreground">{commits.length}</span>
              </button>
              {!historyCollapsed && (
                <div className="px-2 pb-2">
                  {commits.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No commits</p>
                  ) : (
                    <div className="space-y-1">
                      {commits.map((commit) => {
                        const isExpanded = expandedCommits.has(commit.hash);
                        const files = commitFilesMap[commit.hash] || [];
                        return (
                          <div key={commit.hash}>
                            <div
                              className={`p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                                selectedCommit?.hash === commit.hash ? 'bg-muted' : ''
                              }`}
                              onClick={() => toggleCommitExpanded(commit)}
                            >
                              <div className="flex items-start gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm truncate" title={commit.subject}>
                                    {commit.subject}
                                  </p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <GitCommit className="h-3 w-3" />
                                    <span className="font-mono">{commit.shortHash}</span>
                                    <span className="mx-1">·</span>
                                    <span>{commit.author}</span>
                                    <span className="mx-1">·</span>
                                    <span>{commit.relativeDate}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            {isExpanded && files.length > 0 && (
                              <div className="ml-6 mt-1 space-y-1">
                                {files.map((file) => (
                                  <div
                                    key={file.path}
                                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                                      selectedFile === file.path && selectedSection === 'commit' && selectedCommit?.hash === commit.hash ? 'bg-muted' : ''
                                    }`}
                                    onClick={() => handleCommitFileClick(commit, file)}
                                  >
                                    {getCommitFileStatusIcon(file.status)}
                                    <span className="text-xs truncate flex-1" title={file.path}>
                                      {file.path}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Diff View - Hidden on mobile when no file selected */}
        <div className={`
          ${selectedFile ? 'flex' : 'hidden md:flex'}
          flex-1 flex-col min-w-0 overflow-hidden
        `}>
          {/* Mobile back button and file name */}
          {selectedFile && (
            <div className="md:hidden p-2 border-b bg-muted/30 flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setDiffText('');
                  if (selectedSection === 'commit') {
                    setSelectedCommit(null);
                  }
                  setSelectedSection('current');
                }}
                className="p-1 hover:bg-accent rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium truncate">
                {selectedFile}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedSection === 'all' ? 'vs origin' : selectedSection === 'commit' ? `commit ${selectedCommit?.shortHash}` : 'current'}
              </span>
            </div>
          )}

          {error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-destructive mb-2">Error loading diff</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <button
                  onClick={loadGitStatus}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2 inline" />
                  Retry
                </button>
              </div>
            </div>
          ) : !selectedFile ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a file to view changes</p>
              </div>
            </div>
          ) : !diffText ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No changes for this file</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto w-full">
              <div className="w-full overflow-hidden">
                <DiffErrorBoundary
                  key={`${selectedFile}-${selectedSection}`}
                  fallback={
                    <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
                      {diffText}
                    </pre>
                  }
                >
                  <DiffView
                    data={{
                      oldFile: {
                        fileName: selectedFile || '',
                        content: null
                      },
                      newFile: {
                        fileName: selectedFile || '',
                        content: null
                      },
                      hunks: [diffText]
                    }}
                    diffViewMode={DiffModeEnum.Unified}
                    diffViewTheme={theme}
                    diffViewHighlight={true}
                    diffViewWrap={true}
                    className="w-full"
                    style={{ maxWidth: '100%', overflow: 'hidden' }}
                  />
                </DiffErrorBoundary>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
