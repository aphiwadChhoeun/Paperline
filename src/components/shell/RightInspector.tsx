import {
  Copy,
  FileText,
  Highlighter,
  PenTool,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash,
  Type as TypeIcon,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditorStore } from '../../store/editorStore'
import {
  ANNOTATION_LABELS,
  type Annotation,
  type FontFamily,
  type InspectorTab,
  type PageState,
  type TextAlign,
} from '../../types/editor'
import { Button, IconButton } from '../ui/Button'
import {
  ColorControl,
  Field,
  NumberInput,
  RangeControl,
  Segmented,
  Select,
  Switch,
  TextArea,
  TextInput,
} from '../ui/Field'
import { clamp, cn, formatBytes, formatDimensions, shortcutLabel } from '../ui/utils'

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'properties', label: 'Properties' },
  { id: 'document', label: 'Document' },
  { id: 'pages', label: 'Pages' },
]

const ANNOTATION_ICONS: Record<Annotation['type'], LucideIcon> = {
  text: TypeIcon,
  highlight: Highlighter,
  rectangle: Square,
  ink: PenTool,
}

const TEXT_COLORS = ['#181817', '#5b5ce8', '#b42318', '#067647', '#b54708']
const HIGHLIGHT_COLORS = ['#ffe066', '#86efac', '#a5d8ff', '#fcc2d7', '#ffc078']
const SHAPE_COLORS = ['#181817', '#5b5ce8', '#b42318', '#067647', '#e7a51a']
const FILL_COLORS = ['#eef0ff', '#fff8e7', '#f5fbf7', '#fef3f2', '#f4f4f2']
const FONT_FAMILIES: FontFamily[] = ['Helvetica', 'Times', 'Courier']

function InspectorSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-3.5 px-3.5 py-3.5', className)}>{children}</div>
}

interface AnnotationPropertiesProps {
  annotation: Annotation
  pageIndex: number
}

