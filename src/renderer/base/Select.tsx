import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { type CSSProperties, useRef } from 'react'

interface Props<T extends string> {
  label: string
  val: T
  items: T[]
  onChange: (newVal: T) => void
  style?: CSSProperties
  id?: string
}

export default function Select<T extends string>({
  label,
  val,
  items,
  onChange,
  style,
  id,
}: Props<T>) {
  const generatedId = useRef(
    `select-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  )
  const selectId = id || generatedId.current

  return (
    <MuiSelect
      labelId={`${selectId}-label`}
      id={selectId}
      value={val}
      label={label}
      variant="standard"
      onChange={(e) => onChange(e.target.value as T)}
      style={style}
    >
      {items.map((item) => (
        <MenuItem key={item} value={item}>
          {item}
        </MenuItem>
      ))}
    </MuiSelect>
  )
}
