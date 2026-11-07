import { useRef, type ChangeEvent } from 'react'
import { ImagePlus, Lock } from 'lucide-react'
import { currentPage, useEditorStore } from '../../store/editorStore'
import { prepareImage } from '../../lib/image'
import { cn } from '../ui/utils'
import { Tooltip } from '../ui/Tooltip'
import { TOOL_META, TOOL_ORDER } from './toolConfig'

export function ToolRail() {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)
  const addAnnotation = useEditorStore((state) => state.addAnnotation)
  const notify = useEditorStore((state) => state.notify)
  const hasDocument = useEditorStore((state) => Boolean(state.fileName))
  const imageInputRef = useRef<HTMLInputElement>(null)

  const insertImage = async (file: File) => {
    try {
      const prepared = await prepareImage(file)
      const page = currentPage(useEditorStore.getState())
      if (!page) return
      const maxWidth = page.width * 0.55
      const maxHeight = page.height * 0.55
      const scale = Math.min(
        maxWidth / prepared.width,
        maxHeight / prepared.height,
        1,
      )
      const width = prepared.width * scale
      const height = prepared.height * scale
      addAnnotation({
        pageId: page.id,
        type: 'image',
        rect: {
          x: (page.width - width) / 2,
          y: (page.height - height) / 2,
          width,
          height,
        },
        dataUrl: prepared.dataUrl,
        mimeType: prepared.mimeType,
        opacity: 1,
        name: prepared.name,
      })
      notify('Image added. Drag it to position it, or adjust its size in the inspector.', 'success')
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'That image could not be inserted.',
        'error',
      )
    }
  }

  const handleImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void insertImage(file)
  }

  return (
    <aside
      aria-label="Editing tools"
      className="flex w-[60px] shrink-0 flex-col items-center border-r border-line bg-surface py-2.5"
    >
      <div className="flex flex-col gap-1">
        {TOOL_ORDER.map((toolId, index) => {
          const meta = TOOL_META[toolId]
          const ToolIcon = meta.icon
          const active = tool === toolId
          return (
            <div
              key={toolId}
              className={cn(index === 1 && 'mt-2 border-t border-line pt-2')}
            >
              <Tooltip label={meta.label} shortcut={meta.hint} side="right">
                <button
                  type="button"
                  aria-label={`${meta.label} tool (${meta.hint})`}
                  aria-keyshortcuts={meta.hint}
                  aria-pressed={active}
                  disabled={!hasDocument}
                  onClick={() => setTool(toolId)}
                  className={cn(
                    'focus-ring relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30',
                    active
                      ? 'bg-accent-50 text-accent-600'
                      : 'text-muted hover:bg-surface-muted hover:text-ink',
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute -left-[10px] h-4 w-[3px] rounded-r-full bg-accent-500"
                    />
                  ) : null}
                  <ToolIcon size={18} strokeWidth={1.75} />
                </button>
              </Tooltip>
            </div>
          )
        })}

        <div className="mt-2 border-t border-line pt-2">
          <Tooltip label="Insert image" side="right">
            <button
              type="button"
              aria-label="Insert image"
              disabled={!hasDocument}
              onClick={() => imageInputRef.current?.click()}
              className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-[10px] text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ImagePlus size={18} strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Choose an image to insert"
        tabIndex={-1}
        onChange={handleImageFile}
      />

      <div className="mt-auto flex flex-col items-center gap-3">
        <span className="h-px w-6 bg-line" aria-hidden="true" />
        <Tooltip label="Local-first · nothing is uploaded" side="right">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line bg-surface-muted text-faint"
          >
            <Lock size={14} strokeWidth={1.8} />
          </div>
        </Tooltip>
      </div>
    </aside>
  )
}
