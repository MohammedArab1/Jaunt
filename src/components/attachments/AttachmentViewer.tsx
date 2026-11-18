import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, X } from 'lucide-react'
import type { Attachment } from '@/types'
import { ensureAttachmentBlob } from '@/lib/sync'
import { formatBytes } from '@/lib/utils'
import { PdfPreview } from './PdfPreview'

interface AttachmentViewerProps {
  attachment: Attachment | null
  onClose: () => void
}

export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!attachment) {
      setUrl(null)
      setBlob(null)
      setFailed(false)
      return
    }

    let alive = true
    let createdUrl: string | undefined
    setUrl(null)
    setBlob(null)
    setFailed(false)

    void ensureAttachmentBlob(attachment.id)
      .then((blob) => {
        if (!alive || !blob) {
          if (alive) setFailed(true)
          return
        }
        createdUrl = URL.createObjectURL(blob)
        setBlob(blob)
        setUrl(createdUrl)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })

    return () => {
      alive = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [attachment])

  const isImage = attachment?.mimeType.startsWith('image/') ?? false
  const isPdf = attachment?.mimeType === 'application/pdf'

  return (
    <Dialog.Root open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm" />
        <Dialog.Content className="dark-scope fixed inset-0 z-[61] flex flex-col outline-none">
          <Dialog.Title className="sr-only">{attachment?.name ?? 'Attachment'}</Dialog.Title>
          <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.9rem)] sm:px-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-fg">{attachment?.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                {attachment ? formatBytes(attachment.size) : ''}
              </p>
            </div>
            {url ? (
              <a
                href={url}
                download={attachment?.name}
                className="btn-icon"
                aria-label="Download attachment"
              >
                <Download className="h-4 w-4" />
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="btn-icon" aria-label="Close viewer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-8">
            {failed ? (
              <p className="text-sm font-semibold text-muted">This file could not be loaded.</p>
            ) : !url ? (
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-fg/20 border-t-coral" />
            ) : isImage ? (
              <img
                src={url}
                alt={attachment?.name ?? ''}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            ) : isPdf && blob ? (
              <PdfPreview blob={blob} name={attachment?.name ?? 'PDF'} />
            ) : (
              <a href={url} download={attachment?.name} className="btn btn-primary">
                Download file
              </a>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
