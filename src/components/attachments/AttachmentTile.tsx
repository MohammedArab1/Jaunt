import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import type { Attachment } from '@/types'
import { ensureAttachmentBlob } from '@/lib/sync'
import { cn } from '@/lib/utils'

interface AttachmentTileProps {
  attachment: Attachment
  onRemove?: () => void
  onOpen?: () => void
  className?: string
}

export function AttachmentTile({ attachment, onRemove, onOpen, className }: AttachmentTileProps) {
  const [url, setUrl] = useState<string | null>(null)
  const isImage = attachment.mimeType.startsWith('image/')

  useEffect(() => {
    if (!isImage) return
    let alive = true
    let createdUrl: string | undefined

    void ensureAttachmentBlob(attachment.id).then((blob) => {
      if (!alive || !blob) return
      createdUrl = URL.createObjectURL(blob)
      setUrl(createdUrl)
    })

    return () => {
      alive = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [attachment.id, isImage])

  const content = isImage ? (
    url ? (
      <img src={url} alt={attachment.name} className="h-full w-full object-cover" loading="lazy" />
    ) : (
      <div className="h-full w-full animate-pulse bg-white/[0.06]" />
    )
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#241A1D] p-2 text-center">
      <FileText className="h-6 w-6 text-punch" />
      <span className="line-clamp-2 text-[9px] font-bold leading-tight text-muted">{attachment.name}</span>
    </div>
  )

  const wrapper = onOpen ? (
    <button type="button" onClick={onOpen} className="block h-full w-full text-left" aria-label={`Open ${attachment.name}`}>
      {content}
    </button>
  ) : (
    content
  )

  return (
    <div
      className={cn(
        'group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]',
        className,
      )}
    >
      {wrapper}
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/75 text-cream shadow-lg backdrop-blur transition hover:bg-black"
          aria-label={`Remove ${attachment.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
