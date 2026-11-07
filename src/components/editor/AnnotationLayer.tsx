import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  Annotation,
  HighlightAnnotation,
  ImageAnnotation,
  InkAnnotation,
  PageState,
  Point,
  RectangleAnnotation,
  RedactionAnnotation,
  TextAnnotation,
  Tool,
} from '../../types/editor'
import { useEditorStore } from '../../store/editorStore'
import {
  annotationViewportBounds,
  clampAnnotationOffset,
  clampPoint,
  clampRect,
  fontFamilyCss,
  hexToRgba,
  normalizeRect,
  pdfPointToViewport,
  pdfRectToViewport,
  smoothSvgPath,
  textAnchor,
  translateAnnotation,
  type ViewportLike,
} from '../../lib/geometry'
import { TextAnnotationEditor } from './TextAnnotationEditor'

interface AnnotationLayerProps {
  page: PageState
  viewport: ViewportLike
}

type ShapeDraft = {
  kind: 'highlight' | 'rectangle' | 'redact'
  start: Point
  current: Point
  startCss: Point
  currentCss: Point
}

type InkDraft = {
  kind: 'ink'
  points: Point[]
  cssPoints: Point[]
}

type Draft = ShapeDraft | InkDraft

type DragState = {
  annotation: Annotation
  startPdf: Point
  startCss: Point
  offset: Point
  moved: boolean
}

const HIGHLIGHT_COLOR = '#f5b83d'
const HIGHLIGHT_OPACITY = 0.35
const SHAPE_COLOR = '#5b5ce8'
const TEXT_COLOR = '#181817'
const TEXT_WIDTH = 180
const TEXT_HEIGHT = 36
const TEXT_FONT_SIZE = 14
const DRAG_THRESHOLD_CSS = 4
const INK_SAMPLE_DISTANCE = 1.25

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function polylineLength(points: Point[]): number {
  let length = 0
  for (let index = 1; index < points.length; index += 1) {
    length += pointDistance(points[index - 1], points[index])
  }
  return length
}

