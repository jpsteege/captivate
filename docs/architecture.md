# Captivate — Architecture Overview

**What it is**: Electron + React app for controlling DMX fixtures and WLED addressable LED strips. Uses Ableton Link (node-link) for BPM sync, with real-time audio analysis and vibe-driven auto-control.

---

## Stack

- Electron (main process) + React/Redux (renderer)
- Redux Toolkit for state, styled-components for UI
- `node-link` native addon for Ableton Link BPM sync
- Web Audio API (renderer) for real-time audio analysis
- IPC between main and renderer for realtime state

---

## Key State

```
Redux (CleanReduxState):
├── dmx.universe[]            — DMX fixtures + channel assignments
├── dmx.fixtureTypesByID      — Fixture type definitions
├── dmx.led.ledFixtures[]     — WLedFixture[] (WLED strips)
├── dmx.led.activeFixture     — Currently selected LED fixture index
├── control.light             — Light scenes (byId, active)
│     └── scene.splitScenes[].ledEffect?    — Per-split LED pattern
│     └── scene.audioModulators?            — Audio → param modulators
├── control.master            — Global master brightness (0–1)
├── control.groupMaster       — Per-group brightness { [group]: 0–1 }
├── autoControl               — Auto-control state (see below)
└── gui.ledEnabled            — Gates WLED tab visibility + broadcast
    gui.audioEnabled          — Gates Audio/AutoControl tab visibility
    gui.activePage            — Current UI tab

RealtimeState (90 Hz, main → renderer via IPC):
├── time: TimeState           — beats, bpm, dt, isPlaying
├── dmxOut: number[512]       — Live DMX channel values
├── wledOut: { [mdns]: BaseColors[] } — Live per-LED RGB per fixture
├── splitStates[]             — Per-split outputParams + randomizer
└── audioFeatures             — Latest audio analysis (renderer-side, preserved across IPC)

AudioFeatures (renderer → main via 'audio_features' IPC at ~20 Hz):
├── enabled, energy, bass, mids, treble
├── centroid, flux, onset, drop, bpm
├── vibeAxes: { heat, energy, pulse, groove, momentum }
└── vibe: VibeType            — Current named vibe (20 types)
```

---

## Engine Loop (main process, 90 Hz)

`src/main/engine/engine.ts` → `getNextRealtimeState()`:
1. Reads `_controlState` (latest Redux state from renderer)
2. Reads `getLatestAudioFeatures()` (buffered from `audio_features` IPC)
3. Computes `splitStates` via `getOutputParams()` + `applyAudioModulators()`
4. Runs `generateAutoScene()` if vibe changed → dispatches `setLightSceneById` to renderer
5. Computes `dmxOut` via `calculateDmx()`
6. Computes `wledOut` via `calculateWledOut()` (applies LED effects + group master)
7. Returns new `RealtimeState` → sent to renderer via IPC

`WledManager` (separate 60 Hz loop) reads `realtimeState.wledOut` → `WledDevice.broadcast()` per fixture.

Both `calculateDmx` and `calculateWledOut` are gated on `timeState.isPlaying`.

---

## Audio Analysis

`src/renderer/hooks/useAudioAnalyzer.ts` — runs entirely in the renderer via Web Audio API.

**Per RAF frame (~60 Hz):**
- `AnalyserNode.getByteFrequencyData()` → 1024-bin FFT
- Computes: energy (RMS), bass/mids/treble (band means), spectral centroid, spectral flux
- Onset detection via adaptive flux threshold
- Drop detection via energy history ring buffer
- BPM via onset autocorrelation (updated every 60 frames)
- 5 vibe axes (heat, energy, pulse, groove, momentum) — slow EMA smoothed (τ ≈ 2s)
- Vibe classification via nearest centroid every 30 frames

**AudioContext suspension fix**: `ctx.resume()` called on creation and checked every frame — prevents Chromium autoplay policy from silently halting analysis.

**IPC flow**: Features dispatched to `realtimeStore` locally, sent to main process via `audio_features` channel every 3 frames (~20 Hz). Main process buffers via `getLatestAudioFeatures()`.

```
src/shared/audioFeatures.ts   — AudioFeatures, VibeAxes, VibeType (20), VIBE_CENTROIDS, classifyVibe()
src/renderer/hooks/useAudioAnalyzer.ts  — Web Audio API hook
src/renderer/ipcHandler.ts    — send_audio_features()
src/main/engine/ipcHandler.ts — getLatestAudioFeatures()
```

---

## Vibe System

20 named vibes: `deep, chill, float, groove, funk, soul, drive, pulse, rave, build, drop, breakdown, tropical, dark, bright, snappy, smooth, epic, intimate, neutral`

Classification: Euclidean nearest-centroid in 5D `[heat, energy, pulse, groove, momentum]` space, on slow-smoothed axes. Reclassified every ~0.5s to avoid flicker.

