import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import {
  Copy,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'
import type { PageState } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { rotatedPageSize } from '../../lib/geometry'

const THUMB_WIDTH = 108

function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'RenderingCancelledException'
  )
}

function PageThumbnail({ page, priority }: { page: PageState; priority: boolean }) {
  const pdf = useEditorStore((state) => state.pdf)
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null)
  const [visible, setVisible] = useState(priority)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPdfPage(null)
    setRendered(false)
    if (!pdf || !visible) return
    pdf
      .getPage(page.sourceIndex + 1)
      .then((loaded) => {
        if (!cancelled) setPdfPage(loaded)
      })
      .catch(() => {
        if (!cancelled) setPdfPage(null)
      })
    return () => {
      cancelled = true
    }
  }, [pdf, page.sourceIndex, visible])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === host) setVisible(entry.isIntersecting)
        }
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const fallback = rotatedPageSize(page, 1)
  const fallbackHeight = fallback.width
    ? (THUMB_WIDTH * fallback.height) / fallback.width
    : THUMB_WIDTH
  const baseScale = fallback.width ? THUMB_WIDTH / fallback.width : 1

  const viewport = useMemo(() => {
    if (!pdfPage) return null
    return pdfPage.getViewport({
      scale: baseScale,
      rotation: page.rotation,
    })
  }, [pdfPage, baseScale, page.rotation])

  const height = viewport?.height ?? fallbackHeight

  useEffect(() => {
    if (!visible || !pdfPage || !viewport) return
    const canvas = canvasRef.current
    if (!canvas) return
    const outputScale = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale))
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale))
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    const context = canvas.getContext('2d')
    if (!context) return
    let cancelled = false
    setRendered(false)
    const task = pdfPage.render({
      canvas: null,
      canvasContext: context,
      viewport,
      transform:
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
    })
    task.promise.then(
      () => {
        if (!cancelled) setRendered(true)
      },
      (error: unknown) => {
        if (!cancelled && !isCancellation(error)) setRendered(true)
      },
    )
    return () => {
      cancelled = true
      task.cancel()
    }
  }, [visible, pdfPage, viewport])

  useEffect(() => {
    if (visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 0
    canvas.height = 0
    setRendered(false)
  }, [visible])

  return (
    <div
      ref={hostRef}
      className="relative overflow-hidden rounded-[2px] bg-white"
      style={{ width: THUMB_WIDTH, height }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {visible && !rendered ? (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-white via-surface-muted to-white" />
      ) : null}
    </div>
  )
}

interface ThumbnailItemProps {
  page: PageState
  index: number
  total: number
  isCurrent: boolean
  isSelected: boolean
  dragIndex: number | null
  dragOverIndex: number | null
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}

function ThumbnailItem({
  page,
  index,
  total,
  isCurrent,
  isSelected,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ThumbnailItemProps) {
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId)
  const rotatePage = useEditorStore((state) => state.rotatePage)
  const duplicatePage = useEditorStore((state) => state.duplicatePage)
  const deletePage = useEditorStore((state) => state.deletePage)

  const isDropTarget = dragOverIndex === index && dragIndex !== null && dragIndex !== index
  const dropAfter = isDropTarget && dragIndex !== null && dragIndex < index

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-thumbnail-id={page.id}
      aria-label={`Page ${index + 1}`}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={() => setCurrentPageId(page.id)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          setCurrentPageId(page.id)
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(index))
        onDragStart(index)
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver(index)
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length > 0) return
        event.preventDefault()
        event.stopPropagation()
        onDrop(index)
      }}
      onDragEnd={onDragEnd}
      className={[
        'group relative flex w-full cursor-pointer justify-center rounded-lg p-1.5 transition-colors',
        isCurrent ? 'bg-accent-50/80' : 'hover:bg-black/[0.035]',
      ].join(' ')}
    >
      {isDropTarget ? (
        <span
          className={[
            'pointer-events-none absolute inset-x-1 h-[2px] rounded-full bg-accent-500',
            dropAfter ? '-bottom-1' : '-top-1',
          ].join(' ')}
        />
      ) : null}

      <div className="flex flex-col items-center gap-1">
        <div
          className={[
            'relative overflow-hidden rounded-[2px] bg-white transition-shadow',
            isCurrent
              ? 'ring-2 ring-accent-500 ring-offset-2 ring-offset-canvas shadow-panel'
              : isSelected
                ? 'ring-2 ring-accent-500/35 shadow-panel'
                : 'ring-1 ring-black/[0.08] shadow-sm group-hover:ring-line-strong',
          ].join(' ')}
        >
          <PageThumbnail page={page} priority={index < 8} />
          <span className="pointer-events-none absolute left-1 top-1 rounded-[3px] bg-black/55 px-1.5 py-px text-[9px] font-semibold tabular-nums text-white backdrop-blur-sm">
            {index + 1}
          </span>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-gradient-to-t from-black/55 via-black/25 to-transparent px-1 pb-1 pt-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              title="Rotate left"
              aria-label={`Rotate page ${index + 1} left`}
              onClick={(event) => {
                event.stopPropagation()
                rotatePage(page.id, -90)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/90 text-ink-soft transition-colors hover:bg-white hover:text-ink"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Rotate right"
              aria-label={`Rotate page ${index + 1} right`}
              onClick={(event) => {
                event.stopPropagation()
                rotatePage(page.id, 90)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/90 text-ink-soft transition-colors hover:bg-white hover:text-ink"
            >
              <RotateCw className="h-3 w-3" />
            </button>
            <button
              type="button"
              title="Duplicate page"
              aria-label={`Duplicate page ${index + 1}`}
              onClick={(event) => {
                event.stopPropagation()
                duplicatePage(page.id)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/90 text-ink-soft transition-colors hover:bg-white hover:text-ink"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              title={total <= 1 ? 'A document needs at least one page' : 'Delete page'}
              aria-label={`Delete page ${index + 1}`}
              disabled={total <= 1}
              onClick={(event) => {
                event.stopPropagation()
                deletePage(page.id)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white/90 text-ink-soft transition-colors hover:bg-white hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-soft"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Thumbnails() {
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const selectedPageId = useEditorStore((state) => state.selectedPageId)
  const movePage = useEditorStore((state) => state.movePage)
  const listRef = useRef<HTMLDivElement>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!currentPageId) return
    const list = listRef.current
    if (!list) return
    const item = list.querySelector<HTMLElement>(
      `[data-thumbnail-id="${currentPageId}"]`,
    )
    item?.scrollIntoView({ block: 'nearest' })
  }, [currentPageId])

  const resetDrag = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted">
        Open a PDF to see page thumbnails.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Pages
        </span>
        <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted">
          {pages.length}
        </span>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex flex-col gap-2">
          {pages.map((page, index) => (
            <ThumbnailItem
              key={page.id}
              page={page}
              index={index}
              total={pages.length}
              isCurrent={page.id === currentPageId}
              isSelected={page.id === selectedPageId && page.id !== currentPageId}
              dragIndex={dragIndex}
              dragOverIndex={dragOverIndex}
              onDragStart={(from) => {
                setDragIndex(from)
                setDragOverIndex(from)
              }}
              onDragOver={(over) => setDragOverIndex(over)}
              onDrop={(target) => {
                if (dragIndex !== null && dragIndex !== target) movePage(dragIndex, target)
                resetDrag()
              }}
              onDragEnd={resetDrag}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
