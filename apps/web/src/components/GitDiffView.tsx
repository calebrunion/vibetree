import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { ChevronLeft, FileText, RefreshCw } from 'lucide-react';
import { DiffView, DiffModeEnum } from '@git-diff-view/react';
import '@git-diff-view/react/styles/diff-view.css';
// import { useAppStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import type { GitStatus } from '@vibetree/core';

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
  modified: boolean;
}

interface GitDiffViewProps {
  worktreePath: string;
  theme?: 'light' | 'dark';
  viewMode: 'unstaged' | 'staged';
  onLoadingChange?: (loading: boolean) => void;
  onFileCountChange?: (count: number) => void;
}

export interface GitDiffViewRef {
  refresh: () => void;
}

export const GitDiffView = forwardRef<GitDiffViewRef, GitDiffViewProps>(function GitDiffView(
  { worktreePath, theme = 'light', viewMode, onLoadingChange, onFileCountChange },
  ref
) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getAdapter } = useWebSocket();

  const loadGitStatus = useCallback(async () => {
    const adapter = getAdapter();
    if (!adapter) return;

    try {
      setLoading(true);
      setError(null);

      const status: GitStatus[] = await adapter.getGitStatus(worktreePath);

      // Convert GitStatus to GitFile format
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

  const loadDiff = useCallback(async (filePath: string, staged: boolean = false) => {
    const adapter = getAdapter();
    if (!adapter) return;

    try {
      setLoading(true);
      setError(null);
      
      const diffTextResult = staged 
        ? await adapter.getGitDiffStaged(worktreePath, filePath)
        : await adapter.getGitDiff(worktreePath, filePath);
      
      // Handle undefined/null results safely
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
    }
  }, [worktreePath, loadGitStatus]);

  useEffect(() => {
    if (selectedFile) {
      const file = files.find(f => f.path === selectedFile);
      if (file) {
        const shouldLoadStaged = viewMode === 'staged' && file.staged;
        const shouldLoadUnstaged = viewMode === 'unstaged' && file.modified;
        
        if (shouldLoadStaged || shouldLoadUnstaged) {
          loadDiff(selectedFile, viewMode === 'staged');
        } else {
          setDiffText('');
        }
      }
    }
  }, [selectedFile, viewMode, files, loadDiff]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onFileCountChange?.(files.length);
  }, [files.length, onFileCountChange]);

  useImperativeHandle(ref, () => ({
    refresh: loadGitStatus
  }), [loadGitStatus]);

  const getStatusIcon = (status: string, forStaged: boolean) => {
    const char = forStaged ? status[0] : status[1];
    const baseClass = "px-1.5 py-0.5 rounded text-xs font-medium inline-flex items-center justify-center min-w-[20px]";
    switch (char) {
      case 'M': return <span className={`${baseClass} text-amber-500 bg-amber-500/20`}>M</span>;
      case 'A': return <span className={`${baseClass} text-green-500 bg-green-500/20`}>A</span>;
      case 'D': return <span className={`${baseClass} text-red-500 bg-red-500/20`}>D</span>;
      case 'R': return <span className={`${baseClass} text-yellow-500 bg-yellow-500/20`}>R</span>;
      case 'C': return <span className={`${baseClass} text-cyan-500 bg-cyan-500/20`}>C</span>;
      case '?': return <span className={`${baseClass} text-gray-500 bg-gray-500/20`}>?</span>;
      case 'U': return <span className={`${baseClass} text-green-500 bg-green-500/20`}>U</span>;
      default: return <span className={`${baseClass} text-gray-400`}>{char || ' '}</span>;
    }
  };

  const filteredFiles = files.filter(file => {
    if (viewMode === 'staged') return file.staged;
    if (viewMode === 'unstaged') return file.modified;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File List - Full width on mobile, fixed width on desktop */}
        <div className={`
          ${selectedFile ? 'hidden md:flex' : 'flex'}
          w-full md:w-80 border-r flex-col min-w-0
        `}>
          <div className="p-3 border-b bg-muted/50">
            <h4 className="text-sm font-medium">
              {viewMode === 'staged' ? 'Staged Changes' : 'Unstaged Changes'} ({filteredFiles.length})
            </h4>
          </div>
          <div className="flex-1 overflow-auto">
            <div className="p-2 space-y-1">
              {filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No {viewMode} changes</p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.path}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedFile === file.path ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedFile(file.path)}
                  >
                    {getStatusIcon(file.status, viewMode === 'staged')}
                    <span className="text-sm truncate flex-1 text-left" title={file.path}>
                      {file.path}
                    </span>
                  </div>
                ))
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
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-accent rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium truncate">{selectedFile}</span>
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
                <p className="text-sm">No {viewMode} changes for this file</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto w-full">
              <div className="p-2 md:p-4 w-full overflow-hidden">
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});