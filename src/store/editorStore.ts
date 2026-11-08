import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { createId } from '../lib/id'
import { isPasswordError, loadPdfDocument } from '../lib/pdfjs'
import { buildExportBytes } from '../lib/exportPdf'
import { extractFormFields } from '../lib/forms'
import { ocrPages } from '../lib/ocr'
import { renderRedactedPages } from '../lib/redact'
import { downloadBytes, outputFileName } from '../lib/download'
import {
  EMPTY_META,
  type Annotation,
  type DocumentMeta,
  type EditorSnapshot,
  type FontFamily,
  type FormField,
  type FormValue,
  type FormValues,
  type HighlightAnnotation,
  type ImageAnnotation,
  type InkAnnotation,
  type InspectorTab,
  type Notice,
  type PageState,
  type Point,
  type Rect,
  type RectangleAnnotation,
  type RedactionAnnotation,
  type SearchMatch,
  type SearchScrollRequest,
  type SessionSnapshot,
  type SidebarTab,
  type TextAlign,
  type TextAnnotation,
  type Tool,
} from '../types/editor'

export type NewAnnotation =
  | Omit<TextAnnotation, 'id' | 'createdAt'>
  | Omit<HighlightAnnotation, 'id' | 'createdAt'>
  | Omit<RectangleAnnotation, 'id' | 'createdAt'>
  | Omit<InkAnnotation, 'id' | 'createdAt'>
  | Omit<ImageAnnotation, 'id' | 'createdAt'>
  | Omit<RedactionAnnotation, 'id' | 'createdAt'>

export interface AnnotationPatch {
  text?: string
  fontSize?: number
  fontFamily?: FontFamily
  color?: string
  align?: TextAlign
  rect?: Rect
  opacity?: number
  fillColor?: string | null
  strokeWidth?: number
  points?: Point[]
}

interface EditorState {
  fileName: string | null
  fileSize: number
  fileLastModified: number
  originalBytes: Uint8Array | null
  pdf: PDFDocumentProxy | null
  numPages: number
  pages: PageState[]
  metadata: DocumentMeta
  formFields: FormField[]
  formValues: FormValues
  flattenForms: boolean
  currentPageId: string | null
  selectedPageId: string | null
  selectedAnnotationId: string | null

  tool: Tool
  zoom: number
  fitMode: 'none' | 'width' | 'page'
  sidebarTab: SidebarTab
  inspectorTab: InspectorTab
  sidebarOpen: boolean
  inspectorOpen: boolean
  commandOpen: boolean

  status: 'idle' | 'loading' | 'ready' | 'exporting' | 'error'
  error: string | null
  isEncrypted: boolean
  isDirty: boolean
  isSaving: boolean
  passwordRequired: boolean
  passwordError: string | null
  pendingFile: File | null
  recoverableSession: SessionSnapshot | null
  notice: Notice | null
  searchMatches: SearchMatch[]
  activeSearchMatchId: string | null
  searchScrollRequest: SearchScrollRequest | null
  ocrOpen: boolean
  ocrStatus: 'idle' | 'running' | 'done' | 'error'
  ocrProgress: number
  ocrMessage: string
  ocrError: string | null

  past: EditorSnapshot[]
  future: EditorSnapshot[]
  pendingSnapshot: EditorSnapshot | null

  openFile: (file: File, password?: string) => Promise<void>
  submitPassword: (password: string) => Promise<void>
  cancelPassword: () => void
  closeDocument: () => void
  restoreSession: () => void
  dismissRecovery: () => void

  setTool: (tool: Tool) => void
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  setFitMode: (mode: 'none' | 'width' | 'page') => void
  setCurrentPageId: (id: string) => void
  setSelectedPageId: (id: string) => void
  selectAnnotation: (id: string | null) => void
  setSidebarTab: (tab: SidebarTab) => void
  setInspectorTab: (tab: InspectorTab) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setCommandOpen: (open: boolean) => void

  addAnnotation: (annotation: NewAnnotation) => Annotation
  updateAnnotation: (id: string, patch: AnnotationPatch, recordHistory?: boolean) => void
  deleteAnnotation: (id: string) => void
  deleteSelectedAnnotation: () => void

