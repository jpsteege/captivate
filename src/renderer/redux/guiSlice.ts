import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SaveInfo } from '../../shared/save'
import {
  MidiConnections,
  DmxConnectionInfo,
  initDmxConnections,
  initMidiConnections,
  WledConnectionInfo,
  initWledConnections,
} from '../../shared/connection'

export type Page =
  | 'Universe'
  | 'Modulation'
  | 'Video'
  | 'Share'
  | 'Mixer'
  | 'Led'
  | 'WledMixer'
  | 'Audio'
  | 'AutoControl'

export interface GuiState {
  activePage: Page
  blackout: boolean
  connectionMenu: boolean
  midi: MidiConnections
  dmx: DmxConnectionInfo
  wled: WledConnectionInfo
  saving: boolean
  loading: SaveInfo | null
  newProjectDialog: boolean
  ledEnabled: boolean
  videoEnabled: boolean
  audioEnabled: boolean
}

export function initGuiState(): GuiState {
  return {
    activePage: 'Universe',
    blackout: false,
    connectionMenu: false,
    midi: initMidiConnections(),
    dmx: initDmxConnections(),
    wled: initWledConnections(),
    saving: false,
    loading: null,
    newProjectDialog: false,
    ledEnabled: false,
    videoEnabled: false,
    audioEnabled: false,
  }
}

export const guiSlice = createSlice({
  name: 'gui',
  initialState: initGuiState(),
  reducers: {
    setActivePage: (state, { payload }: PayloadAction<Page>) => {
      state.activePage = payload
    },
    setBlackout: (state, { payload }: PayloadAction<boolean>) => {
      state.blackout = payload
    },
    setConnectionsMenu: (state, { payload }: PayloadAction<boolean>) => {
      state.connectionMenu = payload
    },
    setMidi: (state, { payload }: PayloadAction<MidiConnections>) => {
      state.midi = payload
    },
    setDmx: (state, { payload }: PayloadAction<DmxConnectionInfo>) => {
      state.dmx = payload
    },
    setWled: (state, { payload }: PayloadAction<WledConnectionInfo>) => {
      state.wled = payload
    },
    setSaving: (state, { payload }: PayloadAction<boolean>) => {
      state.saving = payload
    },
    setLoading: (state, { payload }: PayloadAction<SaveInfo | null>) => {
      state.loading = payload
    },
    setNewProjectDialog: (state, { payload }: PayloadAction<boolean>) => {
      state.newProjectDialog = payload
    },
    toggleLedEnabled: (state, _: PayloadAction<undefined>) => {
      state.ledEnabled = !state.ledEnabled
    },
    toggleVideoEnabled: (state, _: PayloadAction<undefined>) => {
      state.videoEnabled = !state.videoEnabled
    },
    toggleAudioEnabled: (state, _: PayloadAction<undefined>) => {
      state.audioEnabled = !state.audioEnabled
    },
  },
})

export const {
  setActivePage,
  setBlackout,
  setConnectionsMenu,
  setMidi,
  setDmx,
  setWled,
  setSaving,
  setLoading,
  setNewProjectDialog,
  toggleLedEnabled,
  toggleVideoEnabled,
  toggleAudioEnabled,
} = guiSlice.actions

export default guiSlice.reducer
