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

async function makeFormFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([300, 400])
  const form = doc.getForm()

  const name = form.createTextField('full_name')
  name.addToPage(page, { x: 24, y: 300, width: 220, height: 24 })

  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 24, y: 260, width: 16, height: 16 })

  const color = form.createRadioGroup('color')
  color.addOptionToPage('Red', page, { x: 80, y: 260, width: 16, height: 16 })
  color.addOptionToPage('Blue', page, { x: 120, y: 260, width: 16, height: 16 })

  const country = form.createDropdown('country')
  country.addOptions(['United States', 'Cambodia', 'Japan'])
  country.addToPage(page, { x: 24, y: 220, width: 180, height: 24 })

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

  it('writes text, checkbox, radio, and dropdown form values', async () => {
    const originalBytes = await makeFormFixture()
    const output = await buildExportBytes({
      originalBytes,
      pages: [pageState(0)],
      meta: { title: 'Form export', author: '', subject: '', keywords: '' },
      formValues: {
        full_name: 'Grace Hopper',
        agree: true,
        color: 'Blue',
        country: 'Japan',
      },
    })
    const doc = await PDFDocument.load(output)
    const form = doc.getForm()
    expect(form.getTextField('full_name').getText()).toBe('Grace Hopper')
    expect(form.getCheckBox('agree').isChecked()).toBe(true)
    expect(form.getRadioGroup('color').getSelected()).toBe('Blue')
    expect(form.getDropdown('country').getSelected()).toEqual(['Japan'])
  })

  it('flattens form fields when requested', async () => {
    const originalBytes = await makeFormFixture()
    const output = await buildExportBytes({
      originalBytes,
      pages: [pageState(0)],
      meta: { title: '', author: '', subject: '', keywords: '' },
      formValues: { full_name: 'Flattened value' },
      flattenForms: true,
    })
    const doc = await PDFDocument.load(output)
    expect(doc.getForm().getFields()).toHaveLength(0)
  })

  it('embeds image annotations', async () => {
    const originalBytes = await makeFixture()
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lK3Q6wAAAABJRU5ErkJggg=='
    const pages = [
      pageState(0, [
        {
          id: 'image-1',
          pageId: 'page-0',
          type: 'image',
          createdAt: 1,
          opacity: 1,
          rect: { x: 24, y: 200, width: 48, height: 48 },
          dataUrl: png,
          mimeType: 'image/png',
          name: 'pixel.png',
        },
      ]),
    ]
    const output = await buildExportBytes({
      originalBytes,
      pages,
      meta: { title: '', author: '', subject: '', keywords: '' },
    })
    const doc = await PDFDocument.load(output)
    expect(doc.getPageCount()).toBe(1)
    expect(output.byteLength).toBeGreaterThan(originalBytes.byteLength)
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
