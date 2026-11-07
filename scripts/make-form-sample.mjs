import { mkdir, writeFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const doc = await PDFDocument.create()
doc.setTitle('Paperline Form Sample')
doc.setAuthor('Paperline')
doc.setSubject('A fillable form for trying Paperline')
doc.setKeywords(['form', 'sample', 'paperline'])

const page = doc.addPage([612, 792])
const { width, height } = page.getSize()
const font = await doc.embedFont(StandardFonts.Helvetica)
const bold = await doc.embedFont(StandardFonts.HelveticaBold)
const serif = await doc.embedFont(StandardFonts.TimesRoman)

const ink = rgb(0.09, 0.09, 0.09)
const muted = rgb(0.42, 0.42, 0.39)
const accent = rgb(0.36, 0.36, 0.91)
const warm = rgb(0.98, 0.97, 0.94)
const line = rgb(0.86, 0.85, 0.81)

page.drawRectangle({ x: 0, y: 0, width, height, color: warm })
page.drawRectangle({ x: 54, y: height - 96, width: 42, height: 5, color: accent })
page.drawText('PAPERLINE / FORM SAMPLE', {
  x: 54,
  y: height - 78,
  size: 8,
  font: bold,
  color: muted,
  characterSpacing: 1.4,
})
page.drawText('Project intake form', {
  x: 54,
  y: height - 145,
  size: 30,
  font: serif,
  color: ink,
})
page.drawText(
  'Click any field on this page to fill it. Export the PDF and the values are written into the actual AcroForm.',
  {
    x: 54,
    y: height - 174,
    size: 10.5,
    font,
    color: muted,
    maxWidth: width - 108,
    lineHeight: 16,
  },
)

const label = (text, x, y) => {
  page.drawText(text.toUpperCase(), {
    x,
    y,
    size: 7.5,
    font: bold,
    color: muted,
    characterSpacing: 1,
  })
}

const sectionLine = (y) => {
  page.drawLine({
    start: { x: 54, y },
    end: { x: width - 54, y },
    thickness: 0.6,
    color: line,
  })
}

sectionLine(height - 208)
label('Your name', 54, height - 244)
label('Email', 330, height - 244)
label('Project type', 54, height - 318)
label('Timeline', 330, height - 318)
label('Notes', 54, height - 408)
label('Interests', 330, height - 408)

const form = doc.getForm()

const name = form.createTextField('full_name')
name.setText('')
name.addToPage(page, {
  x: 54,
  y: height - 282,
  width: 244,
  height: 26,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

const email = form.createTextField('email')
email.addToPage(page, {
  x: 330,
  y: height - 282,
  width: 228,
  height: 26,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

const project = form.createDropdown('project_type')
project.addOptions(['Website', 'Mobile app', 'Brand system', 'Document workflow'])
project.addToPage(page, {
  x: 54,
  y: height - 356,
  width: 244,
  height: 26,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

const timeline = form.createDropdown('timeline')
timeline.addOptions(['This month', 'Next quarter', 'Flexible'])
timeline.addToPage(page, {
  x: 330,
  y: height - 356,
  width: 228,
  height: 26,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

const notes = form.createTextField('notes')
notes.enableMultiline()
notes.addToPage(page, {
  x: 54,
  y: height - 507,
  width: 244,
  height: 86,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

const interests = form.createOptionList('interests')
interests.addOptions(['Design', 'Engineering', 'Research', 'Operations'])
interests.addToPage(page, {
  x: 330,
  y: height - 507,
  width: 228,
  height: 86,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
  textColor: ink,
  borderWidth: 1,
})

label('How should we follow up?', 54, height - 556)
const followup = form.createRadioGroup('follow_up')
followup.addOptionToPage('Email', page, {
  x: 54,
  y: height - 586,
  width: 16,
  height: 16,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
})
followup.addOptionToPage('Phone', page, {
  x: 150,
  y: height - 586,
  width: 16,
  height: 16,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
})
followup.addOptionToPage('No preference', page, {
  x: 246,
  y: height - 586,
  width: 16,
  height: 16,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
})
;[
  ['Email', 78],
  ['Phone', 174],
  ['No preference', 270],
].forEach(([text, x]) => {
  page.drawText(text, {
    x,
    y: height - 582,
    size: 10,
    font,
    color: ink,
  })
})

const agree = form.createCheckBox('newsletter')
agree.addToPage(page, {
  x: 54,
  y: height - 632,
  width: 16,
  height: 16,
  borderColor: line,
  backgroundColor: rgb(1, 1, 1),
})
page.drawText('Send me occasional product notes', {
  x: 78,
  y: height - 628,
  size: 10,
  font,
  color: ink,
})

page.drawRectangle({
  x: 54,
  y: 80,
  width: width - 108,
  height: 58,
  color: rgb(0.96, 0.95, 0.92),
  borderColor: line,
  borderWidth: 1,
})
page.drawText('This form is processed locally. No data leaves your browser.', {
  x: 70,
  y: 114,
  size: 9.5,
  font,
  color: muted,
})
page.drawText('Paperline form sample', {
  x: 70,
  y: 96,
  size: 8,
  font: bold,
  color: accent,
})

const bytes = await doc.save()
await mkdir('public', { recursive: true })
await writeFile('public/form-sample.pdf', bytes)
console.log(`Wrote public/form-sample.pdf (${bytes.length} bytes)`)
