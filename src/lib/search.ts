import type { PDFDocumentProxy } from 'pdfjs-dist'
import { pdfjsLib } from './pdfjs'
import type { OcrLayer, PageState, Rect, SearchMatch } from '../types/editor'

export interface SearchOptions {
  /** Abort a search when the query changes or the panel unmounts. */
  signal?: AbortSignal
  /** Maximum number of matches returned across the document. */
  maxResults?: number
  /** Called after each page has been inspected. */
  onProgress?: (processed: number, total: number) => void
}

interface TextItemLike {
  str: string
  transform: number[]
  width: number
  height: number
  hasEOL?: boolean
}

interface TextRun {
  start: number
  end: number
  text: string
  item: TextItemLike
}

interface NormalizedText {
  text: string
  /** Maps a normalized-text index back to the raw item string. */
  map: number[]
}

interface PageTextData {
  text: NormalizedText
  runs: TextRun[]
  viewport: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['getViewport']>
}

interface OcrRun {
  start: number
  end: number
  rect: Rect
}

interface OcrTextData {
  text: NormalizedText
  runs: OcrRun[]
}

const DEFAULT_MAX_RESULTS = 100
const MAX_RESULTS_PER_PAGE = 20
const SNIPPET_CONTEXT = 48

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

function normalizeWithMap(raw: string): NormalizedText {
  let text = ''
  const map: number[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index]
    if (/\s/.test(character)) {
      if (text.length > 0 && !text.endsWith(' ')) {
        text += ' '
        map.push(index)
      }
      continue
    }
    text += character
    map.push(index)
  }
  return { text, map }
}

function buildSnippet(text: string, start: number, end: number): string {
  const from = Math.max(0, start - SNIPPET_CONTEXT)
  const to = Math.min(text.length, end + SNIPPET_CONTEXT)
  const body = text.slice(from, to).trim()
  return `${from > 0 ? '…' : ''}${body}${to < text.length ? '…' : ''}`
}

async function extractPageText(
  pdf: PDFDocumentProxy,
  sourceIndex: number,
): Promise<PageTextData> {
  const page = await pdf.getPage(sourceIndex + 1)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  const content = await page.getTextContent()
  let raw = ''
  const runs: TextRun[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str) continue
    if (raw && !raw.endsWith(' ') && !raw.endsWith('\n')) raw += ' '
    const start = raw.length
    raw += item.str
    runs.push({
      start,
      end: raw.length,
      text: item.str,
      item: item as TextItemLike,
    })
    raw += item.hasEOL ? '\n' : ' '
  }

  return { text: normalizeWithMap(raw), runs, viewport }
}

function buildOcrText(layer: OcrLayer): OcrTextData {
  let raw = ''
  const runs: OcrRun[] = []
  for (const word of layer.words) {
    if (!word.text.trim()) continue
    if (raw) raw += ' '
    const start = raw.length
    raw += word.text
    runs.push({ start, end: raw.length, rect: word.rect })
  }
  return { text: normalizeWithMap(raw), runs }
}

