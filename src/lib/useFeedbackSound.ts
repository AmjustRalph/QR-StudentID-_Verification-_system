import { useCallback, useRef } from 'react'

/**
 * Short, synthesized beeps for scan results — no audio asset to ship, and no
 * licensing to think about. `granted` is two quick ascending tones (like a
 * checkout scanner), `denied` is one low buzz. Reuses a single AudioContext
 * across calls; browsers only let it start after a user gesture, but by the
 * time a scan happens the invigilator has already interacted with the page
 * (started the session), so this never needs an explicit "enable sound" step.
 */
export function useFeedbackSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) return null
      ctxRef.current = new AudioCtx()
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const tone = useCallback(
    (ctx: AudioContext, frequency: number, startAt: number, duration: number, peakGain: number) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + duration + 0.02)
    },
    [],
  )

  const playGranted = useCallback(() => {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, 880, now, 0.09, 0.18)
    tone(ctx, 1318.5, now + 0.09, 0.14, 0.18)
  }, [getContext, tone])

  const playDenied = useCallback(() => {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime
    tone(ctx, 220, now, 0.22, 0.16)
  }, [getContext, tone])

  return { playGranted, playDenied }
}
