/** Distinct sound and vibration per outcome, so the result is felt without reading the screen. */
type Outcome = 'found' | 'saved' | 'blocked'

const patterns: Record<Outcome, { vibrate: number | number[]; tones: [number, number][] }> = {
  found: { vibrate: 40, tones: [[1320, 0.06]] },
  saved: {
    vibrate: [60, 40, 60],
    tones: [
      [880, 0.08],
      [1320, 0.12],
    ],
  },
  blocked: {
    vibrate: [250, 120, 250],
    tones: [
      [220, 0.18],
      [180, 0.28],
    ],
  },
}

let audio: AudioContext | null = null

function play(tones: [number, number][]) {
  try {
    audio ??= new AudioContext()
    let at = audio.currentTime
    for (const [frequency, duration] of tones) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gain.gain.setValueAtTime(0.18, at)
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(at)
      oscillator.stop(at + duration)
      at += duration + 0.03
    }
  } catch {
    // Sound is a nicety; some browsers block audio until the first tap.
  }
}

export function signal(outcome: Outcome) {
  const pattern = patterns[outcome]
  navigator.vibrate?.(pattern.vibrate)
  play(pattern.tones)
}
