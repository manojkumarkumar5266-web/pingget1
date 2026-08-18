/** Default: ring up to 1 minute until DP accepts/declines or timeout. */
export const REQUEST_ALERT_DURATION_MS = 60_000

/**
 * Modern two-tone chime (not a raw sine beep) for nearby new requests.
 * Loops for up to `durationMs` or until stop() is called.
 */
export function playRequestAlert(durationMs = REQUEST_ALERT_DURATION_MS): () => void {
  let stopped = false
  let ctx: AudioContext | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const chime = () => {
    if (stopped) return
    try {
      if (!ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return
        ctx = new AC()
      }
      const now = ctx.currentTime
      const master = ctx.createGain()
      master.gain.value = 0.22
      master.connect(ctx.destination)

      const notes = [
        { freq: 523.25, start: 0, dur: 0.18 },
        { freq: 659.25, start: 0.12, dur: 0.22 },
        { freq: 783.99, start: 0.26, dur: 0.38 },
      ]
      for (const n of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = n.freq
        const t0 = now + n.start
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.dur)
        osc.connect(gain)
        gain.connect(master)
        osc.start(t0)
        osc.stop(t0 + n.dur + 0.02)
      }
    } catch {
      /* ignore audio failures (autoplay policy, etc.) */
    }
  }

  chime()
  intervalId = setInterval(chime, 1600)
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
