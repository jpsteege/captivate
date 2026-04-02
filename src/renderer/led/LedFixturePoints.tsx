import { pLerp, Point } from 'math/point'
import { useDmxSelector } from 'renderer/redux/store'
import { useRealtimeSelector } from 'renderer/redux/realtimeStore'
import styled from 'styled-components'
import { pointsToSegments } from 'shared/ledFixtures'
import { BaseColors } from 'shared/baseColors'

interface Props {
  index: number
}

/**
 * Renders the connecting lines between LED fixture points as an SVG polyline,
 * plus individual LED dots along the path colored by current wledOut output.
 * Active fixtures are drawn thicker and brighter.
 */

function computeLedPositions(points: Point[], ledCount: number): Point[] {
  const segments = pointsToSegments(points)
  const totalLength = segments.reduce((acc, s) => acc + s.length, 0)
  if (totalLength <= 0 || ledCount <= 0) return []

  const positions: Point[] = []
  for (const segment of segments) {
    const segLedCount = (segment.length / totalLength) * ledCount
    for (let i = 0; i < segLedCount; i++) {
      const ratio = i / segLedCount
      positions.push(pLerp(segment.p0, segment.p1, ratio))
    }
  }
  return positions
}

function DynamicSvg({
  points,
  lineColor,
  lineWidth,
  ledPositions,
  ledColors,
  isActive,
}: {
  points: Point[]
  lineColor: string
  lineWidth: string
  ledPositions: Point[]
  ledColors: BaseColors[]
  isActive: boolean
}) {
  const pointsString = points
    .map(({ x, y }) => `${x},${1.0 - y}`)
    .join(' ')

  const ledRadius = isActive ? 0.008 : 0.005

  return (
    <svg
      viewBox="0 0 1 1"
      height="100%"
      width="100%"
      style={{ objectFit: 'fill' }}
      preserveAspectRatio="none"
    >
      <polyline
        points={pointsString}
        style={{ fill: 'none', stroke: lineColor, strokeWidth: lineWidth }}
      />
      {ledPositions.map((pos, i) => {
        const color = ledColors[i]
        const r = color ? Math.round(color.red * 255) : 0
        const g = color ? Math.round(color.green * 255) : 0
        const b = color ? Math.round(color.blue * 255) : 0
        const brightness = color ? (color.red + color.green + color.blue) / 3 : 0
        const fill = brightness > 0.01 ? `rgb(${r},${g},${b})` : (isActive ? '#555' : '#333')
        return (
          <circle
            key={i}
            cx={pos.x}
            cy={1.0 - pos.y}
            r={ledRadius}
            fill={fill}
          />
        )
      })}
    </svg>
  )
}

export default function LedFixturePoints({ index }: Props) {
  const points = useDmxSelector((dmx) => dmx.led.ledFixtures[index].points)
  const ledCount = useDmxSelector((dmx) => dmx.led.ledFixtures[index].led_count)
  const mdns = useDmxSelector((dmx) => dmx.led.ledFixtures[index].mdns)
  const isActive = useDmxSelector((dmx) => dmx.led.activeFixture === index)
  const ledColors = useRealtimeSelector((state) => state.wledOut[mdns] ?? [])

  const ledPositions = computeLedPositions(points, ledCount)

  return (
    <Root>
      <DynamicSvg
        points={points}
        lineColor={isActive ? '#eee' : '#fff5'}
        lineWidth={isActive ? '0.005' : '0.003'}
        ledPositions={ledPositions}
        ledColors={ledColors}
        isActive={isActive}
      />
    </Root>
  )
}

const Root = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
`
