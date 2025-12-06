import { useState, useRef, useCallback, useEffect } from 'react'
import { GitCommitHorizontal, Check } from 'lucide-react'
import type { GitCommit } from '@buddy/core'

interface GitGraphProps {
  commits: GitCommit[]
  onCommitClick?: (commit: GitCommit) => void
  onBranchClick?: (branchName: string) => void
  theme?: 'light' | 'dark'
  isFullscreen?: boolean
  copiedHash?: string | null
  copiedBranch?: string | null
}

const BRANCH_COLORS = {
  light: ['#0969da', '#1a7f37', '#cf222e', '#8250df', '#bf8700', '#0550ae', '#6e7781'],
  dark: ['#58a6ff', '#3fb950', '#f85149', '#a371f7', '#d29922', '#79c0ff', '#8b949e'],
}

const ROW_HEIGHT = 32
const DOT_SIZE = 8
const LINE_WIDTH = 2
const COLUMN_WIDTH = 16

interface BranchLabel {
  name: string
  isInSyncWithOrigin?: boolean
}

function getBranchLabels(refs: string[] | undefined): BranchLabel[] {
  if (!refs || refs.length === 0) return []

  const labels: BranchLabel[] = []
  let headBranch: string | null = null

  // First: find current HEAD branch
  for (const ref of refs) {
    if (ref.startsWith('HEAD -> ')) {
      headBranch = ref.replace('HEAD -> ', '')
      break
    }
  }

  // Check if origin has the same branch at this commit (in sync)
  const originBranchName = headBranch ? `origin/${headBranch}` : null
  const isInSyncWithOrigin = originBranchName ? refs.includes(originBranchName) : false

  // Add current HEAD branch with sync info
  if (headBranch) {
    labels.push({ name: headBranch, isInSyncWithOrigin })
  }

  // Second: local branches (no /)
  for (const ref of refs) {
    if (!ref.includes('/') && !ref.startsWith('tag:') && ref !== headBranch) {
      labels.push({ name: ref })
    }
  }

  // Third: remote branches (origin/*) - skip the one that's in sync with HEAD
  for (const ref of refs) {
    if (ref.startsWith('origin/') && ref !== 'origin/HEAD') {
      // Skip if this is the origin branch that's in sync with HEAD
      if (isInSyncWithOrigin && ref === originBranchName) continue
      if (!labels.some((l) => l.name === ref)) {
        labels.push({ name: ref })
      }
    }
  }

  // Last: origin/HEAD (only if not same as the in-sync origin branch)
  if (refs.includes('origin/HEAD') && !labels.some((l) => l.name === 'origin/HEAD')) {
    // Skip if origin/HEAD points to the same branch that's in sync
    const originHeadBranch = refs.find((r) => r.startsWith('origin/') && r !== 'origin/HEAD')
    if (!(isInSyncWithOrigin && originHeadBranch === originBranchName)) {
      labels.push({ name: 'origin/HEAD' })
    }
  }

  // Limit to 3 labels to avoid clutter
  return labels.slice(0, 3)
}

function isCurrentHead(refs: string[] | undefined): boolean {
  if (!refs || refs.length === 0) return false
  return refs.some((ref) => ref.startsWith('HEAD -> '))
}

interface GraphNode {
  commit: GitCommit
  column: number
  parents: string[]
  childColumns: Map<string, number>
}

function buildGraphLayout(commits: GitCommit[]): GraphNode[] {
  const nodes: GraphNode[] = []
  const hashToNode = new Map<string, GraphNode>()
  const activeColumns = new Map<string, number>()
  let nextColumn = 0

  for (const commit of commits) {
    let column = 0

    const existingColumn = activeColumns.get(commit.hash)
    if (existingColumn !== undefined) {
      column = existingColumn
      activeColumns.delete(commit.hash)
    } else {
      while ([...activeColumns.values()].includes(nextColumn)) {
        nextColumn++
      }
      column = nextColumn
    }

    const parents = commit.parents || []
    const childColumns = new Map<string, number>()

    if (parents.length > 0) {
      const firstParent = parents[0]
      if (!activeColumns.has(firstParent)) {
        activeColumns.set(firstParent, column)
      }
      childColumns.set(firstParent, activeColumns.get(firstParent)!)

      for (let i = 1; i < parents.length; i++) {
        const parent = parents[i]
        if (!activeColumns.has(parent)) {
          let mergeColumn = column + 1
          while ([...activeColumns.values()].includes(mergeColumn)) {
            mergeColumn++
          }
          activeColumns.set(parent, mergeColumn)
        }
        childColumns.set(parent, activeColumns.get(parent)!)
      }
    }

    const node: GraphNode = {
      commit,
      column,
      parents,
      childColumns,
    }

    nodes.push(node)
    hashToNode.set(commit.hash, node)
  }

  return nodes
}

