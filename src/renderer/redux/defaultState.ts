import defaultSave from './defaultSave.json'
import { SaveState } from 'shared/save'
import initState from './initState'
import { CleanReduxState } from './store'

export default function defaultState(): CleanReduxState {
  const save = defaultSave as SaveState
  const state = initState()
  if (save.device) state.control.device = save.device
  if (save.dmx) {
    state.dmx = save.dmx
    state.dmx.led.ledFixtures = state.dmx.led.ledFixtures.map((fixture) => ({
      ...fixture,
      protocol: fixture.protocol ?? 'DDP',
    }))
  }
  if (save.light) state.control.light = save.light
  if (save.visual) state.control.visual = save.visual
  return state
}
