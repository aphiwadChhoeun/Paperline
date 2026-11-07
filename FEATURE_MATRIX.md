# Feature matrix

Status legend: **Shipped** = works end to end; **Partial** = works with a documented constraint; **Not yet** = intentionally not exposed in this build.

## Document intake

| Capability | Status | Notes |
| --- | --- | --- |
| Open local PDF via file picker | Shipped | Accepts `.pdf` / `application/pdf`; selected files are captured before the input is reset. |
| Drag-and-drop PDF | Shipped | Window-level drop overlay. |
| Bundled sample document | Shipped | `public/sample.pdf` and fillable `public/form-sample.pdf`. |
| Password-protected PDF viewing | Shipped | Password dialog and retry. Export is disabled because pdf-lib cannot decrypt. |
| Multi-document tabs | Not yet | One document at a time. |
| Recent files library | Partial | Same-file edit recovery, not a full recent-files library. |

## Viewing and navigation

| Capability | Status | Notes |
| --- | --- | --- |
| PDF.js rendering with DPR-aware canvas | Shipped | Cancellable, lazy page rendering. |
| Continuous page stack | Shipped | Active page tracking via IntersectionObserver. |
| Zoom in/out and reset | Shipped | 10%–800%. |
| Fit width / fit page | Shipped | Fit width is based on the active page for mixed-size documents. |
| Page rotation | Shipped | 0/90/180/270, reflected in viewer and export. |
| Page thumbnails | Shipped | Lazy rendering, rotation, duplicate, delete, drag reorder. |
| Outline/bookmark navigation | Shipped | Nested outline with destination resolution. |
| Full-document search | Shipped | Debounced, abortable, result snippets, page navigation, on-page match highlights; includes OCR text layers. |
| Text selection and copy | Not yet | No PDF.js text layer in this milestone. |
| Link navigation | Partial | Links are preserved by pdf-lib's page copy where possible, but not interactively exposed. |

## Editing

| Capability | Status | Notes |
| --- | --- | --- |
| Add text box | Shipped | Inline editor plus inspector controls. |
| Edit existing PDF text runs | Not yet | Requires a content-stream editor or licensed engine; not faked with overlays. |
| Text font/size/color/alignment/opacity | Shipped | Helvetica, Times, Courier on export. |
| Highlight | Shipped | Drag to create, color and opacity controls. |
| Rectangle shape | Shipped | Drag to create, stroke/fill controls. |
| Freehand ink | Shipped | Pointer sampling and smoothed SVG preview. |
| Select and move annotations | Shipped | Selected annotations can be dragged. |
| Resize annotations with handles | Not yet | Handles are visual only; inspector changes size/style. |
| Delete annotations | Shipped | Delete key, inspector button, undoable. |
| Insert images | Shipped | PNG/JPEG/WebP, downscaled locally, moved and sized via the inspector, embedded on export. |
| Redaction | Shipped | Drag redaction boxes; affected pages are rasterized with the marks burned in, removing source text/images. |
| OCR | Shipped | Current page or all pages, language selection, invisible searchable text layer, in-app search integration. |
| Digital signature | Not yet | No cryptographic signing. |
| Page reorder | Shipped | Thumbnail drag-and-drop. |
| Page duplicate | Shipped | Deep copies annotations with independent page IDs. |
| Page delete | Shipped | Blocked when only one page remains. |
| Insert blank page / insert from PDF | Not yet | Not exposed. |
| Merge / split / extract | Not yet | Not exposed. |
| Crop / resize pages | Not yet | Not exposed. |
| AcroForm fill | Shipped | Existing text, multiline text, checkboxes, radio groups, dropdowns, and option lists. |
| AcroForm create | Not yet | No form designer. |
| Form flattening | Shipped | Optional toggle in the Document inspector. |

## Document properties and output

| Capability | Status | Notes |
| --- | --- | --- |
| Edit title/author/subject/keywords | Shipped | Applied on export. |
| Undo / redo | Shipped | Covers annotations, form values, and page operations. |
| Autosave and same-file recovery | Shipped | `localStorage` keyed by name, size, and modified time. |
| Export PDF | Shipped | Valid PDF, annotations flattened, form values written, OCR layers embedded, redacted pages replaced, page order/rotation applied. |
| Flatten annotations | Shipped | Export always flattens annotations into page content. |
| Flatten form fields | Shipped | Optional; values are baked into page content. |
| Embed images | Shipped | Image annotations are embedded as PDF image objects. |
| Invisible OCR text layer | Shipped | Hidden text survives in exported PDF and is text-extractable. |
| Destructive redaction | Shipped | Redacted pages become images; original page text is not extractable. |
| Preserve untouched content | Shipped | In-place path when page order is unchanged. |
| Preserve bookmarks/forms on page reorganization | Partial | Page copy can drop document-level structures; see limitations. |
| Password-protect export | Not yet | Not exposed. |
| Encrypted PDF export | Not yet | View-only; export button is disabled. |
| Compress/optimize | Not yet | Not exposed. |
| Export pages as images | Not yet | Not exposed. |
| Print | Not yet | No dedicated print workflow. |
| PDF/A | Not yet | Not exposed. |
| Compare documents | Not yet | Not exposed. |

## Interface and platform

| Capability | Status | Notes |
| --- | --- | --- |
| Premium desktop editor shell | Shipped | Top bar, tool rail, navigator, inspector, status bar. |
| Command palette | Shipped | Cmd/Ctrl+K. |
| Keyboard shortcuts | Shipped | Tools, undo/redo, export, open, zoom, page navigation. |
| Accessible labels and focus states | Shipped | Production Lighthouse accessibility 100. |
| Reduced-motion support | Shipped | CSS media query. |
| Mobile editing | Not yet | Clear mobile notice; desktop-first. |
| Dark theme | Not yet | Light theme only. |
| Real-time collaboration | Not yet | Local-first. |
| Cloud storage | Not yet | No backend. |
| Automated export tests | Shipped | 9 Vitest regression tests. |

## Quality gates

| Gate | Status |
| --- | --- |
| `npm run build` | Pass |
| `npm test` | Pass (9 tests) |
| `npm run lint` | Pass with React effect warnings |
| Browser smoke test | Pass |
| Export reopen verification | Pass |
| Duplicate-page regression | Pass |
| Session recovery test | Pass |
