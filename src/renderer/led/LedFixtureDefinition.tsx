import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import RemoveIcon from '@mui/icons-material/Remove'
import { IconButton, TextField, Tooltip } from '@mui/material'
import Dropdown from 'renderer/base/Dropdown'
import GroupPicker from 'renderer/base/GroupPicker'
import NumberField from 'renderer/base/NumberField'
import Slider from 'renderer/base/Slider'
import Select from 'renderer/base/Select'
import ToggleButton from 'renderer/base/ToggleButton'
import {
  addLedFixtureGroup,
  removeLedFixtureGroup,
  removeLedFixture,
  setActiveLedFixture,
  setLedFixtureWindowEnabled,
  setLedFixtureWindowPos,
  setLedFixtureWindowWidth,
  updateActiveLedFixture,
} from 'renderer/redux/dmxSlice'
import { useDmxSelector, useTypedSelector } from 'renderer/redux/store'
import {
  LED_STRIP_TYPES,
  LedFixture,
  MAX_LED_COUNT,
  WLED_PROTOCOLS,
  WledProtocol,
} from 'shared/ledFixtures'
import { getSortedGroups } from 'shared/dmxUtil'
import styled, { useTheme } from 'styled-components'
import { useDispatch } from 'react-redux'
import { useState } from 'react'
import {
  ResetWledProtocolResponse,
  TestWledConnectionResponse,
} from 'shared/ipc_channels'

interface Props {
  index: number
}

// @ts-ignore: Typescript doesn't recognize the globals set in "src/main/preload.js"
const ipcRenderer = window.electron.ipcRenderer

function getRecommendedProtocol(version: string | undefined): WledProtocol | null {
  if (!version) return null

  const match = version.match(/(\d+)\.(\d+)/)
  if (!match) return null

  const major = Number(match[1])
  const minor = Number(match[2])

  if (Number.isNaN(major) || Number.isNaN(minor)) return null
  if (major > 0 || (major === 0 && minor >= 13)) return 'DDP'
  return 'UDP'
}

function getProtocolRecommendation(
  version: string | undefined,
  currentProtocol: WledProtocol
): string {
  const fallbackMessage =
    'Protocol selection: DDP recommended for WLED 0.13+, UDP for older versions'
  if (!version) return fallbackMessage

  const recommendedProtocol = getRecommendedProtocol(version)
  if (!recommendedProtocol) return fallbackMessage

  if (currentProtocol === recommendedProtocol) {
    return `✓ Optimal protocol for WLED ${version}`
  }

  return `⚠ Consider switching to ${recommendedProtocol} for WLED ${version}`
}

type Status = 'connected' | 'discovering' | 'disconnected' | 'error'

function getConnectionStateTooltip(status: Status): string {
  if (status === 'connected') return 'Connected to WLED device'
  if (status === 'discovering') return 'Searching for WLED device on network'
  if (status === 'error') return 'Connection error while communicating with WLED'
  return 'WLED device not found on network'
}

function getLatencyColor(latency: number, theme: any): string {
  if (latency < 50) return '#4caf50'
  if (latency <= 200) return theme.colors.text.warning
  return '#f44336'
}

function getPacketLossColor(packetLossRate: number, theme: any): string {
  if (packetLossRate < 0.05) return '#4caf50'
  if (packetLossRate <= 0.2) return theme.colors.text.warning
  return '#f44336'
}

