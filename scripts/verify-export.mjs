import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const path = process.argv[2]
if (!path) throw new Error('Pass a PDF path')
const bytes = new Uint8Array(await readFile(path))
const doc = await PDFDocument.load(bytes)
console.log(
  JSON.stringify(
    {
      pages: doc.getPageCount(),
      rotations: doc.getPages().map((page) => page.getRotation().angle),
      title: doc.getTitle(),
      author: doc.getAuthor(),
      producer: doc.getProducer(),
      bytes: bytes.length,
    },
    null,
    2,
  ),
)

const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true })
const pdf = await task.promise
const texts = []
for (let index = 1; index <= pdf.numPages; index += 1) {
  const page = await pdf.getPage(index)
  const content = await page.getTextContent()
  texts.push(
    content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}
await pdf.loadingTask.destroy()
console.log(JSON.stringify({ extracted: texts }, null, 2))
