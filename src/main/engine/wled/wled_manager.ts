import { WledConnectionInfo } from '../../../shared/connection'
import { indexArray } from '../../../shared/util'
import { WledProtocol } from '../../../shared/ledFixtures'
import { EngineContext } from '../engineContext'
import WledDevice from './wled_device'

export default class WledManager {
  private devices: { [mdns: string]: WledDevice | undefined } = {}
  private pokeInterval: NodeJS.Timeout
  private broadcastInterval: NodeJS.Timeout
  private c: EngineContext

  constructor(c: EngineContext) {
    this.c = c

    this.updateDevices()

    this.pokeInterval = setInterval(() => {
      this.updateDevices()
    }, 1000)

    this.broadcastInterval = setInterval(() => {
      const state = this.c.controlState()
      if (state === null) return

      if (!state.gui.ledEnabled) return

      const rtState = this.c.realtimeState()

      for (const fixture of state.dmx.led.ledFixtures) {
        const colors =
          rtState.wledOut[fixture.mdns] ??
          indexArray(fixture.led_count).map(() => ({
            red: 0,
            green: 0,
            blue: 0,
          }))
        const device = this.devices[fixture.mdns]
        if (device !== undefined && device.isConnected()) {
          device.broadcast(colors)
        }
      }
    }, 1000 / 60)
  }

  private updateDevices() {
    const state = this.c.controlState()
    if (state === null) return

    const mdnsSet = new Set(state.dmx.led.ledFixtures.map((f) => f.mdns))

    for (const fixture of state.dmx.led.ledFixtures) {
      const device = this.devices[fixture.mdns]
      if (device === undefined) {
        this.devices[fixture.mdns] = new WledDevice(fixture.mdns, fixture.protocol)
      } else if (device.getConfiguredProtocol() !== fixture.protocol) {
        this.handleProtocolChange(fixture.mdns, fixture.protocol)
      } else {
        const connectionState = device.getConnectionState()
        if (connectionState === 'error' || connectionState === 'disconnected') {
          device.refresh()
        }
      }
    }

    for (const [mdns, device] of Object.entries(this.devices)) {
      if (!mdnsSet.has(mdns)) {
        console.log('WLED device removed', { mdns })
        device?.release()
        delete this.devices[mdns]
      }
    }

    this.c.onWledConnectionUpdate?.(this.getConnectionStatus())
  }

  handleProtocolChange(mdns: string, newProtocol: WledProtocol): void {
    const existingDevice = this.devices[mdns]
    if (existingDevice !== undefined) {
      existingDevice.release()
      delete this.devices[mdns]
    }

    this.devices[mdns] = new WledDevice(mdns, newProtocol)
  }

  getConnectionStatus(): WledConnectionInfo {
    const available = Object.values(this.devices)
      .filter((d): d is WledDevice => d !== undefined)
      .map((device) => device.getDeviceInfo())
    const connected = available
      .filter((d) => {
        const device = this.devices[d.mdns]
        return device !== undefined && device.isConnected()
      })
      .map((d) => d.mdns)

    return { available, connected }
  }

  getDevice(mdns: string) {
    return this.devices[mdns]
  }

  release() {
    for (const [_mdns, device] of Object.entries(this.devices)) {
      if (device !== undefined) {
        device.release()
      }
    }
    clearInterval(this.pokeInterval)
    clearInterval(this.broadcastInterval)
  }
}
