// ── Vibe Axes ────────────────────────────────────────────────────────────────
// 5 musical-character axes computed from raw FFT features.
// Each axis is 0–1 and smoothed with a slow EMA (~2s) before vibe classification.

export interface VibeAxes {
  heat: number      // 0 = cool/bright/treble-heavy  →  1 = warm/bass-heavy
  energy: number    // 0 = ambient/silence           →  1 = intense/loud
  pulse: number     // 0 = smooth/flowing             →  1 = punchy/percussive
  groove: number    // 0 = sparse/minimal             →  1 = mid-rich/syncopated
  momentum: number  // 0 = resolving/falling          →  1 = building/rising
}

export function initVibeAxes(): VibeAxes {
  return { heat: 0.5, energy: 0, pulse: 0, groove: 0.5, momentum: 0.5 }
}

// ── 20 Named Vibes ───────────────────────────────────────────────────────────

export type VibeType =
  | 'deep'      // low-energy, cool, minimal — late-night techno baseline
  | 'chill'     // calm, neutral warmth, no pulse — lounge/downtempo
  | 'float'     // very low energy, airy — ambient/chillwave
  | 'groove'    // medium energy, warm, syncopated — house/funk
  | 'funk'      // high energy, very warm, punchy — funky/syncopated
  | 'soul'      // medium energy, warm, smooth — R&B/soul
  | 'drive'     // high energy, cool, driving — progressive techno
  | 'pulse'     // high energy, strong regular beat — EDM/4-on-floor
  | 'rave'      // maximum energy, cool, rapid — hard techno/gabber feel
  | 'build'     // rising momentum — pre-drop buildup
  | 'drop'      // peak everything — the drop
  | 'breakdown' // post-drop sparse — breakdown/outro
  | 'tropical'  // warm, energetic, syncopated — afrobeats/tropical house
  | 'dark'      // medium energy, cool, heavy — dark techno/industrial
  | 'bright'    // medium energy, cool/treble-bright — pop/euphoric trance
  | 'snappy'    // fast, percussive, complex — DnB/jungle
  | 'smooth'    // flowing, warm, melodic — smooth jazz/slow RnB
  | 'epic'      // massive, building — stadium trance/epic
  | 'intimate'  // very quiet, sparse, delicate — acoustic/ballad
  | 'neutral'   // average — when no strong character detected

export const VIBE_TYPES: VibeType[] = [
  'deep', 'chill', 'float', 'groove', 'funk', 'soul',
  'drive', 'pulse', 'rave', 'build', 'drop', 'breakdown',
  'tropical', 'dark', 'bright', 'snappy', 'smooth', 'epic',
  'intimate', 'neutral',
]

// Named centroids in [heat, energy, pulse, groove, momentum] space
export const VIBE_CENTROIDS: Record<VibeType, VibeAxes> = {
  deep:      { heat: 0.30, energy: 0.20, pulse: 0.30, groove: 0.40, momentum: 0.40 },
  chill:     { heat: 0.50, energy: 0.20, pulse: 0.20, groove: 0.30, momentum: 0.30 },
  float:     { heat: 0.50, energy: 0.10, pulse: 0.10, groove: 0.20, momentum: 0.30 },
  groove:    { heat: 0.70, energy: 0.50, pulse: 0.50, groove: 0.80, momentum: 0.50 },
  funk:      { heat: 0.80, energy: 0.70, pulse: 0.70, groove: 0.90, momentum: 0.50 },
  soul:      { heat: 0.70, energy: 0.50, pulse: 0.40, groove: 0.70, momentum: 0.40 },
  drive:     { heat: 0.30, energy: 0.70, pulse: 0.60, groove: 0.50, momentum: 0.70 },
  pulse:     { heat: 0.40, energy: 0.80, pulse: 0.90, groove: 0.50, momentum: 0.50 },
  rave:      { heat: 0.20, energy: 0.90, pulse: 0.90, groove: 0.60, momentum: 0.60 },
  build:     { heat: 0.40, energy: 0.60, pulse: 0.60, groove: 0.50, momentum: 0.90 },
  drop:      { heat: 0.50, energy: 1.00, pulse: 1.00, groove: 0.70, momentum: 0.50 },
  breakdown: { heat: 0.50, energy: 0.20, pulse: 0.20, groove: 0.30, momentum: 0.10 },
  tropical:  { heat: 0.80, energy: 0.60, pulse: 0.60, groove: 0.80, momentum: 0.50 },
  dark:      { heat: 0.20, energy: 0.60, pulse: 0.50, groove: 0.40, momentum: 0.50 },
  bright:    { heat: 0.30, energy: 0.60, pulse: 0.50, groove: 0.50, momentum: 0.50 },
  snappy:    { heat: 0.50, energy: 0.80, pulse: 0.90, groove: 0.90, momentum: 0.60 },
  smooth:    { heat: 0.60, energy: 0.40, pulse: 0.20, groove: 0.50, momentum: 0.40 },
  epic:      { heat: 0.40, energy: 0.90, pulse: 0.70, groove: 0.60, momentum: 0.80 },
  intimate:  { heat: 0.60, energy: 0.10, pulse: 0.10, groove: 0.20, momentum: 0.30 },
  neutral:   { heat: 0.50, energy: 0.40, pulse: 0.40, groove: 0.40, momentum: 0.40 },
}

