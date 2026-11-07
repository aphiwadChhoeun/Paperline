export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType = 'application/pdf') {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function outputFileName(fileName: string | null): string {
  const base = (fileName ?? 'document.pdf').replace(/\.pdf$/i, '')
  return `${base}-edited.pdf`
}
