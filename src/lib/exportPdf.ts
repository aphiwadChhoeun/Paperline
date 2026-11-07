import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  TextRenderingMode,
  degrees,
  rgb,
  setTextRenderingMode,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type {
  Annotation,
  DocumentMeta,
  FormValue,
  FormValues,
  OcrLayer,
  PageState,
} from '../types/editor'

export interface BuildExportOptions {
  originalBytes: Uint8Array
  pages: PageState[]
  meta: DocumentMeta
  formValues?: FormValues
  flattenForms?: boolean
  /** Full-page PNG replacements produced by the redaction renderer. */
  redactedPageImages?: Record<string, Uint8Array>
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

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(encoded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function drawOcrLayer(page: PDFPage, layer: OcrLayer, font: PDFFont) {
  if (layer.words.length === 0) return
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible))
  for (const word of layer.words) {
    const text = word.text
      .normalize('NFKD')
      .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '')
      .trim()
    if (!text) continue
    const size = Math.max(4, Math.min(32, word.rect.height * 0.9))
    page.drawText(text, {
      x: word.rect.x,
      y: word.rect.y + word.rect.height * 0.18,
      size,
      font,
      color: rgb(0, 0, 0),
    })
  }
  page.pushOperators(setTextRenderingMode(TextRenderingMode.Fill))
}

async function drawAnnotation(
  document: PDFDocument,
  page: PDFPage,
  annotation: Annotation,
  fonts: Record<'Helvetica' | 'Times' | 'Courier', PDFFont>,
  imageCache: Map<string, Promise<PDFImage>>,
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
    case 'redaction':
      // Redacted pages are replaced by a rasterized image before this point.
      break
    case 'image': {
      let embedded = imageCache.get(annotation.dataUrl)
      if (!embedded) {
        const bytes = dataUrlToBytes(annotation.dataUrl)
        embedded =
          annotation.mimeType === 'image/jpeg'
            ? document.embedJpg(bytes)
            : document.embedPng(bytes)
        imageCache.set(annotation.dataUrl, embedded)
      }
      const image = await embedded
      page.drawImage(image, {
        x: annotation.rect.x,
        y: annotation.rect.y,
        width: annotation.rect.width,
        height: annotation.rect.height,
        opacity: annotation.opacity,
      })
      break
    }
  }
}

function applyFormValue(
  form: ReturnType<PDFDocument['getForm']>,
  name: string,
  value: FormValue,
) {
  const field = form.getFieldMaybe(name)
  if (!field) return

  if (field instanceof PDFTextField) {
    field.setText(Array.isArray(value) ? value.join(', ') : String(value))
    return
  }
  if (field instanceof PDFCheckBox) {
    if (value === true || value === 'true' || value === 'Yes') field.check()
    else field.uncheck()
    return
  }
  if (field instanceof PDFRadioGroup) {
    if (typeof value === 'string' && value && value !== 'Off') field.select(value)
    else field.clear()
    return
  }
  if (field instanceof PDFDropdown) {
    if (Array.isArray(value)) {
      if (value.length > 0) field.select(value)
      else field.clear()
    } else if (typeof value === 'string' && value) {
      field.select(value)
    } else {
      field.clear()
    }
    return
  }
  if (field instanceof PDFOptionList) {
    if (Array.isArray(value)) {
      if (value.length > 0) field.select(value)
      else field.clear()
    } else if (typeof value === 'string' && value) {
      field.select(value)
    } else {
      field.clear()
    }
  }
}

export async function buildExportBytes({
  originalBytes,
  pages,
  meta,
  formValues = {},
  flattenForms = false,
  redactedPageImages = {},
}: BuildExportOptions): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('There are no pages to export.')

  const original = await PDFDocument.load(originalBytes, { updateMetadata: false })
  const sourcePages = original.getPages()
  if (sourcePages.length === 0) throw new Error('The source PDF has no pages.')

  for (const pageState of pages) {
    const needsRedaction = pageState.annotations.some(
      (annotation) => annotation.type === 'redaction',
    )
    if (needsRedaction && !redactedPageImages[pageState.id]) {
      throw new Error(
        'The redacted pages could not be rasterized, so export was stopped to avoid leaking content.',
      )
    }
  }

  const hasRedactions = pages.some((pageState) =>
    pageState.annotations.some((annotation) => annotation.type === 'redaction'),
  )
  const identityOrder =
    !hasRedactions &&
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
      const redactedImage = redactedPageImages[pageState.id]
      if (redactedImage) {
        const page = output.addPage([pageState.width, pageState.height])
        const image = await output.embedPng(redactedImage)
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: pageState.width,
          height: pageState.height,
        })
        outputPages.push(page)
      } else {
        const [copied] = await output.copyPages(original, [pageState.sourceIndex])
        outputPages.push(output.addPage(copied))
      }
    }
  }

  const fonts = {
    Helvetica: await output.embedFont(StandardFonts.Helvetica),
    Times: await output.embedFont(StandardFonts.TimesRoman),
    Courier: await output.embedFont(StandardFonts.Courier),
  }

  const imageCache = new Map<string, Promise<PDFImage>>()
  for (const [index, pageState] of pages.entries()) {
    const page = outputPages[index]
    if (!page) continue
    page.setRotation(degrees(pageState.rotation))
    if (redactedPageImages[pageState.id]) continue
    for (const annotation of pageState.annotations) {
      await drawAnnotation(output, page, annotation, fonts, imageCache)
    }
    if (pageState.ocr) {
      drawOcrLayer(page, pageState.ocr, fonts.Helvetica)
    }
  }

  if (flattenForms || Object.keys(formValues).length > 0) {
    const form = output.getForm()
    for (const [name, value] of Object.entries(formValues)) {
      applyFormValue(form, name, value)
    }
    if (flattenForms && form.getFields().length > 0) {
      form.flatten()
    }
  }

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
