import styled from 'styled-components'
import StatusBar from '../menu/StatusBar'
import { useRealtimeSelector } from '../redux/realtimeStore'
import { useDmxSelector, useTypedSelector } from '../redux/store'
import { useDispatch } from 'react-redux'
import {
  setAutoEnabled,
  setGroupRole,
  setGlobalDepth,
  setPerGroupDepth,
  AUTO_SCENE_ID,
} from '../redux/autoControlSlice'
import { GroupRole, GROUP_ROLES, GROUP_ROLE_LABELS, GROUP_ROLE_DESCRIPTIONS } from '../../shared/groupRoles'
import { VIBE_HUE, VIBE_TYPES, VibeType } from '../../shared/audioFeatures'
import { getSortedGroups } from '../../shared/dmxUtil'
import Slider from '@mui/material/Slider'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'

export default function AutoControlPage() {
  const dispatch = useDispatch()
  const features = useRealtimeSelector((s) => s.audioFeatures)
  const autoControl = useTypedSelector((s) => s.autoControl)
  const dmx = useDmxSelector((dmx) => dmx)
  const autoSceneExists = useTypedSelector(
    (s) => AUTO_SCENE_ID in s.control.present.light.byId
  )

  const allGroups = getSortedGroups(
    dmx.universe,
    dmx.fixtureTypes,
    dmx.fixtureTypesByID,
    dmx.led.ledFixtures
  )

  const activeGroups = allGroups.filter(
    (g) => (autoControl.groupRoles[g] ?? 'off') !== 'off'
  )

  return (
    <Root>
      <StatusBar />
      <Content>
        <Header>
          <HeaderTitle>Auto Control</HeaderTitle>
          <EnableRow>
            <Switch
              size="small"
              checked={autoControl.enabled}
              onChange={(e) => dispatch(setAutoEnabled(e.target.checked))}
            />
            <EnableLabel>{autoControl.enabled ? 'Enabled' : 'Disabled'}</EnableLabel>
          </EnableRow>
        </Header>

        {!features.enabled && (
          <Notice>Enable audio on the Audio tab to activate auto-control.</Notice>
        )}

        {/* ── Panel 3: Live Status ───────────────────────────────────── */}
        {features.enabled && (
          <Section>
            <SectionLabel>Live Status</SectionLabel>
            <StatusRow>
              <VibeChip $hue={VIBE_HUE[features.vibe]}>
                {features.vibe.toUpperCase()}
              </VibeChip>
              <AxisMiniGrid>
                {(['heat', 'energy', 'pulse', 'groove', 'momentum'] as const).map((ax) => (
                  <AxisMiniRow key={ax}>
                    <AxisMiniLabel>{ax}</AxisMiniLabel>
                    <AxisMiniTrack>
                      <AxisMiniFill style={{ width: `${Math.round(features.vibeAxes[ax] * 100)}%` }} />
                    </AxisMiniTrack>
                  </AxisMiniRow>
                ))}
              </AxisMiniGrid>
            </StatusRow>
            {autoControl.enabled && autoSceneExists && (
              <AutoSceneNote>
                Auto scene is active — select &quot;Auto&quot; in the Scenes list to use it.
              </AutoSceneNote>
            )}
          </Section>
        )}

        {/* ── Panel 1: Group Roles ───────────────────────────────────── */}
        <Section>
          <SectionLabel>Group Roles</SectionLabel>
          {allGroups.length === 0 && (
            <EmptyMessage>No fixture groups found. Define groups in the DMX tab.</EmptyMessage>
          )}
          <GroupTable>
            {allGroups.map((group) => {
              const role = autoControl.groupRoles[group] ?? 'off'
              const depth = autoControl.perGroupDepth[group] ?? 1
              return (
                <GroupRow key={group}>
                  <GroupName>{group}</GroupName>
                  <Select
                    size="small"
                    value={role}
                    onChange={(e) =>
                      dispatch(setGroupRole({ group, role: e.target.value as GroupRole }))
                    }
                    sx={{ fontSize: '0.8rem', minWidth: '8rem' }}
                    title={GROUP_ROLE_DESCRIPTIONS[role]}
                  >
                    {GROUP_ROLES.map((r) => (
                      <MenuItem key={r} value={r} sx={{ fontSize: '0.8rem' }}>
                        {GROUP_ROLE_LABELS[r]}
                      </MenuItem>
                    ))}
                  </Select>
                  <DepthSliderWrap>
                    <DepthLabel>Depth {Math.round(depth * 100)}%</DepthLabel>
                    <Slider
                      size="small"
                      value={depth}
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={role === 'off'}
                      onChange={(_, v) =>
                        dispatch(setPerGroupDepth({ group, depth: v as number }))
                      }
                    />
                  </DepthSliderWrap>
                </GroupRow>
              )
            })}
          </GroupTable>
        </Section>

        {/* ── Global depth ──────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Global Depth</SectionLabel>
          <GlobalDepthRow>
            <Slider
              size="small"
              value={autoControl.globalDepth}
              min={0}
              max={1}
              step={0.01}
              onChange={(_, v) => dispatch(setGlobalDepth(v as number))}
            />
            <GlobalDepthVal>{Math.round(autoControl.globalDepth * 100)}%</GlobalDepthVal>
          </GlobalDepthRow>
        </Section>

        {/* ── Panel 2: Vibe Mapping summary ────────────────────────── */}
        {activeGroups.length > 0 && (
          <Section>
            <SectionLabel>Vibe → Behavior Mapping</SectionLabel>
            <MapGrid>
              <MapHeaderRow>
                <MapCell $header />
                {activeGroups.map((g) => (
                  <MapCell key={g} $header>
                    {g}
                  </MapCell>
                ))}
              </MapHeaderRow>
              {VIBE_TYPES.map((vibe) => (
                <MapRow key={vibe} $vibe={vibe}>
                  <MapVibeLabel $hue={VIBE_HUE[vibe]}>{vibe}</MapVibeLabel>
                  {activeGroups.map((group) => {
                    const role = autoControl.groupRoles[group] ?? 'off'
                    const entry = autoControl.behaviorMap[role]
                    const effectType = (
                      entry?.vibeOverrides[vibe]?.ledEffect?.type ??
                      entry?.default.ledEffect.type ??
                      'none'
                    )
                    return (
                      <MapCell key={group} title={`${role}: ${effectType}`}>
                        <EffectBadge>{effectType}</EffectBadge>
                      </MapCell>
                    )
                  })}
                </MapRow>
              ))}
            </MapGrid>
          </Section>
        )}
      </Content>
    </Root>
  )
}

