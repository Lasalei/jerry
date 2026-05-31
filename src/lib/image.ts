// Downscale + compress a picked image into a small data URL (base64 JPEG)
// suitable for storing directly on a style and syncing over the network.
//
// ~640px longest edge at quality 0.7 keeps each photo around 40–60 KB, so ~50
// styles total a few MB — small enough to sync, cache offline, and round-trip
// through the JSON backup without any separate file storage.

const MAX_EDGE = 640
const QUALITY = 0.7

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await loadBitmap(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kunne ikke behandle bildet')
  ctx.drawImage(bitmap, 0, 0, w, h)

  // Release decoder memory where supported.
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  return canvas.toDataURL('image/jpeg', QUALITY)
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap handles EXIF orientation on modern mobile browsers.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fall through to the <img> path.
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Kunne ikke lese bildet'))
    }
    img.src = url
  })
}
