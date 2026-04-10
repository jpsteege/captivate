import { useEffect, useRef, useState } from 'react'
import {
  AudioFeatures,
  VibeAxes,
  VibeType,
  classifyVibe,
  initAudioFeatures,
  initVibeAxes,
} from '../../shared/audioFeatures'
import { useRealtimeDispatch } from '../redux/realtimeStore'
import { send_audio_features } from '../ipcHandler'

const FFT_SIZE = 2048
const ENERGY_HISTORY_FRAMES = 120  // ~2 s at 60 fps
const ONSET_HISTORY_FRAMES = 180   // ~3 s at 60 fps for BPM autocorr
const BPM_UPDATE_EVERY = 60        // frames between BPM recalculations
const VIBE_UPDATE_EVERY = 30       // frames between vibe reclassification (~0.5s)
const SLOW_EMA = 0.97              // τ ≈ 2s at 60fps for vibe axis smoothing
const FAST_EMA = 0.85              // τ ≈ 0.3s at 60fps for pulse axis

function bandMean(data: Uint8Array, lo: number, hi: number): number {
  const count = hi - lo + 1
  if (count <= 0) return 0
  let sum = 0
  for (let k = lo; k <= hi; k++) sum += data[k]
  return sum / (count * 255)
}

function autocorrBpm(onsets: number[], sampleRate: number): number {
  const n = onsets.length
  if (n < 60) return 0
  let bestBpm = 0
  let bestScore = -Infinity
  for (let bpm = 50; bpm <= 200; bpm += 2) {
    const lagFrames = Math.round((sampleRate * 60) / bpm)
    if (lagFrames >= n) continue
    let score = 0
    for (let i = lagFrames; i < n; i++) score += onsets[i] * onsets[i - lagFrames]
    score /= n - lagFrames
    if (score > bestScore) { bestScore = score; bestBpm = bpm }
  }
  return bestScore > 0.0005 ? bestBpm : 0
}

export interface AudioAnalyzerControls {
  devices: MediaDeviceInfo[]
  deviceId: string | null
  enabled: boolean
  setDeviceId: (id: string | null) => void
  setEnabled: (enabled: boolean) => void
}

