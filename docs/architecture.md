# Captivate — Architecture Overview

**What it is**: Electron + React app for controlling DMX fixtures and WLED addressable LED strips. Uses Ableton Link (node-link) for BPM sync.

---

## Stack

- Electron (main process) + React/Redux (renderer)
- Redux Toolkit for state, styled-components for UI
- `node-link` native addon for Ableton Link BPM sync
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
├── control.master            — Master brightness
└── gui.ledEnabled            — Gates WLED tab visibility + broadcast output
    gui.activePage            — Current UI tab

RealtimeState (90 Hz, sent via IPC):
├── time: TimeState           — beats, bpm, dt, isPlaying
├── dmxOut: number[512]       — Live DMX channel values
├── wledOut: { [mdns]: BaseColors[] } — Live per-LED RGB values per fixture
└── splitStates[]             — Per-split outputParams (hue, sat, bright, x, y, width, height...)
```

---

## Engine Loop (main process, 90 Hz)

`src/main/engine/engine.ts` → `getNextRealtimeState()` → computes `splitStates` + `dmxOut` + `wledOut` → sends to renderer via IPC.

`WledManager` (separate 60 Hz loop) reads `realtimeState.wledOut` → calls `WledDevice.broadcast()` per fixture.

Both `calculateDmx` and `calculateWledOut` are gated on `timeState.isPlaying` — Start/Stop controls both DMX and WLED output.

---

## WLED Data Flow

```
Scene params (hue/sat/bright/x/y/width/height)
  ↓ (per splitScene, via splitStates in RealtimeState)
calculateWledOut() — runs in 90 Hz engine loop
  → getLedFixturesInGroups() — match LED fixtures to scene groups
  → getLedValues(params, fixture, master) — compute per-LED RGB
  → stored in realtimeState.wledOut

WledManager.broadcastInterval (60 Hz)
  → reads realtimeState.wledOut
  → WledDevice.broadcast(colors) — send UDP DRGB or DDP packet
```

**Key requirements for WLED to respond to a scene:**
- `gui.ledEnabled` must be `true` (toggles the LED tab and enables broadcast)
- `time.isPlaying` must be `true` (Start/Stop button)
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

Points define a polyline path in the 2D grid; `led_count` LEDs are interpolated along it proportionally.

---

## WLED Protocol

**UDP DRGB** (all WLED versions, max 490 LEDs):
- Header: `[0x02, timeout_seconds]`
- Payload: `R, G, B, R, G, B, ...` (3 bytes × led_count, values 0–255)

**DDP** (WLED 0.13+, recommended):
- Header: 10 bytes (flags, sequence, data type, destination, offset, length)
- Payload: RGB bytes, no LED count limit
- Use DDP if firmware ≥ 0.13 — the app detects this automatically via Test Connection

The app auto-falls back from DDP → UDP after 10 consecutive failures.

---

## UI Pages

| Page | File | Purpose |
|------|------|---------|
| Universe | `src/renderer/pages/Universe.tsx` | DMX fixture setup |
| Led | `src/renderer/pages/LedPage.tsx` | WLED fixture list + grid placement |
| Modulation | `src/renderer/pages/Scenes.tsx` | Light scene editor |
| Mixer | `src/renderer/pages/Mixer.tsx` | DMX output review (512 channel sliders) |
| WledMixer | `src/renderer/pages/WledMixer.tsx` | LED output review (per-fixture colour strips) |
| Video | `src/renderer/pages/VisualizerPage.tsx` | Visual scenes |

Menu controlled by `src/renderer/redux/guiSlice.ts` → `Page` union type → `src/renderer/menu/MenuBar.tsx` → `src/renderer/App.tsx` routing.

---

## Key Shared Utilities

| Function | File | Purpose |
|----------|------|---------|
| `getLedValues(params, fixture, master)` | `src/shared/ledFixtures.ts` | Compute per-LED BaseColors[] from scene params |
| `pointsToSegments(points)` | `src/shared/ledFixtures.ts` | Convert fixture waypoints to line segments |
| `getLedFixturesInGroups()` | `src/shared/dmxUtil.ts` | Filter LED fixtures by scene groups |
| `getWindowMultiplier()` | `src/shared/dmxUtil.ts` | Moving window brightness multiplier |
| `getBaseColorsFromHsv()` | `src/shared/baseColors.ts` | HSV → RGB conversion |
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
