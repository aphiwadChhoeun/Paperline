# Known limitations

Paperline is honest about what it does not do. These are intentional boundaries, not hidden failures.

## Text editing

- **Existing PDF text cannot be edited in place.** The current engine can add new text boxes, but it does not rewrite arbitrary PDF text runs. True in-place text editing requires a content-stream editor or a licensed engine such as PDFium/MuPDF/Apryse; faking it with a white rectangle would be unsafe and is not implemented.
- Text boxes are flattened on export. They are not editable PDF annotations after export.
- Export supports three standard font families: Helvetica, Times, and Courier. Custom embedded fonts in new text are not supported.
- Screen text wrapping is CSS-approximated. Very long unbroken words can wrap differently on export.
- No text selection/copy layer is rendered over the PDF.

## Page operations

- Duplicated pages are exported by copying one source page at a time. This is correct but can be slower for very large documents with many duplicates.
- Reordering, deleting, or duplicating pages creates a new PDF via page copy. Document-level structures that pdf-lib does not copy, such as some bookmarks, AcroForm definitions, attachments, and page labels, may be lost. When page order is unchanged, Paperline mutates the original document in place to preserve more structure.
- Insert blank page, insert from another PDF, merge, split, extract, crop, and resize are not implemented.
- Page labels and custom page numbering are not editable.

## Security and sensitive content

- **Redaction is destructive but page-wide.** Redacted pages are rasterized to an image with the black boxes burned in, so source text and images on that page cannot be extracted. The trade-off is that the entire page becomes non-selectable and document-level structures on that page (forms, bookmarks, links) are lost.
- Password-protected PDFs can be opened for viewing. Export is disabled because pdf-lib cannot decrypt them.
- Digital signatures and certificate-based signing are not implemented. Editing a signed PDF may invalidate existing signatures.
- No malware scanning, sandboxing beyond the browser process, or server-side validation is performed.

## Forms

- Existing AcroForm fields can be filled: text, multiline text, checkboxes, radio groups, dropdowns, and option lists. Form **creation** is not implemented.
- Form values are written on export through pdf-lib. Interactive fields remain interactive unless **Flatten fields on export** is enabled.
- Field appearance updates use pdf-lib's built-in appearance handling. Complex custom field appearances, calculation scripts, validation scripts, and non-WinAnsi glyphs may not render exactly like the original authoring tool.
- Page reordering, deletion, or duplication creates a new document via page copying. Form fields may not survive those document-level page operations; fill forms on documents whose page order is unchanged for the most reliable export.
- Signature fields are not displayed or signed. Digital signatures are not implemented.
- No AI summarization, question answering, or document analysis is included.

## OCR

- OCR uses Tesseract.js. Language data is downloaded on demand from the Tesseract CDN; the document image itself is processed locally and never uploaded.
- OCR can run on the current page or all pages. Large documents take time, and there is no cancel/background queue yet beyond closing the dialog while it runs.
- Accuracy depends on scan quality, resolution, skew, handwriting, and language. Low-confidence words are still included.
- OCR text layers are written with standard PDF fonts and sanitized to a Latin/WinAnsi-compatible character range. Non-Latin scripts may not be fully represented in the exported searchable layer even if Tesseract recognizes them.
- OCR is performed on the unrotated page raster. Pages with unusual rotation, crop boxes, or very small text may produce offset or poor results.
- Redaction clears the OCR layer for that page. Redacted pages are exported as images without an OCR layer.
- The in-app search panel searches the OCR text, but OCR text is not highlighted on the PDF canvas.

## Redaction

- Redaction requires rasterizing the entire affected page. Text outside the black boxes on that page also becomes non-selectable after export.
- Redacted pages lose interactive forms, links, bookmarks, and other document-level structures because the page is replaced by an image.
- The raster resolution is capped at 2400px on the longest edge. Very small text may soften slightly on print, though the black redaction areas are still fully opaque.
- Redaction removes content from the **exported PDF**, not from the original file on disk. The editor keeps the original bytes until you close the document or replace them.
- Redaction is not a substitute for legal review. Verify the exported PDF with your own tooling before distributing sensitive documents.

## Images

- Image insertion supports PNG, JPEG, and WebP source files. Images are normalized to PNG/JPEG and capped at 1600px on the longest edge to keep local recovery manageable.
- Images can be moved by dragging and resized with the inspector's width/height fields. There is no crop, rotation handle, aspect-ratio lock, or layer ordering UI.
- Image annotations are flattened into the exported PDF. The original image quality is limited by the 1600px normalization cap.
- Very large numbers of embedded images can exceed browser `localStorage` recovery limits. Export still works because the image data lives in memory; only session recovery is affected.

## Collaboration and storage

- One document can be open at a time.
- Edits are stored in browser `localStorage`. There is no cloud library, account, share link, version history, or real-time collaboration.
- Session recovery is keyed by file name, byte size, and last-modified timestamp. If the file changes on disk, the recovery key changes.
- Clearing site data removes local recovery snapshots.

## Interface

- Selection handles are visual only. Annotations can be dragged but not resized by dragging a handle; use the inspector controls instead.
- Fit width is derived from the active page, so mixed-size documents may have pages wider than the viewport.
- Search highlights are geometric approximations based on PDF.js text-run widths. Variable-width fonts and multi-line phrases may highlight slightly wider or narrower than the glyphs.
- The interface is desktop-first. Mobile shows a clear notice rather than a degraded editor.
- Dark theme is not included in this milestone.
- The PDF canvas is a rendered bitmap; it is not a text layer, so copy/paste of source text is unavailable.

## Performance

- Very large documents depend on browser memory and PDF.js rendering speed. Page canvases are released when scrolled far out of view, but thousands of pages still carry metadata and thumbnails.
- The initial JavaScript bundle includes PDF.js and pdf-lib and exceeds the default Vite chunk warning threshold. Code-splitting is a future optimization.

## Quality

- Lint reports React `set-state-in-effect` warnings in lazy-render and search components. These are non-blocking and relate to observer-driven state synchronization.
- Automated browser E2E coverage is a smoke test plus export round-trip checks in this milestone; a full Playwright matrix is a future phase.
- PDF rendering fidelity depends on PDF.js and may differ from a native PDF viewer for exotic constructs, especially unusual blend modes, color spaces, or damaged files.
