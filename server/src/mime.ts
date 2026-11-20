const INLINE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
])

export function baseMimeType(value: string | null | undefined): string {
  return (value ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

export function isAllowedAttachmentMime(value: string | null | undefined): boolean {
  const mime = baseMimeType(value)
  return mime === 'application/pdf' || (mime.startsWith('image/') && mime !== 'image/svg+xml')
}

export function isInlineSafeMime(value: string | null | undefined): boolean {
  const mime = baseMimeType(value)
  return mime === 'application/pdf' || INLINE_IMAGE_TYPES.has(mime)
}
