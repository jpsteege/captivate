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
import { LED_STRIP_TYPES, LedFixture, MAX_LED_COUNT } from 'shared/ledFixtures'
import { getSortedGroups } from 'shared/dmxUtil'
import styled, { useTheme } from 'styled-components'
import { useDispatch } from 'react-redux'

interface Props {
  index: number
}

export default function LedFixtureDefinition({ index }: Props) {
  let def = useDmxSelector((dmx) => dmx.led.ledFixtures[index])
  let isActive = useDmxSelector((dmx) => dmx.led.activeFixture === index)
  const dmx = useDmxSelector((dmx) => dmx)
  const theme = useTheme()
  const wledConnections = useTypedSelector((state) => state.gui.wled)

  const dispatch = useDispatch()

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
  const isConnected = wledConnections.connected.includes(def.mdns)
  const isDiscovered =
    !!fixtureConnection && (fixtureConnection.lastSeen ?? 0) > 0
  const status: Status = isConnected
    ? 'connected'
    : isDiscovered
    ? 'discovering'
    : 'disconnected'
  const statusTooltip =
    status === 'connected'
      ? 'Connected to WLED device'
      : status === 'discovering'
      ? 'WLED device discovered, connecting...'
      : 'WLED device not found on network'
  const availableGroups = getSortedGroups(
    dmx.universe,
    dmx.fixtureTypes,
    dmx.fixtureTypesByID,
    dmx.led.ledFixtures
  )

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
      <Dropdown
        isOpen={false}
        onClick={(e) => {
          e.stopPropagation()
          dispatch(setActiveLedFixture(index))
        }}
      />
      <Tooltip title={statusTooltip}>
        <StatusDot $status={status} />
      </Tooltip>
      <InactiveContent>
        <Name>{def.name}</Name>
        <InfoRow>
          <Info>{`${def.led_count} LEDs`}</Info>
          <Info>{`mDNS: ${def.mdns}`}</Info>
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
type Status = 'connected' | 'discovering' | 'disconnected'

const StatusDot = styled.div<{ $status: Status }>`
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  margin-right: 0.5rem;
  background-color: ${(props) => {
    if (props.$status === 'connected') return '#4caf50'
    if (props.$status === 'discovering') return props.theme.colors.text.warning
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
