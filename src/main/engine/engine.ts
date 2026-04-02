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
import { handleAutoScene } from '../../shared/autoScene'
import { setActiveScene } from '../../renderer/redux/controlSlice'
import TapTempoEngine from './TapTempoEngine'
import { flatten_fixtures, getFixturesInGroups, getLedFixturesInGroups } from '../../shared/dmxUtil'
import { LightScene_t } from '../../shared/Scenes'
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

  const splitStates: SplitState[] = scene.splitScenes.map(
    (splitScene, splitIndex) => {
      const splitOutputParams = getOutputParams(
        nextTimeState.beats,
        scene,
        splitIndex,
        allParamKeys
      )
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
  }
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
      const colors = getLedValues(splitState.outputParams, fixture, master)

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
