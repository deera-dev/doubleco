import { CameraOff, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats: () => Promise<string[]>
}

type Reader = (video: HTMLVideoElement) => Promise<string | null>

const SCAN_EVERY_MS = 150
const SAMPLE_SIZE = 480

/** Native BarcodeDetector where the browser has it (Chrome Android), jsQR elsewhere (iPhone Safari). */
async function createReader(): Promise<Reader> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
  if (Native && (await Native.getSupportedFormats()).includes('qr_code')) {
    const detector = new Native({ formats: ['qr_code'] })
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null
  }

  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!context || video.videoWidth === 0) return null
    const scale = Math.min(1, SAMPLE_SIZE / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    return (
      jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ?? null
    )
  }
}

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable'

interface QrScannerProps {
  onDetect: (value: string) => void
  paused: boolean
}

export function QrScanner({ onDetect, paused }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDetectRef = useRef(onDetect)
  const [state, setState] = useState<CameraState>('starting')
  const [attempt, setAttempt] = useState(0)
  onDetectRef.current = onDetect

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt restarts the camera on "Coba lagi".
  useEffect(() => {
    if (paused) return
    let stream: MediaStream | null = null
    let timer = 0
    let isStopped = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable')
        return
      }
      setState('starting')
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (error) {
        setState(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'denied'
            : 'unavailable',
        )
        return
      }
      const video = videoRef.current
      if (isStopped || !video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)
      setState('running')

      const read = await createReader()
      const tick = async () => {
        if (isStopped) return
        if (video.readyState >= video.HAVE_CURRENT_DATA) {
          const value = await read(video).catch(() => null)
          if (value && !isStopped) onDetectRef.current(value)
        }
        timer = window.setTimeout(tick, SCAN_EVERY_MS)
      }
      tick()
    }

    start()
    return () => {
      isStopped = true
      window.clearTimeout(timer)
      for (const track of stream?.getTracks() ?? []) track.stop()
    }
  }, [paused, attempt])

  if (state === 'denied' || state === 'unavailable') {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-6 text-center sm:aspect-video">
        <CameraOff className="size-8 text-muted-foreground" />
        <p className="max-w-xs text-muted-foreground text-sm">
          {state === 'denied'
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau ketik nomor kartu di bawah.'
            : 'Kamera tidak tersedia di perangkat ini. Ketik nomor kartu di bawah.'}
        </p>
        <Button type="button" variant="outline" onClick={() => setAttempt((count) => count + 1)}>
          <RefreshCw />
          Coba lagi
        </Button>
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black sm:aspect-video">
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Kamera untuk scan QR kartu"
        className="size-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative size-3/5 max-h-72 max-w-72 rounded-3xl shadow-[0_0_0_100vmax_rgb(0_0_0/0.45)]">
          <span className="absolute -top-0.5 -left-0.5 size-8 rounded-tl-3xl border-white border-t-4 border-l-4" />
          <span className="absolute -top-0.5 -right-0.5 size-8 rounded-tr-3xl border-white border-t-4 border-r-4" />
          <span className="absolute -bottom-0.5 -left-0.5 size-8 rounded-bl-3xl border-white border-b-4 border-l-4" />
          <span className="absolute -right-0.5 -bottom-0.5 size-8 rounded-br-3xl border-white border-r-4 border-b-4" />
        </div>
      </div>
      <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/90">
        {state === 'starting' ? 'Menyalakan kamera…' : 'Arahkan ke QR di kartu jahit'}
      </p>
    </div>
  )
}
