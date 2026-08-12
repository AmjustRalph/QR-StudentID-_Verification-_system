import type { RefObject } from 'react'
import { Reticle } from '@/components/ui/Reticle'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import type { ScannerStatus } from './useQrScanner'

type Props = {
  videoRef: RefObject<HTMLVideoElement>
  status: ScannerStatus
  error: string | null
  caption: string
}

/** The camera viewport framed by the scan reticle — shared by both scanning screens. */
export function ScannerViewport({ videoRef, status, error, caption }: Props) {
  return (
    <div className="flex flex-col items-center">
      <Reticle tone={status === 'error' ? 'denied' : 'azure'} size="lg" className="w-full max-w-xs">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-navy-950">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            muted
            playsInline
            className={cn('h-full w-full object-cover', status !== 'active' && 'opacity-0')}
          />
          {status !== 'active' && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center">
              {status === 'error' ? (
                <p className="text-sm text-denied-600">{error}</p>
              ) : (
                <Spinner className="h-6 w-6 text-azure-100" />
              )}
            </div>
          )}
        </div>
      </Reticle>
      <p className="mt-3 text-sm text-ink-muted">{status === 'error' ? 'Camera unavailable' : caption}</p>
    </div>
  )
}
