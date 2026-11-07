import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerDownLeft,
  Download,
  FileX,
  FolderOpen,
  Maximize2,
  PanelLeft,
  PanelRight,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanText,
  Search,
  Trash,
  Undo2,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { Modal } from './ui/Modal'
import { cn, shortcutLabel } from './ui/utils'
import { TOOL_META, TOOL_ORDER } from './shell/toolConfig'

type CommandGroup = 'File' | 'Edit' | 'View' | 'Tools' | 'Page'

interface CommandAction {
  id: string
  group: CommandGroup
  label: string
  icon: LucideIcon
  keywords?: string
  shortcut?: string
  disabled?: boolean
  run: () => void
}

interface CommandPaletteProps {
  onOpen: () => void
}

export function CommandPalette({ onOpen }: CommandPaletteProps) {
  const commandOpen = useEditorStore((state) => state.commandOpen)
  if (!commandOpen) return null
  return <CommandPaletteDialog onOpen={onOpen} />
}

function CommandPaletteDialog({ onOpen }: CommandPaletteProps) {
  const setCommandOpen = useEditorStore((state) => state.setCommandOpen)
  const fileName = useEditorStore((state) => state.fileName)
  const status = useEditorStore((state) => state.status)
  const canUndo = useEditorStore((state) => state.past.length > 0)
  const canRedo = useEditorStore((state) => state.future.length > 0)
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const zoomIn = useEditorStore((state) => state.zoomIn)
  const zoomOut = useEditorStore((state) => state.zoomOut)
  const setFitMode = useEditorStore((state) => state.setFitMode)
  const setTool = useEditorStore((state) => state.setTool)
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar)
  const toggleInspector = useEditorStore((state) => state.toggleInspector)
  const rotatePage = useEditorStore((state) => state.rotatePage)
  const duplicatePage = useEditorStore((state) => state.duplicatePage)
  const deletePage = useEditorStore((state) => state.deletePage)
  const closeDocument = useEditorStore((state) => state.closeDocument)
  const exportDocument = useEditorStore((state) => state.exportDocument)
  const setOcrOpen = useEditorStore((state) => state.setOcrOpen)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const hasDocument = Boolean(fileName)
  const isExporting = status === 'exporting'
  const currentPage =
    pages.find((page) => page.id === currentPageId) ?? pages[0] ?? null

  const actions: CommandAction[] = [
    {
      id: 'open',
      group: 'File',
      label: 'Open PDF…',
      icon: FolderOpen,
      shortcut: shortcutLabel('O'),
      keywords: 'file browse document',
      run: onOpen,
    },
    {
      id: 'export',
      group: 'File',
      label: 'Export PDF',
      icon: Download,
      shortcut: shortcutLabel('S'),
      keywords: 'save download flatten annotations',
      disabled: !hasDocument || isExporting || status === 'loading',
      run: () => void exportDocument(),
    },
    {
      id: 'close',
      group: 'File',
      label: 'Close document',
      icon: FileX,
      keywords: 'clear exit',
      disabled: !hasDocument,
      run: closeDocument,
    },
    {
      id: 'undo',
      group: 'Edit',
      label: 'Undo',
      icon: Undo2,
      shortcut: shortcutLabel('Z'),
      keywords: 'history back',
      disabled: !canUndo,
      run: undo,
    },
    {
      id: 'redo',
      group: 'Edit',
      label: 'Redo',
      icon: Redo2,
      shortcut: shortcutLabel('Z', true),
      keywords: 'history forward',
      disabled: !canRedo,
      run: redo,
    },
    {
      id: 'zoom-in',
      group: 'View',
      label: 'Zoom in',
      icon: ZoomIn,
      shortcut: '+',
      keywords: 'larger magnify',
      disabled: !hasDocument,
      run: zoomIn,
    },
    {
      id: 'zoom-out',
      group: 'View',
      label: 'Zoom out',
      icon: ZoomOut,
      shortcut: '−',
      keywords: 'smaller reduce',
      disabled: !hasDocument,
      run: zoomOut,
    },
    {
      id: 'fit-width',
      group: 'View',
      label: 'Fit page to width',
      icon: Maximize2,
      keywords: 'zoom fit canvas',
      disabled: !hasDocument,
      run: () => setFitMode('width'),
    },
    {
      id: 'toggle-sidebar',
      group: 'View',
      label: 'Toggle sidebar',
      icon: PanelLeft,
      keywords: 'navigator panels thumbnails outline search',
      run: toggleSidebar,
    },
    {
      id: 'toggle-inspector',
      group: 'View',
      label: 'Toggle inspector',
      icon: PanelRight,
      keywords: 'properties document pages panel',
      run: toggleInspector,
    },
    ...TOOL_ORDER.map<CommandAction>((toolId) => {
      const meta = TOOL_META[toolId]
      return {
        id: `tool-${toolId}`,
        group: 'Tools',
        label: `${meta.label} tool`,
        icon: meta.icon,
        shortcut: meta.hint,
        keywords: meta.description,
        disabled: !hasDocument,
        run: () => setTool(toolId),
      }
    }),
    {
      id: 'ocr-scanned-pages',
      group: 'Tools',
      label: 'OCR scanned pages',
      icon: ScanText,
      keywords: 'searchable text tesseract scan recognize',
      disabled: !hasDocument,
      run: () => setOcrOpen(true),
    },
    {
      id: 'rotate-left',
      group: 'Page',
      label: 'Rotate page left',
      icon: RotateCcw,
      keywords: 'turn counterclockwise',
      disabled: !currentPage,
      run: () => {
        if (currentPage) rotatePage(currentPage.id, -90)
      },
    },
    {
      id: 'rotate-right',
      group: 'Page',
      label: 'Rotate page right',
      icon: RotateCw,
      keywords: 'turn clockwise',
      disabled: !currentPage,
      run: () => {
        if (currentPage) rotatePage(currentPage.id, 90)
      },
    },
    {
      id: 'duplicate-page',
      group: 'Page',
      label: 'Duplicate current page',
      icon: Copy,
      keywords: 'copy clone page',
      disabled: !currentPage,
      run: () => {
        if (currentPage) duplicatePage(currentPage.id)
      },
    },
    {
      id: 'delete-page',
      group: 'Page',
      label: 'Delete current page',
      icon: Trash,
      keywords: 'remove page',
      disabled: !currentPage || pages.length <= 1,
      run: () => {
        if (currentPage) deletePage(currentPage.id)
      },
    },
  ]

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? actions.filter((action) =>
        `${action.label} ${action.keywords ?? ''} ${action.group}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : actions

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filtered.length - 1))

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(
      `[data-command-index="${safeActiveIndex}"]`,
    )
    element?.scrollIntoView?.({ block: 'nearest' })
  }, [safeActiveIndex])

  const execute = (action: CommandAction) => {
    if (action.disabled) return
    action.run()
    setCommandOpen(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (filtered.length === 0) return
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => {
        let next = index
        for (let step = 0; step < filtered.length; step += 1) {
          next = (next + direction + filtered.length) % filtered.length
          if (!filtered[next].disabled) return next
        }
        return index
      })
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const action = filtered[safeActiveIndex]
      if (action) execute(action)
    }
  }

  const rows: Array<
    | { type: 'group'; key: string; label: CommandGroup }
    | { type: 'action'; key: string; action: CommandAction; index: number }
  > = []
  let lastGroup: CommandGroup | null = null
  let actionIndex = 0
  for (const action of filtered) {
    if (action.group !== lastGroup) {
      rows.push({ type: 'group', key: `group-${action.group}`, label: action.group })
      lastGroup = action.group
    }
    rows.push({
      type: 'action',
      key: action.id,
      action,
      index: actionIndex,
    })
    actionIndex += 1
  }

  return (
    <Modal
      open
      onClose={() => setCommandOpen(false)}
      labelledBy="command-title"
      className="max-w-[620px] overflow-hidden"
    >
      <h2 id="command-title" className="sr-only">
        Command palette
      </h2>
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <Search size={16} strokeWidth={1.9} className="shrink-0 text-faint" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={handleInputKeyDown}
          placeholder="Search commands or actions…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-autocomplete="list"
          aria-activedescendant={
            filtered.length > 0 ? `command-option-${safeActiveIndex}` : undefined
          }
          className="h-12 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
        />
        <kbd className="shrink-0 rounded border border-line bg-surface-muted px-1.5 py-0.5 font-sans text-[9px] text-faint">
          Esc
        </kbd>
      </div>

      <div
        id="command-list"
        ref={listRef}
        role="listbox"
        aria-label="Commands"
        className="max-h-[390px] overflow-y-auto p-2"
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-9 text-center">
            <p className="text-[11px] text-muted">
              No commands match{' '}
              <span className="font-medium text-ink-soft">“{query.trim()}”</span>.
            </p>
            <p className="mt-1 text-[10px] text-faint">
              Try “export”, “rotate”, or “sidebar”.
            </p>
          </div>
        ) : (
          rows.map((row) => {
            if (row.type === 'group') {
              return (
                <div
                  key={row.key}
                  role="presentation"
                  className="px-2.5 pb-1 pt-2.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-faint first:pt-1"
                >
                  {row.label}
                </div>
              )
            }

            const { action, index } = row
            const ActionIcon = action.icon
            const selected = index === safeActiveIndex
            return (
              <button
                key={row.key}
                id={`command-option-${index}`}
                data-command-index={index}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={action.disabled}
                onMouseMove={() => {
                  if (!action.disabled) setActiveIndex(index)
                }}
                onClick={() => execute(action)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-35',
                  selected ? 'bg-accent-50 text-ink' : 'text-ink-soft hover:bg-surface-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                    selected
                      ? 'border-accent-200 bg-surface text-accent-600'
                      : 'border-line bg-surface text-muted',
                  )}
                >
                  <ActionIcon size={14} strokeWidth={1.85} />
                </span>
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                {action.shortcut ? (
                  <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[9px] text-faint">
                    {action.shortcut}
                  </kbd>
                ) : null}
              </button>
            )
          })
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-[9px] text-faint">
        <span className="flex items-center gap-1.5">
          <kbd className="flex h-4 w-4 items-center justify-center rounded border border-line bg-surface">
            <ArrowUp size={9} />
          </kbd>
          <kbd className="flex h-4 w-4 items-center justify-center rounded border border-line bg-surface">
            <ArrowDown size={9} />
          </kbd>
          <span>navigate</span>
          <kbd className="ml-1 flex h-4 items-center justify-center gap-0.5 rounded border border-line bg-surface px-1">
            <CornerDownLeft size={9} />
          </kbd>
          <span>select</span>
        </span>
        <span>Paperline commands</span>
      </div>
    </Modal>
  )
}
