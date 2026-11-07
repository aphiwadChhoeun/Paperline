import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageState, SearchMatch } from '../types/editor'

export interface SearchOptions {
  /** Abort a search when the query changes or the panel unmounts. */
  signal?: AbortSignal
  /** Maximum number of matches returned across the document. */
  maxResults?: number
  /** Called after each page has been inspected. */
  onProgress?: (processed: number, total: number) => void
}

const DEFAULT_MAX_RESULTS = 100
const MAX_RESULTS_PER_PAGE = 20
const SNIPPET_CONTEXT = 48

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

async function extractPageText(
  pdf: PDFDocumentProxy,
  sourceIndex: number,
): Promise<string> {
  const page = await pdf.getPage(sourceIndex + 1)
  const content = await page.getTextContent()
  const chunks: string[] = []
  for (const item of content.items) {
    if (!('str' in item)) continue
    chunks.push(item.str)
    chunks.push(item.hasEOL ? '\n' : ' ')
  }
  return chunks.join('').replace(/\s+/g, ' ').trim()
}

function buildSnippet(text: string, start: number, end: number): string {
  const from = Math.max(0, start - SNIPPET_CONTEXT)
  const to = Math.min(text.length, end + SNIPPET_CONTEXT)
  const body = text.slice(from, to).trim()
  return `${from > 0 ? '…' : ''}${body}${to < text.length ? '…' : ''}`
}

/**
 * Extract and search the text of every page in a document.
 *
 * Pages are processed sequentially and the browser is yielded to between
 * pages, so the UI stays responsive while large documents are scanned.
 */
export async function searchDocument(
  pdf: PDFDocumentProxy,
  pages: PageState[],
  query: string,
  options: SearchOptions = {},
): Promise<SearchMatch[]> {
  const needle = query.trim().replace(/\s+/g, ' ')
  if (!needle) return []

  const needleLower = needle.toLowerCase()
  const maxResults = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS)
  const signal = options.signal
  const results: SearchMatch[] = []
  const seenSnippets = new Set<string>()
  const textCache = new Map<number, string>()

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    if (signal?.aborted) return results
    const pageState = pages[pageIndex]
    if (!pageState) continue

    let pageText = textCache.get(pageState.sourceIndex)
    if (pageText === undefined) {
      try {
        pageText = await extractPageText(pdf, pageState.sourceIndex)
      } catch {
        pageText = ''
      }
      textCache.set(pageState.sourceIndex, pageText)
    }

    const ocrText = pageState.ocr?.text?.trim()
    if (ocrText) {
      pageText = pageText.trim() ? `${pageText} ${ocrText}` : ocrText
    }

    if (pageText) {
      const haystack = pageText.toLowerCase()
      let from = 0
      let pageMatches = 0
      while (pageMatches < MAX_RESULTS_PER_PAGE && results.length < maxResults) {
        const found = haystack.indexOf(needleLower, from)
        if (found < 0) break
        const end = found + needleLower.length
        const snippet = buildSnippet(pageText, found, end)
        const key = `${pageState.id}:${snippet}`
        if (!seenSnippets.has(key)) {
          seenSnippets.add(key)
          results.push({
            pageId: pageState.id,
            pageIndex,
            snippet,
            text: pageText.slice(found, end),
          })
          pageMatches += 1
        }
        from = Math.max(found + needleLower.length, found + 1)
      }
    }

    options.onProgress?.(pageIndex + 1, pages.length)
    if (results.length >= maxResults) break
    // Yield so the browser can paint the progress indicator.
    await yieldToBrowser()
  }

  return results
}
