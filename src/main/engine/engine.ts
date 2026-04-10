import { WebContents } from 'electron'
import { ConnectionManager } from './connections/ConnectionManager'
import * as MidiConnection from './midiConnection'
import type NodeLink from 'node-link'
import { ipcSetup, IPC_Callbacks } from './ipcHandler'
import { CleanReduxState } from '../../renderer/redux/store'
import {
  RealtimeState,
  initRealtimeState,
  SplitState,
} from '../../renderer/redux/realtimeStore'
import { TimeState, initTimeState } from '../../shared/TimeState'
import {
  initRandomizerState,
  resizeRandomizer,
  updateIndexes,
} from '../../shared/randomizer'
import { getOutputParams } from '../../shared/modulation'
import { handleMessage } from './handleMidi'
import openVisualizerWindow, {
  VisualizerContainer,
} from './createVisualizerWindow'
import { calculateDmx } from './dmxEngine'
import { getLedValues } from '../../shared/ledFixtures'
import { BaseColors } from '../../shared/baseColors'
import { applyLedEffect } from '../../shared/ledPatterns'
import { AudioFeatures, AudioModulator } from '../../shared/audioFeatures'
import { getLatestAudioFeatures } from './ipcHandler'
import { Params } from '../../shared/params'
import { handleAutoScene } from '../../shared/autoScene'
import { setActiveScene, setLightSceneById } from '../../renderer/redux/controlSlice'
import { AUTO_SCENE_ID } from '../../renderer/redux/autoControlSlice'
import { resolveBehavior } from '../../shared/vibeBehavior'
import { initLightScene, initSplitScene, LightScene_t } from '../../shared/Scenes'
import TapTempoEngine from './TapTempoEngine'
import { flatten_fixtures, getFixturesInGroups, getLedFixturesInGroups, getSortedGroups } from '../../shared/dmxUtil'
import { ThrottleMap } from './midiConnection'
import { MidiMessage, midiInputID } from '../../shared/midi'
import { getAllParamKeys } from '../../renderer/redux/dmxSlice'
import { indexArray } from '../../shared/util'
import WledManager from './wled/wled_manager'

let _nodeLink: NodeLink | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NodeLinkCtor: new () => NodeLink = require('node-link')
  _nodeLink = new NodeLinkCtor()
  _nodeLink.setIsPlaying(true)
  _nodeLink.enableStartStopSync(true)
  _nodeLink.enable(true)
} catch (err) {
  console.error('[engine] Failed to load node-link native addon:', err)
  console.error(
    '[engine] Remediation: run `npm run rebuild-node-link --prefix release/app` then restart the app. Link sync will be disabled.'
  )
}
let _ipcCallbacks: IPC_Callbacks | null = null
let _controlState: CleanReduxState | null = null
let _realtimeState: RealtimeState = initRealtimeState()
let _lastFrameTime = 0
const _tapTempoEngine = new TapTempoEngine()
let _lastAutoVibe = ''
function _tapTempo() {
  if (_nodeLink === null) return
  const nodeLink = _nodeLink
  _tapTempoEngine.tap((newBpm) => {
    nodeLink.setTempo(newBpm)
  }, (newPhase, { force }) => {
    const info = nodeLink.getSessionInfoCurrent();
    const newBeat = info.beats - info.phase + newPhase;
    if (force) {
      nodeLink.forceBeat(newBeat);
    } else {
      nodeLink.requestBeat(newBeat);
    }
  })
}
let _connectionManager = new ConnectionManager({
  controlState: () => _controlState,
  realtimeState: () => _realtimeState,
})
let _wledManager: WledManager | null = null

const _midiThrottle = new ThrottleMap((message: MidiMessage) => {
  if (_controlState !== null && _ipcCallbacks !== null) {
    handleMessage(
      message,
      _controlState,
      _realtimeState,
      _nodeLink,
      _ipcCallbacks.send_dispatch,
      _tapTempo
    )
  }
}, 1000 / 60)

export function getIpcCallbacks() {
  return _ipcCallbacks
}

export function getWledManager() {
  return _wledManager
}