export default function LedFixtureDefinition({ index }: Props) {
  let def = useDmxSelector((dmx) => dmx.led.ledFixtures[index])
  let isActive = useDmxSelector((dmx) => dmx.led.activeFixture === index)
  const dmx = useDmxSelector((dmx) => dmx)
  const theme = useTheme()
  const wledConnections = useTypedSelector((state) => state.gui.wled)

  const dispatch = useDispatch()
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [testDiagnostics, setTestDiagnostics] =
    useState<TestWledConnectionResponse | null>(null)
  const [identifyStatus, setIdentifyStatus] = useState<'idle' | 'identifying'>(
    'idle'
  )

  function setField<
    Key extends keyof LedFixture,
    Value extends LedFixture[Key]
  >(key: Key, value: Value) {
    dispatch(
      updateActiveLedFixture({
        ...def,
        [key]: value,
      })
    )
  }

  const mdnsValue = def.mdns
  const mdnsIsEmpty = mdnsValue.trim().length === 0
  const mdnsHasInvalidChars = !/^[a-zA-Z0-9-]+$/.test(mdnsValue)
  const mdnsHasError = mdnsIsEmpty || mdnsHasInvalidChars
  const mdnsHelperText = mdnsHasError
    ? mdnsIsEmpty
      ? 'mDNS name is required.'
      : 'Use letters, numbers, and hyphens only (no spaces or .local).'
    : 'Enter device hostname only (e.g., wled-livingroom; no .local suffix)'
  const mdnsHelperColor = mdnsHasError
    ? theme.colors.text.error
    : theme.colors.text.secondary

  const fixtureConnection = wledConnections.available.find(
    (d) => d.mdns === def.mdns
  )
  const version = fixtureConnection?.version
  const recommendedProtocol = getRecommendedProtocol(version)
  const protocolRecommendation = getProtocolRecommendation(version, def.protocol)
  const isProtocolOptimal =
    recommendedProtocol !== null && def.protocol === recommendedProtocol
  const status: Status = fixtureConnection?.connectionState ?? 'disconnected'
  const statusTooltip = getConnectionStateTooltip(status)
  const availableGroups = getSortedGroups(
    dmx.universe,
    dmx.fixtureTypes,
    dmx.fixtureTypesByID,
    dmx.led.ledFixtures
  )

  async function handleTestConnection() {
    if (mdnsHasError) return
    setTestStatus('testing')
    setTestDiagnostics(null)
    try {
      const response = (await ipcRenderer.invoke('test_wled_connection', {
        mdns: def.mdns,
        testType: 'connection',
      })) as TestWledConnectionResponse
      setTestDiagnostics(response)
      setTestStatus(response.success ? 'success' : 'error')
    } catch (_error) {
      setTestStatus('error')
      setTestDiagnostics(null)
    }
  }

  async function handleResetProtocol() {
    if (mdnsHasError) return
    try {
      const response = (await ipcRenderer.invoke('reset_wled_protocol', {
        mdns: def.mdns,
      })) as ResetWledProtocolResponse
      if (!response.success) {
        console.warn('Failed to reset WLED protocol', response)
      }
    } catch (error) {
      console.warn('Failed to reset WLED protocol', error)
    }
  }

  async function handleIdentify() {
    if (mdnsHasError) return
    setIdentifyStatus('identifying')
    try {
      await ipcRenderer.invoke('test_wled_connection', {
        mdns: def.mdns,
        testType: 'identify',
      })
    } finally {
      setTimeout(() => setIdentifyStatus('idle'), 3000)
    }
  }

  if (isActive)
    return (
      <ActiveRoot>
        <Row>
          <Dropdown
            isOpen={true}
            onClick={() => dispatch(setActiveLedFixture(null))}
          />
          <FieldGroup>
            <FieldRow>
              <TextField
                value={def.name}
                label="Name"
                size="small"
                variant="standard"
                onChange={(e) => setField('name', e.target.value)}
                fullWidth
              />
              <Select
                label="Strip Type"
                val={def.type}
                items={LED_STRIP_TYPES}
                onChange={(newType) => setField('type', newType)}
                style={{ minWidth: '8rem' }}
              />
              <ProtocolField>
                <Select
                  label="Protocol"
                  val={def.protocol}
                  items={WLED_PROTOCOLS}
                  onChange={(newProtocol) => setField('protocol', newProtocol)}
                  style={{ minWidth: '8rem' }}
                />
                <Tooltip title={protocolRecommendation}>
                  <InfoIconWrapper>
                    <InfoOutlinedIcon fontSize="small" />
                  </InfoIconWrapper>
                </Tooltip>
                {version && recommendedProtocol && (
                  <ProtocolRecommendation $isOptimal={isProtocolOptimal}>
                    {isProtocolOptimal ? '✓' : '⚠'}{' '}
                    {isProtocolOptimal
                      ? `Optimal for WLED ${version}`
                      : `${recommendedProtocol} recommended for WLED ${version}`}
                  </ProtocolRecommendation>
                )}
              </ProtocolField>
            </FieldRow>
            <FieldRow>
              <MdnsField>
                <TextField
                  value={mdnsValue}
                  label="mDNS Name"
                  size="small"
                  variant="standard"
                  error={mdnsHasError}
                  helperText={mdnsHelperText}
                  FormHelperTextProps={{ style: { color: mdnsHelperColor } }}
                  onChange={(e) => setField('mdns', e.target.value)}
                  fullWidth
                />
                <Tooltip title="WLED Setup: Ensure your WLED device is on the same network and mDNS is enabled in WLED settings. Enter the device hostname only (without the .local suffix).">
                  <InfoIconWrapper>
                    <InfoOutlinedIcon fontSize="small" />
                  </InfoIconWrapper>
                </Tooltip>
              </MdnsField>
            </FieldRow>
            <TestSection>
              <TestButtonsRow>
                <TestButton
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || mdnsHasError}
                >
                  {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                </TestButton>
                <TestButton
                  onClick={handleIdentify}
                  disabled={identifyStatus === 'identifying' || mdnsHasError}
                >
                  {identifyStatus === 'identifying'
                    ? 'Identifying...'
                    : 'Identify Device'}
                </TestButton>
              </TestButtonsRow>
              {testStatus === 'testing' && <Spinner />}
              {testDiagnostics && (
                <DiagnosticsList>
                  <DiagnosticItem>
                    <span>
                      {testDiagnostics.diagnostics.mdnsResolved ? '✓' : '✗'}{' '}
                      mDNS Resolution
                      {testDiagnostics.diagnostics.ip
                        ? ` (${testDiagnostics.diagnostics.ip})`
                        : ''}
                    </span>
                  </DiagnosticItem>
                  <DiagnosticItem>
                    <span>
                      {testDiagnostics.diagnostics.httpAccessible ? '✓' : '✗'}{' '}
                      HTTP API Accessible
                      {testDiagnostics.diagnostics.deviceInfo
                        ? ` (WLED ${testDiagnostics.diagnostics.deviceInfo.version}, ${testDiagnostics.diagnostics.deviceInfo.ledCount} LEDs)`
                        : ''}
                    </span>
                  </DiagnosticItem>
                  {testDiagnostics.diagnostics.httpError && (
                    <ErrorText>
                      HTTP Error: {testDiagnostics.diagnostics.httpError}
                    </ErrorText>
                  )}
                  <DiagnosticItem>
                    <span>
                      {testDiagnostics.diagnostics.packetSent ? '✓' : '✗'} Test
                      Packet Sent
                    </span>
                  </DiagnosticItem>
                  {testDiagnostics.diagnostics.packetError && (
                    <ErrorText>
                      Packet Error: {testDiagnostics.diagnostics.packetError}
                    </ErrorText>
                  )}
                  {testDiagnostics.success && (
                    <SuccessText>All connection checks passed.</SuccessText>
                  )}
                </DiagnosticsList>
              )}
            </TestSection>
            <QualityMetricsSection>
              <QualityHeader>Connection Quality</QualityHeader>
              <MetricsRow>
                <ConnectionStateBadge $status={status}>
                  {status}
                </ConnectionStateBadge>
                <ProtocolStatusIndicator
                  $hasFallback={!!fixtureConnection?.protocolFallbackOccurred}
                >
                  Protocol: {fixtureConnection?.currentProtocol ?? def.protocol}
                  {fixtureConnection?.protocolFallbackOccurred
                    ? ' (fallback active)'
                    : ''}
                </ProtocolStatusIndicator>
              </MetricsRow>
              <MetricsRow>
                <PacketLossIndicator
                  $color={getPacketLossColor(
                    fixtureConnection?.packetLossRate ?? 0,
                    theme
                  )}
                >
                  Loss:{' '}
                  {fixtureConnection?.packetLossRate !== undefined
                    ? `${(fixtureConnection.packetLossRate * 100).toFixed(1)}%`
                    : 'N/A'}
                </PacketLossIndicator>
                <LatencyIndicator
                  $color={getLatencyColor(fixtureConnection?.latency ?? 0, theme)}
                >
                  Latency:{' '}
                  {fixtureConnection?.latency !== undefined
                    ? `${fixtureConnection.latency}ms`
                    : 'N/A'}
                </LatencyIndicator>
              </MetricsRow>
              {fixtureConnection?.protocolFallbackOccurred && (
                <ResetProtocolButton onClick={handleResetProtocol}>
                  Reset Protocol
                </ResetProtocolButton>
              )}
            </QualityMetricsSection>
            <NumberField
              label="LED Count"
              val={def.led_count}
              onChange={(newCount) => setField('led_count', newCount)}
              min={0}
              max={MAX_LED_COUNT}
              helperText={`Max: ${MAX_LED_COUNT} LEDs`}
            />
            <SectionHeader>Groups</SectionHeader>
            <GroupPicker
              groups={def.groups}
              availableGroups={availableGroups}
              addGroup={(g) => dispatch(addLedFixtureGroup(g))}
              removeGroup={(g) => dispatch(removeLedFixtureGroup(g))}
            />
            <SectionHeader>Window</SectionHeader>
            <WindowControlRow>
              <ToggleButton
                isEnabled={!!def.window?.x}
                onClick={() =>
                  dispatch(
                    setLedFixtureWindowEnabled({
                      dimension: 'x',
                      enabled: !def.window?.x,
                    })
                  )
                }
              >
                X
              </ToggleButton>
              <ToggleButton
                isEnabled={!!def.window?.y}
                onClick={() =>
                  dispatch(
                    setLedFixtureWindowEnabled({
                      dimension: 'y',
                      enabled: !def.window?.y,
                    })
                  )
                }
              >
                Y
              </ToggleButton>
            </WindowControlRow>
            {def.window?.x && (
              <AxisControls>
                <Label>X Position</Label>
                <Slider
                  value={def.window.x.pos}
                  orientation="horizontal"
                  onChange={(pos) =>
                    dispatch(
                      setLedFixtureWindowPos({ dimension: 'x', pos: pos })
                    )
                  }
                />
                <Label>X Width</Label>
                <Slider
                  value={def.window.x.width}
                  orientation="horizontal"
                  onChange={(width) =>
                    dispatch(
                      setLedFixtureWindowWidth({
                        dimension: 'x',
                        width: width,
                      })
                    )
                  }
                />
              </AxisControls>
            )}
            {def.window?.y && (
              <AxisControls>
                <Label>Y Position</Label>
                <Slider
                  value={def.window.y.pos}
                  orientation="horizontal"
                  onChange={(pos) =>
                    dispatch(
                      setLedFixtureWindowPos({ dimension: 'y', pos: pos })
                    )
                  }
                />
                <Label>Y Width</Label>
                <Slider
                  value={def.window.y.width}
                  orientation="horizontal"
                  onChange={(width) =>
                    dispatch(
                      setLedFixtureWindowWidth({
                        dimension: 'y',
                        width: width,
                      })
                    )
                  }
                />
              </AxisControls>
            )}
          </FieldGroup>
        </Row>
      </ActiveRoot>
    )

  return (
    <InactiveRoot onClick={() => dispatch(setActiveLedFixture(index))}>
      <div
        onClick={(e) => {
          e.stopPropagation()
          dispatch(setActiveLedFixture(index))
        }}
      >
        <Dropdown
          isOpen={false}
          onClick={() => dispatch(setActiveLedFixture(index))}
        />
      </div>
      <Tooltip title={statusTooltip}>
        <StatusDot $status={status} />
      </Tooltip>
      <InactiveContent>
        <Name>{def.name}</Name>
        <InfoRow>
          <Info>{`${def.led_count} LEDs`}</Info>
          <Info>{`mDNS: ${def.mdns}`}</Info>
          <Info>{`Protocol: ${fixtureConnection?.currentProtocol ?? def.protocol}`}</Info>
          {fixtureConnection?.packetLossRate !== undefined && (
            <Info>{`Loss: ${(fixtureConnection.packetLossRate * 100).toFixed(1)}%`}</Info>
          )}
          {fixtureConnection?.latency !== undefined && (
            <Info>{`Latency: ${fixtureConnection.latency}ms`}</Info>
          )}
          {fixtureConnection?.protocolFallbackOccurred && (
            <Info>{'⚠ Using UDP fallback'}</Info>
          )}
        </InfoRow>
      </InactiveContent>
      <div style={{ flex: '1 0 0' }} />
      <IconButton
        onClick={(e) => {
          e.stopPropagation()
          dispatch(removeLedFixture(index))
        }}
      >
        <RemoveIcon />
      </IconButton>
    </InactiveRoot>
  )
}

