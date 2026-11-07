import { Lock } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { cn } from '../ui/utils'
import { Tooltip } from '../ui/Tooltip'
import { TOOL_META, TOOL_ORDER } from './toolConfig'

export function ToolRail() {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)
  const hasDocument = useEditorStore((state) => Boolean(state.fileName))

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
      </div>

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
