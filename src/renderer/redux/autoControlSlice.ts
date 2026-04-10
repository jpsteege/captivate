import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { GroupRole } from '../../shared/groupRoles'
import { VibeBehaviorMap, DEFAULT_VIBE_BEHAVIOR_MAP } from '../../shared/vibeBehavior'
import { VibeType } from '../../shared/audioFeatures'
import { VibeBehavior } from '../../shared/vibeBehavior'

export const AUTO_SCENE_ID = '__captivate_auto__'

export interface AutoControlState {
  enabled: boolean
  groupRoles: Record<string, GroupRole>     // group name → role
  behaviorMap: VibeBehaviorMap              // role → { default, vibeOverrides }
  globalDepth: number                       // 0–1 master effect strength
  perGroupDepth: Record<string, number>     // group → 0–1 depth override
}

function initAutoControlState(): AutoControlState {
  return {
    enabled: false,
    groupRoles: {},
    behaviorMap: DEFAULT_VIBE_BEHAVIOR_MAP,
    globalDepth: 1,
    perGroupDepth: {},
  }
}

const autoControlSlice = createSlice({
  name: 'autoControl',
  initialState: initAutoControlState(),
  reducers: {
    setAutoEnabled: (state, { payload }: PayloadAction<boolean>) => {
      state.enabled = payload
    },
    setGroupRole: (
      state,
      { payload }: PayloadAction<{ group: string; role: GroupRole }>
    ) => {
      state.groupRoles[payload.group] = payload.role
    },
    setGroupRoles: (
      state,
      { payload }: PayloadAction<Record<string, GroupRole>>
    ) => {
      state.groupRoles = payload
    },
    setGlobalDepth: (state, { payload }: PayloadAction<number>) => {
      state.globalDepth = payload
    },
    setPerGroupDepth: (
      state,
      { payload }: PayloadAction<{ group: string; depth: number }>
    ) => {
      state.perGroupDepth[payload.group] = payload.depth
    },
    setVibeOverride: (
      state,
      {
        payload,
      }: PayloadAction<{
        role: GroupRole
        vibe: VibeType
        behavior: Partial<VibeBehavior>
      }>
    ) => {
      const entry = state.behaviorMap[payload.role]
      if (entry) {
        entry.vibeOverrides[payload.vibe] = {
          ...(entry.vibeOverrides[payload.vibe] ?? {}),
          ...payload.behavior,
        }
      }
    },
    resetBehaviorMap: (state) => {
      state.behaviorMap = DEFAULT_VIBE_BEHAVIOR_MAP
    },
  },
})

export const {
  setAutoEnabled,
  setGroupRole,
  setGroupRoles,
  setGlobalDepth,
  setPerGroupDepth,
  setVibeOverride,
  resetBehaviorMap,
} = autoControlSlice.actions

export default autoControlSlice.reducer