const ActiveRoot = styled.div`
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  background-color: ${(props) => props.theme.colors.bg.darker};
  border: 1px solid ${(props) => props.theme.colors.divider};
  border-radius: 0.25rem;
`

const InactiveRoot = styled.div`
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  cursor: pointer;
  border: 1px solid ${(props) => props.theme.colors.bg.darker};
  background-color: ${(props) => props.theme.colors.bg.primary};
  transition: border-color 120ms ease, background-color 120ms ease;
  :hover {
    border-color: ${(props) => props.theme.colors.text.primary};
    background-color: ${(props) => props.theme.colors.bg.lighter};
  }
`

const Name = styled.div`
  margin-right: 0.75rem;
  font-weight: 600;
`

const Info = styled.div`
  color: ${(props) => props.theme.colors.text.secondary};
`

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
`

const FieldRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  width: 100%;
`

const MdnsField = styled.div`
  display: flex;
  gap: 0.35rem;
  align-items: center;
  width: 100%;
`

const ProtocolField = styled.div`
  display: flex;
  gap: 0.35rem;
  align-items: center;
`

const InfoRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  color: ${(props) => props.theme.colors.text.secondary};
`

const InactiveContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`
const StatusDot = styled.div<{ $status: Status }>`
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  margin-right: 0.5rem;
  background-color: ${(props) => {
    if (props.$status === 'connected') return '#4caf50'
    if (props.$status === 'discovering') return props.theme.colors.text.warning
    if (props.$status === 'error') return '#f44336'
    return props.theme.colors.text.secondary
  }};
  border: 1px solid ${(props) => props.theme.colors.bg.darker};
`

