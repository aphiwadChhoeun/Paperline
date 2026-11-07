import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }
export type { PDFDocumentProxy }

export interface LoadPdfOptions {
  password?: string
}

export function isPasswordError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'PasswordException'
  )
}

export async function loadPdfDocument(
  data: Uint8Array,
  options: LoadPdfOptions = {},
): Promise<PDFDocumentProxy> {
  const task = pdfjsLib.getDocument({
    data,
    password: options.password,
    useSystemFonts: true,
  })
  return task.promise
}