export function start(
  renderer: WebContents,
  visualizerContainer: VisualizerContainer
) {
  _ipcCallbacks = ipcSetup({
    renderer: renderer,
    visualizerContainer: visualizerContainer,
    on_new_control_state: (newState) => {
      _controlState = newState
    },
    on_user_command: (command) => {
      if (command.type === 'IncrementTempo') {
        _nodeLink?.setTempo(_realtimeState.time.bpm + command.amount)
      } else if (command.type === 'SetLinkEnabled') {
        _nodeLink?.enable(command.isEnabled)
      } else if (command.type === 'EnableStartStopSync') {
        _nodeLink?.enableStartStopSync(command.isEnabled)
      } else if (command.type === 'SetIsPlaying') {
        _nodeLink?.setIsPlaying(command.isPlaying)
      } else if (command.type === 'SetBPM') {
        _nodeLink?.setTempo(command.bpm)
      } else if (command.type === 'TapTempo') {
        _tapTempo()
      }
    },
    on_open_visualizer: () => {
      openVisualizerWindow(visualizerContainer)
    },
  })

  // We're currently calculating the realtimeState 90x per second.
  // The renderer should have a new realtime state on each animation frame (assuming a refresh rate of 60 hz)
  setInterval(() => {
    const nextTimeState = getNextTimeState()
    if (_ipcCallbacks !== null && _controlState !== null) {
      _realtimeState = getNextRealtimeState(
        _realtimeState,
        nextTimeState,
        _ipcCallbacks,
        _controlState
      )
      _ipcCallbacks.send_time_state(_realtimeState)
      _ipcCallbacks.send_visualizer_state({
        rt: _realtimeState,
        state: _controlState,
      })
    }
  }, 1000 / 90)

  _wledManager = new WledManager({
    controlState: () => _controlState,
    realtimeState: () => _realtimeState,
    onWledConnectionUpdate: (info) =>
      _ipcCallbacks?.send_wled_connection_update(info),
  })
  return _ipcCallbacks
}

export function stop() {
  if (_wledManager) {
    _wledManager.release()
    _wledManager = null
  }
  _ipcCallbacks = null
}

setInterval(async () => {
  if (_controlState) {
    const connectionStatus = await _connectionManager.updateConnections(
      _controlState.control.device.connectable.dmx
    )
    _ipcCallbacks?.send_dmx_connection_update(connectionStatus)
  }
}, 1000)

MidiConnection.maintain({
  update_ms: 1000,
  onUpdate: (activeDevices) => {
    if (_ipcCallbacks !== null)
      _ipcCallbacks.send_midi_connection_update(activeDevices)
  },
  onMessage: (message) => {
    _midiThrottle.call(midiInputID(message), message)
  },
  getConnectable: () => {
    return _controlState ? _controlState.control.device.connectable.midi : []
  },
})

// Todo: Desimate dt in this context
function getNextTimeState(): TimeState {
  let currentTime = Date.now()
  const dt = currentTime - _lastFrameTime

  _lastFrameTime = currentTime

  if (_nodeLink === null) {
    return { ...initTimeState(), dt }
  }

  return {
    ..._nodeLink.getSessionInfoCurrent(),
    dt: dt,
    quantum: 4.0,
  }
}

function generateAutoScene(
  ipcCallbacks: IPC_Callbacks,
  controlState: CleanReduxState,
  vibe: string
) {
  const autoControl = controlState.autoControl
  if (!autoControl.enabled) return

  const dmx = controlState.dmx
  const allGroups = getSortedGroups(
    dmx.universe,
    dmx.fixtureTypes,
    dmx.fixtureTypesByID,
    dmx.led.ledFixtures
  )

  const splitScenes = allGroups
    .filter((group) => {
      const role = autoControl.groupRoles[group] ?? 'off'
      return role !== 'off'
    })
    .map((group) => {
      const role = autoControl.groupRoles[group] ?? 'off'
      const behavior = resolveBehavior(role as any, vibe as any, autoControl.behaviorMap)
      const groupDepth = autoControl.perGroupDepth[group] ?? 1
      const depth = autoControl.globalDepth * groupDepth
      const splitScene = initSplitScene()
      splitScene.groups = { [group]: true }
      splitScene.ledEffect = behavior.ledEffect
      splitScene.baseParams = {
        hue: behavior.hueOverride ?? 0,
        saturation: behavior.saturation,
        brightness: behavior.brightness * depth,
      }
      return splitScene
    })

  if (splitScenes.length === 0) return

  const autoScene = {
    ...initLightScene(),
    name: 'Auto',
    splitScenes,
  }

  ipcCallbacks.send_dispatch(
    setLightSceneById({ id: AUTO_SCENE_ID, scene: autoScene })
  )
}

