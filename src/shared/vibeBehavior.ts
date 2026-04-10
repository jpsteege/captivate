import { LedEffect } from './ledPatterns'
import { VibeType } from './audioFeatures'
import { GroupRole } from './groupRoles'

// ---------------------------------------------------------------------------
// VibeBehavior — what a fixture group does for a given vibe
// ---------------------------------------------------------------------------
export interface VibeBehavior {
  ledEffect: LedEffect
  hueOverride?: number   // 0–1; if set, overrides the scene's base hue
  saturation: number     // 0–1
  brightness: number     // 0–1 base brightness before globalDepth scaling
}

// Per-role entry: a default behavior plus optional per-vibe overrides
export interface RoleBehaviorEntry {
  default: VibeBehavior
  vibeOverrides: Partial<Record<VibeType, Partial<VibeBehavior>>>
}

export type VibeBehaviorMap = Partial<Record<GroupRole, RoleBehaviorEntry>>

// ---------------------------------------------------------------------------
// Merge a per-vibe override on top of the role default
// ---------------------------------------------------------------------------
export function resolveBehavior(
  role: GroupRole,
  vibe: VibeType,
  map: VibeBehaviorMap
): VibeBehavior {
  const entry = map[role]
  if (!entry) return FALLBACK_BEHAVIOR
  const override = entry.vibeOverrides[vibe] ?? {}
  return { ...entry.default, ...override }
}

// ---------------------------------------------------------------------------
// Fallback used when role has no entry
// ---------------------------------------------------------------------------
const FALLBACK_BEHAVIOR: VibeBehavior = {
  ledEffect: { type: 'none', speed: 0.5, intensity: 0.5 },
  saturation: 1,
  brightness: 0.5,
}

