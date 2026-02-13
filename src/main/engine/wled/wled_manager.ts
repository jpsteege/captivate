import { getLedValues } from '../../../shared/ledFixtures'
import { BaseColors } from '../../../shared/baseColors'
import { WledConnectionInfo } from '../../../shared/connection'
import { getLedFixturesInGroups } from '../../../shared/dmxUtil'
import { indexArray, zip } from '../../../shared/util'
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
      if (rtState.splitStates.length === 0) return

      const scenes = state.control.light
      const activeScene = scenes.byId[scenes.active]
      if (!activeScene) return

      const ledOutputs = new Map<string, BaseColors[]>()

      for (const [splitState, splitScene] of zip(
        rtState.splitStates,
        activeScene.splitScenes
      )) {
        if (!splitState?.outputParams) continue

        const matchingFixtures = getLedFixturesInGroups(
          state.dmx.led.ledFixtures,
          splitScene.groups
        )

        for (const fixture of matchingFixtures) {
          const colors = getLedValues(
            splitState.outputParams,
            fixture,
            state.control.master
          )

          if (!ledOutputs.has(fixture.mdns)) {
            ledOutputs.set(
              fixture.mdns,
              indexArray(fixture.led_count).map(() => ({
                red: 0,
                green: 0,
                blue: 0,
              }))
            )
          }

          const existing = ledOutputs.get(fixture.mdns)!
          colors.forEach((color, i) => {
            existing[i] = this.maxBlendColors(existing[i], color)
          })
        }
      }

      for (const fixture of state.dmx.led.ledFixtures) {
        const colors =
          ledOutputs.get(fixture.mdns) ??
          indexArray(fixture.led_count).map(() => ({
            red: 0,
            green: 0,
            blue: 0,
          }))
        const device = this.devices[fixture.mdns]
        if (device !== undefined) {
          device.broadcast(colors)
        }
      }
    }, 1000 / 60)
  }

  private maxBlendColors(a: BaseColors, b: BaseColors): BaseColors {
    return {
      red: Math.max(a.red, b.red),
      green: Math.max(a.green, b.green),
      blue: Math.max(a.blue, b.blue),
    }
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