function AnnotationProperties({ annotation, pageIndex }: AnnotationPropertiesProps) {
  const updateAnnotation = useEditorStore((state) => state.updateAnnotation)
  const deleteAnnotation = useEditorStore((state) => state.deleteAnnotation)
  const AnnotationIcon = ANNOTATION_ICONS[annotation.type]

  const setOpacity = (value: number) =>
    updateAnnotation(annotation.id, { opacity: clamp(value, 0, 1) }, false)
  // Sliders update transiently while dragging. Committing an empty patch
  // records one history entry at the already-applied value.
  const commitOpacity = () => updateAnnotation(annotation.id, {}, true)
  const setStrokeWidth = (value: number) =>
    updateAnnotation(annotation.id, { strokeWidth: value }, false)
  const commitStrokeWidth = () => updateAnnotation(annotation.id, {}, true)

  return (
    <>
      <div className="border-b border-line px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
            <AnnotationIcon size={15} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-ink">
                {ANNOTATION_LABELS[annotation.type]} annotation
              </p>
              <span className="shrink-0 text-[9px] font-medium uppercase tracking-[0.1em] text-faint">
                Page {pageIndex + 1}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-4 text-muted">
              Changes are autosaved to this browser.
            </p>
          </div>
        </div>
      </div>

      <InspectorSection>
        {annotation.type === 'text' ? (
          <>
            <Field label="Content" htmlFor="annotation-text">
              <TextArea
                id="annotation-text"
                rows={3}
                value={annotation.text}
                placeholder="Add a note…"
                onChange={(event) =>
                  updateAnnotation(annotation.id, { text: event.target.value }, false)
                }
                onBlur={() => updateAnnotation(annotation.id, {}, true)}
              />
            </Field>
            <div className="grid grid-cols-[1fr_92px] gap-2">
              <Field label="Font family" htmlFor="annotation-font">
                <Select
                  id="annotation-font"
                  value={annotation.fontFamily}
                  onChange={(event) =>
                    updateAnnotation(annotation.id, {
                      fontFamily: event.target.value as FontFamily,
                    })
                  }
                >
                  {FONT_FAMILIES.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Size" htmlFor="annotation-size">
                <NumberInput
                  id="annotation-size"
                  min={4}
                  max={144}
                  value={annotation.fontSize}
                  suffix="pt"
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (Number.isFinite(value)) {
                      updateAnnotation(annotation.id, {
                        fontSize: clamp(value, 4, 144),
                      })
                    }
                  }}
                />
              </Field>
            </div>
            <Field label="Color">
              <ColorControl
                label="Text color"
                value={annotation.color}
                presets={TEXT_COLORS}
                onChange={(color) => updateAnnotation(annotation.id, { color })}
              />
            </Field>
            <Field label="Alignment">
              <Segmented<TextAlign>
                label="Text alignment"
                value={annotation.align}
                onChange={(align) => updateAnnotation(annotation.id, { align })}
                options={[
                  {
                    value: 'left',
                    label: 'Left',
                    icon: <TextAlignStart size={12} strokeWidth={2} />,
                  },
                  {
                    value: 'center',
                    label: 'Center',
                    icon: <TextAlignCenter size={12} strokeWidth={2} />,
                  },
                  {
                    value: 'right',
                    label: 'Right',
                    icon: <TextAlignEnd size={12} strokeWidth={2} />,
                  },
                ]}
              />
            </Field>
            <RangeControl
              label="Opacity"
              value={annotation.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setOpacity}
              onCommit={commitOpacity}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
          </>
        ) : null}

        {annotation.type === 'highlight' ? (
          <>
            <Field label="Highlight color">
              <ColorControl
                label="Highlight color"
                value={annotation.color}
                presets={HIGHLIGHT_COLORS}
                onChange={(color) => updateAnnotation(annotation.id, { color })}
              />
            </Field>
            <RangeControl
              label="Opacity"
              value={annotation.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setOpacity}
              onCommit={commitOpacity}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
          </>
        ) : null}

        {annotation.type === 'rectangle' ? (
          <>
            <Field label="Stroke color">
              <ColorControl
                label="Stroke color"
                value={annotation.color}
                presets={SHAPE_COLORS}
                onChange={(color) => updateAnnotation(annotation.id, { color })}
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-line bg-surface-muted/60 px-2.5 py-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
                Fill shape
              </span>
              <Switch
                label="Fill shape"
                checked={annotation.fillColor !== null}
                onChange={(checked) =>
                  updateAnnotation(annotation.id, {
                    fillColor: checked ? (annotation.fillColor ?? '#eef0ff') : null,
                  })
                }
              />
            </div>
            {annotation.fillColor !== null ? (
              <Field label="Fill color">
                <ColorControl
                  label="Fill color"
                  value={annotation.fillColor}
                  presets={FILL_COLORS}
                  onChange={(fillColor) => updateAnnotation(annotation.id, { fillColor })}
                />
              </Field>
            ) : null}
            <RangeControl
              label="Stroke width"
              value={annotation.strokeWidth}
              min={0.5}
              max={12}
              step={0.5}
              onChange={setStrokeWidth}
              onCommit={commitStrokeWidth}
              formatValue={(value) => `${value} pt`}
            />
            <RangeControl
              label="Opacity"
              value={annotation.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setOpacity}
              onCommit={commitOpacity}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
          </>
        ) : null}

        {annotation.type === 'ink' ? (
          <>
            <Field label="Ink color">
              <ColorControl
                label="Ink color"
                value={annotation.color}
                presets={SHAPE_COLORS}
                onChange={(color) => updateAnnotation(annotation.id, { color })}
              />
            </Field>
            <RangeControl
              label="Stroke width"
              value={annotation.strokeWidth}
              min={0.5}
              max={12}
              step={0.5}
              onChange={setStrokeWidth}
              onCommit={commitStrokeWidth}
              formatValue={(value) => `${value} pt`}
            />
            <RangeControl
              label="Opacity"
              value={annotation.opacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setOpacity}
              onCommit={commitOpacity}
              formatValue={(value) => `${Math.round(value * 100)}%`}
            />
          </>
        ) : null}
      </InspectorSection>

      <div className="border-t border-line px-3.5 py-3">
        <Button
          variant="danger"
          size="sm"
          className="w-full"
          onClick={() => deleteAnnotation(annotation.id)}
        >
          <Trash size={13} strokeWidth={1.9} />
          Delete annotation
        </Button>
        <p className="mt-2 text-center text-[9px] text-faint">
          Select and press Delete to remove
        </p>
      </div>
    </>
  )
}