function itemRect(
  run: TextRun,
  localStart: number,
  localEnd: number,
  viewport: PageTextData['viewport'],
): Rect | null {
  const transform = pdfjsLib.Util.transform(
    viewport.transform,
    run.item.transform,
  )
  const height = Math.hypot(transform[2], transform[3]) || run.item.height || 10
  const length = Math.max(1, run.text.length)
  const left = transform[4] + run.item.width * (localStart / length)
  const width = Math.max(0.5, run.item.width * ((localEnd - localStart) / length))
  const top = transform[5] - height
  const [x1, y1] = viewport.convertToPdfPoint(left, top)
  const [x2, y2] = viewport.convertToPdfPoint(left + width, top + height)
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

function nativeMatches(
  page: PageState,
  pageIndex: number,
  data: PageTextData,
  needle: string,
): SearchMatch[] {
  const haystack = data.text.text.toLowerCase()
  const results: SearchMatch[] = []
  let from = 0

  while (results.length < MAX_RESULTS_PER_PAGE) {
    const found = haystack.indexOf(needle, from)
    if (found < 0) break
    const end = found + needle.length
    const rawStart = data.text.map[found]
    const rawEnd = (data.text.map[end - 1] ?? rawStart) + 1
    const rects: Rect[] = []

    for (const run of data.runs) {
      if (run.end <= rawStart || run.start >= rawEnd) continue
      const localStart = Math.max(0, rawStart - run.start)
      const localEnd = Math.min(run.text.length, rawEnd - run.start)
      if (localEnd <= localStart) continue
      const rect = itemRect(run, localStart, localEnd, data.viewport)
      if (rect && rect.width > 0.1 && rect.height > 0.1) rects.push(rect)
    }

    if (rects.length > 0) {
      results.push({
        id: `${page.id}:native:${found}`,
        pageId: page.id,
        pageIndex,
        snippet: buildSnippet(data.text.text, found, end),
        text: data.text.text.slice(found, end),
        rects,
      })
    }
    from = Math.max(found + needle.length, found + 1)
  }

  return results
}

function ocrMatches(
  page: PageState,
  pageIndex: number,
  data: OcrTextData,
  needle: string,
): SearchMatch[] {
  const haystack = data.text.text.toLowerCase()
  const results: SearchMatch[] = []
  let from = 0

  while (results.length < MAX_RESULTS_PER_PAGE) {
    const found = haystack.indexOf(needle, from)
    if (found < 0) break
    const end = found + needle.length
    const rawStart = data.text.map[found]
    const rawEnd = (data.text.map[end - 1] ?? rawStart) + 1
    const rects = data.runs
      .filter((run) => run.end > rawStart && run.start < rawEnd)
      .map((run) => run.rect)
      .filter((rect) => rect.width > 0.1 && rect.height > 0.1)

    if (rects.length > 0) {
      results.push({
        id: `${page.id}:ocr:${found}`,
        pageId: page.id,
        pageIndex,
        snippet: buildSnippet(data.text.text, found, end),
        text: data.text.text.slice(found, end),
        rects,
      })
    }
    from = Math.max(found + needle.length, found + 1)
  }

  return results
}

/**
 * Extract and search the text of every page in a document. Results include
 * PDF-space rectangles so the viewer can highlight the matched text on the page.
 * Pages are processed sequentially and the browser is yielded to between pages,
 * so the UI stays responsive while large documents are scanned.
 */
export async function searchDocument(
  pdf: PDFDocumentProxy,
  pages: PageState[],
  query: string,
  options: SearchOptions = {},
): Promise<SearchMatch[]> {
  const needle = normalizeQuery(query).toLowerCase()
  if (!needle) return []

  const maxResults = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS)
  const signal = options.signal
  const results: SearchMatch[] = []
  const seen = new Set<string>()
  const textCache = new Map<number, PageTextData>()

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (signal?.aborted) return results
    const pageState = pages[pageIndex]
    if (!pageState) continue

    let pageText = textCache.get(pageState.sourceIndex)
    if (!pageText) {
      try {
        pageText = await extractPageText(pdf, pageState.sourceIndex)
      } catch {
        options.onProgress?.(pageIndex + 1, pages.length)
        await yieldToBrowser()
        continue
      }
      textCache.set(pageState.sourceIndex, pageText)
    }

    const data = pageText
    const native = nativeMatches(pageState, pageIndex, data, needle)
    for (const match of native) {
      if (results.length >= maxResults) break
      if (seen.has(match.id)) continue
      seen.add(match.id)
      results.push(match)
    }

    // On scanned pages the native text is empty. Use the OCR layer's word
    // rectangles to highlight matches, but avoid double-highlighting a digital
    // page that merely has an OCR layer as a backup.
    if (
      results.length < maxResults &&
      pageState.ocr &&
      data.text.text.trim().length < 20
    ) {
      const ocr = ocrMatches(
        pageState,
        pageIndex,
        buildOcrText(pageState.ocr),
        needle,
      )
      for (const match of ocr) {
        if (results.length >= maxResults) break
        if (seen.has(match.id)) continue
        seen.add(match.id)
        results.push(match)
      }
    }

    options.onProgress?.(pageIndex + 1, pages.length)
    if (results.length >= maxResults) break
    await yieldToBrowser()
  }

  return results
}
