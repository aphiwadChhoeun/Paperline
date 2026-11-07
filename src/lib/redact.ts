import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument } from './pdfjs'
import type { Annotation, PageState, Point } from '../types/editor'
import { hexToRgba } from './geometry'

const MAX_PAGE_EDGE = 2400
const FONT_CSS = {
  Helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}

function canvasPoint(point: Point, scale: number, canvasHeight: number): Point {
  return {
    x: point.x * scale,
    y: canvasHeight - point.y * scale,
  }
}

async function loadImage(dataUrl: string, cache: Map<string, Promise<HTMLImageElement>>) {
  let promise = cache.get(dataUrl)
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('An image annotation could not be rendered.'))
      image.src = dataUrl
    })
    cache.set(dataUrl, promise)
  }
  return promise
}

async function drawAnnotation(
  context: CanvasRenderingContext2D,
  annotation: Annotation,
  scale: number,
  canvasHeight: number,
  imageCache: Map<string, Promise<HTMLImageElement>>,
) {
  if (annotation.type === 'redaction') return
  context.save()
  context.globalAlpha = annotation.opacity

  if (annotation.type === 'text') {
    const { rect } = annotation
    const x = rect.x * scale
    const top = canvasHeight - (rect.y + rect.height) * scale
    const fontSize = annotation.fontSize * scale
    const lineHeight = fontSize * 1.3
    context.fillStyle = annotation.color
    context.font = `${fontSize}px ${FONT_CSS[annotation.fontFamily]}`
    context.textBaseline = 'top'
    for (const [index, line] of annotation.text.split('\n').entries()) {
      const width = context.measureText(line).width
      let lineX = x
      if (annotation.align === 'center') lineX += (rect.width * scale - width) / 2
      if (annotation.align === 'right') lineX += rect.width * scale - width
      context.fillText(line, lineX, top + index * lineHeight)
    }
  } else if (annotation.type === 'highlight') {
    const { rect } = annotation
    context.fillStyle = annotation.color
    context.fillRect(
      rect.x * scale,
      canvasHeight - (rect.y + rect.height) * scale,
      rect.width * scale,
      rect.height * scale,
    )
  } else if (annotation.type === 'rectangle') {
    const { rect } = annotation
    const x = rect.x * scale
    const y = canvasHeight - (rect.y + rect.height) * scale
    const width = rect.width * scale
    const height = rect.height * scale
    if (annotation.fillColor) {
      context.fillStyle = hexToRgba(annotation.fillColor, annotation.opacity * 0.24)
      context.fillRect(x, y, width, height)
    }
    context.strokeStyle = annotation.color
    context.lineWidth = annotation.strokeWidth * scale
    context.strokeRect(x, y, width, height)
  } else if (annotation.type === 'ink') {
    if (annotation.points.length < 2) {
      context.restore()
      return
    }
    context.strokeStyle = annotation.color
    context.lineWidth = annotation.strokeWidth * scale
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    const first = canvasPoint(annotation.points[0], scale, canvasHeight)
    context.moveTo(first.x, first.y)
    for (let index = 1; index < annotation.points.length; index += 1) {
      const point = canvasPoint(annotation.points[index], scale, canvasHeight)
      context.lineTo(point.x, point.y)
    }
    context.stroke()
  } else if (annotation.type === 'image') {
    const image = await loadImage(annotation.dataUrl, imageCache)
    context.drawImage(
      image,
      annotation.rect.x * scale,
      canvasHeight - (annotation.rect.y + annotation.rect.height) * scale,
      annotation.rect.width * scale,
      annotation.rect.height * scale,
    )
  }

  context.restore()
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('The redacted page could not be encoded.'))
    }, 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * Render pages that contain redactions into flattened PNGs. The original text
 * and images are rasterized, annotations are burned in, and redaction marks are
 * painted over the result. The export path then replaces those pages with the
 * images, so no source text survives underneath the black boxes.
 */
export async function renderRedactedPages(
  pdf: PDFDocumentProxy,
  pages: PageState[],
  originalBytes?: Uint8Array,
): Promise<Record<string, Uint8Array>> {
  let source = pdf
  let ownedSource = false
  if (originalBytes) {
    try {
      source = await loadPdfDocument(originalBytes.slice())
      ownedSource = true
    } catch {
      source = pdf
    }
  }

  const result: Record<string, Uint8Array> = {}
  const imageCache = new Map<string, Promise<HTMLImageElement>>()

  try {
    for (const pageState of pages) {
      const redactions = pageState.annotations.filter(
        (annotation) => annotation.type === 'redaction',
      )
      if (redactions.length === 0) continue

      const page = await source.getPage(pageState.sourceIndex + 1)
      const scale = Math.max(
        1.2,
        Math.min(
          2.5,
          MAX_PAGE_EDGE / Math.max(pageState.width, pageState.height),
        ),
      )
      const viewport = page.getViewport({ scale, rotation: 0 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('The browser could not prepare a redacted page.')
      }
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
        background: '#ffffff',
      }).promise

      // Burn in every non-redaction annotation before the final black boxes.
      for (const annotation of pageState.annotations) {
        await drawAnnotation(context, annotation, scale, canvas.height, imageCache)
      }

      context.fillStyle = '#000000'
      for (const redaction of redactions) {
        if (redaction.type !== 'redaction') continue
        context.fillRect(
          redaction.rect.x * scale,
          canvas.height - (redaction.rect.y + redaction.rect.height) * scale,
          redaction.rect.width * scale,
          redaction.rect.height * scale,
        )
      }

      result[pageState.id] = await canvasToPng(canvas)
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    if (ownedSource) await source.loadingTask.destroy()
  }

  return result
}