interface PagePropertiesProps {
  page: PageState
  index: number
  total: number
}

function PageProperties({ page, index, total }: PagePropertiesProps) {
  const rotatePage = useEditorStore((state) => state.rotatePage)
  const duplicatePage = useEditorStore((state) => state.duplicatePage)
  const deletePage = useEditorStore((state) => state.deletePage)
  const setPageRotation = useEditorStore((state) => state.setPageRotation)

  return (
    <>
      <div className="border-b border-line px-3.5 py-3">
        <p className="text-[12px] font-semibold text-ink">Page {index + 1}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-muted">
          Selected page · {total} {total === 1 ? 'page' : 'pages'} in document
        </p>
      </div>

      <InspectorSection>
        <div className="flex items-start gap-3">
          <div className="flex h-[92px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted p-2">
            <div
              className="flex h-[76px] w-[56px] flex-col gap-1 rounded-[2px] border border-line bg-white p-1.5 shadow-sm transition-transform"
              style={{ transform: `rotate(${page.rotation}deg)` }}
              aria-hidden="true"
            >
              <span className="h-1 w-2/3 rounded-full bg-line-strong" />
              <span className="h-1 w-full rounded-full bg-line" />
              <span className="h-1 w-full rounded-full bg-line" />
              <span className="h-1 w-4/5 rounded-full bg-line" />
              <span className="mt-auto h-1 w-1/2 rounded-full bg-line" />
            </div>
          </div>
          <div className="min-w-0 space-y-1 pt-0.5 text-[10px] leading-4 text-muted">
            <p className="text-[11px] font-medium text-ink">
              {formatDimensions(page.width, page.height)}
            </p>
            <p className="tabular-nums">
              {Math.round(page.width)} × {Math.round(page.height)} pt
            </p>
            <p className="tabular-nums">{page.rotation}° rotation</p>
            <p>
              {page.annotations.length}{' '}
              {page.annotations.length === 1 ? 'annotation' : 'annotations'}
            </p>
          </div>
        </div>

        <Field label="Rotation" htmlFor="page-rotation">
          <Select
            id="page-rotation"
            value={page.rotation}
            onChange={(event) => setPageRotation(page.id, Number(event.target.value))}
          >
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </Select>
        </Field>
      </InspectorSection>

      <div className="space-y-2 border-t border-line px-3.5 py-3.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-faint">
          Page actions
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="justify-start"
            onClick={() => rotatePage(page.id, -90)}
          >
            <RotateCcw size={13} strokeWidth={1.8} />
            Rotate left
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="justify-start"
            onClick={() => rotatePage(page.id, 90)}
          >
            <RotateCw size={13} strokeWidth={1.8} />
            Rotate right
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="justify-start"
            onClick={() => duplicatePage(page.id)}
          >
            <Copy size={13} strokeWidth={1.8} />
            Duplicate
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="justify-start"
            disabled={total <= 1}
            onClick={() => deletePage(page.id)}
          >
            <Trash size={13} strokeWidth={1.8} />
            Delete page
          </Button>
        </div>
        <p className="pt-1 text-[9px] text-faint">
          Page changes can be undone with {shortcutLabel('Z')}.
        </p>
      </div>
    </>
  )
}

