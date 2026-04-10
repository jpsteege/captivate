import styled from 'styled-components'
import StatusBar from '../menu/StatusBar'
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer'
import { useRealtimeSelector } from '../redux/realtimeStore'
import { useDispatch } from 'react-redux'
import { toggleAudioEnabled } from '../redux/guiSlice'
import { useTypedSelector } from '../redux/store'
import { VIBE_HUE } from '../../shared/audioFeatures'

export default function AudioPage() {
  const dispatch = useDispatch()
  const audioEnabled = useTypedSelector((s) => s.gui.audioEnabled)
  const { devices, deviceId, enabled, setDeviceId, setEnabled } =
    useAudioAnalyzer()
  const features = useRealtimeSelector((s) => s.audioFeatures)

  function handleToggleEnabled() {
    setEnabled(!enabled)
    // Keep guiState in sync so AutoControl tab visibility works
    if (!enabled !== audioEnabled) {
      dispatch(toggleAudioEnabled())
    }
  }

  return (
    <Root>
      <StatusBar />
      <Content>
        <Header>
          <HeaderTitle>Audio Analysis</HeaderTitle>
        </Header>

        <Section>
          <SectionLabel>Input Device</SectionLabel>
          <Row>
            <DeviceSelect
              value={deviceId ?? ''}
              onChange={(e) => setDeviceId(e.target.value || null)}
            >
              <option value="">Default input</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Input ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </DeviceSelect>
            <EnableButton $active={enabled} onClick={handleToggleEnabled}>
              {enabled ? 'Enabled' : 'Enable'}
            </EnableButton>
          </Row>
        </Section>

        {enabled && (
          <>
            <Section>
              <SectionLabel>Vibe</SectionLabel>
              <VibeChip $hue={VIBE_HUE[features.vibe]}>
                {features.vibe.toUpperCase()}
              </VibeChip>
              <AxisGrid>
                <AxisRow label="Heat" value={features.vibeAxes.heat} />
                <AxisRow label="Energy" value={features.vibeAxes.energy} />
                <AxisRow label="Pulse" value={features.vibeAxes.pulse} />
                <AxisRow label="Groove" value={features.vibeAxes.groove} />
                <AxisRow label="Momentum" value={features.vibeAxes.momentum} />
              </AxisGrid>
            </Section>

            <Section>
              <SectionLabel>Features</SectionLabel>
              <MetersGrid>
                <MeterRow label="Energy" value={features.energy} />
                <MeterRow label="Bass" value={features.bass} color="#e57373" />
                <MeterRow label="Mids" value={features.mids} color="#81c784" />
                <MeterRow
                  label="Treble"
                  value={features.treble}
                  color="#64b5f6"
                />
                <MeterRow
                  label="Onset"
                  value={features.onset}
                  color="#ffb74d"
                />
                <MeterRow
                  label="Flux"
                  value={features.flux}
                  color="#ce93d8"
                />
                <MeterRow
                  label="Centroid"
                  value={features.centroid}
                  color="#80deea"
                />
              </MetersGrid>
            </Section>

            <Section>
              <SectionLabel>Events</SectionLabel>
              <EventRow>
                <EventPill $active={features.onset > 0.3} color="#ffb74d">
                  Onset
                </EventPill>
                <EventPill $active={features.drop} color="#ef9a9a">
                  Drop
                </EventPill>
                {features.bpm > 0 && (
                  <BpmDisplay>{Math.round(features.bpm)} BPM</BpmDisplay>
                )}
              </EventRow>
            </Section>
          </>
        )}

        {!enabled && (
          <Hint>
            Enable audio input to start extracting real-time features for
            reactive lighting and auto-control.
          </Hint>
        )}
      </Content>
    </Root>
  )
}

