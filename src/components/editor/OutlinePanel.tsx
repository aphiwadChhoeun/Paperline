import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'

interface OutlineNode {
  title: string
  bold: boolean
  italic: boolean
  dest: string | unknown[] | null
  url: string | null
  items: OutlineNode[]
}

interface RawOutlineNode {
  title?: unknown
  bold?: unknown
  italic?: unknown
  dest?: unknown
  url?: unknown
  items?: unknown
}

type PageRef = Parameters<PDFDocumentProxy['getPageIndex']>[0]

function isPageRef(value: unknown): value is PageRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'num' in value &&
    'gen' in value &&
    typeof (value as { num?: unknown }).num === 'number' &&
    typeof (value as { gen?: unknown }).gen === 'number'
  )
}

function normalizeOutline(raw: readonly unknown[]): OutlineNode[] {
  const nodes: OutlineNode[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as RawOutlineNode
    const title = typeof record.title === 'string' ? record.title : ''
    const dest =
      typeof record.dest === 'string'
        ? record.dest
        : Array.isArray(record.dest)
          ? record.dest
          : null
    nodes.push({
      title,
      bold: record.bold === true,
      italic: record.italic === true,
      dest,
      url: typeof record.url === 'string' ? record.url : null,
      items: Array.isArray(record.items) ? normalizeOutline(record.items) : [],
    })
  }
  return nodes
}

async function resolveDestination(
  pdf: PDFDocumentProxy,
  destination: string | unknown[],
  depth = 0,
): Promise<number | null> {
  if (depth > 4) return null
  if (typeof destination === 'string') {
    try {
      const resolved = await pdf.getDestination(destination)
      return resolved ? resolveDestination(pdf, resolved, depth + 1) : null
    } catch {
      return null
    }
  }
  if (!Array.isArray(destination) || destination.length === 0) return null
  const target = destination[0]
  if (typeof target === 'number') return target
  if (typeof target === 'string') {
    return resolveDestination(pdf, target, depth + 1)
  }
  if (isPageRef(target)) {
    try {
      return await pdf.getPageIndex(target)
    } catch {
      return null
    }
  }
  return null
}

interface OutlineRowProps {
  node: OutlineNode
  path: string
  collapsed: Set<string>
  onToggle: (path: string) => void
  onActivate: (node: OutlineNode) => void
}

function OutlineRow({ node, path, collapsed, onToggle, onActivate }: OutlineRowProps) {
  const hasChildren = node.items.length > 0
  const isCollapsed = collapsed.has(path)
  return (
    <div>
      <div className="group flex items-start gap-0.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-surface-muted">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(path)}
            aria-label={isCollapsed ? 'Expand bookmark' : 'Collapse bookmark'}
            aria-expanded={!isCollapsed}
            className="focus-ring mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-black/[0.06] hover:text-ink-soft"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="mt-[3px] h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onActivate(node)}
          className="focus-ring min-w-0 flex-1 rounded py-0.5 text-left text-[12px] leading-5 text-ink-soft transition-colors hover:text-ink"
          title={node.title || 'Untitled bookmark'}
        >
          <span
            className="line-clamp-2 break-words"
            style={{
              fontWeight: node.bold ? 600 : 400,
              fontStyle: node.italic ? 'italic' : 'normal',
            }}
          >
            {node.title || 'Untitled bookmark'}
          </span>
        </button>
      </div>
      {hasChildren && !isCollapsed ? (
        <div className="ml-[11px] border-l border-line/80 pl-1.5">
          {node.items.map((child, index) => (
            <OutlineRow
              key={`${path}.${index}`}
              node={child}
              path={`${path}.${index}`}
              collapsed={collapsed}
              onToggle={onToggle}
              onActivate={onActivate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function OutlinePanel() {
  const pdf = useEditorStore((state) => state.pdf)
  const [nodes, setNodes] = useState<OutlineNode[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setNodes([])
    setStatus(pdf ? 'loading' : 'empty')
    if (!pdf) return
    pdf
      .getOutline()
      .then((raw) => {
        if (cancelled) return
        const next = normalizeOutline(raw ?? [])
        setNodes(next)
        setStatus(next.length > 0 ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!cancelled) {
          setNodes([])
          setStatus('empty')
        }
      })
    return () => {
      cancelled = true
    }
  }, [pdf])

  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const activate = (node: OutlineNode) => {
    const state = useEditorStore.getState()
    const activePdf = state.pdf
    if (!activePdf) return
    void (async () => {
      if (node.dest) {
        const sourceIndex = await resolveDestination(activePdf, node.dest)
        if (sourceIndex !== null) {
          const page = useEditorStore
            .getState()
            .pages.find((item) => item.sourceIndex === sourceIndex)
          if (page) {
            useEditorStore.getState().setCurrentPageId(page.id)
            return
          }
        }
      }
      if (node.url) {
        window.open(node.url, '_blank', 'noopener,noreferrer')
      }
    })()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Bookmarks
        </span>
        {status === 'ready' ? (
          <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted">
            {nodes.length}
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {status === 'loading' ? (
          <div className="space-y-2 px-1 pt-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-5 animate-pulse rounded bg-black/[0.05]"
                style={{ width: `${88 - index * 9}%` }}
              />
            ))}
          </div>
        ) : status === 'empty' || nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 pb-10 text-center">
            <BookOpen className="h-5 w-5 text-faint" />
            <p className="text-xs text-muted">This document has no bookmarks.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {nodes.map((node, index) => (
              <OutlineRow
                key={`root.${index}`}
                node={node}
                path={`root.${index}`}
                collapsed={collapsed}
                onToggle={toggle}
                onActivate={activate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
