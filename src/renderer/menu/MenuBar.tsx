import React from 'react'
import styled from 'styled-components'
import zIndexes from '../zIndexes'
import UniverseIcon from '@mui/icons-material/Settings'
import LightingIcon from '@mui/icons-material/Lightbulb'
import WbIncandescentIcon from '@mui/icons-material/WbIncandescent'
import LedOutputIcon from '@mui/icons-material/LinearScale'
import GroupsIcon from '@mui/icons-material/AccountTree'
import VisualsIcon from '../images/Thick.png'
import MixerIcon from '@mui/icons-material/BarChart'
import AudioIcon from '@mui/icons-material/GraphicEq'
import AutoControlIcon from '@mui/icons-material/Tune'
import { useTypedSelector } from '../redux/store'
import { useDispatch } from 'react-redux'
import { setActivePage, Page } from '../redux/guiSlice'
import MasterSlider from '../controls/MasterSlider'

const selectedBorder = 0.2 //rem

export default function MenuBar() {
  const activePage = useTypedSelector((state) => state.gui.activePage)
  const dispatch = useDispatch()
  const ledEnabled = useTypedSelector((state) => state.gui.ledEnabled)
  const videoEnabled = useTypedSelector((state) => state.gui.videoEnabled)
  const audioEnabled = useTypedSelector((state) => state.gui.audioEnabled)

  const setPage = (newPage: Page) => {
    return () => {
      dispatch(setActivePage(newPage))
    }
  }

  function MenuItem({
    page,
    paddingRem = 0.8,
    children,
  }: {
    page: Page
    tooltipText: string
    paddingRem?: number
    children: React.ReactNode
  }) {
    const isActive = activePage === page
    const p = paddingRem
    const padding = isActive
      ? `${p}rem ${p}rem ${p}rem ${p - selectedBorder}rem`
      : `${p}rem`
    return (
      <Item
        selected={activePage === page}
        style={{ padding: padding, fontSize: '1.7rem', margin: '0' }}
        onClick={setPage(page)}
      >
        {children}
      </Item>
    )
  }

  return (
    <Root>
      {/* ── Fixtures ── */}
      <SectionLabel>Fixtures</SectionLabel>
      <MenuItem page="Universe" tooltipText="DMX Setup">
        <UniverseIcon fontSize="inherit" />
      </MenuItem>
      {ledEnabled && (
        <MenuItem page="Led" tooltipText="LED Editor">
          <WbIncandescentIcon fontSize="inherit" />
        </MenuItem>
      )}
      <MenuItem page="Groups" tooltipText="Fixture Groups">
        <GroupsIcon fontSize="inherit" />
      </MenuItem>

      <Divider />

      {/* ── Scenes ── */}
      <SectionLabel>Scenes</SectionLabel>
      <MenuItem page="Modulation" tooltipText="Scene Editor">
        <LightingIcon fontSize="inherit" />
      </MenuItem>
      {videoEnabled && (
        <MenuItem page="Video" tooltipText="Visualizer" paddingRem={0.5}>
          <img
            src={VisualsIcon}
            style={{ width: '2.3rem', height: '2.3rem', margin: '0' }}
          />
        </MenuItem>
      )}

      <Divider />

      {/* ── Output ── */}
      <SectionLabel>Output</SectionLabel>
      <MenuItem page="Mixer" tooltipText="DMX Output">
        <MixerIcon fontSize="inherit" />
      </MenuItem>
      {ledEnabled && (
        <MenuItem page="WledMixer" tooltipText="LED Output">
          <LedOutputIcon fontSize="inherit" />
        </MenuItem>
      )}

      <Divider />

      {/* ── Sound ── */}
      <SectionLabel>Sound</SectionLabel>
      <MenuItem page="Audio" tooltipText="Audio Analysis">
        <AudioIcon fontSize="inherit" />
      </MenuItem>
      {audioEnabled && (
        <MenuItem page="AutoControl" tooltipText="Auto Control">
          <AutoControlIcon fontSize="inherit" />
        </MenuItem>
      )}

      <Spacer />
      <MasterSlider />
      <div style={{ height: '0.5rem' }} />
    </Root>
  )
}

const Root = styled.div`
  z-index: ${zIndexes.leftMenu};
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.theme.colors.bg.lighter};
  align-items: center;
`

const Item = styled.div<{ selected: boolean }>`
  cursor: pointer;
  opacity: ${(props) => (props.selected ? 1 : 0.5)};
  filter: ${(props) => (props.selected ? `grayscale(0%)` : `grayscale(100%)`)};
  border-left: ${(props) => props.selected && '0.2rem solid #fff'};
  :hover {
    filter: grayscale(0%);
    opacity: 1;
  }
`

const Divider = styled.div`
  width: 60%;
  height: 1px;
  background-color: ${(props) => props.theme.colors.divider};
  margin: 0.3rem 0;
`

const SectionLabel = styled.div`
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: ${(props) => props.theme.colors.text.secondary};
  opacity: 0.6;
  margin-top: 0.4rem;
  margin-bottom: 0.1rem;
`

const Spacer = styled.div`
  flex: 1 0 0;
`
