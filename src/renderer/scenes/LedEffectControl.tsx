import styled from 'styled-components'
import { useDispatch } from 'react-redux'
import { useActiveLightScene } from 'renderer/redux/store'
import { setLedEffect } from 'renderer/redux/controlSlice'
import {
  LED_EFFECT_TYPES,
  LedEffect,
  LedEffectType,
  initLedEffect,
} from 'shared/ledPatterns'
import Slider from '@mui/material/Slider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

// Effect types that use the speed slider
const TIME_BASED: LedEffectType[] = [
  'chase', 'pulse', 'strobe', 'colorwave', 'breathe',
]

const EFFECT_LABELS: Record<LedEffectType, string> = {
  none: 'None',
  chase: 'Chase',
  pulse: 'Pulse',
  strobe: 'Strobe',
  sparkle: 'Sparkle',
  gradient: 'Gradient',
  colorwave: 'Color Wave',
  breathe: 'Breathe',
  mirror: 'Mirror',
  lightning: 'Lightning',
}

interface Props {
  splitIndex: number
}

export default function LedEffectControl({ splitIndex }: Props) {
  const dispatch = useDispatch()
  const effect: LedEffect = useActiveLightScene(
    (scene) => scene.splitScenes[splitIndex]?.ledEffect ?? initLedEffect()
  )

  function update(patch: Partial<LedEffect>) {
    dispatch(setLedEffect({ splitIndex, effect: { ...effect, ...patch } }))
  }

  const showSpeed = TIME_BASED.includes(effect.type)

  return (
    <Root>
      <Label>LED Effect</Label>
      <Row>
        <Select
          size="small"
          value={effect.type}
          onChange={(e) => update({ type: e.target.value as LedEffectType })}
          sx={{ fontSize: '0.85rem', minWidth: '9rem' }}
        >
          {LED_EFFECT_TYPES.map((t) => (
            <MenuItem key={t} value={t} sx={{ fontSize: '0.85rem' }}>
              {EFFECT_LABELS[t]}
            </MenuItem>
          ))}
        </Select>
      </Row>

      {effect.type !== 'none' && (
        <>
          <SliderRow>
            <SliderLabel>Intensity</SliderLabel>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={effect.intensity}
              onChange={(_, v) => update({ intensity: v as number })}
              sx={{ flex: 1 }}
            />
            <SliderValue>{Math.round(effect.intensity * 100)}%</SliderValue>
          </SliderRow>

          {showSpeed && (
            <SliderRow>
              <SliderLabel>Speed</SliderLabel>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.01}
                value={effect.speed}
                onChange={(_, v) => update({ speed: v as number })}
                sx={{ flex: 1 }}
              />
              <SliderValue>{Math.round(effect.speed * 100)}%</SliderValue>
            </SliderRow>
          )}
        </>
      )}
    </Root>
  )
}

const Root = styled.div`
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const Label = styled.div`
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${(p) => p.theme.colors.text.secondary};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const SliderRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`

const SliderLabel = styled.div`
  width: 4rem;
  font-size: 0.8rem;
  color: ${(p) => p.theme.colors.text.secondary};
`

const SliderValue = styled.div`
  width: 2.5rem;
  font-size: 0.8rem;
  text-align: right;
  color: ${(p) => p.theme.colors.text.secondary};
  font-variant-numeric: tabular-nums;
`