const InfoIconWrapper = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.colors.text.secondary};
`

const ProtocolRecommendation = styled.div<{ $isOptimal: boolean }>`
  font-size: 0.75rem;
  color: ${(props) =>
    props.$isOptimal ? '#4caf50' : props.theme.colors.text.warning};
  white-space: nowrap;
`

const SectionHeader = styled.div`
  margin-top: 0.5rem;
  font-weight: 600;
`

const WindowControlRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`

const AxisControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`

const Label = styled.div`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.text.secondary};
`

const TestSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 1px solid ${(props) => props.theme.colors.divider};
  border-radius: 0.25rem;
  padding: 0.5rem;
`

const TestButtonsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const TestButton = styled.button`
  border: 1px solid ${(props) => props.theme.colors.divider};
  background-color: ${(props) => props.theme.colors.bg.lighter};
  color: ${(props) => props.theme.colors.text.primary};
  border-radius: 0.25rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;

  :disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`

const DiagnosticsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`

const DiagnosticItem = styled.div`
  font-size: 0.85rem;
  color: ${(props) => props.theme.colors.text.secondary};
`

const ErrorText = styled.div`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.text.error};
`

const SuccessText = styled.div`
  font-size: 0.8rem;
  color: #4caf50;
`

const Spinner = styled.div`
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid ${(props) => props.theme.colors.divider};
  border-top-color: ${(props) => props.theme.colors.text.primary};
  animation: spin 0.75s linear infinite;

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`

const QualityMetricsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border: 1px solid ${(props) => props.theme.colors.divider};
  border-radius: 0.25rem;
  padding: 0.5rem;
`

