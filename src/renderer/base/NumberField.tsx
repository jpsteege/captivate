import { TextField } from '@mui/material'
import { clampMaybe } from '../../math/util'

interface Props2 {
  val: number
  label: string
  onChange: (newVal: number) => void
  min?: number
  max?: number
  numberType?: 'int' | 'float'
  helperText?: string
}

export default function NumberField({
  val,
  label,
  onChange,
  min,
  max,
  numberType = 'int',
  helperText,
}: Props2) {
  return (
    <TextField
      value={val.toString()}
      label={label}
      size="small"
      variant="standard"
      helperText={helperText}
      onChange={(e) => {
        if (numberType === 'int') {
          onChange(clampMaybe(parseInt(e.target.value), min, max))
        } else {
          onChange(clampMaybe(parseFloat(e.target.value), min, max))
        }
      }}
      type="number"
    />
  )
}