function SelectionFrame({ dashed = false }: { dashed?: boolean }) {
  const corners = [
    { left: '-3px', top: '-3px' },
    { right: '-3px', top: '-3px' },
    { left: '-3px', bottom: '-3px' },
    { right: '-3px', bottom: '-3px' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        className={[
          'absolute -inset-[1px]',
          dashed
            ? 'border border-dashed border-accent-500/80'
            : 'border-[1.5px] border-accent-500',
        ].join(' ')}
      />
      {dashed
        ? null
        : corners.map((position, index) => (
            <span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-[2px] border border-accent-500 bg-white shadow-sm"
              style={position}
            />
          ))}
    </div>
  )
}

export function AnnotationLayer({ page, viewport }: AnnotationLayerProps) {
  const tool = useEditorStore((state) => state.tool)
  const selectedId = useEditorStore((state) => state.selectedAnnotationId)
  const selectAnnotation = useEditorStore((state) => state.selectAnnotation)
  const addAnnotation = useEditorStore((state) => state.addAnnotation)
  const updateAnnotation = useEditorStore((state) => state.updateAnnotation)

  const layerRef = useRef<HTMLDivElement>(null)
  const lastSelectionRef = useRef<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const draftRef = useRef<Draft | null>(null)
  const dragRef = useRef<DragState | null>(null)

  // Selecting a text annotation makes it editable inline. Only react to a
  // selection change, so finishing an edit with Enter does not immediately
  // re-open the editor when the annotation is updated elsewhere.
  useEffect(() => {
    if (lastSelectionRef.current === selectedId) return
    lastSelectionRef.current = selectedId
    if (!selectedId) {
      setEditingId(null)
      return
    }
    const selected = page.annotations.find((annotation) => annotation.id === selectedId)
    setEditingId(selected?.type === 'text' ? selected.id : null)
  }, [selectedId, page.annotations])

  // Never leave stale drawing/drag state behind when the tool changes.
  useEffect(() => {
    draftRef.current = null
    setDraft(null)
  }, [tool])

  const cssPoint = (event: { clientX: number; clientY: number }): Point | null => {
    const element = layerRef.current
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const pdfPoint = (event: { clientX: number; clientY: number }): Point | null => {
    const css = cssPoint(event)
    if (!css) return null
    const [x, y] = viewport.convertToPdfPoint(css.x, css.y)
    return { x, y }
  }

  const capturePointer = (pointerId: number) => {
    try {
      layerRef.current?.setPointerCapture(pointerId)
    } catch {
      // The pointer may already have been released.
    }
  }

  const releasePointer = (pointerId: number) => {
    try {
      layerRef.current?.releasePointerCapture(pointerId)
    } catch {
      // Ignore pointers that were never captured.
    }
  }

  const startDrag = (event: ReactPointerEvent, annotation: Annotation) => {
    if (event.button !== 0) return
    event.stopPropagation()
    if (tool !== 'select') return
    if (annotation.type !== 'text') event.preventDefault()
    selectAnnotation(annotation.id)
    if (annotation.type === 'text') setEditingId(annotation.id)
    const point = pdfPoint(event)
    const css = cssPoint(event)
    if (!point || !css) return
    capturePointer(event.pointerId)
    const state: DragState = {
      annotation,
      startPdf: point,
      startCss: css,
      offset: { x: 0, y: 0 },
      moved: false,
    }
    dragRef.current = state
    setDrag(state)
  }

  const handleBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (tool === 'select') {
      selectAnnotation(null)
      return
    }
    const css = cssPoint(event)
    const pdf = pdfPoint(event)
    if (!css || !pdf) return
    const clamped = clampPoint(pdf, page.width, page.height)

    if (tool === 'text') {
      const width = Math.min(TEXT_WIDTH, page.width)
      const height = Math.min(TEXT_HEIGHT, page.height)
      const rect = clampRect(
        { x: clamped.x, y: clamped.y - height, width, height },
        page.width,
        page.height,
      )
      const created = addAnnotation({
        pageId: page.id,
        type: 'text',
        rect,
        text: 'New text',
        fontSize: TEXT_FONT_SIZE,
        fontFamily: 'Helvetica',
        color: TEXT_COLOR,
        opacity: 1,
        align: 'left',
      })
      // selectAnnotation also leaves the text tool, so clicking away commits
      // the edit instead of dropping another text box.
      selectAnnotation(created.id)
      setEditingId(created.id)
      return
    }

    capturePointer(event.pointerId)
    event.preventDefault()
    if (tool === 'highlight' || tool === 'rectangle' || tool === 'redact') {
      const next: ShapeDraft = {
        kind: tool,
        start: clamped,
        current: clamped,
        startCss: css,
        currentCss: css,
      }
      draftRef.current = next
      setDraft(next)
      return
    }
    if (tool === 'ink') {
      const next: InkDraft = {
        kind: 'ink',
        points: [clamped],
        cssPoints: [css],
      }
      draftRef.current = next
      setDraft(next)
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activeDrag = dragRef.current
    if (activeDrag) {
      const css = cssPoint(event)
      const point = pdfPoint(event)
      if (!css || !point) return
      const screenDistance = Math.hypot(
        css.x - activeDrag.startCss.x,
        css.y - activeDrag.startCss.y,
      )
      if (!activeDrag.moved && screenDistance < 3) return
      const dx = point.x - activeDrag.startPdf.x
      const dy = point.y - activeDrag.startPdf.y
      const offset = clampAnnotationOffset(
        activeDrag.annotation,
        dx,
        dy,
        page.width,
        page.height,
      )
      const next = { ...activeDrag, offset, moved: true }
      dragRef.current = next
      setDrag(next)
      return
    }

    const activeDraft = draftRef.current
    if (!activeDraft) return
    const css = cssPoint(event)
    const pdf = pdfPoint(event)
    if (!css || !pdf) return
    const clamped = clampPoint(pdf, page.width, page.height)

    if (activeDraft.kind === 'ink') {
      const last = activeDraft.cssPoints[activeDraft.cssPoints.length - 1]
      if (last && pointDistance(last, css) < INK_SAMPLE_DISTANCE) return
      const next: InkDraft = {
        ...activeDraft,
        points: [...activeDraft.points, clamped],
        cssPoints: [...activeDraft.cssPoints, css],
      }
      draftRef.current = next
      setDraft(next)
      return
    }

    const next: ShapeDraft = {
      ...activeDraft,
      current: clamped,
      currentCss: css,
    }
    draftRef.current = next
    setDraft(next)
  }

  const finishDrag = (pointerId: number) => {
    const activeDrag = dragRef.current
    dragRef.current = null
    setDrag(null)
    releasePointer(pointerId)
    if (!activeDrag) return
    const { annotation, offset, moved } = activeDrag
    if (!moved) return
    if (Math.abs(offset.x) < 0.01 && Math.abs(offset.y) < 0.01) return
    if (annotation.type === 'ink') {
      updateAnnotation(
        annotation.id,
        {
          points: annotation.points.map((point) => ({
            x: point.x + offset.x,
            y: point.y + offset.y,
          })),
        },
        true,
      )
      return
    }
    updateAnnotation(
      annotation.id,
      {
        rect: {
          ...annotation.rect,
          x: annotation.rect.x + offset.x,
          y: annotation.rect.y + offset.y,
        },
      },
      true,
    )
  }

  const finishDraft = (pointerId: number) => {
    const activeDraft = draftRef.current
    draftRef.current = null
    setDraft(null)
    releasePointer(pointerId)
    if (!activeDraft) return

    if (activeDraft.kind === 'ink') {
      const traveled = polylineLength(activeDraft.cssPoints)
      if (activeDraft.points.length < 2 || traveled < DRAG_THRESHOLD_CSS) return
      addAnnotation({
        pageId: page.id,
        type: 'ink',
        points: activeDraft.points,
        color: SHAPE_COLOR,
        strokeWidth: 2,
        opacity: 1,
      })
      return
    }

    const widthCss = Math.abs(activeDraft.currentCss.x - activeDraft.startCss.x)
    const heightCss = Math.abs(activeDraft.currentCss.y - activeDraft.startCss.y)
    if (Math.max(widthCss, heightCss) < DRAG_THRESHOLD_CSS) return

    const rect = clampRect(
      normalizeRect(activeDraft.start, activeDraft.current),
      page.width,
      page.height,
    )
    if (rect.width < 0.5 || rect.height < 0.5) return

    if (activeDraft.kind === 'highlight') {
      addAnnotation({
        pageId: page.id,
        type: 'highlight',
        rect,
        color: HIGHLIGHT_COLOR,
        opacity: HIGHLIGHT_OPACITY,
      })
      return
    }

    if (activeDraft.kind === 'redact') {
      addAnnotation({
        pageId: page.id,
        type: 'redaction',
        rect,
        opacity: 1,
      })
      return
    }

    addAnnotation({
      pageId: page.id,
      type: 'rectangle',
      rect,
      color: SHAPE_COLOR,
      fillColor: null,
      strokeWidth: 1.5,
      opacity: 1,
    })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      finishDrag(event.pointerId)
      return
    }
    if (draftRef.current) finishDraft(event.pointerId)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    draftRef.current = null
    dragRef.current = null
    setDraft(null)
    setDrag(null)
    releasePointer(event.pointerId)
  }

  const interactive = (annotation: Annotation) =>
    tool === 'select' || editingId === annotation.id

  const renderHighlight = (annotation: HighlightAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const box = annotationViewportBounds(visual, viewport)
    const selected = selectedId === annotation.id
    return (
      <div
        key={annotation.id}
        className="absolute"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          pointerEvents: interactive(annotation) ? 'auto' : 'none',
          cursor: tool === 'select' ? 'move' : undefined,
        }}
        onPointerDown={(event) => startDrag(event, annotation)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          selectAnnotation(annotation.id)
        }}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: hexToRgba(annotation.color, annotation.opacity) }}
        />
        {selected ? <SelectionFrame /> : null}
      </div>
    )
  }

  const renderRectangle = (annotation: RectangleAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const box = annotationViewportBounds(visual, viewport)
    const selected = selectedId === annotation.id
    return (
      <div
        key={annotation.id}
        className="absolute"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          pointerEvents: interactive(annotation) ? 'auto' : 'none',
          cursor: tool === 'select' ? 'move' : undefined,
        }}
        onPointerDown={(event) => startDrag(event, annotation)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          selectAnnotation(annotation.id)
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            border: `${Math.max(1, annotation.strokeWidth * viewport.scale)}px solid ${hexToRgba(
              annotation.color,
              annotation.opacity,
            )}`,
            backgroundColor: annotation.fillColor
              ? hexToRgba(annotation.fillColor, annotation.opacity * 0.24)
              : 'transparent',
          }}
        />
        {selected ? <SelectionFrame /> : null}
      </div>
    )
  }

  const renderRedaction = (annotation: RedactionAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const box = annotationViewportBounds(visual, viewport)
    const selected = selectedId === annotation.id
    return (
      <div
        key={annotation.id}
        className="absolute"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          pointerEvents: interactive(annotation) ? 'auto' : 'none',
          cursor: tool === 'select' ? 'move' : undefined,
        }}
        onPointerDown={(event) => startDrag(event, annotation)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          selectAnnotation(annotation.id)
        }}
      >
        <div className="absolute inset-0 bg-black/90" />
        <div className="pointer-events-none absolute inset-0 border border-red-500/80" />
        <span className="pointer-events-none absolute left-1 top-1 rounded-[2px] bg-red-600 px-1 py-px text-[8px] font-semibold uppercase tracking-[0.08em] text-white">
          Redact
        </span>
        {selected ? <SelectionFrame /> : null}
      </div>
    )
  }

  const renderImage = (annotation: ImageAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const image = visual.type === 'image' ? visual : annotation
    const anchor = textAnchor(image, viewport)
    const selected = selectedId === annotation.id
    return (
      <div
        key={annotation.id}
        className="absolute"
        style={{
          left: anchor.x,
          top: anchor.y,
          width: image.rect.width * viewport.scale,
          height: image.rect.height * viewport.scale,
          transform: `rotate(${viewport.rotation}deg)`,
          transformOrigin: '0 0',
          opacity: annotation.opacity,
          pointerEvents: interactive(annotation) ? 'auto' : 'none',
          cursor: tool === 'select' ? 'move' : undefined,
        }}
        onPointerDown={(event) => startDrag(event, annotation)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          selectAnnotation(annotation.id)
        }}
      >
        <img
          src={annotation.dataUrl}
          alt={annotation.name || 'Inserted image'}
          draggable={false}
          className="h-full w-full object-fill select-none"
        />
        {selected ? <SelectionFrame /> : null}
      </div>
    )
  }

  const renderText = (annotation: TextAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const text = visual.type === 'text' ? visual : annotation
    const anchor = textAnchor(text, viewport)
    const sketchWidth = text.rect.width * viewport.scale
    const sketchHeight = text.rect.height * viewport.scale
    const selected = selectedId === annotation.id
    const editing = editingId === annotation.id
    const fontSize = text.fontSize * viewport.scale
    return (
      <div
        key={annotation.id}
        className="absolute"
        style={{
          left: anchor.x,
          top: anchor.y,
          width: sketchWidth,
          height: sketchHeight,
          transform: `rotate(${viewport.rotation}deg)`,
          transformOrigin: '0 0',
          pointerEvents: interactive(annotation) ? 'auto' : 'none',
          cursor: tool === 'select' && !editing ? 'move' : undefined,
        }}
        onPointerDown={(event) => startDrag(event, annotation)}
        onDoubleClick={(event) => {
          event.stopPropagation()
          selectAnnotation(annotation.id)
          setEditingId(annotation.id)
        }}
      >
        {editing ? (
          <TextAnnotationEditor
            annotation={text}
            scale={viewport.scale}
            onClose={() =>
              setEditingId((current) => (current === annotation.id ? null : current))
            }
          />
        ) : (
          <div
            className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
            style={{
              fontFamily: fontFamilyCss(annotation.fontFamily),
              fontSize: `${fontSize}px`,
              lineHeight: 1.3,
              color: annotation.color,
              opacity: annotation.opacity,
              textAlign: annotation.align,
            }}
          >
            {text.text}
          </div>
        )}
        {selected ? <SelectionFrame /> : null}
      </div>
    )
  }

  const renderInk = (annotation: InkAnnotation) => {
    const visual =
      drag?.annotation.id === annotation.id
        ? translateAnnotation(annotation, drag.offset.x, drag.offset.y)
        : annotation
    const ink = visual.type === 'ink' ? visual : annotation
    const points = ink.points.map((point) => pdfPointToViewport(point, viewport))
    const path = smoothSvgPath(points)
    const selected = selectedId === annotation.id
    const strokeWidth = Math.max(1, annotation.strokeWidth * viewport.scale)
    const canInteract = tool === 'select'
    const bounds = selected ? annotationViewportBounds(ink, viewport) : null
    return (
      <svg
        key={annotation.id}
        className="absolute inset-0 overflow-visible"
        width={viewport.width}
        height={viewport.height}
        style={{ pointerEvents: 'none' }}
      >
        <path
          d={path}
          fill="none"
          stroke={hexToRgba(annotation.color, annotation.opacity)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {canInteract ? (
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(12, strokeWidth + 10)}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'stroke', cursor: 'move' }}
            onPointerDown={(event) => startDrag(event, annotation)}
            onDoubleClick={(event) => {
              event.stopPropagation()
              selectAnnotation(annotation.id)
            }}
          />
        ) : null}
        {selected && bounds ? (
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke="rgba(91, 92, 232, 0.8)"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ) : null}
      </svg>
    )
  }

  const renderAnnotation = (annotation: Annotation) => {
    switch (annotation.type) {
      case 'highlight':
        return renderHighlight(annotation)
      case 'rectangle':
        return renderRectangle(annotation)
      case 'text':
        return renderText(annotation)
      case 'ink':
        return renderInk(annotation)
      case 'image':
        return renderImage(annotation)
      case 'redaction':
        return renderRedaction(annotation)
    }
  }

  const draftPreview = (() => {
    if (!draft) return null
    if (draft.kind === 'ink') {
      const points = draft.cssPoints
      if (points.length < 2) return null
      return (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={viewport.width}
          height={viewport.height}
        >
          <path
            d={smoothSvgPath(points)}
            fill="none"
            stroke={hexToRgba(SHAPE_COLOR, 0.85)}
            strokeWidth={2 * viewport.scale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
    const widthCss = Math.abs(draft.currentCss.x - draft.startCss.x)
    const heightCss = Math.abs(draft.currentCss.y - draft.startCss.y)
    if (Math.max(widthCss, heightCss) < DRAG_THRESHOLD_CSS) return null
    const rect = normalizeRect(draft.start, draft.current)
    const box = pdfRectToViewport(rect, viewport)
    const isHighlight = draft.kind === 'highlight'
    const isRedact = draft.kind === 'redact'
    return (
      <div
        className="pointer-events-none absolute"
        style={{
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
          backgroundColor: isHighlight
            ? hexToRgba(HIGHLIGHT_COLOR, HIGHLIGHT_OPACITY)
            : isRedact
              ? 'rgba(0,0,0,0.88)'
              : 'transparent',
          border: isHighlight
            ? '1px solid rgba(245, 184, 61, 0.7)'
            : isRedact
              ? '1.5px solid rgba(220, 38, 38, 0.9)'
              : `1.5px solid ${SHAPE_COLOR}`,
        }}
      />
    )
  })()

  const toolCursor: Record<Tool, string> = {
    select: 'default',
    text: 'text',
    highlight: 'crosshair',
    rectangle: 'crosshair',
    ink: 'crosshair',
    redact: 'crosshair',
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0"
      style={{
        cursor: toolCursor[tool],
        touchAction: tool === 'select' ? 'pan-y' : 'none',
        userSelect: 'none',
      }}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={() => {
        if (!dragRef.current && !draftRef.current) return
        dragRef.current = null
        draftRef.current = null
        setDrag(null)
        setDraft(null)
      }}
    >
      {page.annotations.map((annotation) => renderAnnotation(annotation))}
      {draftPreview}
    </div>
  )
}