function DocumentProperties() {
  const fileName = useEditorStore((state) => state.fileName)
  const fileSize = useEditorStore((state) => state.fileSize)
  const pageCount = useEditorStore((state) => state.pages.length)
  const metadata = useEditorStore((state) => state.metadata)
  const setMetadata = useEditorStore((state) => state.setMetadata)

  return (
    <>
      <div className="border-b border-line px-3.5 py-3">
        <p className="text-[12px] font-semibold text-ink">Document</p>
        <p className="mt-0.5 text-[10px] leading-4 text-muted">
          File details and metadata written on export.
        </p>
      </div>

      <InspectorSection>
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-muted/60 p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft">
            <FileText size={16} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-ink">{fileName}</p>
            <p className="mt-0.5 text-[9.5px] tabular-nums text-muted">
              {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {formatBytes(fileSize)}
            </p>
          </div>
        </div>

        <Field label="Title" htmlFor="meta-title">
          <TextInput
            id="meta-title"
            value={metadata.title}
            placeholder="Untitled document"
            onChange={(event) => setMetadata({ title: event.target.value })}
          />
        </Field>
        <Field label="Author" htmlFor="meta-author">
          <TextInput
            id="meta-author"
            value={metadata.author}
            placeholder="Add an author"
            onChange={(event) => setMetadata({ author: event.target.value })}
          />
        </Field>
        <Field label="Subject" htmlFor="meta-subject">
          <TextInput
            id="meta-subject"
            value={metadata.subject}
            placeholder="What is this document about?"
            onChange={(event) => setMetadata({ subject: event.target.value })}
          />
        </Field>
        <Field
          label="Keywords"
          htmlFor="meta-keywords"
          hint="Separate keywords with commas."
        >
          <TextInput
            id="meta-keywords"
            value={metadata.keywords}
            placeholder="contract, invoice, notes"
            onChange={(event) => setMetadata({ keywords: event.target.value })}
          />
        </Field>
      </InspectorSection>

      <div className="border-t border-line px-3.5 py-3.5">
        <div className="flex gap-2.5 rounded-lg border border-[#d8eadf] bg-[#f5fbf7] px-3 py-2.5">
          <ShieldCheck size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#2f9e6e]" />
          <div>
            <p className="text-[10px] font-medium text-ink-soft">Local-first by design</p>
            <p className="mt-0.5 text-[9.5px] leading-4 text-muted">
              Your document is never uploaded. Metadata and edits are applied when you export.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function PagesList() {
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId)
  const rotatePage = useEditorStore((state) => state.rotatePage)
  const duplicatePage = useEditorStore((state) => state.duplicatePage)
  const deletePage = useEditorStore((state) => state.deletePage)

  return (
    <div>
      <div className="border-b border-line px-3.5 py-3">
        <p className="text-[12px] font-semibold text-ink">Pages</p>
        <p className="mt-0.5 text-[10px] leading-4 text-muted">
          Jump to a page or make quick changes.
        </p>
      </div>
      <div className="space-y-1 p-2">
        {pages.map((page, index) => {
          const current = page.id === currentPageId
          return (
            <div
              key={page.id}
              className={cn(
                'group flex items-center gap-1 rounded-lg border p-1.5 transition-colors',
                current
                  ? 'border-accent-200 bg-accent-50/70'
                  : 'border-transparent hover:border-line hover:bg-surface-muted',
              )}
            >
              <button
                type="button"
                onClick={() => setCurrentPageId(page.id)}
                aria-label={`Go to page ${index + 1}`}
                aria-current={current ? 'page' : undefined}
                className="focus-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left"
              >
                <span
                  className={cn(
                    'flex h-10 w-8 shrink-0 items-center justify-center rounded-[3px] border bg-white text-[9px] font-medium shadow-sm',
                    current ? 'border-accent-300 text-accent-700' : 'border-line text-faint',
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-[11px] font-medium',
                      current ? 'text-accent-700' : 'text-ink-soft',
                    )}
                  >
                    Page {index + 1}
                  </span>
                  <span className="mt-0.5 block text-[9px] tabular-nums text-faint">
                    {page.rotation}° · {Math.round(page.width)}×{Math.round(page.height)}
                  </span>
                </span>
              </button>
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity',
                  current
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
                )}
              >
                <IconButton
                  label={`Rotate page ${index + 1} right`}
                  size="sm"
                  onClick={() => rotatePage(page.id, 90)}
                >
                  <RotateCw size={12} strokeWidth={1.9} />
                </IconButton>
                <IconButton
                  label={`Duplicate page ${index + 1}`}
                  size="sm"
                  onClick={() => duplicatePage(page.id)}
                >
                  <Copy size={12} strokeWidth={1.9} />
                </IconButton>
                <IconButton
                  label={`Delete page ${index + 1}`}
                  size="sm"
                  variant="ghost"
                  className="text-[#b42318] hover:bg-[#fef3f2]"
                  disabled={pages.length <= 1}
                  onClick={() => deletePage(page.id)}
                >
                  <Trash size={12} strokeWidth={1.9} />
                </IconButton>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RightInspector() {
  const fileName = useEditorStore((state) => state.fileName)
  const pages = useEditorStore((state) => state.pages)
  const currentPageId = useEditorStore((state) => state.currentPageId)
  const selectedPageId = useEditorStore((state) => state.selectedPageId)
  const inspectorTab = useEditorStore((state) => state.inspectorTab)
  const setInspectorTab = useEditorStore((state) => state.setInspectorTab)
  const annotation = useEditorStore((state) => {
    if (!state.selectedAnnotationId) return null
    for (const page of state.pages) {
      const found = page.annotations.find((item) => item.id === state.selectedAnnotationId)
      if (found) return found
    }
    return null
  })

  const hasDocument = Boolean(fileName)
  const selectedPage =
    pages.find((page) => page.id === selectedPageId) ??
    pages.find((page) => page.id === currentPageId) ??
    pages[0] ??
    null
  const selectedPageIndex = selectedPage
    ? pages.findIndex((page) => page.id === selectedPage.id)
    : -1
  const annotationPageIndex = annotation
    ? pages.findIndex((page) => page.annotations.some((item) => item.id === annotation.id))
    : -1

  const detailLabel = !hasDocument
    ? '—'
    : annotation
      ? `Page ${Math.max(0, annotationPageIndex) + 1}`
      : selectedPage
        ? `Page ${selectedPageIndex + 1} of ${pages.length}`
        : '—'

  return (
    <aside
      aria-label="Inspector"
      className="flex w-[312px] shrink-0 flex-col border-l border-line bg-surface max-[1200px]:w-[286px]"
    >
      <div className="border-b border-line px-3 pt-3">
        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
            Inspector
          </span>
          <span className="truncate text-[9.5px] tabular-nums text-faint">{detailLabel}</span>
        </div>
        <div role="tablist" aria-label="Inspector views" className="flex gap-0.5">
          {INSPECTOR_TABS.map((tab) => {
            const isActive = hasDocument && inspectorTab === tab.id
            return (
              <button
                key={tab.id}
                id={`inspector-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-controls={`inspector-panel-${tab.id}`}
                disabled={!hasDocument}
                onClick={() => setInspectorTab(tab.id)}
                className={cn(
                  'focus-ring relative flex h-9 flex-1 items-center justify-center border-b-2 px-1 text-[10.5px] font-medium transition-colors',
                  isActive
                    ? 'border-accent-500 text-ink'
                    : 'border-transparent text-muted hover:text-ink',
                  !hasDocument && 'cursor-not-allowed text-faint/70 hover:text-faint/70',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        id={`inspector-panel-${inspectorTab}`}
        role="tabpanel"
        aria-labelledby={`inspector-tab-${inspectorTab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {!hasDocument ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 px-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-muted text-faint">
              <SlidersHorizontal size={17} strokeWidth={1.7} />
            </span>
            <p className="text-[11px] font-medium text-ink-soft">Nothing to inspect</p>
            <p className="text-[10px] leading-4 text-muted">
              Open a PDF to edit page settings, document metadata, and annotations.
            </p>
          </div>
        ) : null}

        {hasDocument && inspectorTab === 'properties' ? (
          annotation ? (
            <AnnotationProperties
              annotation={annotation}
              pageIndex={Math.max(0, annotationPageIndex)}
            />
          ) : selectedPage ? (
            <PageProperties
              page={selectedPage}
              index={selectedPageIndex}
              total={pages.length}
            />
          ) : null
        ) : null}

        {hasDocument && inspectorTab === 'document' ? <DocumentProperties /> : null}
        {hasDocument && inspectorTab === 'pages' ? <PagesList /> : null}
      </div>
    </aside>
  )
}
