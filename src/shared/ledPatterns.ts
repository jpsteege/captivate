import { BaseColors, getBaseColorsFromHsv } from './baseColors'
import { TimeState } from './TimeState'

export type LedEffectType =
  | 'none'
  | 'chase'
  | 'pulse'
  | 'strobe'
  | 'sparkle'
  | 'gradient'
  | 'colorwave'
  | 'breathe'
  | 'mirror'
  | 'lightning'

export interface LedEffect {
  type: LedEffectType
  speed: number    // 0–1  how fast the effect animates
  intensity: number // 0–1  effect strength / density
}

export function initLedEffect(): LedEffect {
  return { type: 'none', speed: 0.5, intensity: 0.5 }
}

export const LED_EFFECT_TYPES: LedEffectType[] = [
  'none', 'chase', 'pulse', 'strobe', 'sparkle',
  'gradient', 'colorwave', 'breathe', 'mirror', 'lightning',
]

// ---------------------------------------------------------------------------
// Apply effect post-processing to a base color array
// colors: array of BaseColors from getLedValues(), length = led_count
// baseHue: scene hue (0–1) used by color-generating effects
// Returns a new array of the same length.
// ---------------------------------------------------------------------------
export function applyLedEffect(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState,
  baseHue: number
): BaseColors[] {
  switch (effect.type) {
    case 'chase':     return applyChase(colors, effect, timeState)
    case 'pulse':     return applyPulse(colors, effect, timeState)
    case 'strobe':    return applyStrobe(colors, effect, timeState)
    case 'sparkle':   return applySparkle(colors, effect)
    case 'gradient':  return applyGradient(colors, effect, baseHue)
    case 'colorwave': return applyColorwave(colors, effect, timeState, baseHue)
    case 'breathe':   return applyBreathe(colors, effect, timeState)
    case 'mirror':    return applyMirror(colors)
    case 'lightning': return applyLightning(colors, effect, baseHue)
    default:          return colors
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scale(c: BaseColors, m: number): BaseColors {
  return { red: c.red * m, green: c.green * m, blue: c.blue * m }
}

// Fractional part of a number, always positive
function frac(x: number): number {
  return x - Math.floor(x)
}

// Low-quality but fast deterministic pseudo-random (seeded by index + salt)
function hash(n: number): number {
  n = ((n >> 16) ^ n) * 0x45d9f3b
  n = ((n >> 16) ^ n) * 0x45d9f3b
  return ((n >> 16) ^ n) >>> 0
}

function pseudoRand(seed: number): number {
  return hash(seed) / 0xffffffff
}

function brightness(c: BaseColors): number {
  return (c.red + c.green + c.blue) / 3
}

// ---------------------------------------------------------------------------
// Chase — a lit window scrolls along the strip, BPM-synced
// speed controls window width (0 = narrow, 1 = wide)
// intensity controls brightness outside the window (0 = full off, 1 = full on)
// ---------------------------------------------------------------------------
function applyChase(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState
): BaseColors[] {
  const n = colors.length
  if (n === 0) return colors
  const windowWidth = 0.1 + effect.speed * 0.4 // 10%–50% of strip
  // position follows beat phase 0–1
  const pos = frac(timeState.beats / 4)
  return colors.map((c, i) => {
    const ledPos = i / n
    const dist = Math.abs(frac(ledPos - pos + 0.5) - 0.5)
    const inWindow = dist < windowWidth / 2
    const mult = inWindow ? 1.0 : effect.intensity * 0.15
    return scale(c, mult)
  })
}

// ---------------------------------------------------------------------------
// Pulse — brightness pulses in/out on beat
// speed controls pulse sharpness (0 = smooth, 1 = snappy)
// intensity controls minimum brightness
// ---------------------------------------------------------------------------
function applyPulse(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState
): BaseColors[] {
  const beatPhase = frac(timeState.beats) // 0–1 within a beat
  const sharpness = 1 + effect.speed * 8
  const pulse = Math.pow(1 - beatPhase, sharpness)
  const mult = effect.intensity + (1 - effect.intensity) * pulse
  return colors.map((c) => scale(c, mult))
}

// ---------------------------------------------------------------------------
// Strobe — full on/off flash
// speed controls strobe rate (0 = 1× beat, 1 = 8× beat)
// intensity controls on-duty-cycle
// ---------------------------------------------------------------------------
function applyStrobe(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState
): BaseColors[] {
  const subdivisions = 1 + Math.round(effect.speed * 7) // 1–8 per beat
  const phase = frac(timeState.beats * subdivisions)
  const duty = 0.1 + effect.intensity * 0.5 // 10%–60% on
  const on = phase < duty
  return on ? colors : colors.map(() => ({ red: 0, green: 0, blue: 0 }))
}

// ---------------------------------------------------------------------------
// Sparkle — random LEDs flash brighter
// speed controls flash decay rate
// intensity controls density (fraction of LEDs active)
// ---------------------------------------------------------------------------
function applySparkle(colors: BaseColors[], effect: LedEffect): BaseColors[] {
  const density = effect.intensity
  const brightness = 0.5 + effect.speed * 0.5
  return colors.map((c, i) => {
    const r = pseudoRand(i + Math.floor(Date.now() / 80))
    return r < density ? scale(c, 1 + brightness) : c
  })
}

// ---------------------------------------------------------------------------
// Gradient — N colors near baseHue spread along the strip
// intensity → numColors (1–5 distinct hue bands)
// speed → spread between colors (0 = tight cluster, 1 = quarter wheel apart)
// ---------------------------------------------------------------------------
function applyGradient(
  colors: BaseColors[],
  effect: LedEffect,
  baseHue: number
): BaseColors[] {
  const n = colors.length
  if (n === 0) return colors
  const numColors = 1 + Math.round(effect.intensity * 4) // 1–5
  const spread = effect.speed * 0.25 // max 0.25 of color wheel between adjacent bands
  return colors.map((c, i) => {
    const segment = Math.floor((i / n) * numColors)
    const hue = frac(baseHue + segment * spread)
    const bri = brightness(c)
    const sat = bri > 0.01 ? 1.0 : 0
    const out = getBaseColorsFromHsv(hue, sat, Math.min(bri * 3, 1))
    return { red: Math.min(out.red, 1), green: Math.min(out.green, 1), blue: Math.min(out.blue, 1) }
  })
}

// ---------------------------------------------------------------------------
// Colorwave — sinusoidal hue oscillation around baseHue
// intensity → hue oscillation depth (0 = no variation, 1 = ±15% of wheel)
// speed → wave travel rate
// ---------------------------------------------------------------------------
function applyColorwave(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState,
  baseHue: number
): BaseColors[] {
  const n = colors.length
  if (n === 0) return colors
  const spread = effect.intensity * 0.15 // max ±15% of color wheel
  const phase = timeState.beats * effect.speed
  return colors.map((c, i) => {
    const wave = Math.sin((i / n) * Math.PI * 2 + phase * Math.PI * 2)
    const hue = frac(baseHue + wave * spread)
    const bri = brightness(c)
    const sat = bri > 0.01 ? 1.0 : 0
    const out = getBaseColorsFromHsv(hue, sat, Math.min(bri * 3, 1))
    return { red: Math.min(out.red, 1), green: Math.min(out.green, 1), blue: Math.min(out.blue, 1) }
  })
}

// ---------------------------------------------------------------------------
// Breathe — slow sinusoidal brightness envelope, ignores beat sync
// speed controls breath rate (in beats per breath)
// intensity controls minimum brightness
// ---------------------------------------------------------------------------
function applyBreathe(
  colors: BaseColors[],
  effect: LedEffect,
  timeState: TimeState
): BaseColors[] {
  const beatsPerBreath = 2 + (1 - effect.speed) * 6 // 2–8 beats per breath
  const phase = frac(timeState.beats / beatsPerBreath)
  const mult = effect.intensity + (1 - effect.intensity) * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2))
  return colors.map((c) => scale(c, mult))
}