Each vibe has a suggested hue (`VIBE_HUE`) used for color-coding in the UI and as default for auto-control.

---

## LED Patterns

`src/shared/ledPatterns.ts` — post-processing pass applied to base colors computed from scene params.

```typescript
applyLedEffect(colors, effect, timeState, baseHue): BaseColors[]
```

| Effect | Description |
|--------|-------------|
| `none` | Pass-through |
| `chase` | BPM-synced lit window scrolling along strip |
| `pulse` | Beat-envelope brightness modulation |
| `strobe` | On/off flash at 1–8× beat subdivisions |
| `sparkle` | Random LEDs flash brighter |
| `gradient` | N color bands near `baseHue` (intensity=1–5 bands, speed=spread) |
| `colorwave` | Sinusoidal hue oscillation ±15% around `baseHue` |
| `breathe` | Slow sinusoidal brightness envelope |
| `mirror` | Left half mirrored onto right half |
| `lightning` | Random 5–50% subset of LEDs flash near `baseHue` |

`baseHue` comes from `splitState.outputParams.hue` — gradient/colorwave/lightning all respect the scene's hue rather than showing arbitrary colors.

Stored as `SplitScene_t.ledEffect?: LedEffect { type, speed, intensity }`.

---

## Audio Modulators

Maps a real-time audio feature to a scene parameter with range scaling and smoothing.

```typescript
interface AudioModulator {
  source: AudioFeatureKey  // 'energy' | 'bass' | 'mids' | 'treble' | 'onset' | 'flux' | 'centroid'
  target: string           // e.g. 'brightness', 'hue', 'saturation'
  min: number              // output range min (0–1)
  max: number              // output range max (0–1)
  smoothing: number        // EMA coefficient (0 = instant, 0.99 = very slow)
}
```

Stored as `LightScene_t.audioModulators?: AudioModulator[]`. Applied in the engine after LFO modulation via `applyAudioModulators()`.

---

## Auto Control

Vibe-driven automatic light scene generation.

**State** (`src/renderer/redux/autoControlSlice.ts`):
```
autoControl.enabled          — master on/off
autoControl.groupRoles       — { [group]: GroupRole }
autoControl.behaviorMap      — VibeBehaviorMap (role → default + vibeOverrides)
autoControl.globalDepth      — 0–1 master effect strength
autoControl.perGroupDepth    — { [group]: 0–1 } per-group override
```

**8 GroupRoles**: `dancefloor, stroboscope, laser, scanner, background, ambient, effect, beam, off`

**Flow**: Engine calls `generateAutoScene()` whenever vibe changes → builds a `LightScene_t` with one `SplitScene_t` per active group (role → `resolveBehavior()` → LED effect + hue + sat + brightness × depth) → dispatches `setLightSceneById({ id: AUTO_SCENE_ID })` to renderer → scene appears as "Auto" in the scene list.

```
src/shared/vibeBehavior.ts        — VibeBehavior, VibeBehaviorMap, DEFAULT_VIBE_BEHAVIOR_MAP, resolveBehavior()
src/shared/groupRoles.ts          — GroupRole type + labels/descriptions
src/renderer/redux/autoControlSlice.ts — Redux slice + AUTO_SCENE_ID constant
```

---

## Group Management & Per-Group Brightness

**Groups** are plain strings attached to fixtures at three levels:
- `Fixture.groups[]` — individual fixture instance
- `FixtureType.groups[]` — fixture type template
- `SubFixture.groups[]` — sub-fixture within a type
- `WLedFixture.groups[]` — WLED strip

`getSortedGroups()` in `src/shared/dmxUtil.ts` collects all unique groups from all levels.

**Per-group brightness** (`control.groupMaster: Record<string, number>`): stored alongside the global master. Engine computes effective master per fixture as `global_master × min(groupMaster values for fixture's groups)`. Applied in both `calculateDmx()` and `calculateWledOut()` via `getGroupEffectiveMaster()` from `src/shared/dmxUtil.ts`.

**Rename**: dispatching `renameGroup` (dmxSlice) + `renameGroupInScenes` (controlSlice) updates all fixture group arrays and all split-scene group keys atomically.

---

## WLED Data Flow

```
Scene params (hue/sat/bright/x/y/width/height)
  ↓ (per splitScene, via splitStates in RealtimeState)
calculateWledOut() — 90 Hz engine loop
  → getLedFixturesInGroups()          — match LED fixtures to scene groups
  → getLedValues(params, fixture,      — compute per-LED BaseColors[]
                 master × groupMaster)
  → applyLedEffect(colors, effect,     — optional LED pattern post-processing
                   timeState, baseHue)
  → max-blend with previous splits     — overlapping groups combine at peak
  → stored in realtimeState.wledOut

WledManager.broadcastInterval (60 Hz)
  → reads realtimeState.wledOut
  → WledDevice.broadcast(colors)       — send UDP DRGB or DDP packet
```

