import { useEffect, useMemo, useRef, useState } from 'react'
import type { PDFPageProxy } from 'pdfjs-dist'
import type { PageState } from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import { rotatedPageSize } from '../../lib/geometry'
import { AnnotationLayer } from './AnnotationLayer'
import { FormLayer } from './FormLayer'
import { SearchHighlightLayer } from './SearchHighlightLayer'

interface PageCanvasProps {
  page: PageState
  scale: number
  pageNumber: number
  isActive: boolean
}

function isCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'RenderingCancelledException'
  )
}

export function PageCanvas({ page, scale, pageNumber, isActive }: PageCanvasProps) {
  const pdf = useEditorStore((state) => state.pdf)
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null)
  // Seed the first pages as visible. IntersectionObserver can still demote
  // offscreen pages, but the document must paint even when the tab is hidden
  // or the observer has not delivered its first callback yet.
  const [visible, setVisible] = useState(pageNumber <= 2 || isActive)
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
    if (isActive) setVisible(true)
  }, [isActive])

  // Only rasterize pages near the viewport. The page box itself always exists,
  // so the scrollbar and page stack stay stable.
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
      { rootMargin: '700px 0px' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const viewport = useMemo(() => {
    if (!pdfPage) return null
    return pdfPage.getViewport({ scale, rotation: page.rotation })
  }, [pdfPage, scale, page.rotation])

  const fallback = rotatedPageSize(page, scale)
  const displayWidth = viewport?.width ?? fallback.width
  const displayHeight = viewport?.height ?? fallback.height

  useEffect(() => {
    if (!visible || !pdfPage || !viewport) return
    const canvas = canvasRef.current
    if (!canvas) return

    const outputScale = Math.min(window.devicePixelRatio || 1, 3)
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
        outputScale !== 1
          ? [outputScale, 0, 0, outputScale, 0, 0]
          : undefined,
    })
    task.promise.then(
      () => {
        if (!cancelled) setRendered(true)
      },
      (error: unknown) => {
        if (!cancelled && !isCancellation(error)) {
          // A failed page render should never take down the workspace.
          setRendered(true)
        }
      },
    )

    return () => {
      cancelled = true
      task.cancel()
    }
  }, [visible, pdfPage, viewport])

  // Drop the backing store for pages that scroll far out of view. This keeps
  // long documents from retaining dozens of full-resolution canvases.
  useEffect(() => {
    if (visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 0
    canvas.height = 0
    setRendered(false)
  }, [visible])

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={hostRef}
        data-page-canvas={page.id}
        className={[
          'relative rounded-[3px] bg-white page-shadow transition-shadow',
          isActive ? 'ring-1 ring-accent-500/45' : 'ring-0',
        ].join(' ')}
        style={{ width: displayWidth, height: displayHeight }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[3px]">
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>

        {visible && !rendered ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[3px] bg-white">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white via-surface-muted to-white" />
          </div>
        ) : null}

        {viewport ? <AnnotationLayer page={page} viewport={viewport} /> : null}
        {viewport ? <FormLayer page={page} viewport={viewport} /> : null}
        {viewport ? <SearchHighlightLayer page={page} viewport={viewport} /> : null}
      </div>

      <span
        className={[
          'select-none rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur-sm transition-colors',
          isActive ? 'bg-accent-50 text-accent-600' : 'bg-black/[0.045] text-muted',
        ].join(' ')}
      >
        Page {pageNumber}
      </span>
    </div>
  )
}