// ---------------------------------------------------------------------------
// Mirror — reflect left half onto right half (or right onto left)
// ---------------------------------------------------------------------------
function applyMirror(colors: BaseColors[]): BaseColors[] {
  const n = colors.length
  if (n < 2) return colors
  const half = Math.floor(n / 2)
  const out = [...colors]
  for (let i = 0; i < half; i++) {
    out[n - 1 - i] = out[i]
  }
  return out
}

// ---------------------------------------------------------------------------
// Lightning — random subset of LEDs pop bright; rest keep base color
// intensity → fraction of LEDs struck per strike (0.05–0.5)
// speed → strike frequency (how often a strike occurs)
// ---------------------------------------------------------------------------
function applyLightning(
  colors: BaseColors[],
  effect: LedEffect,
  baseHue: number
): BaseColors[] {
  const n = colors.length
  if (n === 0) return colors
  const now = Date.now()
  const strikeWindow = Math.round(30 + (1 - effect.speed) * 270) // ms between strikes: 30–300
  const slot = Math.floor(now / strikeWindow)
  // Use slot as seed — only 10% of slots produce a strike
  if (pseudoRand(slot) > 0.1) return colors

  const fraction = 0.05 + effect.intensity * 0.45 // 5%–50% of LEDs
  const flashColor = getBaseColorsFromHsv(baseHue, 0.3, 1) // near-white tinted by baseHue
  return colors.map((c, i) => {
    // deterministic per-LED per-slot: flash if this LED is in the struck subset
    return pseudoRand(slot * 10000 + i) < fraction ? flashColor : c
  })
}