function getNextRealtimeState(
  realtimeState: RealtimeState,
  nextTimeState: TimeState,
  ipcCallbacks: IPC_Callbacks,
  controlState: CleanReduxState
): RealtimeState {
  const scene =
    controlState.control.light.byId[controlState.control.light.active]
  const dmx = controlState.dmx
  const allParamKeys = getAllParamKeys(dmx)

  handleAutoScene(
    realtimeState,
    nextTimeState,
    controlState,
    (newLightScene) => {
      ipcCallbacks.send_dispatch(
        setActiveScene({
          sceneType: 'light',
          val: newLightScene,
        })
      )
    },
    (newVisualScene) => {
      ipcCallbacks.send_dispatch(
        setActiveScene({
          sceneType: 'visual',
          val: newVisualScene,
        })
      )
    }
  )

  const fixtures = flatten_fixtures(dmx.universe, dmx.fixtureTypesByID)

  const audioFeatures = getLatestAudioFeatures()

  // Auto scene generation — regenerate when vibe changes
  const currentVibe = audioFeatures.vibe ?? 'neutral'
  if (currentVibe !== _lastAutoVibe) {
    _lastAutoVibe = currentVibe
    generateAutoScene(ipcCallbacks, controlState, currentVibe)
  }

  const splitStates: SplitState[] = scene.splitScenes.map(
    (splitScene, splitIndex) => {
      let splitOutputParams = getOutputParams(
        nextTimeState.beats,
        scene,
        splitIndex,
        allParamKeys
      )
      if (scene.audioModulators && scene.audioModulators.length > 0) {
        splitOutputParams = applyAudioModulators(
          splitOutputParams,
          scene.audioModulators,
          audioFeatures
        )
      }
      let splitSceneFixtures = getFixturesInGroups(fixtures, splitScene.groups)
      let splitSceneFixturesWithinEpicness = splitSceneFixtures.filter(
        (fixture) => fixture.intensity <= (splitOutputParams.intensity ?? 1)
      )

      let newRandomizerState = resizeRandomizer(
        realtimeState.splitStates[splitIndex]?.randomizer ??
          initRandomizerState(),
        splitSceneFixturesWithinEpicness.length
      )

      newRandomizerState = updateIndexes(
        realtimeState.time.beats,
        newRandomizerState,
        nextTimeState,
        indexArray(splitSceneFixturesWithinEpicness.length),
        splitScene.randomizer
      )

      return {
        outputParams: splitOutputParams,
        randomizer: newRandomizerState,
      }
    }
  )

  return {
    time: nextTimeState,
    dmxOut: calculateDmx(controlState, splitStates, nextTimeState),
    splitStates,
    wledOut: calculateWledOut(controlState, splitStates, scene, nextTimeState),
    audioFeatures: realtimeState.audioFeatures,
  }
}

// Exponential moving average smoothing state (per modulator, per call)
// We use a simple approximation here since audio features are updated ~20 Hz
function applyAudioModulators(
  params: Params,
  modulators: AudioModulator[],
  features: AudioFeatures
): Params {
  if (!features.enabled || modulators.length === 0) return params
  const result: Params = { ...params }
  for (const mod of modulators) {
    const raw = features[mod.source] as number
    const mapped = mod.min + raw * (mod.max - mod.min)
    const existing = (result[mod.target] as number | undefined) ?? 0
    // Smooth: blend toward new value (smoothing=0 → instant, smoothing=1 → frozen)
    result[mod.target] = existing * mod.smoothing + mapped * (1 - mod.smoothing)
  }
  return result
}

function maxBlendColors(a: BaseColors, b: BaseColors): BaseColors {
  return {
    red: Math.max(a.red, b.red),
    green: Math.max(a.green, b.green),
    blue: Math.max(a.blue, b.blue),
  }
}

function calculateWledOut(
  controlState: CleanReduxState,
  splitStates: SplitState[],
  scene: LightScene_t | undefined,
  timeState: TimeState
): { [mdns: string]: BaseColors[] } {
  if (!timeState.isPlaying) return {}
  if (!scene) return {}

  const ledFixtures = controlState.dmx.led.ledFixtures
  const master = controlState.control.master
  const ledOutputs: { [mdns: string]: BaseColors[] } = {}

  for (let i = 0; i < splitStates.length; i++) {
    const splitState = splitStates[i]
    const splitScene = scene.splitScenes[i]
    if (!splitState?.outputParams || !splitScene) continue

    const matchingFixtures = getLedFixturesInGroups(ledFixtures, splitScene.groups)

    for (const fixture of matchingFixtures) {
      let colors = getLedValues(splitState.outputParams, fixture, master)
      if (splitScene.ledEffect && splitScene.ledEffect.type !== 'none') {
        colors = applyLedEffect(colors, splitScene.ledEffect, timeState, splitState.outputParams.hue ?? 0)
      }

      if (!ledOutputs[fixture.mdns]) {
        ledOutputs[fixture.mdns] = indexArray(fixture.led_count).map(() => ({
          red: 0,
          green: 0,
          blue: 0,
        }))
      }

      const existing = ledOutputs[fixture.mdns]
      colors.forEach((color, idx) => {
        existing[idx] = maxBlendColors(existing[idx], color)
      })
    }
  }

  // Ensure all fixtures have an entry (black if not driven by any split)
  for (const fixture of ledFixtures) {
    if (!ledOutputs[fixture.mdns]) {
      ledOutputs[fixture.mdns] = indexArray(fixture.led_count).map(() => ({
        red: 0,
        green: 0,
        blue: 0,
      }))
    }
  }

  return ledOutputs
}
