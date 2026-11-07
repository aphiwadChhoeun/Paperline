import { FileClock, X } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { Button, IconButton } from './ui/Button'
import { formatSavedAt } from './ui/utils'

export function RecoveryBanner() {
  const session = useEditorStore((state) => state.recoverableSession)
  const restoreSession = useEditorStore((state) => state.restoreSession)
  const dismissRecovery = useEditorStore((state) => state.dismissRecovery)

  if (!session) return null

  return (
    <div
      role="status"
      className="animate-fade-in pointer-events-auto absolute left-1/2 top-4 z-20 w-[min(560px,calc(100%-2rem))] -translate-x-1/2"
    >
      <div className="flex items-start gap-3 rounded-xl border border-[#f0d9a8] bg-[#fffbf0] px-3.5 py-3 shadow-panel">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#f0d9a8] bg-[#fff4d6] text-[#9a6a12]">
          <FileClock size={15} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-ink">Pick up where you left off</p>
          <p className="mt-0.5 text-[10px] leading-4 text-ink-soft">
            Local edits from {formatSavedAt(session.savedAt)} are available for this document.
          </p>
          <p className="mt-0.5 text-[9px] tabular-nums text-muted">
            {session.pages.length} {session.pages.length === 1 ? 'page' : 'pages'} ·{' '}
            {session.fileName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="primary" size="sm" onClick={restoreSession}>
            Restore edits
          </Button>
          <IconButton label="Dismiss recovery banner" size="sm" onClick={dismissRecovery}>
            <X size={13} strokeWidth={2} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
