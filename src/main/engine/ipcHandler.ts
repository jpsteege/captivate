import { ipcMain, WebContents, dialog } from 'electron'
import ipcChannels, {
  UserCommand,
  MainCommand,
  TestWledConnectionRequest,
  TestWledConnectionResponse,
  ResetWledProtocolRequest,
  ResetWledProtocolResponse,
} from '../../shared/ipc_channels'
import ipcChannelsVisualizer from '../../visualizer/ipcChannels'
import { CleanReduxState } from '../../renderer/redux/store'
import { RealtimeState } from '../../renderer/redux/realtimeStore'
import * as midiConnection from './midiConnection'
import { PayloadAction } from '@reduxjs/toolkit'
import { promises } from 'fs'
import { VisualizerResource } from '../../visualizer/threejs/VisualizerManager'
import { VisualizerContainer } from './createVisualizerWindow'
import { DmxConnectionInfo, WledConnectionInfo } from 'shared/connection'
import { getWledManager } from './engine'

interface Config {
  renderer: WebContents
  visualizerContainer: VisualizerContainer
  on_new_control_state: (new_state: CleanReduxState) => void
  on_user_command: (command: UserCommand) => void
  on_open_visualizer: () => void
}

let _config: Config

export function ipcSetup(config: Config) {
  _config = config

  ipcMain.on(ipcChannels.new_control_state, (_e, new_state: CleanReduxState) =>
    _config.on_new_control_state(new_state)
  )

  ipcMain.on(ipcChannels.user_command, (_e, command: UserCommand) => {
    _config.on_user_command(command)
  })

  ipcMain.on(ipcChannels.open_visualizer, (_e) => {
    _config.on_open_visualizer()
  })

  return {
    send_dmx_connection_update: (payload: DmxConnectionInfo) =>
      _config.renderer.send(ipcChannels.dmx_connection_update, payload),
    send_wled_connection_update: (payload: WledConnectionInfo) =>
      _config.renderer.send(ipcChannels.wled_connection_update, payload),
    send_midi_connection_update: (payload: midiConnection.UpdatePayload) =>
      _config.renderer.send(ipcChannels.midi_connection_update, payload),
    send_time_state: (time_state: RealtimeState) =>
      _config.renderer.send(ipcChannels.new_time_state, time_state),
    send_dispatch: (action: PayloadAction<any>) =>
      _config.renderer.send(ipcChannels.dispatch, action),
    send_visualizer_state: (payload: VisualizerResource) => {
      const visualizer = _config.visualizerContainer.visualizer
      if (visualizer) {
        visualizer.webContents.send(
          ipcChannelsVisualizer.new_visualizer_state,
          payload
        )
      }
    },
    send_main_command: (command: MainCommand) => {
      _config.renderer.send(ipcChannels.main_command, command)
    },
  }
}

export type IPC_Callbacks = ReturnType<typeof ipcSetup>

ipcMain.handle(
  ipcChannels.load_file,
  async (_event, title: string, fileFilters: Electron.FileFilter[]) => {
    const dialogResult = await dialog.showOpenDialog({
      title: title,
      filters: fileFilters,
      properties: ['openFile'],
    })
    if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
      return await promises.readFile(dialogResult.filePaths[0], 'utf8')
    } else {
      throw new Error('User cancelled the file load')
    }
  }
)

ipcMain.handle(
  ipcChannels.save_file,
  async (
    _event,
    title: string,
    data: string,
    fileFilters: Electron.FileFilter[]
  ) => {
    const dialogResult = await dialog.showSaveDialog({
      title: title,
      filters: fileFilters,
      properties: ['createDirectory'],
    })
    if (!dialogResult.canceled && dialogResult.filePath !== undefined) {
      return await promises.writeFile(dialogResult.filePath, data)
    } else {
      throw new Error('User cancelled the file save')
    }
  }
)

ipcMain.handle(
  ipcChannels.get_local_filepaths,
  async (_event, title: string, fileFilters: Electron.FileFilter[]) => {
    const dialogResult = await dialog.showOpenDialog({
      title: title,
      filters: fileFilters,
      properties: ['openFile', 'multiSelections'],
    })
    if (!dialogResult.canceled && dialogResult.filePaths.length > 0) {
      return dialogResult.filePaths
    } else {
      throw new Error('User cancelled the file load')
    }
  }
)

ipcMain.handle(
  ipcChannels.test_wled_connection,
  async (
    _event,
    request: TestWledConnectionRequest
  ): Promise<TestWledConnectionResponse> => {
    const wledManager = getWledManager()
    const device = wledManager?.getDevice(request.mdns)

    if (!device) {
      return {
        success: false,
        mdns: request.mdns,
        diagnostics: {
          mdnsResolved: false,
          ip: null,
          httpAccessible: false,
          httpError: 'Device not found in WLED manager',
          packetSent: false,
          packetError: 'Device not found in WLED manager',
        },
      }
    }

    if (request.testType === 'identify') {
      if (device.ip === null) {
        return {
          success: false,
          mdns: request.mdns,
          diagnostics: {
            mdnsResolved: false,
            ip: null,
            httpAccessible: false,
            packetSent: false,
            packetError: 'No resolved IP for identify packet',
          },
        }
      }

      let packetError: string | undefined
      let packetSent = false

      try {
        await device.identify()
        packetSent = true
      } catch (error) {
        packetError = error instanceof Error ? error.message : String(error)
      }

      return {
        success: packetSent,
        mdns: request.mdns,
        diagnostics: {
          mdnsResolved: true,
          ip: device.ip,
          httpAccessible: false,
          packetSent,
          ...(packetError ? { packetError } : {}),
        },
      }
    }

    return device.testConnection()
  }
)

ipcMain.handle(
  ipcChannels.reset_wled_protocol,
  async (
    _event,
    request: ResetWledProtocolRequest
  ): Promise<ResetWledProtocolResponse> => {
    const wledManager = getWledManager()
    const device = wledManager?.getDevice(request.mdns)

    if (!device) {
      return {
        success: false,
        mdns: request.mdns,
        error: 'Device not found in WLED manager',
      }
    }

    device.resetProtocol()
    return {
      success: true,
      mdns: request.mdns,
    }
  }
)
