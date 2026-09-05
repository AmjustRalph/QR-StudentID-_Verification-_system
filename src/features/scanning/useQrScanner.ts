import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export type ScannerStatus = 'starting' | 'active' | 'error'

type Options = {
  /** While true, the camera stays live but decoded frames are ignored. */
  paused?: boolean
  /** Minimum time before the same decoded value is allowed to fire again. */
  cooldownMs?: number
  /**
   * Set false to defer camera acquisition entirely — e.g. while a
   * prerequisite form is showing and the <video> element this hook attaches
   * to isn't mounted yet. Acquisition only happens once, on mount, keyed off
   * this flag; if the caller renders the video element conditionally (as the
   * scanning screens do while collecting session details first), leaving
   * this true from the start attaches the stream to nothing and it never
   * retries. Flip it to true once the real scanning view is on screen.
   */
  enabled?: boolean
}

/**
 * Drives a hidden-until-ready <video> from the device camera and decodes QR
 * codes from it via jsQR, calling onDecode with the raw token string. Debounces
 * repeat decodes of the same code so a code sitting in frame doesn't fire on
 * every tick — the caller still gets exactly one call per physical presentation.
 */
export function useQrScanner(onDecode: (value: string) => void, options: Options = {}) {
  const { paused = false, cooldownMs = 2500, enabled = true } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<ScannerStatus>('starting')
  const [error, setError] = useState<string | null>(null)

  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const onDecodeRef = useRef(onDecode)
  onDecodeRef.current = onDecode
  const lastRef = useRef<{ value: string; at: number } | null>(null)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let stream: MediaStream | null = null
    let frameHandle: number | null = null

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function loop() {
      const video = videoRef.current
      if (!cancelled && video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        if (!pausedRef.current) {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const result = jsQR(frame.data, frame.width, frame.height)
          if (result?.data) {
            const now = Date.now()
            const last = lastRef.current
            if (!last || last.value !== result.data || now - last.at > cooldownMs) {
              lastRef.current = { value: result.data, at: now }
              onDecodeRef.current(result.data)
            }
          }
        }
      }
      frameHandle = requestAnimationFrame(loop)
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('active')
        loop()
      } catch (caught) {
        if (cancelled) return
        setStatus('error')
        setError(
          caught instanceof DOMException && caught.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access, or use the search below.'
            : 'Could not access a camera on this device. Use the search below.',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      if (frameHandle !== null) cancelAnimationFrame(frameHandle)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // cooldownMs intentionally excluded: changing it mid-session would tear
    // down and restart the camera stream for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { videoRef, status, error }
}