  updateFormValue: (fieldName: string, value: FormValue, recordHistory?: boolean) => void
  commitTransient: () => void
  setFlattenForms: (flatten: boolean) => void
  setOcrOpen: (open: boolean) => void
  runOcr: (pageIds: string[], language: string) => Promise<void>
  setSearchMatches: (matches: SearchMatch[]) => void
  setActiveSearchMatch: (id: string | null) => void
  focusSearchMatch: (id: string) => void
  clearSearchHighlights: () => void

  rotatePage: (pageId: string, delta: number) => void
  setPageRotation: (pageId: string, rotation: number) => void
  deletePage: (pageId: string) => void
  duplicatePage: (pageId: string) => void
  movePage: (fromIndex: number, toIndex: number) => void

  setMetadata: (patch: Partial<DocumentMeta>) => void
  undo: () => void
  redo: () => void
  exportDocument: () => Promise<void>
  notify: (message: string, tone?: Notice['tone']) => void
  dismissNotice: () => void
}

const INITIAL = {
  fileName: null,
  fileSize: 0,
  fileLastModified: 0,
  originalBytes: null,
  pdf: null,
  numPages: 0,
  pages: [] as PageState[],
  metadata: EMPTY_META,
  formFields: [] as FormField[],
  formValues: {} as FormValues,
  flattenForms: false,
  currentPageId: null,
  selectedPageId: null,
  selectedAnnotationId: null,
  tool: 'select' as Tool,
  zoom: 1,
  fitMode: 'width' as const,
  sidebarTab: 'thumbnails' as SidebarTab,
  inspectorTab: 'properties' as InspectorTab,
  sidebarOpen: true,
  inspectorOpen: true,
  commandOpen: false,
  status: 'idle' as const,
  error: null,
  isEncrypted: false,
  isDirty: false,
  isSaving: false,
  passwordRequired: false,
  passwordError: null,
  pendingFile: null,
  recoverableSession: null,
  notice: null,
  searchMatches: [] as SearchMatch[],
  activeSearchMatchId: null,
  searchScrollRequest: null,
  ocrOpen: false,
  ocrStatus: 'idle' as const,
  ocrProgress: 0,
  ocrMessage: '',
  ocrError: null,
  past: [] as EditorSnapshot[],
  future: [] as EditorSnapshot[],
  pendingSnapshot: null as EditorSnapshot | null,
}

const SESSION_PREFIX = 'paperline:session:'
const MAX_HISTORY = 60

function sessionKey(fileName: string, fileSize: number, fileLastModified: number) {
  return `${SESSION_PREFIX}${encodeURIComponent(fileName)}:${fileSize}:${fileLastModified}`
}

function readSession(
  fileName: string,
  fileSize: number,
  fileLastModified: number,
): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(sessionKey(fileName, fileSize, fileLastModified))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionSnapshot
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function writeSession(state: EditorState) {
  if (!state.fileName || state.pages.length === 0) return
  try {
    const snapshot: SessionSnapshot = {
      fileName: state.fileName,
      fileSize: state.fileSize,
      fileLastModified: state.fileLastModified,
      pages: state.pages,
      formValues: state.formValues,
      flattenForms: state.flattenForms,
      savedAt: Date.now(),
    }
    localStorage.setItem(
      sessionKey(state.fileName, state.fileSize, state.fileLastModified),
      JSON.stringify(snapshot),
    )
  } catch {
    // Storage can be unavailable in private mode. Editing must still work.
  }
}

function clonePages(pages: PageState[]): PageState[] {
  return structuredClone(pages)
}

function cloneFormValues(values: FormValues): FormValues {
  return structuredClone(values)
}

function snapshot(state: Pick<EditorState, 'pages' | 'formValues'>): EditorSnapshot {
  return {
    pages: clonePages(state.pages),
    formValues: cloneFormValues(state.formValues),
  }
}

function normalizeRotation(value: number): number {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360
}

