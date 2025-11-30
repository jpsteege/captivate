import { RealtimeState } from 'renderer/redux/realtimeStore'
import { CleanReduxState } from 'renderer/redux/store'
import { WledConnectionInfo } from '../../shared/connection'

export interface EngineContext {
  realtimeState: () => RealtimeState
  controlState: () => CleanReduxState | null
  onWledConnectionUpdate?: (info: WledConnectionInfo) => void
}
