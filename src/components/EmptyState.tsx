import {
  FileUp,
  FolderOpen,
  Layers,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Type,
} from 'lucide-react'
import { Button } from './ui/Button'

interface EmptyStateProps {
  onOpen: () => void
  onTrySample: () => void
  sampleLoading: boolean
}

const FEATURES = [
  { icon: Type, label: 'Annotate', detail: 'Text, highlights, shapes, ink' },
  { icon: Layers, label: 'Reorganize', detail: 'Rotate, duplicate, delete' },
  { icon: ShieldCheck, label: 'Private by default', detail: 'Runs fully in your browser' },
]

export function EmptyState({ onOpen, onTrySample, sampleLoading }: EmptyStateProps) {
  return (
    <div className="workspace-grid flex h-full items-center justify-center overflow-y-auto px-6 py-8">
      <div className="animate-fade-in w-full max-w-[600px]">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Sparkles size={11} strokeWidth={1.9} className="text-accent-500" />
            Local PDF editor
          </span>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-ink">
            A calmer place to edit PDFs.
          </h1>
          <p className="mx-auto mt-2 max-w-[430px] text-[12.5px] leading-6 text-muted">
            Annotate, reorganize, and export documents without sending them anywhere.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-line-strong bg-surface p-6 shadow-[0_1px_2px_rgba(20,19,16,0.03)] transition-colors">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
              <FileUp size={22} strokeWidth={1.7} />
            </div>
            <p className="mt-3 text-[13px] font-medium text-ink">
              Drag a PDF here to begin
            </p>
            <p className="mt-1 text-[11px] text-muted">or choose a file from your device</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="primary"
                className="h-9 px-3.5"
                onClick={onOpen}
              >
                <FolderOpen size={14} strokeWidth={1.9} />
                Open PDF
              </Button>
              <Button
                variant="secondary"
                className="h-9 px-3.5"
                onClick={onTrySample}
                disabled={sampleLoading}
              >
                {sampleLoading ? (
                  <LoaderCircle size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} strokeWidth={1.9} />
                )}
                {sampleLoading ? 'Loading sample…' : 'Try sample'}
              </Button>
            </div>
            <p className="mt-3 text-[9.5px] text-faint">
              PDF files only · processed locally · nothing is uploaded
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {FEATURES.map((feature) => {
            const FeatureIcon = feature.icon
            return (
              <div
                key={feature.label}
                className="rounded-xl border border-line/80 bg-surface/70 px-3 py-2.5"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-ink-soft">
                  <FeatureIcon size={12} strokeWidth={1.9} className="text-muted" />
                  {feature.label}
                </div>
                <p className="mt-1 text-[9px] leading-4 text-faint">{feature.detail}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
