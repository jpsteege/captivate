import { getLedValues } from '../../../shared/ledFixtures'
import { WledConnectionInfo } from '../../../shared/connection'
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
      if (
        rtState.splitStates.length === 0 ||
        !rtState.splitStates[0]?.outputParams
      )
        return

      for (const fixture of state.dmx.led.ledFixtures) {
        const device = this.devices[fixture.mdns]
        if (device !== undefined) {
          device.broadcast(
            getLedValues(
              rtState.splitStates[0].outputParams,
              fixture,
              state.control.master
            )
          )
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
        this.devices[fixture.mdns] = new WledDevice(fixture.mdns)
      } else {
        device.refresh()
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
