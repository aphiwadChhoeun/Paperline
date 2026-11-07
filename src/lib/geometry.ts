import type { Annotation, FontFamily, PageState, Point, Rect } from '../types/editor'

/**
 * Minimal structural shape of a PDF.js PageViewport. Keeping the shape local
 * means geometry stays testable without importing the whole PDF.js runtime.
 */
export interface ViewportLike {
  width: number
  height: number
  scale: number
  rotation: number
  convertToPdfPoint(x: number, y: number): number[]
  convertToViewportPoint(x: number, y: number): number[]
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

export function rotatePoint(point: Point, origin: Point, angle: number): Point {
  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

/** CSS dimensions of a page once its absolute rotation is applied. */
export function rotatedPageSize(page: Pick<PageState, 'width' | 'height' | 'rotation'>, scale = 1) {
  const swap = Math.abs(page.rotation) % 180 !== 0
  return {
    width: (swap ? page.height : page.width) * scale,
    height: (swap ? page.width : page.height) * scale,
  }
}

export function pdfPointToViewport(point: Point, viewport: ViewportLike): Point {
  const [x, y] = viewport.convertToViewportPoint(point.x, point.y)
  return { x, y }
}

export function viewportPointToPdf(point: Point, viewport: ViewportLike): Point {
  const [x, y] = viewport.convertToPdfPoint(point.x, point.y)
  return { x, y }
}

/**
 * Convert a PDF-space rectangle into a viewport-space (CSS pixel) box. The
 * result is normalized to left/top/width/height, so it works for any page
 * rotation that is a multiple of 90 degrees.
 */
export function pdfRectToViewport(rect: Rect, viewport: ViewportLike): Rect {
  const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y)
  const [x2, y2] = viewport.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height)
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export function clampPoint(point: Point, width: number, height: number): Point {
  return {
    x: clamp(point.x, 0, width),
    y: clamp(point.y, 0, height),
  }
}

export function clampRect(rect: Rect, width: number, height: number): Rect {
  const safeWidth = Math.min(Math.max(rect.width, 0), width)
  const safeHeight = Math.min(Math.max(rect.height, 0), height)
  return {
    x: clamp(rect.x, 0, width - safeWidth),
    y: clamp(rect.y, 0, height - safeHeight),
    width: safeWidth,
    height: safeHeight,
  }
}

export function inkBounds(points: Point[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** PDF-space bounding box for any annotation type. */
export function annotationPdfBounds(annotation: Annotation): Rect {
  return annotation.type === 'ink' ? inkBounds(annotation.points) : annotation.rect
}

export function annotationViewportBounds(
  annotation: Annotation,
  viewport: ViewportLike,
): Rect {
  return pdfRectToViewport(annotationPdfBounds(annotation), viewport)
}

/**
 * The viewport-space top-left corner of a text box, matching the orientation
 * of the page. CSS rotation around this point reproduces PDF.js' page rotation.
 */
export function textAnchor(annotation: Annotation, viewport: ViewportLike): Point {
  const rect = annotationPdfBounds(annotation)
  const [x, y] = viewport.convertToViewportPoint(rect.x, rect.y + rect.height)
  return { x, y }
}

export function translateAnnotation(
  annotation: Annotation,
  dx: number,
  dy: number,
): Annotation {
  if (annotation.type === 'ink') {
    return {
      ...annotation,
      points: annotation.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    }
  }
  return {
    ...annotation,
    rect: {
      ...annotation.rect,
      x: annotation.rect.x + dx,
      y: annotation.rect.y + dy,
    },
  }
}

/** Constrain a translation so the annotation stays inside the page. */
export function clampAnnotationOffset(
  annotation: Annotation,
  dx: number,
  dy: number,
  pageWidth: number,
  pageHeight: number,
): Point {
  const bounds = annotationPdfBounds(annotation)
  return {
    x: clamp(bounds.x + dx, 0, Math.max(0, pageWidth - bounds.width)) - bounds.x,
    y: clamp(bounds.y + dy, 0, Math.max(0, pageHeight - bounds.height)) - bounds.y,
  }
}

export function fontFamilyCss(family: FontFamily): string {
  switch (family) {
    case 'Times':
      return '"Times New Roman", Times, serif'
    case 'Courier':
      return '"Courier New", Courier, monospace'
    default:
      return '"Helvetica Neue", Helvetica, Arial, sans-serif'
  }
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/** Convert #rrggbb to an rgba() string. Falls back to the raw value. */
export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const normalized =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value.padEnd(6, '0').slice(0, 6)
  const parsed = Number.parseInt(normalized, 16)
  if (Number.isNaN(parsed)) return hex
  const r = (parsed >> 16) & 255
  const g = (parsed >> 8) & 255
  const b = parsed & 255
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

/** Smooth SVG path through sampled pointer points. */
export function smoothSvgPath(points: Point[]): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (points.length === 1) return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }
  let path = `M ${first.x} ${first.y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    path += ` Q ${current.x} ${current.y} ${midX} ${midY}`
  }
  const last = points[points.length - 1]
  path += ` L ${last.x} ${last.y}`
  return path
}
