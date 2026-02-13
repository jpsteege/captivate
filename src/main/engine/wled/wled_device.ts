import dgram from 'node:dgram'
import http from 'node:http'
import makeMdns from 'multicast-dns'
import udpBuffer from './udp_buffer'
import { BaseColors } from '../../../shared/baseColors'
import { WledDevice_t } from '../../../shared/connection'

const mdns = makeMdns()
const client = dgram.createSocket('udp4')

const WLED_PORT = 21324
const MDNS_QUERY_TYPE = 'A'
const WLED_CONNECTION_TIMEOUT_MS = 15000
const WLED_HTTP_TIMEOUT_MS = 500

interface WledDeviceInfo {
  brand: string
  version: string
  name: string
  ledCount: number
}

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
  private httpWarningIssued = false
  private lastHttpSuccess: number | null = null
  private lastHttpCheckAt: number | null = null
  private cachedVersion: string | null = null
  private cachedLedCount: number | null = null
  private cachedBrand: string | null = null
  private cachedDeviceName: string | null = null

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
    void this.checkHttpHealth()
  }

  private httpRequest(endpoint: string, timeout: number = WLED_HTTP_TIMEOUT_MS): Promise<any> {
    return new Promise((resolve) => {
      if (this.ip === null) {
        resolve(null)
        return
      }

      const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
      const req = http.get(
        `http://${this.ip}/${normalizedEndpoint}`,
        {
          timeout,
        },
        (res) => {
          const statusCode = res.statusCode ?? 0
          const chunks: Buffer[] = []

          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })

          res.on('end', () => {
            if (statusCode < 200 || statusCode >= 300) {
              console.warn('WLED HTTP request failed - HTTP error', {
                mdns: this.mdns_name,
                ip: this.ip,
                endpoint: normalizedEndpoint,
                statusCode,
              })
              resolve(null)
              return
            }

            const payload = Buffer.concat(chunks).toString('utf8')
            try {
              resolve(JSON.parse(payload))
            } catch (error) {
              console.warn('WLED HTTP request failed - invalid JSON', {
                mdns: this.mdns_name,
                ip: this.ip,
                endpoint: normalizedEndpoint,
                error,
              })
              resolve(null)
            }
          })
        }
      )

      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'))
      })

      req.on('error', (error: NodeJS.ErrnoException) => {
        const errorCode = error.code
        if (errorCode === 'ECONNREFUSED') {
          console.warn('WLED HTTP request failed - connection refused', {
            mdns: this.mdns_name,
            ip: this.ip,
            endpoint: normalizedEndpoint,
            errorCode,
          })
        } else if (errorCode === 'ETIMEDOUT') {
          console.warn('WLED HTTP request failed - timeout', {
            mdns: this.mdns_name,
            ip: this.ip,
            endpoint: normalizedEndpoint,
            errorCode,
          })
        } else {
          console.warn('WLED HTTP request failed', {
            mdns: this.mdns_name,
            ip: this.ip,
            endpoint: normalizedEndpoint,
            errorCode,
            error,
          })
        }
        resolve(null)
      })
    })
  }

  async getApiDeviceInfo(): Promise<WledDeviceInfo | null> {
    const info = await this.httpRequest('json/info')
    if (info === null || typeof info !== 'object') return null

    const brand = typeof info.brand === 'string' ? info.brand : null
    const version = typeof info.ver === 'string' ? info.ver : null
    const name = typeof info.name === 'string' ? info.name : null
    const ledCount =
      info.leds && typeof info.leds === 'object' && typeof info.leds.count === 'number'
        ? info.leds.count
        : null

    if (brand === null || version === null || name === null || ledCount === null) return null

    return {
      brand,
      version,
      name,
      ledCount,
    }
  }

  async getDeviceState(): Promise<any | null> {
    return this.httpRequest('json/state')
  }

  private async checkHttpHealth(): Promise<boolean> {
    this.lastHttpCheckAt = Date.now()

    if (this.ip === null) {
      if (!this.httpWarningIssued) {
        console.warn('WLED HTTP health check skipped - no IP', {
          mdns: this.mdns_name,
        })
        this.httpWarningIssued = true
      }
      return false
    }

    console.log('WLED HTTP health check', {
      mdns: this.mdns_name,
      ip: this.ip,
      endpoint: 'json/info',
    })

    const info = await this.getApiDeviceInfo()

    if (info === null) {
      if (!this.httpWarningIssued) {
        console.warn('WLED HTTP health check failed', {
          mdns: this.mdns_name,
          ip: this.ip,
        })
        this.httpWarningIssued = true
      }
      return false
    }

    this.cachedBrand = info.brand
    this.cachedVersion = info.version
    this.cachedDeviceName = info.name
    this.cachedLedCount = info.ledCount
    this.lastHttpSuccess = Date.now()
    this.httpWarningIssued = false

    console.log('WLED HTTP health check success', {
      mdns: this.mdns_name,
      ip: this.ip,
      brand: info.brand,
      version: info.version,
      name: info.name,
      ledCount: info.ledCount,
    })

    return true
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
    const now = Date.now()
    const mdnsConnected =
      this.ip !== null &&
      this.lastSeen !== null &&
      now - this.lastSeen < WLED_CONNECTION_TIMEOUT_MS
    const httpConnected =
      this.lastHttpSuccess !== null && now - this.lastHttpSuccess < WLED_CONNECTION_TIMEOUT_MS

    return mdnsConnected && httpConnected
  }

  getDeviceInfo(): WledDevice_t {
    const now = Date.now()
    const httpAccessible =
      this.lastHttpCheckAt === null
        ? undefined
        : this.lastHttpSuccess !== null && now - this.lastHttpSuccess < WLED_CONNECTION_TIMEOUT_MS

    return {
      mdns: this.baseMdns,
      name: this.cachedDeviceName ?? this.baseMdns,
      ip: this.ip,
      lastSeen: this.lastSeen ?? 0,
      version: this.cachedVersion ?? undefined,
      ledCount: this.cachedLedCount ?? undefined,
      brand: this.cachedBrand ?? undefined,
      httpAccessible,
    }
  }
}
