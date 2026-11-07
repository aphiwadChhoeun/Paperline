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

- **Redaction is not implemented.** A black rectangle drawn over text does not remove the underlying content and would create a false sense of security. The tool is omitted until destructive content removal can be verified.
- Password-protected PDFs can be opened for viewing. Export is disabled because pdf-lib cannot decrypt them.
- Digital signatures and certificate-based signing are not implemented. Editing a signed PDF may invalidate existing signatures.
- No malware scanning, sandboxing beyond the browser process, or server-side validation is performed.

## Forms, OCR, and AI

- AcroForm detection, filling, creation, and flattening are not implemented.
- OCR of scanned PDFs is not implemented.
- No AI summarization, question answering, or document analysis is included.

## Collaboration and storage

- One document can be open at a time.
- Edits are stored in browser `localStorage`. There is no cloud library, account, share link, version history, or real-time collaboration.
- Session recovery is keyed by file name, byte size, and last-modified timestamp. If the file changes on disk, the recovery key changes.
- Clearing site data removes local recovery snapshots.

## Interface

- Selection handles are visual only. Annotations can be dragged but not resized by dragging a handle; use the inspector controls instead.
- Fit width is derived from the active page, so mixed-size documents may have pages wider than the viewport.
- Search matches are shown in the result panel but are not highlighted on the PDF canvas.
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
