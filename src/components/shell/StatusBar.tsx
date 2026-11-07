import { LoaderCircle, Lock } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { TOOL_META } from './toolConfig'

export function StatusBar() {
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const zoom = useEditorStore((state) => state.zoom)
  const tool = useEditorStore((state) => state.tool)
  const status = useEditorStore((state) => state.status)
  const hasDocument = useEditorStore((state) => Boolean(state.fileName))

  const currentIndex = pages.findIndex((page) => page.id === currentPageId)
  const ToolIcon = TOOL_META[tool].icon
  const isExporting = status === 'exporting'

  return (
    <footer className="flex h-[30px] shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-3 text-[10px] text-muted">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="tabular-nums">
          {hasDocument ? `${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'No document'}
        </span>
        <span className="h-3 w-px bg-line" aria-hidden="true" />
        <span className="tabular-nums">
          {hasDocument && currentIndex >= 0
            ? `Page ${currentIndex + 1} of ${pages.length}`
            : 'Open a PDF'}
        </span>
      </div>

      <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
        <Lock size={11} strokeWidth={1.9} className="shrink-0" />
        <span className="truncate">Local-first · Your edits stay in this browser</span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {isExporting ? (
          <span
            aria-live="polite"
            className="flex items-center gap-1 font-medium text-accent-600"
          >
            <LoaderCircle size={11} className="animate-spin" />
            Exporting PDF…
          </span>
        ) : null}
        <span className="flex items-center gap-1.5 capitalize">
          <ToolIcon size={11} strokeWidth={1.9} />
          {tool}
        </span>
        <span className="h-3 w-px bg-line" aria-hidden="true" />
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>
    </footer>
  )
}
