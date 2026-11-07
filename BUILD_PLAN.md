# Paperline build plan and file ownership

## Product

Local-first, production-feeling browser PDF editor. Open a real PDF, view it,
annotate it, rotate/reorder/delete pages, and export a valid PDF where edits are
baked in.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 3 + custom design tokens in `src/index.css`
- PDF.js for rendering (`src/lib/pdfjs.ts`)
- pdf-lib for export (`src/lib/exportPdf.ts`)
- Zustand store (`src/store/editorStore.ts`)
- LocalStorage session recovery

## Shared contracts

- Types: `src/types/editor.ts`
- Store: `src/store/editorStore.ts`
- PDF.js loader: `src/lib/pdfjs.ts`
- Export: `src/lib/exportPdf.ts`
- Download helper: `src/lib/download.ts`

Annotations are stored in PDF user space (points, origin bottom-left). The
viewer converts them through the PDF.js viewport so zoom and page rotation are
handled correctly.

## Workstream ownership

### UI shell agent

Owns:

- `src/App.tsx`
- `src/App.css` (replace or delete usage)
- `src/components/shell/**`
- `src/components/EmptyState.tsx`
- `src/components/PasswordDialog.tsx`
- `src/components/RecoveryBanner.tsx`
- `src/components/Toast.tsx`
- `src/components/CommandPalette.tsx`
- `src/components/ui/**`
- additive changes to `src/index.css`

Must not edit:

- `src/store/editorStore.ts`
- `src/types/editor.ts`
- `src/lib/**`
- `src/components/editor/**`
- `package.json`

### PDF engine agent

Owns:

- `src/components/editor/PdfWorkspace.tsx`
- `src/components/editor/PageCanvas.tsx`
- `src/components/editor/AnnotationLayer.tsx`
- `src/components/editor/Thumbnails.tsx`
- `src/components/editor/OutlinePanel.tsx`
- `src/components/editor/SearchPanel.tsx`
- `src/components/editor/TextAnnotationEditor.tsx`
- `src/lib/search.ts`
- `src/lib/geometry.ts`

Must not edit:

- `src/App.tsx`
- `src/components/shell/**`
- `src/store/editorStore.ts`
- `src/types/editor.ts`
- `src/lib/exportPdf.ts`
- `package.json`

### Integration / QA agent

Owns:

- build fixes across files
- `README.md`
- `FEATURE_MATRIX.md`
- `KNOWN_LIMITATIONS.md`
- tests and fixture notes

## Current milestone status

Shipped: local PDF open/render, zoom/fit, thumbnails, outline, search,
text/highlight/rectangle/ink/image annotations, select/move, fillable AcroForm
fields (text, checkbox, radio, dropdown, option list), optional form flattening,
OCR with an invisible searchable text layer, destructive page-raster redaction,
page rotate/duplicate/reorder/delete, undo/redo, local session recovery, metadata
editing, PDF export, sample documents, command palette, premium shell, and 9
export regression tests.

Documented gaps: existing text editing, form creation, digital signatures,
merge/split/crop, encrypted-PDF export, cloud collaboration.
See `FEATURE_MATRIX.md`, `KNOWN_LIMITATIONS.md`, and `QA_REPORT.md`.

## Definition of done for this milestone

1. App builds and runs.
2. User can open a PDF via picker, drag/drop, or sample.
3. Pages render sharply; zoom, page navigation, rotation, thumbnails work.
4. User can add text, highlight, rectangle, and ink annotations.
5. User can reorder, duplicate, rotate, and delete pages.
6. Undo/redo works for edits and page operations.
7. Export downloads a valid PDF with annotations flattened and page changes applied.
8. Session recovery banner restores local edits for the same file.
9. Premium shell: top bar, tool rail, left sidebar, canvas, inspector, status bar.
10. Known limitations are honest and documented.
