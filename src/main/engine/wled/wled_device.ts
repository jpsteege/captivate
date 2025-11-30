import dgram from 'node:dgram'
import makeMdns from 'multicast-dns'
import udpBuffer from './udp_buffer'
import { BaseColors } from '../../../shared/baseColors'
import { WledDevice_t } from '../../../shared/connection'

const mdns = makeMdns()
const client = dgram.createSocket('udp4')

const WLED_PORT = 21324
const MDNS_QUERY_TYPE = 'A'
const WLED_CONNECTION_TIMEOUT_MS = 15000

mdns.on('error', (e) => {
  console.error('error', e)
})

mdns.on('warning', (w) => {
  console.warn('warning', w)
})

export default class WledDevice {
  mdns_name: string
  baseMdns: string
  listener: (res: makeMdns.ResponsePacket) => void
  ip: string | null = null
  lastSeen: number | null = null
  private noIpWarningIssued = false

  constructor(mdns_name: string) {
    this.baseMdns = mdns_name
    this.mdns_name = `${mdns_name}.local`

    this.listener = (res: makeMdns.ResponsePacket) => {
      if (res.answers.length > 0) {
        let answer = res.answers[0]
        if (answer.type === MDNS_QUERY_TYPE && answer.name === this.mdns_name) {
          const wasNull = this.ip === null
          if (this.ip !== answer.data) {
            this.ip = answer.data
            console.log(`WLed ip updated ${this.mdns_name} -> ${this.ip}`)
          }
          if (this.ip !== null) {
            this.noIpWarningIssued = false
          }
          if (wasNull && answer.data) {
            console.log('WLED device discovered', {
              mdns: this.baseMdns,
              ip: answer.data,
            })
          }
          this.lastSeen = Date.now()
        }
      }
    }

    mdns.addListener('response', this.listener)

    this.refresh()
  }

  /// Re-queries mdns to update the device ip address
  refresh() {
    mdns.query(this.mdns_name, MDNS_QUERY_TYPE)
  }

  /// Sends colors to each led via UDP
  broadcast(colors: BaseColors[]) {
    if (this.ip === null) {
      if (!this.noIpWarningIssued) {
        console.warn('WLED broadcast skipped - no IP', {
          mdns: this.mdns_name,
        })
        this.noIpWarningIssued = true
      }
      return
    }

    try {
      client.send(udpBuffer(colors), WLED_PORT, this.ip, (err) => {
        if (err) {
          console.error('WLED UDP Send Error', {
            mdns: this.mdns_name,
            ip: this.ip,
            error: err,
          })
        }
      })
    } catch (err) {
      console.error('WLED UDP Send Error', {
        mdns: this.mdns_name,
        ip: this.ip,
        error: err,
      })
    }
  }

  release() {
    mdns.removeListener('response', this.listener)
  }

  isConnected() {
    return this.ip !== null && this.lastSeen !== null
      ? Date.now() - this.lastSeen < WLED_CONNECTION_TIMEOUT_MS
      : false
  }

  getDeviceInfo(): WledDevice_t {
    return {
      mdns: this.baseMdns,
      name: this.baseMdns,
      ip: this.ip,
      lastSeen: this.lastSeen ?? 0,
    }
  }
}
