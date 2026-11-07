import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Maximize2, MoveHorizontal, ZoomIn, ZoomOut } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { clamp, isTypingTarget, rotatedPageSize } from '../../lib/geometry'
import { PageCanvas } from './PageCanvas'

const PAGE_PADDING = 112
const SCROLL_LEAD = 24
const PROGRAMMATIC_SCROLL_MS = 750

export function PdfWorkspace() {
  const pdf = useEditorStore((state) => state.pdf)
  const pages = useEditorStore((state) => state.pages)
  const currentId = useEditorStore((state) => state.currentPageId)
  const zoom = useEditorStore((state) => state.zoom)
  const fitMode = useEditorStore((state) => state.fitMode)
  const zoomIn = useEditorStore((state) => state.zoomIn)
  const zoomOut = useEditorStore((state) => state.zoomOut)
  const setZoom = useEditorStore((state) => state.setZoom)
  const setFitMode = useEditorStore((state) => state.setFitMode)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<string, HTMLDivElement>())
  const suppressScrollRef = useRef<string | null>(null)
  const programmaticUntilRef = useRef(0)
  const scrollTimerRef = useRef<number | null>(null)
  const lastCurrentRef = useRef<string | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const measure = () => {
      const next = { width: element.clientWidth, height: element.clientHeight }
      setViewportSize((current) =>
        current.width === next.width && current.height === next.height ? current : next,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const activePage = pages.find((page) => page.id === currentId) ?? pages[0] ?? null
  const activeWidth = activePage?.width ?? 0
  const activeHeight = activePage?.height ?? 0
  const activeRotation = activePage?.rotation ?? 0

  const fitScale = useMemo(() => {
    if (!activeWidth || !activeHeight || viewportSize.width === 0) return 1
    const rotated = rotatedPageSize({
      width: activeWidth,
      height: activeHeight,
      rotation: activeRotation,
    })
    if (!rotated.width || !rotated.height) return 1
    const availableWidth = Math.max(160, viewportSize.width - PAGE_PADDING)
    const availableHeight = Math.max(160, viewportSize.height - PAGE_PADDING)
    const raw =
      fitMode === 'page'
        ? Math.min(availableWidth / rotated.width, availableHeight / rotated.height)
        : availableWidth / rotated.width
    return clamp(raw, 0.1, 4)
  }, [activeWidth, activeHeight, activeRotation, fitMode, viewportSize])

  const scale = fitMode === 'none' ? zoom : fitScale

  // Keep the store's zoom in sync with the fitted scale. This makes the first
  // press of zoom-in/out continue from the fitted size instead of snapping.
  useEffect(() => {
    if (fitMode === 'none' || fitScale <= 0) return
    const next = clamp(Number(fitScale.toFixed(4)), 0.1, 8)
    if (Math.abs(useEditorStore.getState().zoom - next) < 0.002) return
    useEditorStore.setState({ zoom: next })
  }, [fitMode, fitScale])

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
    }
  }, [])

  const registerPage = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) pageRefs.current.set(id, node)
    else pageRefs.current.delete(id)
  }, [])

  const scrollToPage = useCallback((id: string) => {
    const root = scrollRef.current
    const element = pageRefs.current.get(id)
    if (!root || !element) return
    const rootRect = root.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const top = root.scrollTop + elementRect.top - rootRect.top - SCROLL_LEAD
    programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = window.setTimeout(() => {
      programmaticUntilRef.current = 0
      scrollTimerRef.current = null
    }, PROGRAMMATIC_SCROLL_MS)
    root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }, [])

  // Navigation from thumbnails, search, outlines or the page input.
  useEffect(() => {
    if (!currentId) return
    if (lastCurrentRef.current === currentId) return
    lastCurrentRef.current = currentId
    if (suppressScrollRef.current === currentId) {
      suppressScrollRef.current = null
      return
    }
    scrollToPage(currentId)
  }, [currentId, scrollToPage])

  const pagesKey = pages.map((page) => page.id).join('|')

  // Track which page owns the viewport while the user scrolls.
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !pagesKey) return
    if (typeof IntersectionObserver === 'undefined') return
    const ratios = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.pageId
          if (!id) continue
          ratios.set(id, entry.isIntersecting ? entry.intersectionRect.height : 0)
        }
        if (Date.now() < programmaticUntilRef.current) return
        let bestId: string | null = null
        let bestHeight = 0
        ratios.forEach((height, id) => {
          if (height > bestHeight) {
            bestHeight = height
            bestId = id
          }
        })
        if (!bestId || bestHeight < 40) return
        const state = useEditorStore.getState()
        if (state.currentPageId === bestId) return
        suppressScrollRef.current = bestId
        state.setCurrentPageId(bestId)
      },
      {
        root,
        threshold: [0, 0.08, 0.2, 0.4, 0.6, 0.8, 1],
      },
    )
    pageRefs.current.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [pagesKey])

  // Workspace keyboard shortcuts. This runs in the capture phase and stops
  // propagation for keys it handles, so app-level shortcuts are not applied
  // twice. Shortcuts that belong to dialogs are left alone.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const state = useEditorStore.getState()
      if (
        state.commandOpen ||
        state.passwordRequired ||
        document.querySelector('[aria-modal="true"]')
      ) {
        return
      }
      const typing = isTypingTarget(event.target)
      const modifier = event.metaKey || event.ctrlKey
      const claim = () => {
        event.preventDefault()
        event.stopImmediatePropagation()
      }

      if (modifier && !event.altKey && event.key.toLowerCase() === 'z') {
        if (typing) return
        claim()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (modifier || event.altKey) return

      if (event.key === 'PageDown' || event.key === 'PageUp') {
        if (typing) return
        claim()
        const currentIndex = state.pages.findIndex((page) => page.id === state.currentPageId)
        const nextIndex = clamp(
          currentIndex + (event.key === 'PageDown' ? 1 : -1),
          0,
          state.pages.length - 1,
        )
        const next = state.pages[nextIndex]
        if (next && next.id !== state.currentPageId) state.setCurrentPageId(next.id)
        return
      }

      if (typing) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!state.selectedAnnotationId) return
        claim()
        state.deleteSelectedAnnotation()
        return
      }

      if (event.key === 'Escape') {
        if (!state.selectedAnnotationId) return
        claim()
        state.selectAnnotation(null)
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'v' || key === 't' || key === 'h' || key === 'r' || key === 'p') {
        claim()
      }
      if (key === 'v') state.setTool('select')
      else if (key === 't') state.setTool('text')
      else if (key === 'h') state.setTool('highlight')
      else if (key === 'r') state.setTool('rectangle')
      else if (key === 'p') state.setTool('ink')
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  if (!pdf || pages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <div className="animate-fade-in rounded-2xl border border-line bg-surface/85 px-6 py-5 text-center shadow-panel">
          <p className="text-sm font-medium text-ink">Preparing document</p>
          <p className="mt-1 text-xs text-muted">
            Pages will appear here as soon as the PDF is ready.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <div
        ref={scrollRef}
        className="workspace-grid relative h-full min-h-0 flex-1 overflow-auto"
      >
        <div className="mx-auto flex min-h-full w-max min-w-full flex-col items-center gap-8 px-8 py-10">
          {pages.map((page, index) => (
            <div
              key={page.id}
              data-page-id={page.id}
              ref={(node) => registerPage(page.id, node)}
              className="flex w-full scroll-mt-8 flex-col items-center"
            >
              <PageCanvas
                page={page}
                scale={scale}
                pageNumber={index + 1}
                isActive={page.id === currentId}
              />
            </div>
          ))}
          <div className="h-2" aria-hidden="true" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-4">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-line/80 bg-surface/95 p-1 shadow-float backdrop-blur">
          <button
            type="button"
            onClick={zoomOut}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="focus-ring min-w-[48px] rounded-lg px-2 py-1 text-center text-[11px] font-medium tabular-nums text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            title="Actual size"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="mx-0.5 h-4 w-px bg-line" aria-hidden="true" />
          <button
            type="button"
            onClick={() => setFitMode('width')}
            aria-pressed={fitMode === 'width'}
            className={[
              'focus-ring flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              fitMode === 'width'
                ? 'bg-accent-50 text-accent-600'
                : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            ].join(' ')}
            aria-label="Fit width"
            title="Fit width"
          >
            <MoveHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFitMode('page')}
            aria-pressed={fitMode === 'page'}
            className={[
              'focus-ring flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
              fitMode === 'page'
                ? 'bg-accent-50 text-accent-600'
                : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
            ].join(' ')}
            aria-label="Fit page"
            title="Fit page"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