// ---------------------------------------------------------------------------
// DEFAULT_VIBE_BEHAVIOR_MAP
// One entry per GroupRole, with role-level defaults and key vibe overrides.
// ---------------------------------------------------------------------------
export const DEFAULT_VIBE_BEHAVIOR_MAP: VibeBehaviorMap = {

  // ── Dancefloor ────────────────────────────────────────────────────────────
  // Primary lighting surface — strongly reactive to beat/energy
  dancefloor: {
    default: {
      ledEffect: { type: 'chase', speed: 0.5, intensity: 0.4 },
      saturation: 1,
      brightness: 0.7,
    },
    vibeOverrides: {
      deep:      { ledEffect: { type: 'pulse', speed: 0.3, intensity: 0.3 }, brightness: 0.4 },
      chill:     { ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.3 }, brightness: 0.35 },
      float:     { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.2 }, brightness: 0.25 },
      groove:    { ledEffect: { type: 'chase', speed: 0.5, intensity: 0.5 }, brightness: 0.7, hueOverride: 0.08 },
      funk:      { ledEffect: { type: 'sparkle', speed: 0.7, intensity: 0.6 }, brightness: 0.85, hueOverride: 0.06 },
      soul:      { ledEffect: { type: 'breathe', speed: 0.5, intensity: 0.5 }, brightness: 0.6, hueOverride: 0.02 },
      drive:     { ledEffect: { type: 'chase', speed: 0.7, intensity: 0.4 }, brightness: 0.8 },
      pulse:     { ledEffect: { type: 'pulse', speed: 0.8, intensity: 0.3 }, brightness: 0.9 },
      rave:      { ledEffect: { type: 'strobe', speed: 0.6, intensity: 0.5 }, brightness: 1.0, hueOverride: 0.65 },
      build:     { ledEffect: { type: 'chase', speed: 0.8, intensity: 0.6 }, brightness: 0.8 },
      drop:      { ledEffect: { type: 'strobe', speed: 0.9, intensity: 0.6 }, brightness: 1.0 },
      breakdown: { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.2 }, brightness: 0.25 },
      tropical:  { ledEffect: { type: 'sparkle', speed: 0.6, intensity: 0.6 }, brightness: 0.8, hueOverride: 0.38 },
      dark:      { ledEffect: { type: 'pulse', speed: 0.5, intensity: 0.3 }, brightness: 0.6, hueOverride: 0.80 },
      bright:    { ledEffect: { type: 'colorwave', speed: 0.5, intensity: 0.4 }, brightness: 0.75, hueOverride: 0.85 },
      snappy:    { ledEffect: { type: 'sparkle', speed: 0.9, intensity: 0.7 }, brightness: 0.95, hueOverride: 0.33 },
      smooth:    { ledEffect: { type: 'colorwave', speed: 0.3, intensity: 0.2 }, brightness: 0.55, hueOverride: 0.05 },
      epic:      { ledEffect: { type: 'chase', speed: 0.9, intensity: 0.8 }, brightness: 1.0 },
      intimate:  { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.15 }, brightness: 0.2 },
      neutral:   { ledEffect: { type: 'pulse', speed: 0.5, intensity: 0.4 }, brightness: 0.55 },
    },
  },

  // ── Stroboscope ───────────────────────────────────────────────────────────
  // Strobe-only fixture — fires on high energy/onset moments
  stroboscope: {
    default: {
      ledEffect: { type: 'none', speed: 0.5, intensity: 0.5 },
      saturation: 0,
      brightness: 0,
    },
    vibeOverrides: {
      pulse:     { ledEffect: { type: 'strobe', speed: 0.5, intensity: 0.4 }, saturation: 0, brightness: 1.0 },
      rave:      { ledEffect: { type: 'strobe', speed: 0.8, intensity: 0.6 }, saturation: 0, brightness: 1.0 },
      drop:      { ledEffect: { type: 'strobe', speed: 0.9, intensity: 0.7 }, saturation: 0, brightness: 1.0 },
      build:     { ledEffect: { type: 'strobe', speed: 0.4, intensity: 0.3 }, saturation: 0, brightness: 0.9 },
      snappy:    { ledEffect: { type: 'strobe', speed: 0.6, intensity: 0.5 }, saturation: 0, brightness: 1.0 },
      epic:      { ledEffect: { type: 'strobe', speed: 0.5, intensity: 0.5 }, saturation: 0, brightness: 1.0 },
      funk:      { ledEffect: { type: 'strobe', speed: 0.3, intensity: 0.3 }, saturation: 0, brightness: 0.8 },
    },
  },

  // ── Laser ─────────────────────────────────────────────────────────────────
  // Sharp, fast-reacting fixture
  laser: {
    default: {
      ledEffect: { type: 'pulse', speed: 0.6, intensity: 0.3 },
      saturation: 1,
      brightness: 0.6,
    },
    vibeOverrides: {
      deep:      { ledEffect: { type: 'none', speed: 0.5, intensity: 0.5 }, brightness: 0 },
      chill:     { ledEffect: { type: 'none', speed: 0.5, intensity: 0.5 }, brightness: 0 },
      float:     { ledEffect: { type: 'none', speed: 0.5, intensity: 0.5 }, brightness: 0 },
      snappy:    { ledEffect: { type: 'sparkle', speed: 0.9, intensity: 0.8 }, brightness: 0.9, hueOverride: 0.60 },
      drive:     { ledEffect: { type: 'chase', speed: 0.8, intensity: 0.5 }, brightness: 0.85, hueOverride: 0.60 },
      rave:      { ledEffect: { type: 'strobe', speed: 0.7, intensity: 0.6 }, brightness: 1.0, hueOverride: 0.65 },
      drop:      { ledEffect: { type: 'lightning', speed: 0.9, intensity: 0.7 }, brightness: 1.0 },
      build:     { ledEffect: { type: 'pulse', speed: 0.7, intensity: 0.5 }, brightness: 0.8 },
      pulse:     { ledEffect: { type: 'pulse', speed: 0.8, intensity: 0.5 }, brightness: 0.9 },
      epic:      { ledEffect: { type: 'chase', speed: 1.0, intensity: 0.8 }, brightness: 1.0 },
    },
  },

  // ── Scanner ───────────────────────────────────────────────────────────────
  // Sweeping / moving head — gradual and sweeping motion
  scanner: {
    default: {
      ledEffect: { type: 'colorwave', speed: 0.4, intensity: 0.3 },
      saturation: 1,
      brightness: 0.65,
    },
    vibeOverrides: {
      groove:    { ledEffect: { type: 'colorwave', speed: 0.5, intensity: 0.4 }, brightness: 0.7, hueOverride: 0.08 },
      build:     { ledEffect: { type: 'chase', speed: 0.7, intensity: 0.5 }, brightness: 0.85 },
      epic:      { ledEffect: { type: 'chase', speed: 0.9, intensity: 0.7 }, brightness: 1.0 },
      drop:      { ledEffect: { type: 'mirror', speed: 0.8, intensity: 0.8 }, brightness: 1.0 },
      breakdown: { ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.2 }, brightness: 0.25 },
      float:     { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.15 }, brightness: 0.2 },
    },
  },

  // ── Background ────────────────────────────────────────────────────────────
  // Wash / ambient LED fill — slow, mood-defining
  background: {
    default: {
      ledEffect: { type: 'colorwave', speed: 0.3, intensity: 0.2 },
      saturation: 0.8,
      brightness: 0.5,
    },
    vibeOverrides: {
      deep:      { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.3 }, brightness: 0.3, hueOverride: 0.65 },
      chill:     { ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.3 }, brightness: 0.35, hueOverride: 0.55 },
      float:     { ledEffect: { type: 'breathe', speed: 0.15, intensity: 0.2 }, brightness: 0.2, hueOverride: 0.72 },
      groove:    { ledEffect: { type: 'colorwave', speed: 0.4, intensity: 0.3 }, brightness: 0.6, hueOverride: 0.08 },
      funk:      { ledEffect: { type: 'colorwave', speed: 0.5, intensity: 0.35 }, brightness: 0.7, hueOverride: 0.06 },
      soul:      { ledEffect: { type: 'breathe', speed: 0.4, intensity: 0.4 }, brightness: 0.55, hueOverride: 0.02 },
      drive:     { ledEffect: { type: 'colorwave', speed: 0.5, intensity: 0.3 }, brightness: 0.65, hueOverride: 0.60 },
      pulse:     { ledEffect: { type: 'pulse', speed: 0.6, intensity: 0.4 }, brightness: 0.7 },
      rave:      { ledEffect: { type: 'gradient', speed: 0.6, intensity: 0.4 }, brightness: 0.6, hueOverride: 0.65 },
      build:     { ledEffect: { type: 'colorwave', speed: 0.6, intensity: 0.4 }, brightness: 0.7 },
      drop:      { ledEffect: { type: 'pulse', speed: 1.0, intensity: 0.5 }, brightness: 1.0 },
      breakdown: { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.15 }, brightness: 0.2, hueOverride: 0.65 },
      tropical:  { ledEffect: { type: 'gradient', speed: 0.5, intensity: 0.5 }, brightness: 0.65, hueOverride: 0.38 },
      dark:      { ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.25 }, brightness: 0.45, hueOverride: 0.80 },
      bright:    { ledEffect: { type: 'colorwave', speed: 0.5, intensity: 0.35 }, brightness: 0.65, hueOverride: 0.85 },
      smooth:    { ledEffect: { type: 'breathe', speed: 0.4, intensity: 0.35 }, brightness: 0.5, hueOverride: 0.05 },
      epic:      { ledEffect: { type: 'gradient', speed: 0.7, intensity: 0.5 }, brightness: 0.85 },
      intimate:  { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.15 }, brightness: 0.15, hueOverride: 0.07 },
    },
  },

  // ── Ambient ───────────────────────────────────────────────────────────────
  // Very smooth, color only — reflects mood, ignores beat
  ambient: {
    default: {
      ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.4 },
      saturation: 0.7,
      brightness: 0.4,
    },
    vibeOverrides: {
      float:     { ledEffect: { type: 'breathe', speed: 0.15, intensity: 0.3 }, brightness: 0.2, hueOverride: 0.72 },
      chill:     { brightness: 0.3, hueOverride: 0.55 },
      soul:      { brightness: 0.5, hueOverride: 0.02 },
      smooth:    { brightness: 0.45, hueOverride: 0.05 },
      intimate:  { ledEffect: { type: 'breathe', speed: 0.15, intensity: 0.2 }, brightness: 0.15, hueOverride: 0.07 },
      funk:      { brightness: 0.65, hueOverride: 0.06 },
      groove:    { brightness: 0.6, hueOverride: 0.08 },
      tropical:  { brightness: 0.6, hueOverride: 0.38 },
    },
  },

  // ── Effect ────────────────────────────────────────────────────────────────
  // Flexible — vibe-specific, used for special effects fixtures
  effect: {
    default: {
      ledEffect: { type: 'pulse', speed: 0.5, intensity: 0.5 },
      saturation: 1,
      brightness: 0.65,
    },
    vibeOverrides: {
      build:     { ledEffect: { type: 'chase', speed: 0.7, intensity: 0.6 }, brightness: 0.8 },
      drop:      { ledEffect: { type: 'lightning', speed: 0.9, intensity: 0.8 }, brightness: 1.0 },
      rave:      { ledEffect: { type: 'strobe', speed: 0.7, intensity: 0.6 }, brightness: 1.0, hueOverride: 0.65 },
      snappy:    { ledEffect: { type: 'sparkle', speed: 0.9, intensity: 0.7 }, brightness: 0.9, hueOverride: 0.33 },
      epic:      { ledEffect: { type: 'mirror', speed: 0.8, intensity: 0.7 }, brightness: 1.0 },
      breakdown: { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.2 }, brightness: 0.2 },
      chill:     { ledEffect: { type: 'breathe', speed: 0.3, intensity: 0.3 }, brightness: 0.35 },
    },
  },

  // ── Beam ──────────────────────────────────────────────────────────────────
  // Moving head beam — sweeps based on mids + energy
  beam: {
    default: {
      ledEffect: { type: 'colorwave', speed: 0.4, intensity: 0.3 },
      saturation: 1,
      brightness: 0.6,
    },
    vibeOverrides: {
      drop:      { ledEffect: { type: 'strobe', speed: 0.5, intensity: 0.5 }, brightness: 1.0 },
      build:     { ledEffect: { type: 'chase', speed: 0.7, intensity: 0.5 }, brightness: 0.85 },
      epic:      { ledEffect: { type: 'mirror', speed: 0.8, intensity: 0.7 }, brightness: 1.0 },
      breakdown: { ledEffect: { type: 'breathe', speed: 0.2, intensity: 0.2 }, brightness: 0.25 },
      float:     { ledEffect: { type: 'breathe', speed: 0.15, intensity: 0.15 }, brightness: 0.2 },
    },
  },

}
