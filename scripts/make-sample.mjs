import { mkdir, writeFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const doc = await PDFDocument.create()
doc.setTitle('Paperline Sample Report')
doc.setAuthor('Paperline')
doc.setSubject('A sample document for trying the editor')
doc.setKeywords(['sample', 'pdf', 'paperline'])

const helvetica = await doc.embedFont(StandardFonts.Helvetica)
const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)
const times = await doc.embedFont(StandardFonts.TimesRoman)

const ink = rgb(0.09, 0.09, 0.09)
const muted = rgb(0.42, 0.42, 0.39)
const accent = rgb(0.36, 0.36, 0.91)
const warm = rgb(0.98, 0.97, 0.94)

const pages = [
  { width: 612, height: 792, label: '01', title: 'Quarterly field notes' },
  { width: 612, height: 792, label: '02', title: 'Observations & signals' },
  { width: 612, height: 792, label: '03', title: 'A working appendix' },
]

for (let index = 0; index < pages.length; index += 1) {
  const spec = pages[index]
  const page = doc.addPage([spec.width, spec.height])
  const { width, height } = page.getSize()

  page.drawRectangle({ x: 0, y: 0, width, height, color: warm })
  page.drawRectangle({ x: 54, y: height - 96, width: 42, height: 5, color: accent })
  page.drawText('PAPERLINE / FIELD REPORT', {
    x: 54,
    y: height - 78,
    size: 8,
    font: helveticaBold,
    color: muted,
    characterSpacing: 1.4,
  })
  page.drawText(spec.label, {
    x: width - 90,
    y: height - 92,
    size: 44,
    font: helveticaBold,
    color: rgb(0.87, 0.86, 0.82),
  })

  page.drawText(spec.title, {
    x: 54,
    y: height - 145,
    size: 31,
    font: times,
    color: ink,
  })

  page.drawText(
    index === 0
      ? 'A compact document for testing selection, annotation, page rotation, reordering, and PDF export.'
      : index === 1
        ? 'Use the highlight, rectangle, and ink tools on this page. Every edit is flattened into the exported PDF.'
        : 'Try rotating this page, duplicating it, then exporting. Reopen the download to verify the result.',
    {
      x: 54,
      y: height - 176,
      size: 11,
      font: helvetica,
      color: muted,
      lineHeight: 17,
      maxWidth: width - 108,
    },
  )

  if (index === 0) {
    page.drawRectangle({
      x: 54,
      y: height - 360,
      width: width - 108,
      height: 132,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.88, 0.87, 0.84),
      borderWidth: 1,
    })
    page.drawText('What to try', {
      x: 74,
      y: height - 262,
      size: 10,
      font: helveticaBold,
      color: accent,
    })
    page.drawText('Open the inspector, select a tool, and mark up this page.', {
      x: 74,
      y: height - 286,
      size: 13,
      font: helvetica,
      color: ink,
    })
    page.drawText('Then export and reopen the file to check fidelity.', {
      x: 74,
      y: height - 308,
      size: 13,
      font: helvetica,
      color: ink,
    })
    page.drawText('01', {
      x: 74,
      y: height - 344,
      size: 8,
      font: helveticaBold,
      color: muted,
    })

    const bars = [0.72, 0.54, 0.83, 0.61, 0.9, 0.48, 0.76, 0.66]
    bars.forEach((value, barIndex) => {
      const barHeight = 72 * value
      page.drawRectangle({
        x: 74 + barIndex * 56,
        y: 262,
        width: 26,
        height: barHeight,
        color: barIndex % 3 === 0 ? accent : rgb(0.83, 0.82, 0.78),
      })
      page.drawText(['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M'][barIndex], {
        x: 82 + barIndex * 56,
        y: 244,
        size: 8,
        font: helvetica,
        color: muted,
      })
    })
    page.drawText('Weekly engagement', {
      x: 54,
      y: 356,
      size: 8,
      font: helveticaBold,
      color: muted,
    })
  }

  if (index === 1) {
    const rows = [
      ['Signal', 'Direction', 'Confidence'],
      ['Faster document review', 'Up', 'High'],
      ['Annotation adoption', 'Up', 'Medium'],
      ['Export fidelity concerns', 'Down', 'High'],
      ['Team sharing requests', 'Up', 'Medium'],
    ]
    rows.forEach((row, rowIndex) => {
      const y = height - 300 - rowIndex * 38
      page.drawLine({
        start: { x: 54, y: y - 12 },
        end: { x: width - 54, y: y - 12 },
        thickness: 0.5,
        color: rgb(0.82, 0.81, 0.77),
      })
      row.forEach((cell, cellIndex) => {
        page.drawText(cell, {
          x: 54 + cellIndex * 176,
          y,
          size: rowIndex === 0 ? 9 : 12,
          font: rowIndex === 0 ? helveticaBold : helvetica,
          color: rowIndex === 0 ? muted : ink,
        })
      })
    })

    page.drawRectangle({
      x: 54,
      y: 158,
      width: width - 108,
      height: 110,
      color: rgb(0.96, 0.95, 0.92),
      borderColor: rgb(0.87, 0.86, 0.82),
      borderWidth: 1,
    })
    page.drawText('Note', {
      x: 74,
      y: 242,
      size: 8,
      font: helveticaBold,
      color: accent,
    })
    page.drawText('Scanned pages and true text reflow are intentionally marked as limitations in this build.', {
      x: 74,
      y: 214,
      size: 11,
      font: helvetica,
      color: ink,
      maxWidth: width - 148,
      lineHeight: 16,
    })
  }

  if (index === 2) {
    const entries = [
      ['01', 'Open a PDF', 'Use the picker, drop a file, or load this sample.'],
      ['02', 'Annotate', 'Text, highlight, rectangle, and ink are flattened on export.'],
      ['03', 'Organize', 'Rotate, duplicate, reorder, and delete pages.'],
      ['04', 'Export', 'Download a real PDF and verify the changes survived.'],
    ]
    entries.forEach((entry, entryIndex) => {
      const y = height - 245 - entryIndex * 76
      page.drawText(entry[0], {
        x: 54,
        y,
        size: 10,
        font: helveticaBold,
        color: accent,
      })
      page.drawText(entry[1], {
        x: 96,
        y,
        size: 15,
        font: helveticaBold,
        color: ink,
      })
      page.drawText(entry[2], {
        x: 96,
        y: y - 19,
        size: 10,
        font: helvetica,
        color: muted,
        maxWidth: width - 150,
      })
    })

    page.drawRectangle({
      x: 54,
      y: 88,
      width: width - 108,
      height: 1,
      color: rgb(0.82, 0.81, 0.77),
    })
    page.drawText('Paperline sample document', {
      x: 54,
      y: 66,
      size: 8,
      font: helvetica,
      color: muted,
    })
    page.drawText('Page 03', {
      x: width - 102,
      y: 66,
      size: 8,
      font: helvetica,
      color: muted,
    })
  }
}

const bytes = await doc.save()
await mkdir('public', { recursive: true })
await writeFile('public/sample.pdf', bytes)
console.log(`Wrote public/sample.pdf (${bytes.length} bytes)`)
