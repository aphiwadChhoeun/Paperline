import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildExportBytes } from '../src/lib/exportPdf'
import type { Annotation, PageState } from '../src/types/editor'

async function makeFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Fixture title')
  doc.setAuthor('Fixture author')
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const labels = ['PAGE ONE', 'PAGE TWO', 'PAGE THREE']
  for (const label of labels) {
    const page = doc.addPage([300, 400])
    page.drawText(label, { x: 24, y: 350, size: 16, font })
  }
  return doc.save()
}

function pageState(
  sourceIndex: number,
  annotations: Annotation[] = [],
  rotation = 0,
): PageState {
  return {
    id: `page-${sourceIndex}-${rotation}-${annotations.length}`,
    sourceIndex,
    width: 300,
    height: 400,
    rotation,
    annotations,
  }
}

function textAnnotation(id: string, pageId: string, text: string): Annotation {
  return {
    id,
    pageId,
    type: 'text',
    createdAt: 1,
    opacity: 1,
    rect: { x: 24, y: 280, width: 180, height: 30 },
    text,
    fontSize: 14,
    fontFamily: 'Helvetica',
    color: '#181817',
    align: 'left',
  }
}

async function extractText(bytes: Uint8Array): Promise<string[]> {
  const pdf = await pdfjs.getDocument({ data: bytes }).promise
  const pages: string[] = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
  }
  await pdf.loadingTask.destroy()
  return pages
}

describe('buildExportBytes', () => {
  it('preserves metadata and rotates pages in place', async () => {
    const originalBytes = await makeFixture()
    const pages = [
      pageState(0, [textAnnotation('a1', 'page-0', 'REVIEWED')]),
      pageState(1, [], 90),
      pageState(2, [], 0),
    ]
    const output = await buildExportBytes({
      originalBytes,
      pages,
      meta: { title: '', author: '', subject: '', keywords: '' },
    })
    const doc = await PDFDocument.load(output)
    expect(doc.getPageCount()).toBe(3)
    expect(doc.getPages().map((page) => page.getRotation().angle)).toEqual([0, 90, 0])
    expect(doc.getTitle()).toBe('Fixture title')
    expect(doc.getAuthor()).toBe('Fixture author')

    const text = await extractText(output)
    expect(text[0]).toContain('PAGE ONE')
    expect(text[0]).toContain('REVIEWED')
    expect(text[1]).toContain('PAGE TWO')
  })

  it('keeps duplicated pages independent', async () => {
    const originalBytes = await makeFixture()
    const pages = [
      pageState(0, [textAnnotation('a1', 'page-0', 'LEFT COPY')]),
      pageState(0, [textAnnotation('a2', 'page-1', 'RIGHT COPY')]),
    ]
    const output = await buildExportBytes({
      originalBytes,
      pages,
      meta: { title: '', author: '', subject: '', keywords: '' },
    })
    const doc = await PDFDocument.load(output)
    expect(doc.getPageCount()).toBe(2)

    const text = await extractText(output)
    expect(text[0]).toContain('LEFT COPY')
    expect(text[0]).not.toContain('RIGHT COPY')
    expect(text[1]).toContain('RIGHT COPY')
    expect(text[1]).not.toContain('LEFT COPY')
  })

  it('honors page order and deletion', async () => {
    const originalBytes = await makeFixture()
    const pages = [pageState(2), pageState(0)]
    const output = await buildExportBytes({
      originalBytes,
      pages,
      meta: { title: 'Reordered', author: '', subject: '', keywords: '' },
    })
    const doc = await PDFDocument.load(output)
    expect(doc.getPageCount()).toBe(2)
    expect(doc.getTitle()).toBe('Reordered')

    const text = await extractText(output)
    expect(text[0]).toContain('PAGE THREE')
    expect(text[1]).toContain('PAGE ONE')
    expect(text.join(' ')).not.toContain('PAGE TWO')
  })
})