**Key requirements for WLED to respond to a scene:**
- `gui.ledEnabled` must be `true`
- `time.isPlaying` must be `true`
- LED fixture `groups[]` must overlap with the scene's splitScene groups

---

## WLED Fixture Model

```typescript
interface WLedFixture {
  mdns: string        // hostname, e.g. "wled-strip1" (no .local suffix)
  protocol: 'DDP' | 'UDP'
  led_count: number   // max 490 for UDP; DDP has no practical limit
  points: Point[]     // waypoints in 0–1 normalized grid space
  groups: string[]    // must match scene groups for scene to drive it
  window?: Window2D_t // optional static axis override (advanced)
}
```

---

## WLED Protocol

**UDP DRGB** (all WLED versions, max 490 LEDs):
- Header: `[0x02, timeout_seconds]`
- Payload: `R, G, B, R, G, B, ...` (3 bytes × led_count, values 0–255)

**DDP** (WLED 0.13+, recommended):
- Header: 10 bytes (flags, sequence, data type, destination, offset, length)
- Payload: RGB bytes, no LED count limit
- Use DDP if firmware ≥ 0.13 — the app auto-detects via Test Connection

The app auto-falls back from DDP → UDP after 10 consecutive failures.

---

## UI Pages

The menu bar is divided into three labeled sections:

**Fixtures**

| Page | File | Purpose |
|------|------|---------|
| Universe | `src/renderer/pages/Universe.tsx` | DMX fixture setup |
| Led | `src/renderer/pages/LedPage.tsx` | WLED fixture list + grid placement |
| WledMixer | `src/renderer/pages/WledMixer.tsx` | LED output review (per-fixture colour strips) |
| Groups | `src/renderer/pages/GroupsPage.tsx` | Group management: rename, fixtures list, per-group brightness |

**Scenes**

| Page | File | Purpose |
|------|------|---------|
| Modulation | `src/renderer/pages/Scenes.tsx` | Light scene editor + LED effect selector |
| Video | `src/renderer/pages/VisualizerPage.tsx` | Visual scenes |
| Mixer | `src/renderer/pages/Mixer.tsx` | DMX output review (512 channel sliders) |

**Sound** *(visible when audio enabled)*

| Page | File | Purpose |
|------|------|---------|
| Audio | `src/renderer/pages/AudioPage.tsx` | Audio analysis meters, vibe chip + axis bars |
| AutoControl | `src/renderer/pages/AutoControlPage.tsx` | Group roles, vibe→behavior mapping, live status |

Menu controlled by `src/renderer/redux/guiSlice.ts` → `Page` union → `src/renderer/menu/MenuBar.tsx` → `src/renderer/App.tsx`.

---

## Key Shared Utilities

| Function | File | Purpose |
|----------|------|---------|
| `getLedValues(params, fixture, master)` | `src/shared/ledFixtures.ts` | Compute per-LED BaseColors[] from scene params |
| `applyLedEffect(colors, effect, time, baseHue)` | `src/shared/ledPatterns.ts` | Apply LED pattern post-processing |
| `getLedFixturesInGroups()` | `src/shared/dmxUtil.ts` | Filter LED fixtures by scene groups |
| `getSortedGroups()` | `src/shared/dmxUtil.ts` | All unique group names across fixtures + LED fixtures |
| `getGroupEffectiveMaster(groups, groupMaster)` | `src/shared/dmxUtil.ts` | Per-fixture group brightness multiplier |
| `getWindowMultiplier()` | `src/shared/dmxUtil.ts` | Moving window brightness multiplier |
| `getBaseColorsFromHsv()` | `src/shared/baseColors.ts` | HSV → RGB conversion |
| `classifyVibe(axes)` | `src/shared/audioFeatures.ts` | Nearest-centroid vibe classification |
| `resolveBehavior(role, vibe, map)` | `src/shared/vibeBehavior.ts` | Merge role default + vibe override into VibeBehavior |
| `calculateDmx()` | `src/main/engine/dmxEngine.ts` | 512-channel DMX output from scene state |
| `calculateWledOut()` | `src/main/engine/engine.ts` | Per-fixture LED colours from scene state |

---

## WledDevice Connection State Machine

```
disconnected → discovering → connected
                                ↓
                             error → discovering (with backoff)
```

`isConnected()` requires: `connectionState === 'connected'` AND `lastSeen` (mDNS) < 15s AND `lastHttpSuccess` < 15s.

Both `lastSeen` and `lastHttpSuccess` are refreshed on each successful broadcast, keeping the connection alive during active output.

On initial startup: mDNS response triggers an immediate HTTP check so both timestamps are populated without needing a manual kick-start.