function MeterRow({
  label,
  value,
  color = '#ffffff',
}: {
  label: string
  value: number
  color?: string
}) {
  const pct = Math.round(value * 100)
  return (
    <MeterRowRoot>
      <MeterLabel>{label}</MeterLabel>
      <MeterTrack>
        <MeterFill style={{ width: `${pct}%`, backgroundColor: color }} />
      </MeterTrack>
      <MeterValue>{pct}%</MeterValue>
    </MeterRowRoot>
  )
}

function AxisRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100)
  return (
    <MeterRowRoot>
      <AxisLabel>{label}</AxisLabel>
      <MeterTrack>
        <AxisFill style={{ width: `${pct}%` }} />
      </MeterTrack>
      <MeterValue>{pct}%</MeterValue>
    </MeterRowRoot>
  )
}

const Root = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Content = styled.div`
  flex: 1 1 0;
  overflow: auto;
  padding: 0 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  margin-top: 1rem;
`

const HeaderTitle = styled.div`
  font-size: 1.3rem;
`

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const SectionLabel = styled.div`
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${(p) => p.theme.colors.text.secondary};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const DeviceSelect = styled.select`
  flex: 1;
  background-color: ${(p) => p.theme.colors.bg.darker};
  color: ${(p) => p.theme.colors.text.primary};
  border: 1px solid ${(p) => p.theme.colors.divider};
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  font-size: 0.9rem;
`

const EnableButton = styled.button<{ $active: boolean }>`
  padding: 0.35rem 1rem;
  border-radius: 4px;
  border: 1px solid ${(p) => (p.$active ? '#4caf50' : p.theme.colors.divider)};
  background-color: ${(p) => (p.$active ? '#1b5e20' : 'transparent')};
  color: ${(p) => (p.$active ? '#a5d6a7' : p.theme.colors.text.primary)};
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
`

const MetersGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const MeterRowRoot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`

const MeterLabel = styled.div`
  width: 4.5rem;
  font-size: 0.85rem;
  text-align: right;
  color: ${(p) => p.theme.colors.text.secondary};
`

const MeterTrack = styled.div`
  flex: 1;
  height: 0.75rem;
  background-color: ${(p) => p.theme.colors.bg.darker};
  border-radius: 2px;
  overflow: hidden;
`

const MeterFill = styled.div`
  height: 100%;
  border-radius: 2px;
  transition: width 50ms linear;
`

const MeterValue = styled.div`
  width: 2.8rem;
  font-size: 0.8rem;
  color: ${(p) => p.theme.colors.text.secondary};
  text-align: right;
  font-variant-numeric: tabular-nums;
`

const EventRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const EventPill = styled.div<{ $active: boolean; color: string }>`
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  border: 1px solid ${(p) => (p.$active ? p.color : p.theme.colors.divider)};
  color: ${(p) => (p.$active ? p.color : p.theme.colors.text.secondary)};
  background-color: ${(p) => (p.$active ? `${p.color}22` : 'transparent')};
  transition: all 80ms ease;
`

const BpmDisplay = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: ${(p) => p.theme.colors.text.primary};
  margin-left: auto;
`

const Hint = styled.div`
  color: ${(p) => p.theme.colors.text.secondary};
  font-size: 0.9rem;
  max-width: 30rem;
  line-height: 1.5;
`

const VibeChip = styled.div<{ $hue: number }>`
  display: inline-block;
  padding: 0.35rem 1.1rem;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  border: 1.5px solid ${(p) => `hsl(${Math.round(p.$hue * 360)}, 80%, 55%)`};
  color: ${(p) => `hsl(${Math.round(p.$hue * 360)}, 80%, 70%)`};
  background-color: ${(p) => `hsl(${Math.round(p.$hue * 360)}, 60%, 15%)`};
  transition: all 400ms ease;
`

const AxisGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.25rem;
`

const AxisLabel = styled.div`
  width: 4.5rem;
  font-size: 0.8rem;
  text-align: right;
  color: ${(p) => p.theme.colors.text.secondary};
`

const AxisFill = styled.div`
  height: 100%;
  border-radius: 2px;
  background-color: #9fa8da;
  transition: width 200ms linear;
`
