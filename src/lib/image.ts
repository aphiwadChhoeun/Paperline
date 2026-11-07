export interface PreparedImage {
  dataUrl: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
  name: string
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024
const MAX_EDGE = 1600

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That image could not be read.'))
    image.src = url
  })
}

/**
 * Normalize a user-selected image into a browser-safe PNG/JPEG data URL and
 * cap its dimensions. This keeps annotation records small enough for local
 * recovery while retaining enough resolution for print-quality export.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a PNG, JPEG, or WebP image.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('That image is larger than 20 MB. Choose a smaller file.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The browser could not prepare that image.')
    context.drawImage(image, 0, 0, width, height)

    const mimeType: PreparedImage['mimeType'] =
      file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    const dataUrl = canvas.toDataURL(
      mimeType,
      mimeType === 'image/jpeg' ? 0.88 : undefined,
    )
    return { dataUrl, mimeType, width, height, name: file.name }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
