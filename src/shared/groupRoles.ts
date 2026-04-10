import { AudioModulator } from './audioFeatures'

export type GroupRole =
  | 'dancefloor'    // strong bass/beat response, LED chase/sparkle
  | 'stroboscope'   // strobe-only, fires on high energy/onset moments
  | 'laser'         // sharp snappy effects, onset-triggered
  | 'scanner'       // sweeping, beat-synced movement
  | 'background'    // ambient wash/fill, mood color, subtle energy response
  | 'ambient'       // very smooth, color from mood, slow changes
  | 'effect'        // flexible vibe-specific fixture
  | 'beam'          // sweeping beam, energy + mids driven
  | 'off'           // no auto-control for this group

export const GROUP_ROLES: GroupRole[] = [
  'off', 'dancefloor', 'stroboscope', 'laser', 'scanner',
  'background', 'ambient', 'effect', 'beam',
]

export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
  off:         'Off',
  dancefloor:  'Dancefloor',
  stroboscope: 'Stroboscope',
  laser:       'Laser',
  scanner:     'Scanner',
  background:  'Background',
  ambient:     'Ambient',
  effect:      'Effect',
  beam:        'Beam',
}

export const GROUP_ROLE_DESCRIPTIONS: Record<GroupRole, string> = {
  off:         'No auto-control for this group',
  dancefloor:  'Primary surface — strong beat/bass response, LED patterns',
  stroboscope: 'Strobe-only — fires on high energy and drops',
  laser:       'Sharp fast effects — onset-triggered, snappy response',
  scanner:     'Sweeping motion — smooth beat-synced movement',
  background:  'Ambient wash — slow mood color, subtle energy response',
  ambient:     'Very smooth — reflects mood only, ignores beat',
  effect:      'Flexible — vibe-specific special effect fixture',
  beam:        'Moving beam — sweeps with mids and energy',
}

// Legacy: pre-baked AudioModulator presets per role (used by old Auto Control page)
export const GROUP_ROLE_PRESETS: Record<GroupRole, AudioModulator[]> = {
  off:         [],
  dancefloor: [
    { source: 'bass', target: 'brightness', min: 0.05, max: 1.0, smoothing: 0.3 },
    { source: 'onset', target: 'brightness', min: 0.0, max: 1.0, smoothing: 0.05 },
  ],
  stroboscope: [
    { source: 'onset', target: 'brightness', min: 0.0, max: 1.0, smoothing: 0.05 },
  ],
  laser: [
    { source: 'onset', target: 'brightness', min: 0.0, max: 1.0, smoothing: 0.1 },
    { source: 'flux', target: 'brightness', min: 0.0, max: 1.0, smoothing: 0.1 },
  ],
  scanner: [
    { source: 'mids', target: 'hue', min: 0.0, max: 0.5, smoothing: 0.6 },
    { source: 'energy', target: 'brightness', min: 0.2, max: 0.9, smoothing: 0.5 },
  ],
  background: [
    { source: 'energy', target: 'saturation', min: 0.3, max: 1.0, smoothing: 0.8 },
    { source: 'energy', target: 'brightness', min: 0.2, max: 0.7, smoothing: 0.9 },
  ],
  ambient: [
    { source: 'energy', target: 'saturation', min: 0.2, max: 0.8, smoothing: 0.95 },
    { source: 'energy', target: 'brightness', min: 0.1, max: 0.5, smoothing: 0.95 },
  ],
  effect: [
    { source: 'onset', target: 'brightness', min: 0.0, max: 1.0, smoothing: 0.1 },
    { source: 'flux', target: 'brightness', min: 0.1, max: 0.9, smoothing: 0.2 },
  ],
  beam: [
    { source: 'mids', target: 'hue', min: 0.0, max: 0.5, smoothing: 0.5 },
    { source: 'treble', target: 'brightness', min: 0.1, max: 0.8, smoothing: 0.4 },
  ],
}