function GraphSvg({ nodes, theme }: { nodes: GraphNode[]; theme: 'light' | 'dark' }) {
  const colors = BRANCH_COLORS[theme]
  const maxColumn = Math.max(...nodes.map((n) => n.column), ...nodes.flatMap((n) => [...n.childColumns.values()]))
  const width = (maxColumn + 1) * COLUMN_WIDTH + DOT_SIZE
  const height = nodes.length * ROW_HEIGHT

  const backgrounds: JSX.Element[] = []
  const lines: JSX.Element[] = []
  const dots: JSX.Element[] = []

  nodes.forEach((node, index) => {
    // Add alternating row background
    if (index % 2 === 1) {
      backgrounds.push(
        <rect
          key={`bg-${node.commit.hash}`}
          x={0}
          y={index * ROW_HEIGHT}
          width={width}
          height={ROW_HEIGHT}
          fill={theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}
        />
      )
    }
    const x = node.column * COLUMN_WIDTH + DOT_SIZE / 2 + 4
    const y = index * ROW_HEIGHT + ROW_HEIGHT / 2
    const color = colors[node.column % colors.length]

    dots.push(
      <circle
        key={`dot-${node.commit.hash}`}
        cx={x}
        cy={y}
        r={DOT_SIZE / 2}
        fill={color}
        stroke={theme === 'dark' ? '#0d1117' : '#fff'}
        strokeWidth={2}
      />
    )

    node.childColumns.forEach((parentColumn, parentHash) => {
      const parentIndex = nodes.findIndex((n) => n.commit.hash === parentHash)
      if (parentIndex === -1) {
        const endY = height
        const parentX = parentColumn * COLUMN_WIDTH + DOT_SIZE / 2 + 4
        const parentColor = colors[parentColumn % colors.length]
        // For left-to-right merges, use the node's color (the branch it stems from)
        const lineColor = parentColumn > node.column ? color : parentColor

        if (parentColumn === node.column) {
          lines.push(
            <line
              key={`line-${node.commit.hash}-${parentHash}`}
              x1={x}
              y1={y}
              x2={parentX}
              y2={endY}
              stroke={parentColor}
              strokeWidth={LINE_WIDTH}
            />
          )
        } else {
          const midY = y + ROW_HEIGHT / 2
          const curveRadius = 10
          lines.push(
            <path
              key={`line-${node.commit.hash}-${parentHash}`}
              d={`M ${x} ${y} L ${x} ${midY} C ${x} ${midY + curveRadius} ${parentX} ${midY + curveRadius} ${parentX} ${midY + curveRadius * 2} L ${parentX} ${endY}`}
              stroke={lineColor}
              strokeWidth={LINE_WIDTH}
              fill="none"
            />
          )
        }
        return
      }

      const parentY = parentIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const parentX = parentColumn * COLUMN_WIDTH + DOT_SIZE / 2 + 4
      const parentColor = colors[parentColumn % colors.length]
      // For left-to-right merges, use the node's color (the branch it stems from)
      const lineColor = parentColumn > node.column ? color : parentColor

      if (parentColumn === node.column) {
        lines.push(
          <line
            key={`line-${node.commit.hash}-${parentHash}`}
            x1={x}
            y1={y}
            x2={parentX}
            y2={parentY}
            stroke={parentColor}
            strokeWidth={LINE_WIDTH}
          />
        )
      } else {
        const midY = y + ROW_HEIGHT / 2
        const curveRadius = 10
        lines.push(
          <path
            key={`line-${node.commit.hash}-${parentHash}`}
            d={`M ${x} ${y} L ${x} ${midY} C ${x} ${midY + curveRadius} ${parentX} ${midY + curveRadius} ${parentX} ${midY + curveRadius * 2} L ${parentX} ${parentY}`}
            stroke={lineColor}
            strokeWidth={LINE_WIDTH}
            fill="none"
          />
        )
      }
    })
  })

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      {backgrounds}
      {lines}
      {dots}
    </svg>
  )
}

