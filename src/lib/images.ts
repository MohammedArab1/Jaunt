export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const ATTACHMENT_ACCEPT = 'image/*,application/pdf'

export interface PreparedFile {
  blob: Blob
  name: string
  mimeType: string
}

function replaceExtension(name: string, extension: string): string {
  return `${name.replace(/\.[^.]+$/, '') || 'ticket'}.${extension}`
}

async function compressImage(file: File): Promise<File> {
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif' ||
    file.size < 350 * 1024
  ) {
    return file
  }

  try {
    const bitmap = await createImageBitmap(file)
    const largestSide = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, 2200 / largestSide)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.86)
    })

    if (!blob || blob.size >= file.size) return file

    return new File([blob], replaceExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

export async function prepareAttachment(file: File): Promise<PreparedFile> {
  const allowed =
    file.type === 'application/pdf' ||
    (file.type.startsWith('image/') && file.type !== 'image/svg+xml')

  if (!allowed) {
    throw new Error('Only photos and PDFs can be attached.')
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" is larger than 25 MB. Try a smaller file.`)
  }

  const prepared = await compressImage(file)

  return {
    blob: prepared,
    name: prepared.type === 'image/jpeg' && file.type !== 'image/jpeg' ? replaceExtension(file.name, 'jpg') : prepared.name,
    mimeType: prepared.type || 'application/octet-stream',
  }
}
