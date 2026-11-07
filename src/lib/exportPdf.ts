import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Annotation, DocumentMeta, PageState } from '../types/editor'

export interface BuildExportOptions {
  originalBytes: Uint8Array
  pages: PageState[]
  meta: DocumentMeta
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  const safe =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized.padEnd(6, '0').slice(0, 6)
  const value = Number.parseInt(safe, 16)
  return rgb(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  )
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return ['']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawTextAnnotation(
  page: PDFPage,
  annotation: Extract<Annotation, { type: 'text' }>,
  font: PDFFont,
) {
  if (!annotation.text.trim()) return
  const { rect } = annotation
  const lineHeight = annotation.fontSize * 1.3
  const lines = annotation.text.split('\n').flatMap((line) =>
    wrapLine(line, font, annotation.fontSize, Math.max(8, rect.width)),
  )
  const top = rect.y + rect.height
  const color = hexToRgb(annotation.color)
  lines.forEach((line, index) => {
    const width = font.widthOfTextAtSize(line, annotation.fontSize)
    let x = rect.x
    if (annotation.align === 'center') x += Math.max(0, (rect.width - width) / 2)
    if (annotation.align === 'right') x += Math.max(0, rect.width - width)
    const y = top - annotation.fontSize - index * lineHeight
    page.drawText(line, {
      x,
      y,
      size: annotation.fontSize,
      font,
      color,
      opacity: annotation.opacity,
    })
  })
}

function drawAnnotation(
  page: PDFPage,
  annotation: Annotation,
  fonts: Record<'Helvetica' | 'Times' | 'Courier', PDFFont>,
) {
  switch (annotation.type) {
    case 'text':
      drawTextAnnotation(page, annotation, fonts[annotation.fontFamily])
      break
    case 'highlight':
      page.drawRectangle({
        x: annotation.rect.x,
        y: annotation.rect.y,
        width: annotation.rect.width,
        height: annotation.rect.height,
        color: hexToRgb(annotation.color),
        opacity: annotation.opacity,
        borderWidth: 0,
      })
      break
    case 'rectangle':
      page.drawRectangle({
        x: annotation.rect.x,
        y: annotation.rect.y,
        width: annotation.rect.width,
        height: annotation.rect.height,
        borderColor: hexToRgb(annotation.color),
        borderWidth: annotation.strokeWidth,
        borderOpacity: annotation.opacity,
        color: annotation.fillColor ? hexToRgb(annotation.fillColor) : undefined,
        opacity: annotation.fillColor ? annotation.opacity * 0.24 : 0,
      })
      break
    case 'ink': {
      if (annotation.points.length < 2) break
      const color = hexToRgb(annotation.color)
      for (let index = 1; index < annotation.points.length; index += 1) {
        const start = annotation.points[index - 1]
        const end = annotation.points[index]
        page.drawLine({
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          thickness: annotation.strokeWidth,
          color,
          opacity: annotation.opacity,
        })
      }
      break
    }
  }
}

export async function buildExportBytes({
  originalBytes,
  pages,
  meta,
}: BuildExportOptions): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('There are no pages to export.')

  const original = await PDFDocument.load(originalBytes, { updateMetadata: false })
  const sourcePages = original.getPages()
  if (sourcePages.length === 0) throw new Error('The source PDF has no pages.')

  const identityOrder =
    pages.length === sourcePages.length &&
    pages.every((page, index) => page.sourceIndex === index)

  const output = identityOrder ? original : await PDFDocument.create()
  const outputPages: PDFPage[] = []

  if (identityOrder) {
    outputPages.push(...sourcePages)
  } else {
    // pdf-lib shares one copied page object when the same source index is
    // requested twice in a single copyPages call. Copying one page at a time
    // guarantees that duplicated pages are independent, so annotations drawn
    // on one page never leak onto its sibling.
    for (const pageState of pages) {
      const [copied] = await output.copyPages(original, [pageState.sourceIndex])
      outputPages.push(output.addPage(copied))
    }
  }

  const fonts = {
    Helvetica: await output.embedFont(StandardFonts.Helvetica),
    Times: await output.embedFont(StandardFonts.TimesRoman),
    Courier: await output.embedFont(StandardFonts.Courier),
  }

  pages.forEach((pageState, index) => {
    const page = outputPages[index]
    if (!page) return
    page.setRotation(degrees(pageState.rotation))
    for (const annotation of pageState.annotations) {
      drawAnnotation(page, annotation, fonts)
    }
  })

  const originalMeta = original.getTitle() ?? ''
  const originalKeywords = original.getKeywords() ?? ''
  output.setTitle(meta.title || originalMeta || 'Edited document')
  output.setAuthor(meta.author || original.getAuthor() || '')
  output.setSubject(meta.subject || original.getSubject() || '')
  output.setKeywords(
    meta.keywords
      ? meta.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean)
      : originalKeywords
        ? originalKeywords.split(',').map((keyword) => keyword.trim())
        : [],
  )
  output.setCreator('Paperline')
  output.setProducer('Paperline')

  return output.save({ useObjectStreams: false, addDefaultPage: false })
}
