import { initParams } from '../params'
import { getLedValues, initLedFixture } from '../ledFixtures'

describe('getLedValues window gating', () => {
  const baseParams = {
    ...initParams(),
    brightness: 1,
    saturation: 0,
    x: 0.5,
    width: 1,
    y: 0.5,
    height: 1,
  }

  it('applies moving window when fixture.window is undefined', () => {
    const fixture = {
      ...initLedFixture(),
      led_count: 1,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      window: undefined,
    }

    const values = getLedValues(baseParams, fixture, 1)
    expect(values[0].red).toBeCloseTo(0.25)
  })

  it('ignores disabled axes while respecting enabled ones', () => {
    const fixture = {
      ...initLedFixture(),
      led_count: 1,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      window: { y: { pos: 0, width: 0 } },
    }

    const values = getLedValues(baseParams, fixture, 1)
    expect(values[0].red).toBeCloseTo(0.5)
  })
})
