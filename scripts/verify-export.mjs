import { readFile } from 'node:fs/promises'
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib'
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
      formFields: doc.getForm().getFields().map((field) => {
        const name = field.getName()
        if (field instanceof PDFTextField) return { name, type: 'text', value: field.getText() }
        if (field instanceof PDFCheckBox) return { name, type: 'checkbox', value: field.isChecked() }
        if (field instanceof PDFRadioGroup) return { name, type: 'radio', value: field.getSelected() }
        if (field instanceof PDFDropdown) return { name, type: 'dropdown', value: field.getSelected() }
        if (field instanceof PDFOptionList) return { name, type: 'optionlist', value: field.getSelected() }
        return { name, type: field.constructor.name }
      }),
    },
    null,
    2,
  ),
)

const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true })
const pdf = await task.promise
const texts = []
const images = []
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
  const operators = await page.getOperatorList()
  images.push(
    operators.fnArray.filter(
      (fn) =>
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject,
    ).length,
  )
}
await pdf.loadingTask.destroy()
console.log(JSON.stringify({ extracted: texts, imageDraws: images }, null, 2))
