import { FileText, Lock, Monitor } from 'lucide-react'
import { BrandMark } from './BrandMark'

interface MobileNoticeProps {
  fileName: string | null
}

export function MobileNotice({ fileName }: MobileNoticeProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-canvas md:hidden">
      <header className="flex h-[54px] shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
        <BrandMark />
        <span className="text-[14px] font-semibold tracking-[-0.02em] text-ink">Paperline</span>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft shadow-panel">
            <Monitor size={20} strokeWidth={1.7} />
          </div>
          <h1 className="mt-4 text-[19px] font-semibold tracking-[-0.025em] text-ink">
            {fileName ? 'Continue on a larger screen' : 'Best on a larger screen'}
          </h1>
          <p className="mt-2 text-[12px] leading-5 text-muted">
            {fileName
              ? 'This document is open. Expand the window to 768px or wider to annotate, reorganize, and export pages.'
              : 'Paperline’s editing workspace needs room for pages, tools, and properties. Open it on a desktop or tablet to edit PDFs.'}
          </p>

          {fileName ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">
                <FileText size={15} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-ink">{fileName}</p>
                <p className="mt-0.5 text-[9.5px] text-muted">Open in a wider window to edit</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[10px] leading-4 text-muted">
            <Lock size={12} strokeWidth={1.9} className="mt-0.5 shrink-0" />
            <span>Files never leave your device. Everything runs in the browser.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