const QualityHeader = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
`

const MetricsRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
`

const ConnectionStateBadge = styled.div<{ $status: Status }>`
  border-radius: 0.2rem;
  padding: 0.2rem 0.45rem;
  font-size: 0.75rem;
  text-transform: capitalize;
  color: #ffffff;
  background-color: ${(props) => {
    if (props.$status === 'connected') return '#4caf50'
    if (props.$status === 'discovering') return props.theme.colors.text.warning
    if (props.$status === 'error') return '#f44336'
    return props.theme.colors.text.secondary
  }};
`

const PacketLossIndicator = styled.div<{ $color: string }>`
  font-size: 0.8rem;
  color: ${(props) => props.$color};
`

const LatencyIndicator = styled.div<{ $color: string }>`
  font-size: 0.8rem;
  color: ${(props) => props.$color};
`

const ProtocolStatusIndicator = styled.div<{ $hasFallback: boolean }>`
  font-size: 0.8rem;
  color: ${(props) =>
    props.$hasFallback ? props.theme.colors.text.warning : props.theme.colors.text.secondary};
`

const ResetProtocolButton = styled.button`
  border: 1px solid ${(props) => props.theme.colors.divider};
  background-color: ${(props) => props.theme.colors.bg.lighter};
  color: ${(props) => props.theme.colors.text.primary};
  border-radius: 0.25rem;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  width: fit-content;
`
