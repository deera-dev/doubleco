import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Dialog } from '@/shared/components/ui/dialog'

interface PhotoViewerProps {
  src: string
  alt: string
  /** The thumbnail; clicking it opens the photo full screen. */
  children: ReactNode
}

/**
 * Full-screen photo: fitted to the screen first, tap to see it at full size and drag/scroll
 * around the details. The phone's back button closes it.
 */
export function PhotoViewer({ src, alt, children }: PhotoViewerProps) {
  const [open, setOpen] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const change = (next: boolean) => {
    setOpen(next)
    if (!next) setZoomed(false)
  }
  const button =
    'flex size-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80'

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="block size-full cursor-zoom-in"
          aria-label={`Lihat ${alt} lebih besar`}
        >
          {children}
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/95" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 outline-none">
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Ketuk foto untuk memperbesar.
          </DialogPrimitive.Description>
          <div className={zoomed ? 'size-full overflow-auto' : 'size-full'}>
            <button
              type="button"
              onClick={() => setZoomed((current) => !current)}
              className={
                zoomed
                  ? 'block min-h-full min-w-full cursor-zoom-out'
                  : 'flex size-full cursor-zoom-in items-center justify-center p-4'
              }
              aria-label={zoomed ? 'Perkecil foto' : 'Perbesar foto'}
            >
              <img
                src={src}
                alt={alt}
                className={zoomed ? 'max-w-none' : 'max-h-full max-w-full object-contain'}
              />
            </button>
          </div>
          <div className="pointer-events-none fixed inset-x-0 top-0 flex justify-end gap-2 p-3">
            <button
              type="button"
              className={`${button} pointer-events-auto`}
              onClick={() => setZoomed((current) => !current)}
              aria-label={zoomed ? 'Perkecil foto' : 'Perbesar foto'}
            >
              {zoomed ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
            </button>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className={`${button} pointer-events-auto`}
              aria-label="Buka foto asli di tab baru"
            >
              <ExternalLink className="size-5" />
            </a>
            <DialogPrimitive.Close className={`${button} pointer-events-auto`} aria-label="Tutup">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}
