import styled from 'styled-components'
import StatusBar from '../menu/StatusBar'
import { useDmxSelector, useTypedSelector } from '../redux/store'
import { useRealtimeSelector } from '../redux/realtimeStore'
import { BaseColors } from 'shared/baseColors'
import useHover from 'renderer/hooks/useHover'
import useMousePosition from 'renderer/hooks/useMousePosition'
import zIndexes from 'renderer/zIndexes'

export default function WledMixer() {
  const numFixtures = useDmxSelector((dmx) => dmx.led.ledFixtures.length)
  const fixtureIndexes: number[] = []
  for (let i = 0; i < numFixtures; i++) fixtureIndexes.push(i)

  return (
    <Root>
      <StatusBar />
      <Header>
        <HeaderTitle>LED Out</HeaderTitle>
      </Header>
      <FixtureList>
        {fixtureIndexes.map((i) => (
          <FixtureRow key={i} index={i} />
        ))}
        {numFixtures === 0 && (
          <EmptyMessage>No LED fixtures defined. Add fixtures in the LED tab.</EmptyMessage>
        )}
      </FixtureList>
    </Root>
  )
}

function FixtureRow({ index }: { index: number }) {
  const fixture = useDmxSelector((dmx) => dmx.led.ledFixtures[index])
  const wledConnections = useTypedSelector((state) => state.gui.wled)
  const colors = useRealtimeSelector((state) => state.wledOut[fixture?.mdns] ?? [])

  if (!fixture) return null

  const connection = wledConnections.available.find((d) => d.mdns === fixture.mdns)
  const isConnected = wledConnections.connected.includes(fixture.mdns)

  return (
    <FixtureRowRoot>
      <FixtureHeader>
        <StatusDot $connected={isConnected} />
        <FixtureName>{fixture.name}</FixtureName>
        <FixtureMeta>{fixture.led_count} LEDs · {fixture.mdns} · {connection?.currentProtocol ?? fixture.protocol}</FixtureMeta>
      </FixtureHeader>
      <LedStrip colors={colors} ledCount={fixture.led_count} />
    </FixtureRowRoot>
  )
}

function LedStrip({ colors, ledCount }: { colors: BaseColors[]; ledCount: number }) {
  return (
    <StripRoot>
      {Array.from({ length: ledCount }, (_, i) => (
        <LedCell key={i} index={i} color={colors[i]} />
      ))}
    </StripRoot>
  )
}

function LedCell({ index, color }: { index: number; color: BaseColors | undefined }) {
  const { hoverDiv, isHover } = useHover()
  const pos = useMousePosition()

  const r = color ? Math.round(color.red * 255) : 0
  const g = color ? Math.round(color.green * 255) : 0
  const b = color ? Math.round(color.blue * 255) : 0
  const brightness = color ? (color.red + color.green + color.blue) / 3 : 0

  return (
    <Cell
      ref={hoverDiv}
      style={{ backgroundColor: `rgb(${r},${g},${b})` }}
      $lit={brightness > 0.01}
    >
      {isHover && (
        <CellInfo style={{ left: `${pos.x}px`, top: `${pos.y}px` }}>
          <div>LED {index + 1}</div>
          <div>R:{r} G:{g} B:{b}</div>
        </CellInfo>
      )}
    </Cell>
  )
}

const Root = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  margin: 1rem 1rem 0.5rem 1rem;
`

const HeaderTitle = styled.div`
  font-size: 1.3rem;
`

const FixtureList = styled.div`
  flex: 1 1 0;
  overflow: auto;
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const EmptyMessage = styled.div`
  color: ${(props) => props.theme.colors.text.secondary};
  margin-top: 2rem;
  text-align: center;
`

const FixtureRowRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background-color: ${(props) => props.theme.colors.bg.darker};
  border: 1px solid ${(props) => props.theme.colors.divider};
  border-radius: 0.25rem;
  padding: 0.6rem 0.75rem;
`

const FixtureHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const StatusDot = styled.div<{ $connected: boolean }>`
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background-color: ${(props) => (props.$connected ? '#4caf50' : props.theme.colors.text.secondary)};
  flex-shrink: 0;
`

const FixtureName = styled.div`
  font-weight: 600;
`

const FixtureMeta = styled.div`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.text.secondary};
`

const StripRoot = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
`

const Cell = styled.div<{ $lit: boolean }>`
  width: 0.7rem;
  height: 1.4rem;
  border-radius: 1px;
  border: 1px solid ${(props) => (props.$lit ? '#fff3' : '#fff1')};
  box-sizing: border-box;
  position: relative;
  cursor: default;
`

const CellInfo = styled.div`
  position: fixed;
  z-index: ${zIndexes.popups};
  margin-left: 1rem;
  color: #111;
  background-color: #eee;
  padding: 0.15rem 0.3rem;
  opacity: 0.9;
  box-shadow: 0px 2px 10px 0px #000000;
  border-radius: 3px;
  font-size: 0.8rem;
  pointer-events: none;
  white-space: nowrap;
`
