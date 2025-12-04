import { useState, useRef, useCallback, useEffect } from 'react'
import { GitCommitHorizontal, Check } from 'lucide-react'
import type { GitCommit } from '@buddy/core'

interface GitGraphProps {
  commits: GitCommit[]
  onCommitClick?: (commit: GitCommit) => void
  theme?: 'light' | 'dark'
  isFullscreen?: boolean
  copiedHash?: string | null
}

const BRANCH_COLORS = {
  light: ['#0969da', '#1a7f37', '#cf222e', '#8250df', '#bf8700', '#0550ae', '#6e7781'],
  dark: ['#58a6ff', '#3fb950', '#f85149', '#a371f7', '#d29922', '#79c0ff', '#8b949e'],
}

const ROW_HEIGHT = 32
const DOT_SIZE = 8
const LINE_WIDTH = 2
const COLUMN_WIDTH = 16

function getBranchNames(refs: string[] | undefined): string[] {
  if (!refs || refs.length === 0) return []

  const branchNames: string[] = []

  // First: current HEAD branch
  for (const ref of refs) {
    if (ref.startsWith('HEAD -> ')) {
      branchNames.push(ref.replace('HEAD -> ', ''))
    }
  }

  // Second: local branches (no /)
  for (const ref of refs) {
    if (!ref.includes('/') && !ref.startsWith('tag:') && !branchNames.includes(ref)) {
      branchNames.push(ref)
    }
  }

  // Third: remote branches (origin/*)
  for (const ref of refs) {
    if (ref.startsWith('origin/') && ref !== 'origin/HEAD' && !branchNames.includes(ref)) {
      branchNames.push(ref)
    }
  }

  // Last: origin/HEAD
  if (refs.includes('origin/HEAD') && !branchNames.includes('origin/HEAD')) {
    branchNames.push('origin/HEAD')
  }

  // Limit to 3 labels to avoid clutter
  return branchNames.slice(0, 3)
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

  const lines: JSX.Element[] = []
  const dots: JSX.Element[] = []

  nodes.forEach((node, index) => {
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
              stroke={parentColor}
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
            stroke={parentColor}
            strokeWidth={LINE_WIDTH}
            fill="none"
          />
        )
      }
    })
  })

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      {lines}
      {dots}
    </svg>
  )
}

export default function GitGraph({
  commits,
  onCommitClick,
  theme = 'dark',
  isFullscreen = false,
  copiedHash,
}: GitGraphProps) {
  const [graphWidth, setGraphWidth] = useState(isFullscreen ? 100 : 60)
  const [isDraggingState, setIsDraggingState] = useState(false)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const currentHeadRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setGraphWidth(isFullscreen ? 100 : 60)
  }, [isFullscreen])

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
      startWidth.current = graphWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return
        const delta = e.clientX - startX.current
        const newWidth = Math.min(200, Math.max(30, startWidth.current + delta))
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
      startWidth.current = graphWidth

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current || e.touches.length !== 1) return
        e.preventDefault()
        const delta = e.touches[0].clientX - startX.current
        const newWidth = Math.min(200, Math.max(30, startWidth.current + delta))
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

  return (
    <div className="h-full overflow-auto">
      <div className="flex">
        <div
          className="flex-shrink-0 sticky left-0 bg-background z-10 overflow-hidden relative"
          style={{ width: graphWidth }}
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
            const branchNames = getBranchNames(node.commit.refs)
            const isHead = isCurrentHead(node.commit.refs)
            return (
              <button
                key={node.commit.hash}
                ref={isHead ? currentHeadRef : null}
                type="button"
                onClick={() => onCommitClick?.(node.commit)}
                className={`w-full md:w-full min-w-max md:min-w-0 flex items-center gap-2 px-2 pr-4 text-left cursor-pointer ${
                  isHead ? 'bg-primary/10 border-l-2 border-primary' : ''
                }`}
                style={{ height: ROW_HEIGHT }}
              >
                {branchNames.length > 0 && (
                  <div className="flex-shrink-0 flex gap-1">
                    {branchNames.map((name) => (
                      <span
                        key={name}
                        className={`px-2 py-0.5 text-xs font-mono rounded whitespace-nowrap md:truncate md:max-w-32 ${
                          name === 'origin/HEAD'
                            ? 'bg-blue-500/20 text-blue-400'
                            : name.startsWith('origin/')
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-accent'
                        }`}
                      >
                        {name}
                      </span>
                    ))}
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
