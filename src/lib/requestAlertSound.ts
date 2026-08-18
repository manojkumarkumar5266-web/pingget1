/**
 * Incoming-request ring for delivery partners.
 * Browsers block audio until a user gesture — call `unlock()` on Go Online / first tap.
 * Ring plays up to 60s and stops on accept / decline / popup close.
 */

const RING_MS = 60_000;

let ctx: AudioContext | null = null;
let unlocked = false;
let stopTimer: number | null = null;
let playing = false;
let oscA: OscillatorNode | null = null;
let oscB: OscillatorNode | null = null;
let gain: GainNode | null = null;

function audioContext(): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export async function unlockRequestAlertSound(): Promise<void> {
  const c = audioContext();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    if (playing) return;
    const g = c.createGain();
    g.gain.value = 0.0001;
    const o = c.createOscillator();
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.04);
    unlocked = true;
  } catch {
    unlocked = false;
  }
}

function stopNodes() {
  try {
    oscA?.stop();
  } catch {
    /* already stopped */
  }
  try {
    oscB?.stop();
  } catch {
    /* already stopped */
  }
  oscA = null;
  oscB = null;
  gain = null;
}

export function stopRequestAlertSound() {
  playing = false;
  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  stopNodes();
}

/** Two-tone ring, ~1 minute, until stopRequestAlertSound() is called. */
export async function playRequestAlertSound() {
  await unlockRequestAlertSound();
  const c = audioContext();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
  } catch {
    return;
  }

  stopRequestAlertSound();
  playing = true;
  unlocked = true;

  const g = c.createGain();
  g.gain.value = 0.22;
  g.connect(c.destination);
  gain = g;

  const o1 = c.createOscillator();
  o1.type = "square";
  o1.frequency.value = 880;
  o1.connect(g);

  const o2 = c.createOscillator();
  o2.type = "square";
  o2.frequency.value = 1174.66;
  o2.connect(g);

  oscA = o1;
  oscB = o2;

  const now = c.currentTime;
  const end = now + RING_MS / 1000;
  let t = now;
  while (t < end) {
    g.gain.setValueAtTime(0.22, t);
    g.gain.setValueAtTime(0.22, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    t += 0.7;
  }
  g.gain.setValueAtTime(0.001, end);

  o1.start(now);
  o2.start(now);
  o1.stop(end);
  o2.stop(end);

  stopTimer = window.setTimeout(() => {
    playing = false;
    stopNodes();
    stopTimer = null;
  }, RING_MS);
}

export function isRequestAlertPlaying() {
  return playing;
}

export const REQUEST_ALERT_DURATION_MS = RING_MS

/** Compatibility helper used by DP home — rings ~60s until the returned stop() is called. */
export function playRequestAlert(_durationMs = RING_MS) {
  void playRequestAlertSound()
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 400])
  } catch {
    /* ignore */
  }
  return () => stopRequestAlertSound()
}