export function useAudioAnalyzer(): AudioAnalyzerControls {
  const dispatch = useRealtimeDispatch()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const prevDataRef = useRef<Uint8Array | null>(null)
  const fluxSmoothedRef = useRef(0)
  const energyHistoryRef = useRef<number[]>([])
  const onsetHistoryRef = useRef<number[]>([])
  const frameCountRef = useRef(0)
  const bpmRef = useRef(0)

  // Vibe axis state (slow-smoothed for stable classification)
  const vibeAxesSmoothedRef = useRef<VibeAxes>(initVibeAxes())
  // Fast-smoothed pulse (onset EMA for vibe axis, separate from onset display)
  const pulseSmoothedRef = useRef(0)
  // Momentum: two energy averages at different time horizons
  const energyFastRef = useRef(0)   // ~0.5s EMA
  const energySlowRef = useRef(0)   // ~3s EMA
  const vibeRef = useRef<VibeType>('neutral')

  // Enumerate audio input devices
  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => setDevices(list.filter((d) => d.kind === 'audioinput')))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!enabled) {
      cleanup()
      dispatch({ type: 'updateAudioFeatures', payload: initAudioFeatures() })
      return
    }

    let cancelled = false

    async function start() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        const ctx = new AudioContext()
        contextRef.current = ctx
        // Resume immediately — Chromium suspends AudioContext if not created
        // directly inside a user-gesture handler (autoplay policy).
        await ctx.resume()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        startLoop(analyser, ctx.sampleRate)
      } catch (err) {
        console.error('[AudioAnalyzer] getUserMedia error:', err)
      }
    }

    start()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [enabled, deviceId])

  function cleanup() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    contextRef.current?.close().catch(() => {})
    streamRef.current = null
    contextRef.current = null
    analyserRef.current = null
    prevDataRef.current = null
    fluxSmoothedRef.current = 0
    energyHistoryRef.current = []
    onsetHistoryRef.current = []
    frameCountRef.current = 0
    bpmRef.current = 0
    vibeAxesSmoothedRef.current = initVibeAxes()
    pulseSmoothedRef.current = 0
    energyFastRef.current = 0
    energySlowRef.current = 0
    vibeRef.current = 'neutral'
  }

  function startLoop(analyser: AnalyserNode, sampleRate: number) {
    const binCount = analyser.frequencyBinCount // FFT_SIZE / 2
    const data = new Uint8Array(binCount)
    const binHz = sampleRate / FFT_SIZE

    // Precompute band bin ranges
    const bassLo = Math.max(0, Math.floor(20 / binHz))
    const bassHi = Math.min(binCount - 1, Math.floor(250 / binHz))
    const midsLo = Math.min(binCount - 1, Math.floor(250 / binHz) + 1)
    const midsHi = Math.min(binCount - 1, Math.floor(4000 / binHz))
    const trebleLo = Math.min(binCount - 1, Math.floor(4000 / binHz) + 1)
    const trebleHi = Math.min(binCount - 1, Math.floor(20000 / binHz))

    function loop() {
      // Re-resume if Chromium suspended the context (e.g. after window blur)
      if (contextRef.current && contextRef.current.state === 'suspended') {
        contextRef.current.resume()
      }
      analyser.getByteFrequencyData(data)
      frameCountRef.current++

      // --- Energy (RMS proxy) ---
      let energySum = 0
      for (let k = 0; k < binCount; k++) {
        const v = data[k] / 255
        energySum += v * v
      }
      const energy = Math.sqrt(energySum / binCount)

      // --- Frequency bands ---
      const bass = bandMean(data, bassLo, bassHi)
      const mids = bandMean(data, midsLo, midsHi)
      const treble = bandMean(data, trebleLo, trebleHi)

      // --- Spectral centroid (normalized 0–1) ---
      let weightedSum = 0
      let magnitudeSum = 0
      for (let k = 0; k < binCount; k++) {
        weightedSum += k * data[k]
        magnitudeSum += data[k]
      }
      const centroid = magnitudeSum > 0 ? weightedSum / (magnitudeSum * binCount) : 0

      // --- Spectral flux (half-wave rectified) ---
      let fluxSum = 0
      if (prevDataRef.current) {
        for (let k = 0; k < binCount; k++) {
          const diff = data[k] - prevDataRef.current[k]
          if (diff > 0) fluxSum += diff
        }
      }
      const flux = fluxSum / (binCount * 255)
      if (!prevDataRef.current) prevDataRef.current = new Uint8Array(binCount)
      prevDataRef.current.set(data)

      // --- Onset (adaptive flux threshold) ---
      fluxSmoothedRef.current = 0.9 * fluxSmoothedRef.current + 0.1 * flux
      const onsetRaw = Math.max(flux - fluxSmoothedRef.current * 1.5, 0) * 10
      const onset = Math.min(onsetRaw, 1)

      // --- Energy history for drop detection ---
      const energyHistory = energyHistoryRef.current
      energyHistory.push(energy)
      if (energyHistory.length > ENERGY_HISTORY_FRAMES) energyHistory.shift()
      let maxEnergy = 0
      for (const e of energyHistory) if (e > maxEnergy) maxEnergy = e
      const drop = energyHistory.length >= 60 && energy < maxEnergy * 0.5 && maxEnergy > 0.1

      // --- Onset history for BPM autocorrelation ---
      const onsetHistory = onsetHistoryRef.current
      onsetHistory.push(onset)
      if (onsetHistory.length > ONSET_HISTORY_FRAMES) onsetHistory.shift()
      if (frameCountRef.current % BPM_UPDATE_EVERY === 0) {
        bpmRef.current = autocorrBpm(onsetHistory, 60)
      }

      // ── Vibe Axes Computation ──────────────────────────────────────────────

      // heat: bass-heavy = warm (1), treble-heavy/bright = cool (0)
      const heatRaw = Math.min(1, bass * 0.6 + (1 - centroid) * 0.4)

      // pulse: fast EMA of onset → percussiveness
      pulseSmoothedRef.current = FAST_EMA * pulseSmoothedRef.current + (1 - FAST_EMA) * onset
      const pulseRaw = pulseSmoothedRef.current

      // groove: mid-to-energy ratio → syncopated mid-range fullness
      const grooveRaw = Math.min(1, mids / (energy + 0.01))

      // momentum: fast vs slow energy trend → rising = building
      energyFastRef.current = 0.90 * energyFastRef.current + 0.10 * energy  // ~0.7s
      energySlowRef.current = 0.98 * energySlowRef.current + 0.02 * energy  // ~3s
      const slope = energyFastRef.current - energySlowRef.current           // positive = rising
      const momentumRaw = Math.min(1, Math.max(0, slope * 5 + 0.5))         // center at 0.5

      // Slow-smooth all axes for stable vibe classification
      const ax = vibeAxesSmoothedRef.current
      ax.heat = SLOW_EMA * ax.heat + (1 - SLOW_EMA) * heatRaw
      ax.energy = SLOW_EMA * ax.energy + (1 - SLOW_EMA) * energy
      ax.pulse = SLOW_EMA * ax.pulse + (1 - SLOW_EMA) * pulseRaw
      ax.groove = SLOW_EMA * ax.groove + (1 - SLOW_EMA) * grooveRaw
      ax.momentum = SLOW_EMA * ax.momentum + (1 - SLOW_EMA) * momentumRaw

      // Reclassify vibe periodically on the smoothed axes
      if (frameCountRef.current % VIBE_UPDATE_EVERY === 0) {
        vibeRef.current = classifyVibe(ax)
      }

      const vibeAxes: VibeAxes = { ...ax }

      // ── Assemble AudioFeatures ─────────────────────────────────────────────
      const features: AudioFeatures = {
        enabled: true,
        energy,
        bass,
        mids,
        treble,
        centroid,
        flux,
        onset,
        drop,
        bpm: bpmRef.current,
        vibeAxes,
        vibe: vibeRef.current,
      }

      dispatch({ type: 'updateAudioFeatures', payload: features })
      // Send to main process every 3 frames (~20 Hz) for audio modulation
      if (frameCountRef.current % 3 === 0) {
        send_audio_features(features)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }

  return { devices, deviceId, enabled, setDeviceId, setEnabled }
}
