import type { AppError } from '@/shared/types/errors'

const MAX_EDGE = 1600
const QUALITY = 0.85

const unreadable: AppError = {
  kind: 'business',
  code: 'PHOTO_UNREADABLE',
  message: 'Photo could not be decoded',
}

export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw unreadable

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw unreadable
  }

  const size = scaledSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw unreadable
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) throw unreadable
  return blob
}