// ── Styled Components ────────────────────────────────────────────────────────

const Root = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const Content = styled.div`
  flex: 1 1 0;
  overflow: auto;
  padding: 0 1rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
`

const HeaderTitle = styled.div`
  font-size: 1.3rem;
  flex: 1;
`

const EnableRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`

const EnableLabel = styled.div`
  font-size: 0.85rem;
  color: ${(p) => p.theme.colors.text.secondary};
`

const Notice = styled.div`
  color: ${(p) => p.theme.colors.text.secondary};
  font-size: 0.85rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${(p) => p.theme.colors.divider};
  border-radius: 4px;
`

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const SectionLabel = styled.div`
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${(p) => p.theme.colors.text.secondary};
`

const StatusRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`

const VibeChip = styled.div<{ $hue: number }>`
  padding: 0.3rem 0.9rem;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  white-space: nowrap;
  border: 1.5px solid ${(p) => `hsl(${Math.round(p.$hue * 360)}, 80%, 55%)`};
  color: ${(p) => `hsl(${Math.round(p.$hue * 360)}, 80%, 70%)`};
  background-color: ${(p) => `hsl(${Math.round(p.$hue * 360)}, 60%, 15%)`};
  transition: all 400ms ease;
`

const AxisMiniGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  flex: 1;
`

const AxisMiniRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`

const AxisMiniLabel = styled.div`
  width: 4rem;
  font-size: 0.72rem;
  color: ${(p) => p.theme.colors.text.secondary};
  text-align: right;
`

const AxisMiniTrack = styled.div`
  flex: 1;
  height: 0.5rem;
  background-color: ${(p) => p.theme.colors.bg.darker};
  border-radius: 2px;
  overflow: hidden;
`

const AxisMiniFill = styled.div`
  height: 100%;
  background-color: #9fa8da;
  border-radius: 2px;
  transition: width 200ms linear;
`

const AutoSceneNote = styled.div`
  font-size: 0.8rem;
  color: ${(p) => p.theme.colors.text.secondary};
  font-style: italic;
`

const EmptyMessage = styled.div`
  color: ${(p) => p.theme.colors.text.secondary};
  font-size: 0.85rem;
`

const GroupTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const GroupRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const GroupName = styled.div`
  width: 6rem;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const DepthSliderWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
`

const DepthLabel = styled.div`
  font-size: 0.7rem;
  color: ${(p) => p.theme.colors.text.secondary};
`

const GlobalDepthRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`

const GlobalDepthVal = styled.div`
  width: 3rem;
  font-size: 0.85rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${(p) => p.theme.colors.text.secondary};
`

const MapGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-x: auto;
`

const MapHeaderRow = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid ${(p) => p.theme.colors.divider};
  padding-bottom: 0.25rem;
  margin-bottom: 0.1rem;
`

const MapRow = styled.div<{ $vibe: VibeType }>`
  display: flex;
  align-items: center;
  padding: 0.1rem 0;
  border-radius: 2px;
`

const MapVibeLabel = styled.div<{ $hue: number }>`
  width: 6rem;
  font-size: 0.78rem;
  color: ${(p) => `hsl(${Math.round(p.$hue * 360)}, 70%, 65%)`};
  white-space: nowrap;
`

const MapCell = styled.div<{ $header?: boolean }>`
  flex: 1;
  min-width: 5rem;
  font-size: ${(p) => (p.$header ? '0.7rem' : '0.72rem')};
  color: ${(p) =>
    p.$header ? p.theme.colors.text.secondary : p.theme.colors.text.primary};
  text-transform: ${(p) => (p.$header ? 'uppercase' : 'none')};
  letter-spacing: ${(p) => (p.$header ? '0.06em' : '0')};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const EffectBadge = styled.span`
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  background-color: ${(p) => p.theme.colors.bg.darker};
  color: ${(p) => p.theme.colors.text.secondary};
  border: 1px solid ${(p) => p.theme.colors.divider};
`
