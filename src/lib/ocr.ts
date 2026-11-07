import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument } from './pdfjs'
import type { OcrLayer, OcrWord, PageState, Rect } from '../types/editor'

export interface OcrProgress {
  page: number
  total: number
  fraction: number
  status: string
}

export interface OcrPageResult {
  pageId: string
  layer: OcrLayer
}

const OCR_MAX_EDGE = 2200

async function renderPageForOcr(
  pdf: PDFDocumentProxy,
  pageState: PageState,
): Promise<{ canvas: HTMLCanvasElement; scale: number; height: number }> {
  const page = await pdf.getPage(pageState.sourceIndex + 1)
  const scale = Math.max(
    1,
    Math.min(2.2, OCR_MAX_EDGE / Math.max(pageState.width, pageState.height)),
  )
  const viewport = page.getViewport({ scale, rotation: 0 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  canvas.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none'
  document.body.appendChild(canvas)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('The browser could not prepare a page for OCR.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  try {
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      background: '#ffffff',
    }).promise
  } finally {
    canvas.remove()
  }
  return { canvas, scale, height: viewport.height / scale }
}

function wordRect(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  scale: number,
  pageHeight: number,
): Rect {
  return {
    x: bbox.x0 / scale,
    y: pageHeight - bbox.y1 / scale,
    width: Math.max(0.5, (bbox.x1 - bbox.x0) / scale),
    height: Math.max(0.5, (bbox.y1 - bbox.y0) / scale),
  }
}

/**
 * OCR a list of pages with a single Tesseract worker. The resulting words are
 * stored in PDF user space so they can be rendered into a hidden text layer on
 * export and searched in the editor.
 */
export async function ocrPages(
  pdf: PDFDocumentProxy,
  pages: PageState[],
  language: string,
  onProgress?: (progress: OcrProgress) => void,
  originalBytes?: Uint8Array,
): Promise<OcrPageResult[]> {
  if (pages.length === 0) return []

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

  // Lazy-load Tesseract so the PDF.js worker and editor startup stay isolated
  // from the OCR runtime until the user actually runs OCR.
  const Tesseract = await import('tesseract.js')
  let currentPage = 0
  const worker = await Tesseract.createWorker(language, Tesseract.OEM.LSTM_ONLY, {
    logger: (message) => {
      onProgress?.({
        page: currentPage + 1,
        total: pages.length,
        fraction: Math.min(
          1,
          Math.max(0, (currentPage + (message.progress ?? 0)) / pages.length),
        ),
        status: message.status || 'Working',
      })
    },
  })

  try {
    const results: OcrPageResult[] = []
    for (let index = 0; index < pages.length; index += 1) {
      currentPage = index
      const pageState = pages[index]
      onProgress?.({
        page: index + 1,
        total: pages.length,
        fraction: index / pages.length,
        status: `Rendering page ${index + 1}`,
      })
      const { canvas, scale, height } = await renderPageForOcr(source, pageState)
      onProgress?.({
        page: index + 1,
        total: pages.length,
        fraction: (index + 0.1) / pages.length,
        status: `Recognizing page ${index + 1}`,
      })
      const result = await worker.recognize(canvas, {}, { blocks: true })
      const words: OcrWord[] = []
      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const text = word.text.trim()
              if (!text) continue
              words.push({
                text,
                rect: wordRect(word.bbox, scale, height),
                confidence: word.confidence,
              })
            }
          }
        }
      }
      results.push({
        pageId: pageState.id,
        layer: {
          language,
          words,
          text: words.map((word) => word.text).join(' '),
          createdAt: Date.now(),
        },
      })
      onProgress?.({
        page: index + 1,
        total: pages.length,
        fraction: (index + 1) / pages.length,
        status: `Finished page ${index + 1}`,
      })
    }
    return results
  } finally {
    await worker.terminate()
    if (ownedSource) await source.loadingTask.destroy()
  }
}
