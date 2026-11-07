# QA report

Date: 2026-11-06

## Automated checks

| Check | Command | Result |
| --- | --- | --- |
| Type-check + production build | `npm run build` | Pass |
| Export regression tests | `npm test` | 9/9 pass |
| Lint | `npm run lint` | Pass (9 React `set-state-in-effect` warnings) |
| Production Lighthouse | Preview server at `http://127.0.0.1:4173` | Accessibility 100, Best Practices 100, SEO 100 |

### Test coverage

`tests/exportPdf.test.ts` verifies:

1. Original metadata and page rotations are preserved through export.
2. Flattened text annotations are present in extracted text.
3. Duplicated pages remain independent (regression for pdf-lib sharing page objects when duplicate source indices are copied in one call).
4. Reordered and deleted pages export in the requested order.
5. Text, checkbox, radio, dropdown, and option-list form values are written into the exported AcroForm.
6. Form flattening removes interactive fields.
7. Image annotations are embedded as PDF image objects.
8. OCR words are embedded as an invisible text layer and remain extractable.
9. Redacted pages are replaced by an image, with source text removed from extraction.
10. Export stops if a redacted page lacks a rasterized replacement.

## Browser smoke tests

Performed in the in-app Chromium browser against both the Vite dev server and the production preview build.

| Flow | Result |
| --- | --- |
| Empty state renders | Pass |
| Load bundled sample PDF | Pass |
| PDF.js canvas renders real page pixels | Pass |
| Thumbnails render | Pass |
| Add a text box inline | Pass |
| Edit text and commit on blur | Pass |
| Highlight drag creation | Pass |
| Rectangle drag creation | Pass |
| Freehand ink creation | Pass |
| Select/move annotation logic | Pass |
| Duplicate page | Pass |
| Rotate page | Pass |
| Reorder/delete page actions exposed | Pass |
| Undo / redo | Pass |
| Search returns snippets and page results | Pass |
| Load fillable form sample | Pass |
| Detect and render text, checkbox, radio, dropdown, and option-list fields | Pass |
| Fill form fields and export | Pass |
| Reopen exported form and read values with pdf-lib | Pass |
| Form values survive undo | Pass |
| Insert PNG image into the page | Pass |
| Select inserted image and edit width/height/opacity controls | Pass |
| Export image annotation and detect an image draw operator | Pass |
| Run OCR on a page and see the OCR text layer count in Document inspector | Pass |
| Export OCR'd PDF and extract OCR words from the invisible layer | Pass |
| Draw a redaction box and export | Pass |
| Verify redacted page has no extractable source text and contains an image draw | Pass |
| Save session, reload browser, reopen same file, restore edits | Pass |
| Export PDF download | Pass |
| Reopen exported PDF and extract text | Pass |
| Exported page count and rotations match editor state | Pass |
| Console errors during normal flow | None observed |
| Lighthouse accessibility | 100 on production build |

## Export round-trip evidence

A 3-page sample was opened, annotated, duplicated (4 pages), and rotated. The downloaded PDF was inspected with `scripts/verify-export.mjs`:

- Page count: 4
- Rotations: `[90, 0, 0, 0]`
- Title/author preserved
- Annotation text present exactly once per annotated page
- Source page text preserved
- Duplicate pages did not leak annotations into each other after the per-page copy fix

## Fixes made during QA

- Removed an unsupported PDF.js `isEvalSupported` option for pdfjs-dist 6.5.
- Replaced a removed `PDFDocumentProxy.destroy()` call with loading-task cleanup.
- Narrowed repeated `getKeywords()` access in the export path.
- Fixed pdf-lib duplicate-page copy behavior by copying pages one at a time.
- Ensured annotation property sliders commit one history entry instead of reverting the transient value.
- Seeded first-page/thumbnail rendering so a hidden or observer-delayed tab still paints.
- Raised the `faint` token contrast to pass WCAG AA and added valid `robots.txt`.
- Added sample PDF generation and PDF verification scripts.
- Fixed native file-picker opening: the change handler reset the file input before reading the live `FileList`, which emptied it in real browser selection. It now captures the `File` first. Verified with a real `FileList` and a dispatched picker change event.
- Added AcroForm extraction, page overlays, value normalization, undo history, and pdf-lib export for text/checkbox/radio/dropdown/option-list fields.
- Added PNG/JPEG/WebP image insertion, normalization, rendering, inspector sizing, local recovery, and pdf-lib embedding.
- Added fillable form sample (`public/form-sample.pdf`) and form screenshot.
- Fixed transient form/annotation history so one undo reverts the whole edit instead of producing a no-op entry.
- Added Tesseract.js OCR with current/all-page scope, language selection, progress, invisible PDF text layer, and search integration.
- Added destructive redaction: redaction tool, page rasterization with burned-in black boxes, export replacement, and source-text removal verification.
- Added dedicated OCR dialog, command-palette action, and Document inspector entry points.

## Known warnings and non-blocking issues

- The production JS bundle is roughly 1.24 MB minified (420 KB gzip). PDF.js and pdf-lib dominate. Code splitting is a future optimization.
- `oxlint` reports React `set-state-in-effect` warnings in observer-driven lazy-render and search components. These are intentional synchronization effects, not build failures.
- Full Playwright cross-browser E2E coverage is a later phase; this milestone uses Vitest plus targeted browser smoke tests.
- The in-app browser's viewport was 1232×825 for smoke testing; desktop layout was exercised. Mobile shows a dedicated notice.
