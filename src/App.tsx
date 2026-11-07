import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileUp, LoaderCircle } from 'lucide-react'
import { useEditorStore } from './store/editorStore'
import { CommandPalette } from './components/CommandPalette'
import { EmptyState } from './components/EmptyState'
import { PasswordDialog } from './components/PasswordDialog'
import { RecoveryBanner } from './components/RecoveryBanner'
import { Toast } from './components/Toast'
import { PdfWorkspace } from './components/editor/PdfWorkspace'
import { LeftSidebar } from './components/shell/LeftSidebar'
import { MobileNotice } from './components/shell/MobileNotice'
import { RightInspector } from './components/shell/RightInspector'
import { StatusBar } from './components/shell/StatusBar'
import { ToolRail } from './components/shell/ToolRail'
import { TopBar } from './components/shell/TopBar'
import { isEditableTarget } from './components/ui/utils'

function LoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(233,232,227,0.76)]"
    >
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-panel">
        <LoaderCircle size={18} strokeWidth={1.8} className="animate-spin text-accent-500" />
        <div>
          <p className="text-[12px] font-medium text-ink">Opening document…</p>
          <p className="mt-0.5 text-[10px] text-muted">Reading pages locally</p>
        </div>
      </div>
    </div>
  )
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-[rgba(24,24,23,0.14)] px-6">
      <div className="animate-scale-in flex w-full max-w-[420px] flex-col items-center rounded-2xl border-2 border-dashed border-accent-400 bg-surface px-8 py-10 shadow-float">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <FileUp size={22} strokeWidth={1.7} />
        </div>
        <p className="mt-3 text-[14px] font-semibold text-ink">Drop your PDF to open</p>
        <p className="mt-1 text-[10.5px] text-muted">
          We&apos;ll keep it on this device.
        </p>
      </div>
    </div>
  )
}

