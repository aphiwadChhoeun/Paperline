import { useEffect } from 'react'
import {
  CircleCheck,
  Info,
  TriangleExclamationPoint,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import type { NoticeTone } from '../types/editor'
import { cn } from './ui/utils'

const TONE_STYLES: Record<
  NoticeTone,
  { icon: LucideIcon; iconClass: string; borderClass: string; backgroundClass: string }
> = {
  success: {
    icon: CircleCheck,
    iconClass: 'text-[#2f9e6e]',
    borderClass: 'border-[#c6e7d4]',
    backgroundClass: 'bg-[#f7fdf9]',
  },
  error: {
    icon: TriangleExclamationPoint,
    iconClass: 'text-[#b42318]',
    borderClass: 'border-[#f3c6c2]',
    backgroundClass: 'bg-[#fffafa]',
  },
  info: {
    icon: Info,
    iconClass: 'text-accent-600',
    borderClass: 'border-line',
    backgroundClass: 'bg-surface',
  },
}

export function Toast() {
  const notice = useEditorStore((state) => state.notice)
  const dismissNotice = useEditorStore((state) => state.dismissNotice)
  const noticeId = notice?.id

  useEffect(() => {
    if (!noticeId) return
    const timer = window.setTimeout(dismissNotice, 4200)
    return () => window.clearTimeout(timer)
  }, [noticeId, dismissNotice])

  if (!notice) return null

  const tone = TONE_STYLES[notice.tone]
  const ToneIcon = tone.icon

  return (
    <div className="pointer-events-none fixed bottom-[38px] right-4 z-40 w-[min(360px,calc(100vw-2rem))]">
      <div
        key={notice.id}
        role={notice.tone === 'error' ? 'alert' : 'status'}
        className={cn(
          'animate-fade-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-float',
          tone.borderClass,
          tone.backgroundClass,
        )}
      >
        <ToneIcon
          size={15}
          strokeWidth={1.9}
          className={cn('mt-0.5 shrink-0', tone.iconClass)}
        />
        <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-ink-soft">{notice.message}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={dismissNotice}
          className="focus-ring -mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-black/5 hover:text-ink"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
