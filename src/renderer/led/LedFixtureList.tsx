import { useDmxSelector } from 'renderer/redux/store'
import { indexArray } from 'shared/util'
import styled from 'styled-components'
import LedFixtureDefinition from './LedFixtureDefinition'
import AddIcon from '@mui/icons-material/Add'
import { IconButton, Tooltip } from '@mui/material'
import { useDispatch } from 'react-redux'
import { addLedFixture } from 'renderer/redux/dmxSlice'

interface Props {}

export default function LedFixtureList({}: Props) {
  const numLedFixtures = useDmxSelector((dmx) => dmx.led.ledFixtures.length)
  const dispatch = useDispatch()

  return (
    <Root>
      <Header>
        <Title>Led Fixtures</Title>
        <Subtitle>
          Configure WLED-compatible LED strips for control via UDP protocol
        </Subtitle>
      </Header>
      <Divider />
      {numLedFixtures === 0 ? (
        <EmptyState>
          No LED fixtures configured. Click + to add your first WLED strip.
        </EmptyState>
      ) : (
        indexArray(numLedFixtures).map((i) => (
          <LedFixtureDefinition key={i} index={i} />
        ))
      )}
      <Tooltip title="Add a new WLED LED strip fixture">
        <AddButton
          onClick={() => {
            dispatch(addLedFixture())
          }}
        >
          <AddIcon />
        </AddButton>
      </Tooltip>
    </Root>
  )
}

const Root = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const Title = styled.div`
  font-size: ${(props) => props.theme.font.size.h1};
  color: ${(props) => props.theme.colors.text.primary};
`

const Subtitle = styled.div`
  color: ${(props) => props.theme.colors.text.secondary};
  margin-top: 0.25rem;
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`

const Divider = styled.div`
  height: 1px;
  width: 100%;
  background-color: ${(props) => props.theme.colors.divider};
  opacity: 0.6;
`

const EmptyState = styled.div`
  color: ${(props) => props.theme.colors.text.secondary};
  font-style: italic;
`

const AddButton = styled(IconButton)`
  align-self: flex-start;
  color: ${(props) => props.theme.colors.text.primary};
`