function App() {
  const fileName = useEditorStore((state) => state.fileName)
  const status = useEditorStore((state) => state.status)
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen)
  const inspectorOpen = useEditorStore((state) => state.inspectorOpen)
  const passwordRequired = useEditorStore((state) => state.passwordRequired)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [formSampleLoading, setFormSampleLoading] = useState(false)

  const hasDocument = Boolean(fileName)

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFiles = useCallback((files: FileList | File[]) => {
    const file = Array.from(files)[0]
    if (!file) return
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if (!isPdf) {
      useEditorStore
        .getState()
        .notify('Choose a PDF file. Paperline can only open documents ending in .pdf.', 'error')
      return
    }
    void useEditorStore.getState().openFile(file)
  }, [])

  const handleTrySample = useCallback(async () => {
    setSampleLoading(true)
    try {
      const response = await fetch('/sample.pdf', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'The sample PDF is not available yet. Open your own PDF instead.'
            : 'The sample PDF could not be loaded. Try opening your own PDF.',
        )
      }
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('The sample PDF is empty. Try opening your own PDF instead.')
      }
      const header = new Uint8Array(buffer.slice(0, 5))
      const isPdf =
        header[0] === 0x25 &&
        header[1] === 0x50 &&
        header[2] === 0x44 &&
        header[3] === 0x46
      if (!isPdf) {
        throw new Error(
          'The sample PDF is not available yet. Open your own PDF instead.',
        )
      }
      const file = new File([buffer], 'paperline-sample.pdf', { type: 'application/pdf' })
      await useEditorStore.getState().openFile(file)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The sample PDF could not be loaded.'
      useEditorStore.getState().notify(message, 'error')
    } finally {
      setSampleLoading(false)
    }
  }, [])

  const handleTryFormSample = useCallback(async () => {
    setFormSampleLoading(true)
    try {
      const response = await fetch('/form-sample.pdf', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'The form sample is not available yet. Open your own PDF instead.'
            : 'The form sample could not be loaded. Try opening your own PDF.',
        )
      }
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength === 0) {
        throw new Error('The form sample is empty. Try opening your own PDF instead.')
      }
      const header = new Uint8Array(buffer.slice(0, 5))
      const isPdf =
        header[0] === 0x25 &&
        header[1] === 0x50 &&
        header[2] === 0x44 &&
        header[3] === 0x46
      if (!isPdf) {
        throw new Error(
          'The form sample is not available yet. Open your own PDF instead.',
        )
      }
      const file = new File([buffer], 'paperline-form-sample.pdf', {
        type: 'application/pdf',
      })
      await useEditorStore.getState().openFile(file)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The form sample could not be loaded.'
      useEditorStore.getState().notify(message, 'error')
    } finally {
      setFormSampleLoading(false)
    }
  }, [])

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    // FileList is live. Capture the File before resetting the input value,
    // otherwise the list can be emptied before the opener sees it.
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) handleFiles([file])
  }

  useEffect(() => {
    document.title = fileName ? `${fileName} — Paperline` : 'Paperline — PDF editor'
  }, [fileName])

  useEffect(() => {
    const compactQuery = window.matchMedia('(max-width: 1099px)')
    const narrowQuery = window.matchMedia('(max-width: 899px)')
    const collapseInspector = () => {
      const state = useEditorStore.getState()
      if (state.inspectorOpen) state.toggleInspector()
    }
    const collapseSidebar = () => {
      const state = useEditorStore.getState()
      if (state.sidebarOpen) state.toggleSidebar()
    }
    if (compactQuery.matches) collapseInspector()
    if (narrowQuery.matches) collapseSidebar()

    const handleCompact = (event: MediaQueryListEvent) => {
      if (event.matches) collapseInspector()
    }
    const handleNarrow = (event: MediaQueryListEvent) => {
      if (event.matches) {
        collapseInspector()
        collapseSidebar()
      }
    }
    compactQuery.addEventListener('change', handleCompact)
    narrowQuery.addEventListener('change', handleNarrow)
    return () => {
      compactQuery.removeEventListener('change', handleCompact)
      narrowQuery.removeEventListener('change', handleNarrow)
    }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(max-width: 1099px)').matches) {
      const state = useEditorStore.getState()
      if (state.inspectorOpen) state.toggleInspector()
    }
    if (window.matchMedia('(max-width: 899px)').matches) {
      const state = useEditorStore.getState()
      if (state.sidebarOpen) state.toggleSidebar()
    }
  }, [fileName])

  useEffect(() => {
    let dragDepth = 0
    let trackingFileDrag = false

    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      trackingFileDrag = true
      dragDepth += 1
      setDragActive(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      trackingFileDrag = true
      setDragActive(true)
    }

    const handleDragLeave = () => {
      if (!trackingFileDrag) return
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) {
        trackingFileDrag = false
        setDragActive(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return
      event.preventDefault()
      event.stopImmediatePropagation()
      trackingFileDrag = false
      dragDepth = 0
      setDragActive(false)
      handleFiles(files)
    }

    const handleDragEnd = () => {
      trackingFileDrag = false
      dragDepth = 0
      setDragActive(false)
    }

    window.addEventListener('dragenter', handleDragEnter, true)
    window.addEventListener('dragover', handleDragOver, true)
    window.addEventListener('dragleave', handleDragLeave, true)
    window.addEventListener('drop', handleDrop, true)
    window.addEventListener('dragend', handleDragEnd, true)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter, true)
      window.removeEventListener('dragover', handleDragOver, true)
      window.removeEventListener('dragleave', handleDragLeave, true)
      window.removeEventListener('drop', handleDrop, true)
      window.removeEventListener('dragend', handleDragEnd, true)
    }
  }, [handleFiles])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useEditorStore.getState()
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const claim = () => {
        event.preventDefault()
        event.stopImmediatePropagation()
      }

      if (state.passwordRequired) {
        if (event.key === 'Escape') {
          claim()
          state.cancelPassword()
        }
        return
      }

      if (state.commandOpen) {
        if (event.key === 'Escape' || (modifier && key === 'k')) {
          claim()
          state.setCommandOpen(false)
        }
        return
      }

      if (modifier && key === 'o') {
        claim()
        openPicker()
        return
      }

      if (modifier && key === 's') {
        claim()
        if (state.fileName && state.status !== 'exporting' && state.status !== 'loading') {
          void state.exportDocument()
        }
        return
      }

      if (modifier && key === 'k') {
        claim()
        state.setCommandOpen(true)
        return
      }

      const editable = isEditableTarget(event.target)

      if (event.key === 'Escape') {
        if (!editable && state.selectedAnnotationId) {
          claim()
          state.selectAnnotation(null)
        }
        return
      }

      if (editable) return

      if (modifier && key === 'z') {
        claim()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }

      if (modifier && key === 'y') {
        claim()
        state.redo()
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selectedAnnotationId) {
          claim()
          state.deleteSelectedAnnotation()
        }
        return
      }

      if (event.key === '+' || event.key === '=') {
        if (!state.fileName) return
        claim()
        state.zoomIn()
        return
      }

      if (event.key === '-' || event.key === '_') {
        if (!state.fileName) return
        claim()
        state.zoomOut()
        return
      }

      if (modifier || event.altKey) return
      if (!state.fileName) return

      switch (key) {
        case 'v':
          claim()
          state.setTool('select')
          break
        case 't':
          claim()
          state.setTool('text')
          break
        case 'h':
          claim()
          state.setTool('highlight')
          break
        case 'r':
          claim()
          state.setTool('rectangle')
          break
        case 'p':
          claim()
          state.setTool('ink')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [openPicker])

  return (
    <>
      <div className="hidden h-full w-full flex-col overflow-hidden bg-canvas md:flex">
        <TopBar onOpen={openPicker} />

        <div className="flex min-h-0 flex-1">
          <ToolRail />
          {sidebarOpen ? <LeftSidebar /> : null}

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
            <div className="relative min-h-0 flex-1">
              {hasDocument ? (
                <PdfWorkspace />
              ) : (
                <EmptyState
                  onOpen={openPicker}
                  onTrySample={() => void handleTrySample()}
                  onTryFormSample={() => void handleTryFormSample()}
                  sampleLoading={sampleLoading}
                  formSampleLoading={formSampleLoading}
                />
              )}
              <RecoveryBanner />
              {status === 'loading' ? <LoadingOverlay /> : null}
            </div>
          </main>

          {inspectorOpen ? <RightInspector /> : null}
        </div>

        <StatusBar />
      </div>

      <MobileNotice fileName={fileName} />

      {dragActive ? <DropOverlay /> : null}

      <Toast />
      {passwordRequired ? <PasswordDialog /> : null}
      <CommandPalette onOpen={openPicker} />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={handleFileInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  )
}

export default App
