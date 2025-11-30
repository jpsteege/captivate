import { BaseColors } from '../../../shared/baseColors'
import { MAX_LED_COUNT } from '../../../shared/ledFixtures'

const MAX_VAL = 255

// All inputs should be from 0 to 255
export default function udpBuffer(colors: BaseColors[]) {
  // https://github.com/Aircoookie/WLED/wiki/UDP-Realtime-Control
  // byte 0 = 2 (DRGB protocol. 490 LEDs max)
  // byte 1 = seconds to wait after last packet to return to normal
  // Byte	Description
  //   2 + n*3	Red Value
  //   3 + n*3	Green Value
  //   4 + n*3	Blue Value

  let buffer = Buffer.alloc(MAX_LED_COUNT * 3 + 2, 0)

  buffer[0] = 2
  buffer[1] = 2

  for (let [i, { red, green, blue }] of colors.entries()) {
    if (i < MAX_LED_COUNT) {
      buffer[2 + i * 3] = red * MAX_VAL
      buffer[3 + i * 3] = green * MAX_VAL
      buffer[4 + i * 3] = blue * MAX_VAL
    }
  }

  if (colors.length > MAX_LED_COUNT) {
    console.warn('MAX_LED_COUNT exceeded. Extra values ignored')
  }

  return buffer
}
