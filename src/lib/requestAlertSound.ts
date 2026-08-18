/** Default: ring up to 1 minute until DP accepts/declines or timeout. */
export const REQUEST_ALERT_DURATION_MS = 60_000

/**
 * Play an attention alert for nearby new requests (DP home).
 * Loops for up to `durationMs` (default 60s) or until stop() is called.
 */
export function playRequestAlert(durationMs = REQUEST_ALERT_DURATION_MS): () => void {
  let stopped = false
  let ctx: AudioContext | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const beep = () => {
    if (stopped) return
    try {
      if (!ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        ctx = new AC()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.18
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.36)
    } catch {
      /* ignore audio failures (autoplay policy, etc.) */
    }
  }

  beep()
  intervalId = setInterval(beep, 700)
  timeoutId = setTimeout(() => stop(), durationMs)

  function stop() {
    if (stopped) return
    stopped = true
    if (intervalId) clearInterval(intervalId)
    if (timeoutId) clearTimeout(timeoutId)
    try {
      ctx?.close()
    } catch { /* ignore */ }
    ctx = null
  }

  return stop
}
