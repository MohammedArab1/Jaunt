import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export function PdfPreview({ blob, name }: { blob: Blob; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPdf(null)
    setPageNumber(1)
    setPageCount(0)
    setLoading(true)
    setError(false)

    const load = async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const data = new Uint8Array(await blob.arrayBuffer())
        const loadingTask = pdfjs.getDocument({ data, useSystemFonts: true })
        loadingTaskRef.current = loadingTask
        const document = await loadingTask.promise
        if (cancelled) {
          void loadingTask.destroy()
          return
        }
        setPdf(document)
        setPageCount(document.numPages)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
      void loadingTaskRef.current?.destroy()
      loadingTaskRef.current = null
    }
  }, [blob])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setContainerWidth(element.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    setLoading(true)
    setError(false)

    const render = async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const canvas = canvasRef.current
        if (!canvas) return

        const unscaled = page.getViewport({ scale: 1 })
        const available = Math.max(260, (containerWidth || 600) - 24)
        const cssWidth = Math.min(900, available)
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const scale = (cssWidth * pixelRatio) / unscaled.width
        const viewport = page.getViewport({ scale })

        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = 'auto'

        renderTaskRef.current?.cancel()
        const task = page.render({ canvas, viewport })
        renderTaskRef.current = task
        await task.promise
        page.cleanup()
      } catch (cause) {
        if (!cancelled && (cause as { name?: string })?.name !== 'RenderingCancelledException') {
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void render()

    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
    }
  }, [containerWidth, pageNumber, pdf])

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto rounded-2xl bg-black/25 p-3"
      >
        <canvas
          ref={canvasRef}
          aria-label={`${name} page ${pageNumber}`}
          className="mx-auto block h-auto max-w-full rounded-lg shadow-[0_16px_50px_-20px_rgba(0,0,0,0.8)]"
        />
        {loading ? (
          <div className="absolute inset-0 grid place-items-center bg-black/25">
            <Loader2 className="h-6 w-6 animate-spin text-coral" />
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-6 text-center">
            <p className="max-w-xs text-sm font-semibold text-fg">
              This PDF could not be displayed. You can download it instead.
            </p>
          </div>
        ) : null}
      </div>

      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            disabled={pageNumber <= 1 || loading}
            className="btn-icon border-fg/15 bg-fg/10 disabled:opacity-40"
            aria-label="Previous PDF page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-24 text-center text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
            Page {pageNumber} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))}
            disabled={pageNumber >= pageCount || loading}
            className="btn-icon border-fg/15 bg-fg/10 disabled:opacity-40"
            aria-label="Next PDF page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
