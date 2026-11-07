import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ScanText,
  X,
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'
import { Button } from './ui/Button'
import { Field, Select } from './ui/Field'
import { Modal } from './ui/Modal'
import { cn } from './ui/utils'

const LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'spa', label: 'Spanish' },
  { value: 'fra', label: 'French' },
  { value: 'deu', label: 'German' },
  { value: 'por', label: 'Portuguese' },
  { value: 'ita', label: 'Italian' },
  { value: 'nld', label: 'Dutch' },
]

export function OcrDialog() {
  const open = useEditorStore((state) => state.ocrOpen)
  const setOpen = useEditorStore((state) => state.setOcrOpen)
  const status = useEditorStore((state) => state.ocrStatus)
  const progress = useEditorStore((state) => state.ocrProgress)
  const message = useEditorStore((state) => state.ocrMessage)
  const error = useEditorStore((state) => state.ocrError)
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const runOcr = useEditorStore((state) => state.runOcr)

  const [language, setLanguage] = useState('eng')
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const running = status === 'running'
  const currentPageIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === currentPageId),
  )
  const targetPages =
    scope === 'current'
      ? pages.filter((page) => page.id === currentPageId)
      : pages

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      labelledBy="ocr-title"
      describedBy="ocr-description"
      className="max-w-[430px]"
    >
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
            <ScanText size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ocr-title" className="text-[14px] font-semibold text-ink">
              Make scanned pages searchable
            </h2>
            <p id="ocr-description" className="mt-0.5 text-[10px] leading-4 text-muted">
              Add an invisible text layer to scanned pages. The document stays in
              your browser.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close OCR dialog"
            onClick={() => setOpen(false)}
            className="focus-ring -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-surface-muted hover:text-ink"
          >
            <X size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field label="Scope" htmlFor="ocr-scope">
            <Select
              id="ocr-scope"
              value={scope}
              disabled={running}
              onChange={(event) => setScope(event.target.value as 'current' | 'all')}
            >
              <option value="current">Current page ({currentPageIndex + 1})</option>
              <option value="all">All pages ({pages.length})</option>
            </Select>
          </Field>
          <Field label="Language" htmlFor="ocr-language">
            <Select
              id="ocr-language"
              value={language}
              disabled={running}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-surface-muted/60 px-3 py-2.5 text-[9.5px] leading-4 text-muted">
          Tesseract language data is downloaded on demand from its CDN. Page
          images and document content are never uploaded.
        </div>

        {running ? (
          <div className="rounded-lg border border-accent-200 bg-accent-50/60 px-3 py-3">
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <LoaderCircle size={14} className="animate-spin text-accent-600" />
              {message || 'Running OCR…'}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-200"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[9px] tabular-nums text-muted">
              {Math.round(progress * 100)}%
            </p>
          </div>
        ) : null}

        {status === 'done' ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#d8eadf] bg-[#f5fbf7] px-3 py-2.5 text-[10px] text-ink-soft">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#2f9e6e]" />
            <span>{message}</span>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="flex items-start gap-2 rounded-lg border border-[#f3c6c2] bg-[#fffafa] px-3 py-2.5 text-[10px] text-ink-soft">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#b42318]" />
            <span>{error || 'OCR could not be completed.'}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-[9px] text-faint">
            {targetPages.length} {targetPages.length === 1 ? 'page' : 'pages'} selected
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              className={cn(running && 'opacity-70')}
            >
              {running ? 'Run in background' : 'Close'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={running || targetPages.length === 0}
              onClick={() => {
                void runOcr(
                  targetPages.map((page) => page.id),
                  language,
                )
              }}
            >
              <ScanText size={13} strokeWidth={1.9} />
              {running ? 'Scanning…' : 'Start OCR'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
