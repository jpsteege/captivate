import Slider from '../base/Slider'
import { useControlSelector } from '../redux/store'
import { useDispatch } from 'react-redux'
import { setMaster } from '../redux/controlSlice'
import { SliderMidiOverlay } from '../base/MidiOverlay'

export default function MasterSlider() {
  const master = useControlSelector((state) => state.master)
  const dispatch = useDispatch()

  return (
    <SliderMidiOverlay
      action={{ type: 'setMaster' }}
      style={{
        flex: '0 1 12rem',
        width: '80%',
        padding: '0.5rem 0',
      }}
    >
      <Slider
        value={master}
        radius={0.5}
        onChange={(newVal: number) => {
          dispatch(setMaster(newVal))
        }}
        orientation="vertical"
      />
    </SliderMidiOverlay>
  )
}