// Nearest-centroid classification (Euclidean distance in 5D)
export function classifyVibe(axes: VibeAxes): VibeType {
  let bestVibe: VibeType = 'neutral'
  let bestDist = Infinity
  for (const vibe of VIBE_TYPES) {
    const c = VIBE_CENTROIDS[vibe]
    const d =
      (axes.heat - c.heat) ** 2 +
      (axes.energy - c.energy) ** 2 +
      (axes.pulse - c.pulse) ** 2 +
      (axes.groove - c.groove) ** 2 +
      (axes.momentum - c.momentum) ** 2
    if (d < bestDist) {
      bestDist = d
      bestVibe = vibe
    }
  }
  return bestVibe
}

// Suggested hue (0–1) for each vibe — used as default hueOverride in behavior map
export const VIBE_HUE: Record<VibeType, number> = {
  deep:      0.65, // dark blue
  chill:     0.55, // teal
  float:     0.72, // soft purple
  groove:    0.08, // warm amber
  funk:      0.06, // orange
  soul:      0.02, // deep red-orange
  drive:     0.60, // electric blue
  pulse:     0.50, // cyan
  rave:      0.75, // ultraviolet
  build:     0.28, // yellow-green
  drop:      0.00, // pure white/red burst
  breakdown: 0.65, // muted blue
  tropical:  0.38, // lime-teal
  dark:      0.80, // dark violet
  bright:    0.85, // electric pink
  snappy:    0.33, // neon green
  smooth:    0.05, // soft salmon-red
  epic:      0.12, // gold
  intimate:  0.07, // warm amber dim
  neutral:   0.55, // white/neutral teal
}

// ── AudioFeatures ─────────────────────────────────────────────────────────────

export interface AudioFeatures {
  enabled: boolean
  energy: number    // 0–1 RMS overall
  bass: number      // 0–1 RMS 20–250 Hz
  mids: number      // 0–1 RMS 250–4000 Hz
  treble: number    // 0–1 RMS 4000–20000 Hz
  centroid: number  // 0–1 spectral centroid (normalized to Nyquist)
  flux: number      // 0–1 spectral flux (half-wave rectified frame delta)
  onset: number     // 0–1 onset strength (percussive attack detector)
  drop: boolean     // true when energy drops ≥50% after a build
  bpm: number       // detected BPM from onset autocorrelation, or 0
  // Vibe system
  vibeAxes: VibeAxes
  vibe: VibeType
}

export function initAudioFeatures(): AudioFeatures {
  return {
    enabled: false,
    energy: 0,
    bass: 0,
    mids: 0,
    treble: 0,
    centroid: 0,
    flux: 0,
    onset: 0,
    drop: false,
    bpm: 0,
    vibeAxes: initVibeAxes(),
    vibe: 'neutral',
  }
}

export type AudioFeatureKey =
  | 'energy'
  | 'bass'
  | 'mids'
  | 'treble'
  | 'centroid'
  | 'flux'
  | 'onset'

export interface AudioModulator {
  source: AudioFeatureKey
  target: string    // DefaultParam key e.g. 'brightness', 'hue', 'saturation'
  min: number       // output range min 0–1
  max: number       // output range max 0–1
  smoothing: number // 0–1 exponential moving average applied before mapping
}
