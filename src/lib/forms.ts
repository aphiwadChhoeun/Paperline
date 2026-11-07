import type { PDFDocumentProxy } from 'pdfjs-dist'
import { createId } from './id'
import type {
  FormField,
  FormFieldType,
  FormValue,
  FormValues,
  PageState,
  Rect,
} from '../types/editor'

interface FieldObject {
  id?: string
  value?: unknown
  defaultValue?: unknown
  exportValues?: unknown
  type?: string
  page?: number
  rect?: number[]
  hidden?: boolean
  editable?: boolean
}

interface WidgetAnnotation {
  subtype?: string
  fieldName?: string
  fieldType?: string
  fieldValue?: unknown
  buttonValue?: string
  exportValue?: string
  checkBox?: boolean
  radioButton?: boolean
  combo?: boolean
  multiSelect?: boolean
  options?: Array<string | { exportValue?: string; displayValue?: string }>
  rect?: number[]
  readOnly?: boolean
  required?: boolean
  hidden?: boolean
  multiLine?: boolean
  maxLen?: number
}

function toRect(raw: number[]): Rect {
  const [x1, y1, x2, y2] = raw
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

function optionValues(
  options: WidgetAnnotation['options'],
): string[] {
  if (!options) return []
  return options
    .map((option) =>
      typeof option === 'string'
        ? option
        : (option.exportValue ?? option.displayValue ?? ''),
    )
    .filter((option) => option.length > 0)
}

function fieldType(annotation: WidgetAnnotation): FormFieldType | null {
  if (annotation.fieldType === 'Tx') return 'text'
  if (annotation.fieldType === 'Ch') {
    return annotation.combo ? 'dropdown' : 'optionlist'
  }
  if (annotation.fieldType === 'Btn') {
    if (annotation.radioButton) return 'radio'
    if (annotation.checkBox) return 'checkbox'
    return null
  }
  return null
}

function readFieldValue(
  objects: FieldObject[] | undefined,
  annotation: WidgetAnnotation,
): unknown {
  const withValue = objects?.find(
    (object) => object.value !== undefined && object.value !== null,
  )
  if (withValue) return withValue.value
  if (annotation.fieldType === 'Btn') {
    return annotation.buttonValue ?? annotation.fieldValue
  }
  return annotation.fieldValue
}

function normalizeValue(
  type: FormFieldType,
  raw: unknown,
  annotation: WidgetAnnotation,
): FormValue {
  if (type === 'checkbox') {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') return raw !== 'Off' && raw !== ''
    return false
  }

  if (type === 'radio') {
    return typeof raw === 'string' && raw !== 'Off' ? raw : ''
  }

  if (type === 'optionlist' && annotation.multiSelect) {
    if (Array.isArray(raw)) return raw.map(String)
    return raw === undefined || raw === null || raw === '' ? [] : [String(raw)]
  }

  if (type === 'dropdown' || type === 'optionlist') {
    if (Array.isArray(raw)) return String(raw[0] ?? '')
    return raw === undefined || raw === null ? '' : String(raw)
  }

  return raw === undefined || raw === null ? '' : String(raw)
}

/**
 * Read fillable AcroForm widgets from PDF.js. Field values come from
 * `getFieldObjects` because widget annotations do not expose a radio group's
 * selected value consistently. Widget annotations supply geometry and options.
 */
export async function extractFormFields(
  pdf: PDFDocumentProxy,
  pages: PageState[],
): Promise<{ fields: FormField[]; values: FormValues }> {
  let objectMap: Map<string, FieldObject[]> | null = null
  try {
    objectMap = (await pdf.getFieldObjects()) as Map<string, FieldObject[]> | null
  } catch {
    objectMap = null
  }

  const fields: FormField[] = []
  const values: FormValues = {}
  const pageBySourceIndex = new Map(pages.map((page) => [page.sourceIndex, page]))

  for (const pageState of pages) {
    let annotations: WidgetAnnotation[]
    try {
      const page = await pdf.getPage(pageState.sourceIndex + 1)
      annotations = (await page.getAnnotations()) as WidgetAnnotation[]
    } catch {
      continue
    }

    for (const annotation of annotations) {
      if (annotation.subtype !== 'Widget' || !annotation.fieldName) continue
      if (!annotation.rect || annotation.rect.length < 4) continue
      const type = fieldType(annotation)
      if (!type) continue
      if (annotation.hidden) continue

      const page = pageBySourceIndex.get(pageState.sourceIndex)
      if (!page) continue
      const rawValue = readFieldValue(
        objectMap?.get(annotation.fieldName),
        annotation,
      )
      const value = normalizeValue(type, rawValue, annotation)
      if (!(annotation.fieldName in values)) values[annotation.fieldName] = value

      fields.push({
        id: createId('field'),
        pageId: page.id,
        fieldName: annotation.fieldName,
        type,
        rect: toRect(annotation.rect),
        value,
        options: optionValues(annotation.options),
        readOnly: Boolean(annotation.readOnly),
        required: Boolean(annotation.required),
        hidden: Boolean(annotation.hidden),
        multiSelect: Boolean(annotation.multiSelect),
        multiline: Boolean(
          annotation.multiLine || annotation.rect[3] - annotation.rect[1] > 30,
        ),
        exportValue: annotation.exportValue ?? null,
        buttonValue: annotation.buttonValue ?? null,
      })
    }
  }

  return { fields, values }
}