export default function GitGraph({
  commits,
  onCommitClick,
  onBranchClick,
  theme = 'dark',
  isFullscreen: _isFullscreen = false,
  copiedHash,
  copiedBranch,
}: GitGraphProps) {
  const [graphWidth, setGraphWidth] = useState<number | null>(null)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentHeadRef = useRef<HTMLButtonElement>(null)
  const maxGraphWidthRef = useRef(200)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (currentHeadRef.current) {
        currentHeadRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }
    })
  }, [commits])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      setIsDraggingState(true)
      startX.current = e.clientX
      startWidth.current = graphWidth ?? maxGraphWidthRef.current
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = e.clientX - startX.current
        const newWidth = Math.min(maxGraphWidthRef.current, Math.max(30, startWidth.current + delta))
        setGraphWidth(newWidth)
      }

      const handleMouseUp = () => {
        isDragging.current = false
        setIsDraggingState(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [graphWidth]
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return
      isDragging.current = true
      setIsDraggingState(true)
      startX.current = e.touches[0].clientX
      startWidth.current = graphWidth ?? maxGraphWidthRef.current

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current || e.touches.length !== 1) return
        e.preventDefault()
        const delta = e.touches[0].clientX - startX.current
        const newWidth = Math.min(maxGraphWidthRef.current, Math.max(30, startWidth.current + delta))
        setGraphWidth(newWidth)
      }

      const handleTouchEnd = () => {
        isDragging.current = false
        setIsDraggingState(false)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }

      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
    },
    [graphWidth]
  )

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <GitCommitHorizontal className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No commits to display</p>
      </div>
    )
  }

  const nodes = buildGraphLayout(commits)

  // Calculate actual max width of the graph and update ref for slider limit
  const maxColumn = Math.max(...nodes.map((n) => n.column), ...nodes.flatMap((n) => [...n.childColumns.values()]))
  const maxGraphWidth = (maxColumn + 1) * COLUMN_WIDTH + DOT_SIZE
  maxGraphWidthRef.current = maxGraphWidth

  // Default to max width if not set
  const effectiveGraphWidth = graphWidth ?? maxGraphWidth

  return (
    <div className="h-full overflow-auto">
      <div className="flex">
        <div
          className="flex-shrink-0 sticky left-0 bg-background z-10 overflow-hidden relative"
          style={{ width: effectiveGraphWidth }}
        >
          <GraphSvg nodes={nodes} theme={theme} />
          <div
            className="absolute top-0 -right-11 w-24 h-full cursor-col-resize touch-none flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div
              className={`w-1 h-full transition-colors pointer-events-none ${isDraggingState ? 'bg-primary' : 'bg-border hover:bg-primary/50'}`}
            />
          </div>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto md:overflow-x-visible">
          {nodes.map((node) => {
            const branchLabels = getBranchLabels(node.commit.refs)
            const isHead = isCurrentHead(node.commit.refs)
            return (
              <button
                key={node.commit.hash}
                ref={isHead ? currentHeadRef : null}
                type="button"
                onClick={() => onCommitClick?.(node.commit)}
                className="w-full md:w-full min-w-max md:min-w-0 flex items-center gap-2 px-2 pr-4 text-left cursor-pointer"
                style={{ height: ROW_HEIGHT }}
              >
                {branchLabels.length > 0 && (
                  <div className="flex-shrink-0 flex gap-1">
                    {branchLabels.map((label, labelIndex) => {
                      const isHeadBranch = isHead && labelIndex === 0
                      const isCopied = copiedBranch === label.name
                      let className =
                        'relative px-2 py-0.5 text-xs font-mono rounded whitespace-nowrap md:truncate md:max-w-32 cursor-pointer hover:opacity-80 transition-opacity '
                      if (isCopied) {
                        className += 'bg-green-500/20 text-green-500 ring-1 ring-green-500/50'
                      } else if (isHeadBranch) {
                        className += 'bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50'
                      } else if (label.name.startsWith('origin/')) {
                        className += 'bg-purple-500/20 text-purple-400'
                      } else {
                        className += 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/50'
                      }
                      return (
                        <span
                          key={label.name}
                          className={className}
                          onClick={(e) => {
                            e.stopPropagation()
                            onBranchClick?.(label.name)
                          }}
                        >
                          <span className={isCopied ? 'invisible' : ''}>
                            {label.name}
                            {label.isInSyncWithOrigin && <span className="ml-1 opacity-60">• origin</span>}
                          </span>
                          {isCopied && (
                            <span className="absolute inset-0 flex items-center justify-center gap-1">
                              <Check className="h-3 w-3" />
                              copied
                            </span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="flex items-center gap-2 md:flex-1 md:min-w-0">
                  <span className="text-sm whitespace-nowrap md:truncate" title={node.commit.subject}>
                    {node.commit.subject}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground flex-shrink-0 flex items-center gap-1">
                    {copiedHash === node.commit.hash ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        <span className="text-green-500">copied</span>
                      </>
                    ) : (
                      node.commit.shortHash
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 hidden md:inline">
                    {node.commit.relativeDate}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
