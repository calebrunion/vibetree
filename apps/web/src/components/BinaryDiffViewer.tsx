import { useState, useEffect, useCallback } from 'react'
import { Code, Eye, FileImage, FileText, Loader2 } from 'lucide-react'

type ViewerType = {
  type: 'image' | 'pdf' | 'svg' | 'text'
  mimeType?: string
}

interface BinaryDiffViewerProps {
  worktreePath: string
  filePath: string
  section: 'current' | 'commit' | 'all'
  commitHash?: string
  getFileContent: (
    worktreePath: string,
    filePath: string,
    ref?: string
  ) => Promise<{
    content: string
    encoding: 'base64' | 'utf8'
    viewerType: ViewerType
  }>
  theme?: 'light' | 'dark'
}

export default function BinaryDiffViewer({
  worktreePath,
  filePath,
  section,
  commitHash,
  getFileContent,
  theme = 'light',
}: BinaryDiffViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [oldContent, setOldContent] = useState<string | null>(null)
  const [newContent, setNewContent] = useState<string | null>(null)
  const [viewerType, setViewerType] = useState<ViewerType | null>(null)
  const [svgViewMode, setSvgViewMode] = useState<'preview' | 'code'>('preview')

  const loadContent = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (section === 'current') {
        const [oldResult, newResult] = await Promise.all([
          getFileContent(worktreePath, filePath, 'HEAD').catch(() => null),
          getFileContent(worktreePath, filePath),
        ])

        setOldContent(oldResult?.content || null)
        setNewContent(newResult?.content || null)
        setViewerType(newResult?.viewerType || oldResult?.viewerType || null)
      } else if (section === 'commit' && commitHash) {
        const [oldResult, newResult] = await Promise.all([
          getFileContent(worktreePath, filePath, `${commitHash}^`).catch(() => null),
          getFileContent(worktreePath, filePath, commitHash).catch(() => null),
        ])

        setOldContent(oldResult?.content || null)
        setNewContent(newResult?.content || null)
        setViewerType(newResult?.viewerType || oldResult?.viewerType || null)
      } else if (section === 'all') {
        const [oldResult, newResult] = await Promise.all([
          getFileContent(worktreePath, filePath, 'origin/HEAD').catch(() => null),
          getFileContent(worktreePath, filePath),
        ])

        setOldContent(oldResult?.content || null)
        setNewContent(newResult?.content || null)
        setViewerType(newResult?.viewerType || oldResult?.viewerType || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content')
    } finally {
      setLoading(false)
    }
  }, [worktreePath, filePath, section, commitHash, getFileContent])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  if (!viewerType) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Unable to determine file type</p>
      </div>
    )
  }

  const renderImageViewer = () => {
    const oldDataUrl = oldContent ? `data:${viewerType.mimeType};base64,${oldContent}` : null
    const newDataUrl = newContent ? `data:${viewerType.mimeType};base64,${newContent}` : null

    return (
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-auto">
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Before</span>
          <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg p-4 w-full min-h-[200px]">
            {oldDataUrl ? (
              <img src={oldDataUrl} alt="Old version" className="max-w-full max-h-[400px] object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileImage className="h-12 w-12 opacity-50" />
                <span className="text-sm">File did not exist</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">After</span>
          <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg p-4 w-full min-h-[200px]">
            {newDataUrl ? (
              <img src={newDataUrl} alt="New version" className="max-w-full max-h-[400px] object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileImage className="h-12 w-12 opacity-50" />
                <span className="text-sm">File was deleted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderSVGViewer = () => {
    const decodeSvg = (content: string | null): string | null => {
      if (!content) return null
      try {
        return atob(content)
      } catch {
        return content
      }
    }

    const oldSvg = decodeSvg(oldContent)
    const newSvg = decodeSvg(newContent)

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium">SVG View:</span>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setSvgViewMode('preview')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                svgViewMode === 'preview' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </button>
            <button
              onClick={() => setSvgViewMode('code')}
              className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                svgViewMode === 'code' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Code
            </button>
          </div>
        </div>

        {svgViewMode === 'preview' ? (
          <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-auto">
            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Before</span>
              <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg p-4 w-full min-h-[200px]">
                {oldSvg ? (
                  <div
                    className="max-w-full max-h-[400px] overflow-auto [&>svg]:max-w-full [&>svg]:max-h-[400px]"
                    dangerouslySetInnerHTML={{ __html: oldSvg }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileImage className="h-12 w-12 opacity-50" />
                    <span className="text-sm">File did not exist</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">After</span>
              <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-lg p-4 w-full min-h-[200px]">
                {newSvg ? (
                  <div
                    className="max-w-full max-h-[400px] overflow-auto [&>svg]:max-w-full [&>svg]:max-h-[400px]"
                    dangerouslySetInnerHTML={{ __html: newSvg }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileImage className="h-12 w-12 opacity-50" />
                    <span className="text-sm">File was deleted</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-auto">
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-sm font-medium text-muted-foreground">Before</span>
              <pre
                className={`flex-1 p-4 text-xs font-mono overflow-auto rounded-lg border min-h-[200px] ${
                  theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50'
                }`}
              >
                {oldSvg || <span className="text-muted-foreground">File did not exist</span>}
              </pre>
            </div>

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span className="text-sm font-medium text-muted-foreground">After</span>
              <pre
                className={`flex-1 p-4 text-xs font-mono overflow-auto rounded-lg border min-h-[200px] ${
                  theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-50'
                }`}
              >
                {newSvg || <span className="text-muted-foreground">File was deleted</span>}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPDFViewer = () => {
    const oldDataUrl = oldContent ? `data:application/pdf;base64,${oldContent}` : null
    const newDataUrl = newContent ? `data:application/pdf;base64,${newContent}` : null

    return (
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-auto">
        <div className="flex-1 flex flex-col items-center gap-2 min-h-0">
          <span className="text-sm font-medium text-muted-foreground">Before</span>
          <div className="flex-1 w-full bg-muted/30 rounded-lg overflow-hidden min-h-[400px]">
            {oldDataUrl ? (
              <iframe src={oldDataUrl} className="w-full h-full min-h-[400px]" title="Old PDF version" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground h-full">
                <FileText className="h-12 w-12 opacity-50" />
                <span className="text-sm">File did not exist</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 min-h-0">
          <span className="text-sm font-medium text-muted-foreground">After</span>
          <div className="flex-1 w-full bg-muted/30 rounded-lg overflow-hidden min-h-[400px]">
            {newDataUrl ? (
              <iframe src={newDataUrl} className="w-full h-full min-h-[400px]" title="New PDF version" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground h-full">
                <FileText className="h-12 w-12 opacity-50" />
                <span className="text-sm">File was deleted</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  switch (viewerType.type) {
    case 'image':
      return renderImageViewer()
    case 'svg':
      return renderSVGViewer()
    case 'pdf':
      return renderPDFViewer()
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Unsupported file type</p>
        </div>
      )
  }
}
