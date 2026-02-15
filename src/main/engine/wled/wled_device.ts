import dgram from 'node:dgram'
import http from 'node:http'
import makeMdns from 'multicast-dns'
import udpBuffer from './udp_buffer'
import { BaseColors } from '../../../shared/baseColors'
import { WledDevice_t } from '../../../shared/connection'
import { TestWledConnectionResponse } from '../../../shared/ipc_channels'
import { WledProtocol } from '../../../shared/ledFixtures'

const mdns = makeMdns()
const client = dgram.createSocket('udp4')

const UDP_WLED_PORT = 21324
const DDP_WLED_PORT = 4048
const MDNS_QUERY_TYPE = 'A'
const WLED_CONNECTION_TIMEOUT_MS = 15000
const WLED_HTTP_TIMEOUT_MS = 500
const WLED_TEST_TIMEOUT_MS = 2000
const INITIAL_BACKOFF_MS = 1000
const FALLBACK_FAILURE_THRESHOLD = 10

type ConnectionState = 'disconnected' | 'discovering' | 'connected' | 'error'

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

  private connectionState: ConnectionState = 'disconnected'
  private mdnsBackoffMs = INITIAL_BACKOFF_MS
  private maxBackoffMs = 30000
  private consecutiveFailures = 0
  private lastMdnsQueryAt: number | null = null

  private totalPacketsSent = 0
  private failedPacketsSent = 0
  private lastSuccessfulBroadcast: number | null = null
  private lastBroadcastLatency: number | null = null

  private configuredProtocol: WledProtocol
  private activeProtocol: WledProtocol
  private protocolFallbackOccurred = false

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  constructor(mdns_name: string, protocol: WledProtocol) {
    this.baseMdns = mdns_name
    this.mdns_name = `${mdns_name}.local`
    this.configuredProtocol = protocol
    this.activeProtocol = protocol

    this.listener = (res: makeMdns.ResponsePacket) => {
      if (res.answers.length > 0) {
        for (const answer of res.answers) {
          if (answer.type !== MDNS_QUERY_TYPE || answer.name !== this.mdns_name) {
            continue
          }

          const wasNull = this.ip === null
          const previousState = this.connectionState
          if (this.ip !== answer.data) {
            this.ip = String(answer.data)
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
          this.consecutiveFailures = 0
          if (previousState === 'disconnected' || previousState === 'error') {
            this.resetProtocol()
          }
          this.transitionState('connected')
        }
      }
    }

    mdns.addListener('response', this.listener)

    this.refresh()
  }

  private transitionState(newState: ConnectionState): void {
    if (this.connectionState !== newState) {
      console.log('WLED connection state transition', {
        mdns: this.baseMdns,
        from: this.connectionState,
        to: newState,
      })
    }

    this.connectionState = newState

    if (newState === 'connected') {
      this.mdnsBackoffMs = INITIAL_BACKOFF_MS
      return
    }

    if (newState === 'error' || newState === 'disconnected') {
      this.incrementBackoff()
    }
  }

  private incrementBackoff(): void {
    this.mdnsBackoffMs = Math.min(this.mdnsBackoffMs * 2, this.maxBackoffMs)
  }

  private createDdpBuffer(colors: BaseColors[]): Buffer {
    const dataLength = colors.length * 3
    const buffer = Buffer.alloc(10 + dataLength)

    buffer[0] = 0x41
    buffer[1] = 0x00
    buffer[2] = 0x01
    buffer[3] = 0x01
    buffer[4] = 0x00
    buffer[5] = 0x00
    buffer[6] = 0x00
    buffer[7] = 0x00
    buffer.writeUInt16BE(dataLength, 8)

    for (let i = 0; i < colors.length; i += 1) {
      const { red, green, blue } = colors[i]
      const offset = 10 + i * 3
      buffer[offset] = Math.max(0, Math.min(255, Math.round(red * 255)))
      buffer[offset + 1] = Math.max(0, Math.min(255, Math.round(green * 255)))
      buffer[offset + 2] = Math.max(0, Math.min(255, Math.round(blue * 255)))
    }

    return buffer
  }

  /// Re-queries mdns to update the device ip address
  refresh() {
    const now = Date.now()
    if (
      this.lastMdnsQueryAt === null ||
      now - this.lastMdnsQueryAt >= this.mdnsBackoffMs
    ) {
      mdns.query(this.mdns_name, MDNS_QUERY_TYPE)
      this.lastMdnsQueryAt = now
      this.transitionState('discovering')
    }

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

  private httpRequestForTest(
    endpoint: string,
    timeout: number
  ): Promise<{ data: any | null; error?: string }> {
    return new Promise((resolve) => {
      if (this.ip === null) {
        resolve({ data: null, error: 'No IP resolved' })
        return
      }

      const normalizedEndpoint = endpoint.startsWith('/')
        ? endpoint.slice(1)
        : endpoint
      const req = http.get(
        `http://${this.ip}/${normalizedEndpoint}`,
        { timeout },
        (res) => {
          const statusCode = res.statusCode ?? 0
          const chunks: Buffer[] = []

          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })

          res.on('end', () => {
            if (statusCode < 200 || statusCode >= 300) {
              resolve({ data: null, error: `HTTP ${statusCode}` })
              return
            }
            const payload = Buffer.concat(chunks).toString('utf8')
            try {
              resolve({ data: JSON.parse(payload) })
            } catch (_error) {
              resolve({ data: null, error: 'Invalid JSON response' })
            }
          })
        }
      )

      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'))
      })

      req.on('error', (error: NodeJS.ErrnoException) => {
        resolve({ data: null, error: error.code ?? error.message })
      })
    })
  }

  private sendUdpTestPacket(colors: BaseColors[]): Promise<{ error?: string }> {
    return new Promise((resolve) => {
      if (this.ip === null) {
        resolve({ error: 'No IP resolved' })
        return
      }
      try {
        client.send(udpBuffer(colors), UDP_WLED_PORT, this.ip, (err) => {
          if (err) {
            resolve({ error: err.message })
            return
          }
          resolve({})
        })
      } catch (error) {
        resolve({ error: error instanceof Error ? error.message : String(error) })
      }
    })
  }

  async testConnection(): Promise<TestWledConnectionResponse> {
    const diagnostics: TestWledConnectionResponse['diagnostics'] = {
      mdnsResolved: false,
      ip: null,
      httpAccessible: false,
      packetSent: false,
    }

    mdns.query(this.mdns_name, MDNS_QUERY_TYPE)

    const started = Date.now()
    while (Date.now() - started < WLED_TEST_TIMEOUT_MS) {
      if (this.ip !== null) break
      await this.wait(100)
    }

    diagnostics.mdnsResolved = this.ip !== null
    diagnostics.ip = this.ip

    if (!diagnostics.mdnsResolved) {
      diagnostics.httpError = 'mDNS resolution timed out'
      diagnostics.packetError = 'No resolved IP for UDP test'
      return {
        success: false,
        mdns: this.baseMdns,
        diagnostics,
      }
    }

    const httpResult = await this.httpRequestForTest(
      '/json/info',
      WLED_TEST_TIMEOUT_MS
    )

    if (httpResult.data !== null && typeof httpResult.data === 'object') {
      diagnostics.httpAccessible = true
      const info = httpResult.data
      const version = typeof info.ver === 'string' ? info.ver : undefined
      const ledCount =
        info.leds && typeof info.leds === 'object' && typeof info.leds.count === 'number'
          ? info.leds.count
          : undefined
      const name = typeof info.name === 'string' ? info.name : undefined
      const brand = typeof info.brand === 'string' ? info.brand : undefined
      if (
        version !== undefined &&
        ledCount !== undefined &&
        name !== undefined &&
        brand !== undefined
      ) {
        diagnostics.deviceInfo = { version, ledCount, name, brand }
      }
    } else {
      diagnostics.httpError = httpResult.error ?? 'HTTP API request failed'
    }

    const packetResult = await this.sendUdpTestPacket([
      { red: 255, green: 255, blue: 255 },
    ])
    diagnostics.packetSent = !packetResult.error
    if (packetResult.error) {
      diagnostics.packetError = packetResult.error
    }

    return {
      success:
        diagnostics.mdnsResolved &&
        diagnostics.httpAccessible &&
        diagnostics.packetSent,
      mdns: this.baseMdns,
      diagnostics,
    }
  }

  async identify(): Promise<void> {
    const totalFrames = 30
    for (let i = 0; i < totalFrames; i += 1) {
      setTimeout(() => {
        const isRed = i % 2 === 0
        this.broadcast([
          isRed
            ? { red: 255, green: 0, blue: 0 }
            : { red: 255, green: 255, blue: 255 },
        ])
      }, i * 100)
    }
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
      this.consecutiveFailures += 1
      this.transitionState('disconnected')
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
      this.consecutiveFailures += 1
      this.transitionState('error')
      return false
    }

    this.cachedBrand = info.brand
    this.cachedVersion = info.version
    this.cachedDeviceName = info.name
    this.cachedLedCount = info.ledCount
    this.lastHttpSuccess = Date.now()
    this.httpWarningIssued = false
    this.consecutiveFailures = 0
    this.transitionState('connected')

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

  getPacketLossRate(): number {
    return this.totalPacketsSent > 0
      ? this.failedPacketsSent / this.totalPacketsSent
      : 0
  }

  resetProtocol(): void {
    this.activeProtocol = this.configuredProtocol
    this.protocolFallbackOccurred = false
    this.consecutiveFailures = 0
  }

  getConfiguredProtocol(): WledProtocol {
    return this.configuredProtocol
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /// Sends colors to each led via selected protocol
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

    const sendStartedAt = Date.now()
    this.totalPacketsSent += 1

    const payload =
      this.activeProtocol === 'DDP' ? this.createDdpBuffer(colors) : udpBuffer(colors)
    const port = this.activeProtocol === 'DDP' ? DDP_WLED_PORT : UDP_WLED_PORT

    try {
      client.send(payload, port, this.ip, (err) => {
        if (err) {
          this.failedPacketsSent += 1
          this.consecutiveFailures += 1
          this.transitionState('error')

          if (this.consecutiveFailures >= FALLBACK_FAILURE_THRESHOLD) {
            if (this.activeProtocol === 'DDP') {
              this.activeProtocol = 'UDP'
              this.protocolFallbackOccurred = true
              this.consecutiveFailures = 0
              console.warn('WLED protocol fallback triggered', {
                mdns: this.baseMdns,
                configuredProtocol: this.configuredProtocol,
                activeProtocol: this.activeProtocol,
              })
            } else {
              console.error('WLED transmission failed repeatedly while using UDP', {
                mdns: this.baseMdns,
                failures: this.consecutiveFailures,
              })
            }
          }

          console.error('WLED Send Error', {
            mdns: this.mdns_name,
            ip: this.ip,
            protocol: this.activeProtocol,
            error: err,
          })
          return
        }

        this.lastSuccessfulBroadcast = Date.now()
        this.lastBroadcastLatency = this.lastSuccessfulBroadcast - sendStartedAt
        this.consecutiveFailures = 0
        this.transitionState('connected')
      })
    } catch (err) {
      this.failedPacketsSent += 1
      this.consecutiveFailures += 1
      this.transitionState('error')

      if (this.consecutiveFailures >= FALLBACK_FAILURE_THRESHOLD) {
        if (this.activeProtocol === 'DDP') {
          this.activeProtocol = 'UDP'
          this.protocolFallbackOccurred = true
          this.consecutiveFailures = 0
          console.warn('WLED protocol fallback triggered', {
            mdns: this.baseMdns,
            configuredProtocol: this.configuredProtocol,
            activeProtocol: this.activeProtocol,
          })
        } else {
          console.error('WLED transmission failed repeatedly while using UDP', {
            mdns: this.baseMdns,
            failures: this.consecutiveFailures,
          })
        }
      }

      console.error('WLED Send Error', {
        mdns: this.mdns_name,
        ip: this.ip,
        protocol: this.activeProtocol,
        error: err,
      })
    }
  }

  release() {
    mdns.removeListener('response', this.listener)
  }

  isConnected() {
    if (this.connectionState !== 'connected') {
      return false
    }

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
      connectionState: this.connectionState,
      packetLossRate: this.getPacketLossRate(),
      lastSuccessfulTransmission: this.lastSuccessfulBroadcast ?? undefined,
      latency: this.lastBroadcastLatency ?? undefined,
      currentProtocol: this.activeProtocol,
      protocolFallbackOccurred: this.protocolFallbackOccurred,
    }
  }
}
