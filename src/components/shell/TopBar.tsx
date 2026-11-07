import {
  Download,
  FolderOpen,
  LoaderCircle,
  Maximize2,
  Minus,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Undo2,
} from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { Button, IconButton } from '../ui/Button'
import { cn, formatBytes, shortcutLabel } from '../ui/utils'
import { BrandMark } from './BrandMark'

interface TopBarProps {
  onOpen: () => void
}

export function TopBar({ onOpen }: TopBarProps) {
  const fileName = useEditorStore((state) => state.fileName)
  const fileSize = useEditorStore((state) => state.fileSize)
  const isDirty = useEditorStore((state) => state.isDirty)
  const status = useEditorStore((state) => state.status)
  const isEncrypted = useEditorStore((state) => state.isEncrypted)
  const canUndo = useEditorStore((state) => state.past.length > 0)
  const canRedo = useEditorStore((state) => state.future.length > 0)
  const zoom = useEditorStore((state) => state.zoom)
  const fitMode = useEditorStore((state) => state.fitMode)
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen)
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const zoomIn = useEditorStore((state) => state.zoomIn)
  const zoomOut = useEditorStore((state) => state.zoomOut)
  const setZoom = useEditorStore((state) => state.setZoom)
  const setFitMode = useEditorStore((state) => state.setFitMode)
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar)
  const toggleInspector = useEditorStore((state) => state.toggleInspector)
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen)
  const exportDocument = useEditorStore((state) => state.exportDocument)

  const hasDocument = Boolean(fileName)
  const isExporting = status === 'exporting'
  const isLoading = status === 'loading'

  let statusLabel = 'Open a PDF to start editing'
  let statusDot = 'bg-faint'
  if (hasDocument) {
    if (isExporting) {
      statusLabel = 'Exporting PDF'
      statusDot = 'bg-accent-500'
    } else if (isDirty) {
      statusLabel = 'Unsaved changes'
      statusDot = 'bg-amber-500'
    } else if (isEncrypted) {
      statusLabel = 'Encrypted · view only'
      statusDot = 'bg-amber-500'
    } else {
      statusLabel = 'Saved locally'
      statusDot = 'bg-[#2f9e6e]'
    }
  }

  return (
    <header className="flex h-[54px] shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2.5">
      <div className="flex items-center gap-2 pl-0.5">
        <BrandMark />
        <span className="sr-only xl:hidden">Paperline</span>
        <span className="hidden text-[14px] font-semibold tracking-[-0.02em] text-ink xl:inline">
          Paperline
        </span>
      </div>

      <span className="mx-1 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <div className="min-w-0 max-w-[280px] flex-1 xl:flex-none">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] font-medium leading-4 text-ink">
            {fileName ?? 'No document open'}
          </span>
          {hasDocument ? (
            <span className="hidden shrink-0 text-[10px] tabular-nums text-faint sm:inline">
              {formatBytes(fileSize)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-muted">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusDot)} />
          <span className="truncate">{statusLabel}</span>
        </div>
      </div>

      <div className="hidden min-[900px]:block flex-1" />

      <div className="flex items-center gap-0.5">
        <IconButton
          label={`Undo (${shortcutLabel('Z')})`}
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 size={15} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          label={`Redo (${shortcutLabel('Z', true)})`}
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 size={15} strokeWidth={1.8} />
        </IconButton>
      </div>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <div className="flex h-8 items-center rounded-lg border border-line bg-surface-muted/60 px-0.5">
        <IconButton
          label="Zoom out"
          size="sm"
          onClick={zoomOut}
          disabled={!hasDocument || zoom <= 0.1}
        >
          <Minus size={13} strokeWidth={2} />
        </IconButton>
        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={!hasDocument}
          title="Reset zoom to 100%"
          className="focus-ring h-6 min-w-[44px] rounded-md px-1 text-center text-[10.5px] font-semibold tabular-nums text-ink-soft transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton
          label="Zoom in"
          size="sm"
          onClick={zoomIn}
          disabled={!hasDocument || zoom >= 8}
        >
          <Plus size={13} strokeWidth={2} />
        </IconButton>
      </div>

      <IconButton
        label="Fit page to width"
        onClick={() => setFitMode('width')}
        active={fitMode === 'width'}
        disabled={!hasDocument}
      >
        <Maximize2 size={14} strokeWidth={1.8} />
      </IconButton>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label="Open command palette"
        className="focus-ring flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-[11px] text-muted transition-colors hover:bg-surface-muted hover:text-ink"
      >
        <Search size={14} strokeWidth={1.8} />
        <span className="hidden xl:inline">Search</span>
        <kbd className="hidden rounded border border-line bg-surface-muted px-1 py-px font-sans text-[9px] font-normal text-faint xl:inline">
          {shortcutLabel('K')}
        </kbd>
      </button>

      <div className="flex items-center gap-0.5">
        <IconButton
          label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onClick={toggleSidebar}
          active={sidebarOpen}
          aria-pressed={sidebarOpen}
        >
          <PanelLeft size={15} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          label={inspectorOpen ? 'Hide inspector' : 'Show inspector'}
          onClick={toggleInspector}
          active={inspectorOpen}
          aria-pressed={inspectorOpen}
        >
          <PanelRight size={15} strokeWidth={1.8} />
        </IconButton>
      </div>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />

      <Button
        variant="secondary"
        onClick={onOpen}
        aria-label="Open a PDF"
        className="px-2 lg:px-3"
      >
        <FolderOpen size={14} strokeWidth={1.8} />
        <span className="hidden lg:inline">Open</span>
      </Button>

      <Button
        variant="primary"
        onClick={() => void exportDocument()}
        disabled={!hasDocument || isExporting || isLoading || isEncrypted}
        aria-busy={isExporting}
        title={
          isEncrypted
            ? 'Encrypted PDF export is not supported yet. The document can still be viewed.'
            : undefined
        }
        className="min-w-[84px] px-2.5 lg:px-3"
      >
        {isExporting ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <Download size={14} strokeWidth={2} />
        )}
        <span>{isExporting ? 'Exporting' : 'Export PDF'}</span>
      </Button>
    </header>
  )
}
