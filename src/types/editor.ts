import type { PDFDocumentProxy } from 'pdfjs-dist'

export type Tool = 'select' | 'text' | 'highlight' | 'rectangle' | 'ink' | 'redact'
export type SidebarTab = 'thumbnails' | 'outline' | 'search' | 'comments'
export type InspectorTab = 'properties' | 'document' | 'pages'
export type AppStatus = 'idle' | 'loading' | 'ready' | 'exporting' | 'error'
export type NoticeTone = 'info' | 'success' | 'error'

/** Coordinates are in PDF user space (72 points per inch, origin bottom-left). */
export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type FontFamily = 'Helvetica' | 'Times' | 'Courier'
export type TextAlign = 'left' | 'center' | 'right'

interface AnnotationBase {
  id: string
  pageId: string
  createdAt: number
  opacity: number
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  rect: Rect
  text: string
  fontSize: number
  fontFamily: FontFamily
  color: string
  align: TextAlign
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight'
  rect: Rect
  color: string
}

export interface RectangleAnnotation extends AnnotationBase {
  type: 'rectangle'
  rect: Rect
  color: string
  fillColor: string | null
  strokeWidth: number
}

export interface InkAnnotation extends AnnotationBase {
  type: 'ink'
  points: Point[]
  color: string
  strokeWidth: number
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image'
  rect: Rect
  dataUrl: string
  mimeType: 'image/png' | 'image/jpeg'
  name: string
}

export interface RedactionAnnotation extends AnnotationBase {
  type: 'redaction'
  rect: Rect
}

export interface OcrWord {
  text: string
  rect: Rect
  confidence: number
}

export interface OcrLayer {
  language: string
  words: OcrWord[]
  text: string
  createdAt: number
}

export type Annotation =
  | TextAnnotation
  | HighlightAnnotation
  | RectangleAnnotation
  | InkAnnotation
  | ImageAnnotation
  | RedactionAnnotation

export interface PageState {
  id: string
  /** Zero-based page index in the original PDF. */
  sourceIndex: number
  /** Unrotated page width in PDF points. */
  width: number
  /** Unrotated page height in PDF points. */
  height: number
  /** Absolute page rotation in degrees: 0, 90, 180, or 270. */
  rotation: number
  annotations: Annotation[]
  /** Optional invisible OCR text layer created in the editor. */
  ocr?: OcrLayer | null
}

export interface DocumentMeta {
  title: string
  author: string
  subject: string
  keywords: string
}

export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'optionlist'

export type FormValue = string | boolean | string[]
export type FormValues = Record<string, FormValue>

export interface FormField {
  id: string
  pageId: string
  fieldName: string
  type: FormFieldType
  rect: Rect
  value: FormValue
  options: string[]
  readOnly: boolean
  required: boolean
  hidden: boolean
  multiSelect: boolean
  multiline: boolean
  exportValue: string | null
  buttonValue: string | null
}

export interface EditorSnapshot {
  pages: PageState[]
  formValues: FormValues
}

export interface SessionSnapshot {
  fileName: string
  fileSize: number
  fileLastModified: number
  pages: PageState[]
  formValues?: FormValues
  flattenForms?: boolean
  savedAt: number
}

export interface SearchMatch {
  id: string
  pageId: string
  pageIndex: number
  snippet: string
  text: string
  /** PDF-space rectangles for every line/word fragment covered by the match. */
  rects: Rect[]
}

export interface SearchScrollRequest {
  matchId: string
  nonce: number
}

export interface Notice {
  id: string
  tone: NoticeTone
  message: string
}

export interface PdfSource {
  bytes: Uint8Array
  pdf: PDFDocumentProxy
}

export const EMPTY_META: DocumentMeta = {
  title: '',
  author: '',
  subject: '',
  keywords: '',
}

export const ANNOTATION_LABELS: Record<Annotation['type'], string> = {
  text: 'Text',
  highlight: 'Highlight',
  rectangle: 'Rectangle',
  ink: 'Drawing',
  image: 'Image',
  redaction: 'Redaction',
}