function metaFromPdf(info: Record<string, unknown> | undefined): DocumentMeta {
  return {
    title: typeof info?.Title === 'string' ? info.Title : '',
    author: typeof info?.Author === 'string' ? info.Author : '',
    subject: typeof info?.Subject === 'string' ? info.Subject : '',
    keywords: typeof info?.Keywords === 'string' ? info.Keywords : '',
  }
}

function findAnnotation(pages: PageState[], id: string): { page: PageState; annotation: Annotation } | null {
  for (const page of pages) {
    const annotation = page.annotations.find((item) => item.id === id)
    if (annotation) return { page, annotation }
  }
  return null
}

export const useEditorStore = create<EditorState>((set, get) => {
  const commitPages = (next: PageState[], markDirty = true) => {
    const state = get()
    const previous = snapshot(state)
    set({
      pages: next,
      past: [...state.past, previous].slice(-MAX_HISTORY),
      future: [],
      pendingSnapshot: null,
      isDirty: markDirty ? true : state.isDirty,
    })
    writeSession(get())
  }

  const commitFormValues = (next: FormValues, markDirty = true) => {
    const state = get()
    const previous = snapshot(state)
    set({
      formValues: next,
      past: [...state.past, previous].slice(-MAX_HISTORY),
      future: [],
      pendingSnapshot: null,
      isDirty: markDirty ? true : state.isDirty,
    })
    writeSession(get())
  }

  const notify = (message: string, tone: Notice['tone'] = 'info') => {
    set({ notice: { id: createId('notice'), message, tone } })
  }

  return {
    ...INITIAL,

    openFile: async (file, password) => {
      set({
        status: 'loading',
        error: null,
        notice: null,
        passwordError: null,
      })
      try {
        const original = new Uint8Array(await file.arrayBuffer())
        let pdf: PDFDocumentProxy
        try {
          pdf = await loadPdfDocument(original.slice(), { password })
        } catch (error) {
          if (isPasswordError(error)) {
            set({
              status: 'idle',
              pendingFile: file,
              passwordRequired: true,
              passwordError: password ? 'That password did not work. Try again.' : null,
            })
            return
          }
          throw error
        }

        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, async (_, sourceIndex) => {
            const page = await pdf.getPage(sourceIndex + 1)
            const viewport = page.getViewport({ scale: 1, rotation: 0 })
            return {
              id: createId('page'),
              sourceIndex,
              width: viewport.width,
              height: viewport.height,
              rotation: normalizeRotation(page.rotate),
              annotations: [],
            } satisfies PageState
          }),
        )

        let info: Record<string, unknown> | undefined
        try {
          const data = await pdf.getMetadata()
          info = data.info as Record<string, unknown> | undefined
        } catch {
          info = undefined
        }

        const forms = await extractFormFields(pdf, pages)
        const recoverable = readSession(file.name, file.size, file.lastModified)
        set({
          ...INITIAL,
          fileName: file.name,
          fileSize: file.size,
          fileLastModified: file.lastModified,
          originalBytes: original,
          pdf,
          numPages: pages.length,
          pages,
          metadata: metaFromPdf(info),
          formFields: forms.fields,
          formValues: forms.values,
          currentPageId: pages[0]?.id ?? null,
          selectedPageId: pages[0]?.id ?? null,
          status: 'ready',
          isEncrypted: Boolean(password),
          fitMode: 'width',
          zoom: 1,
          recoverableSession: recoverable,
        })
        if (recoverable) {
          notify('Previous edits were found for this document. Restore them from the banner.')
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'This PDF could not be opened.'
        set({ status: 'error', error: message, pendingFile: null })
        notify(message, 'error')
      }
    },

    submitPassword: async (password) => {
      const file = get().pendingFile
      if (!file) return
      await get().openFile(file, password)
    },

    cancelPassword: () => {
      set({ passwordRequired: false, passwordError: null, pendingFile: null, status: 'idle' })
    },

    closeDocument: () => {
      const current = get().pdf
      if (current) {
        void current.loadingTask.destroy()
      }
      set({ ...INITIAL })
    },

    restoreSession: () => {
      const snapshot = get().recoverableSession
      if (!snapshot || snapshot.pages.length === 0) return
      set({
        pages: clonePages(snapshot.pages),
        formValues: {
          ...cloneFormValues(get().formValues),
          ...cloneFormValues(snapshot.formValues ?? {}),
        },
        flattenForms: snapshot.flattenForms ?? get().flattenForms,
        currentPageId: snapshot.pages[0]?.id ?? null,
        selectedPageId: snapshot.pages[0]?.id ?? null,
        selectedAnnotationId: null,
        past: [],
        future: [],
        pendingSnapshot: null,
        isDirty: true,
        recoverableSession: null,
      })
      writeSession(get())
      notify('Previous edits restored.', 'success')
    },

    dismissRecovery: () => set({ recoverableSession: null }),

    setTool: (tool) => set({ tool, selectedAnnotationId: null }),

    setZoom: (zoom) => set({ zoom: Math.min(8, Math.max(0.1, zoom)), fitMode: 'none' }),
    zoomIn: () => set((state) => ({ zoom: Math.min(8, state.zoom * 1.15), fitMode: 'none' })),
    zoomOut: () => set((state) => ({ zoom: Math.max(0.1, state.zoom / 1.15), fitMode: 'none' })),
    setFitMode: (fitMode) => set({ fitMode }),

    setCurrentPageId: (id) => set({ currentPageId: id, selectedPageId: id }),
    setSelectedPageId: (id) => set({ selectedPageId: id }),

    selectAnnotation: (id) => {
      if (!id) {
        set({ selectedAnnotationId: null })
        return
      }
      const found = findAnnotation(get().pages, id)
      set({
        selectedAnnotationId: id,
        selectedPageId: found?.page.id ?? get().selectedPageId,
        currentPageId: found?.page.id ?? get().currentPageId,
        tool: 'select',
        inspectorTab: 'properties',
      })
    },

    setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
    setInspectorTab: (inspectorTab) => set({ inspectorTab, inspectorOpen: true }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleInspector: () => set((state) => ({ inspectorOpen: !state.inspectorOpen })),
    setCommandOpen: (commandOpen) => set({ commandOpen }),

    addAnnotation: (input) => {
      const annotation = {
        ...input,
        id: createId('annotation'),
        createdAt: Date.now(),
      } as Annotation
      const pages = clonePages(get().pages)
      const page = pages.find((item) => item.id === annotation.pageId)
      if (!page) return annotation
      page.annotations.push(annotation)
      if (annotation.type === 'redaction') {
        // Never let an OCR text layer reintroduce redacted content.
        page.ocr = null
      }
      commitPages(pages)
      set({ selectedAnnotationId: annotation.id, inspectorTab: 'properties' })
      return annotation
    },

    updateAnnotation: (id, patch, recordHistory = true) => {
      const currentPages = get().pages
      const found = findAnnotation(currentPages, id)
      if (!found) return
      if (recordHistory) {
        const pages = clonePages(currentPages)
        const target = findAnnotation(pages, id)
        if (!target) return
        Object.assign(target.annotation, patch)
        commitPages(pages)
      } else {
        const pages = currentPages.map((page) =>
          page.id === found.page.id
            ? {
                ...page,
                annotations: page.annotations.map((annotation) =>
                  annotation.id === id ? ({ ...annotation, ...patch } as Annotation) : annotation,
                ),
              }
            : page,
        )
        set({
          pages,
          pendingSnapshot: get().pendingSnapshot ?? snapshot(get()),
          isDirty: true,
        })
      }
    },

    deleteAnnotation: (id) => {
      const pages = clonePages(get().pages)
      for (const page of pages) {
        page.annotations = page.annotations.filter((annotation) => annotation.id !== id)
      }
      commitPages(pages)
      set({ selectedAnnotationId: null })
    },

    deleteSelectedAnnotation: () => {
      const id = get().selectedAnnotationId
      if (id) get().deleteAnnotation(id)
    },

    updateFormValue: (fieldName, value, recordHistory = true) => {
      const state = get()
      const next = { ...cloneFormValues(state.formValues), [fieldName]: value }
      if (recordHistory) {
        commitFormValues(next)
      } else {
        set({
          formValues: next,
          pendingSnapshot: get().pendingSnapshot ?? snapshot(get()),
          isDirty: true,
        })
      }
    },

    commitTransient: () => {
      const state = get()
      if (!state.pendingSnapshot) return
      set({
        past: [...state.past, state.pendingSnapshot].slice(-MAX_HISTORY),
        future: [],
        pendingSnapshot: null,
        isDirty: true,
      })
      writeSession(get())
    },

    setFlattenForms: (flattenForms) => {
      set({ flattenForms, isDirty: true })
      writeSession(get())
    },

    setOcrOpen: (ocrOpen) => set({ ocrOpen }),

    runOcr: async (pageIds, language) => {
      const state = get()
      if (!state.pdf || state.ocrStatus === 'running') return
      const targetPages = state.pages.filter((page) => pageIds.includes(page.id))
      if (targetPages.length === 0) return

      set({
        ocrStatus: 'running',
        ocrProgress: 0,
        ocrMessage: 'Preparing OCR…',
        ocrError: null,
      })
      try {
        const results = await ocrPages(
          state.pdf,
          targetPages,
          language,
          (progress) => {
            set({
              ocrProgress: progress.fraction,
              ocrMessage: `${progress.status} · ${progress.page}/${progress.total}`,
            })
          },
          state.originalBytes ?? undefined,
        )
        const pages = clonePages(get().pages)
        for (const result of results) {
          const page = pages.find((item) => item.id === result.pageId)
          if (page) page.ocr = result.layer
        }
        commitPages(pages)
        set({
          ocrStatus: 'done',
          ocrProgress: 1,
          ocrMessage: `Searchable text added to ${results.length} ${
            results.length === 1 ? 'page' : 'pages'
          }.`,
        })
        notify(
          `OCR complete. Searchable text is now available on ${
            results.length === 1 ? 'this page' : 'these pages'
          }.`,
          'success',
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'OCR could not be completed. Check your network connection and try again.'
        set({ ocrStatus: 'error', ocrError: message, ocrMessage: message })
        notify(message, 'error')
      }
    },

    setSearchMatches: (matches) =>
      set({
        searchMatches: matches,
        activeSearchMatchId: matches[0]?.id ?? null,
        searchScrollRequest: null,
      }),

    setActiveSearchMatch: (activeSearchMatchId) => set({ activeSearchMatchId }),

    focusSearchMatch: (id) => {
      const state = get()
      const match = state.searchMatches.find((item) => item.id === id)
      if (!match) return
      set({
        activeSearchMatchId: id,
        currentPageId: match.pageId,
        selectedPageId: match.pageId,
        searchScrollRequest: {
          matchId: id,
          nonce: (state.searchScrollRequest?.nonce ?? 0) + 1,
        },
      })
    },

    clearSearchHighlights: () =>
      set({
        searchMatches: [],
        activeSearchMatchId: null,
        searchScrollRequest: null,
      }),

    rotatePage: (pageId, delta) => {
      const pages = clonePages(get().pages)
      const page = pages.find((item) => item.id === pageId)
      if (!page) return
      page.rotation = normalizeRotation(page.rotation + delta)
      commitPages(pages)
    },

    setPageRotation: (pageId, rotation) => {
      const pages = clonePages(get().pages)
      const page = pages.find((item) => item.id === pageId)
      if (!page) return
      page.rotation = normalizeRotation(rotation)
      commitPages(pages)
    },

    deletePage: (pageId) => {
      const state = get()
      if (state.pages.length <= 1) {
        notify('A document must keep at least one page.', 'error')
        return
      }
      const index = state.pages.findIndex((page) => page.id === pageId)
      if (index < 0) return
      const pages = clonePages(state.pages)
      pages.splice(index, 1)
      const nextCurrent =
        state.currentPageId === pageId
          ? (pages[Math.min(index, pages.length - 1)]?.id ?? null)
          : state.currentPageId
      commitPages(pages)
      set({
        currentPageId: nextCurrent,
        selectedPageId: nextCurrent,
        selectedAnnotationId: null,
      })
    },

    duplicatePage: (pageId) => {
      const pages = clonePages(get().pages)
      const index = pages.findIndex((page) => page.id === pageId)
      if (index < 0) return
      const source = pages[index]
      const copy: PageState = {
        ...structuredClone(source),
        id: createId('page'),
        annotations: source.annotations.map((annotation) => ({
          ...structuredClone(annotation),
          id: createId('annotation'),
          pageId: '',
        })) as Annotation[],
      }
      copy.annotations.forEach((annotation) => {
        annotation.pageId = copy.id
      })
      pages.splice(index + 1, 0, copy)
      commitPages(pages)
      set({ currentPageId: copy.id, selectedPageId: copy.id, selectedAnnotationId: null })
    },

    movePage: (fromIndex, toIndex) => {
      const state = get()
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.pages.length ||
        toIndex >= state.pages.length
      ) {
        return
      }
      const pages = clonePages(state.pages)
      const [moved] = pages.splice(fromIndex, 1)
      pages.splice(toIndex, 0, moved)
      commitPages(pages)
    },

    setMetadata: (patch) => {
      set((state) => ({ metadata: { ...state.metadata, ...patch }, isDirty: true }))
      writeSession(get())
    },

    undo: () => {
      const state = get()
      const previous = state.past[state.past.length - 1]
      if (!previous) return
      set({
        pages: clonePages(previous.pages),
        formValues: cloneFormValues(previous.formValues),
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, MAX_HISTORY),
        currentPageId: previous.pages.some((page) => page.id === state.currentPageId)
          ? state.currentPageId
          : (previous.pages[0]?.id ?? null),
        selectedAnnotationId: null,
        pendingSnapshot: null,
        isDirty: true,
      })
      writeSession(get())
    },

    redo: () => {
      const state = get()
      const next = state.future[0]
      if (!next) return
      set({
        pages: clonePages(next.pages),
        formValues: cloneFormValues(next.formValues),
        future: state.future.slice(1),
        past: [...state.past, snapshot(state)].slice(-MAX_HISTORY),
        currentPageId: next.pages.some((page) => page.id === state.currentPageId)
          ? state.currentPageId
          : (next.pages[0]?.id ?? null),
        selectedAnnotationId: null,
        pendingSnapshot: null,
        isDirty: true,
      })
      writeSession(get())
    },

    exportDocument: async () => {
      const state = get()
      if (!state.originalBytes || state.pages.length === 0) {
        notify('Open a PDF before exporting.', 'error')
        return
      }
      set({ status: 'exporting', isSaving: true, error: null })
      try {
        const hasRedactions = state.pages.some((page) =>
          page.annotations.some((annotation) => annotation.type === 'redaction'),
        )
        const redactedPageImages =
          hasRedactions && state.pdf
            ? await renderRedactedPages(
                state.pdf,
                state.pages,
                state.originalBytes ?? undefined,
              )
            : undefined
        const bytes = await buildExportBytes({
          originalBytes: state.originalBytes,
          pages: state.pages,
          meta: state.metadata,
          formValues: state.formValues,
          flattenForms: state.flattenForms,
          redactedPageImages,
        })
        downloadBytes(bytes, outputFileName(state.fileName))
        set({ status: 'ready', isSaving: false, isDirty: false })
        notify('Your edited PDF is ready.', 'success')
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : 'The PDF could not be exported.'
        const message = /encrypt/i.test(raw)
          ? 'This PDF is password-protected. Viewing works, but encrypted PDF export is not supported in this build.'
          : raw
        set({ status: 'ready', isSaving: false, error: message })
        notify(message, 'error')
      }
    },

    notify,
    dismissNotice: () => set({ notice: null }),
  }
})

export function currentPage(state: EditorState): PageState | null {
  return state.pages.find((page) => page.id === state.currentPageId) ?? state.pages[0] ?? null
}

export function selectedAnnotation(state: EditorState): Annotation | null {
  if (!state.selectedAnnotationId) return null
  return findAnnotation(state.pages, state.selectedAnnotationId)?.annotation ?? null
}
