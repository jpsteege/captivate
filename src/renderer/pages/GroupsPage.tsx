import { useState } from 'react'
import styled from 'styled-components'
import StatusBar from '../menu/StatusBar'
import { useDmxSelector, useControlSelector } from '../redux/store'
import { useDispatch } from 'react-redux'
import { getSortedGroups } from '../../shared/dmxUtil'
import { renameGroup, removeGroup } from '../redux/dmxSlice'
import { setGroupMaster, renameGroupInScenes, removeGroupFromScenes } from '../redux/controlSlice'
import Slider from '@mui/material/Slider'
import IconButton from '@mui/material/IconButton'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'

export default function GroupsPage() {
  const dispatch = useDispatch()
  const dmx = useDmxSelector((d) => d)
  const groupMaster = useControlSelector((s) => s.groupMaster)

  const allGroups = getSortedGroups(
    dmx.universe,
    dmx.fixtureTypes,
    dmx.fixtureTypesByID,
    dmx.led.ledFixtures
  )

  return (
    <Root>
      <StatusBar />
      <Content>
        <Header>
          <HeaderTitle>Groups</HeaderTitle>
        </Header>

        {allGroups.length === 0 && (
          <Hint>
            No groups defined yet. Add groups to your DMX fixtures or WLED
            devices in the DMX or LED tabs.
          </Hint>
        )}

        {allGroups.map((group) => (
          <GroupCard
            key={group}
            group={group}
            dmx={dmx}
            brightness={groupMaster[group] ?? 1}
            onRename={(oldName, newName) => {
              dispatch(renameGroup({ oldName, newName }))
              dispatch(renameGroupInScenes({ oldName, newName }))
            }}
            onBrightnessChange={(value) =>
              dispatch(setGroupMaster({ group, value }))
            }
            onDelete={(name) => {
              dispatch(removeGroup(name))
              dispatch(removeGroupFromScenes(name))
            }}
          />
        ))}
      </Content>
    </Root>
  )
}

// ── GroupCard ────────────────────────────────────────────────────────────────

// Build lists of DMX fixture names and LED fixture names for a group
function getFixturesForGroup(group: string, dmx: any) {
  const dmxFixtures: string[] = []
  const ledFixtures: string[] = []

  for (const fixture of dmx.universe) {
    const ft = dmx.fixtureTypesByID[fixture.type]
    const allGroups = [
      ...fixture.groups,
      ...(ft?.groups ?? []),
      ...(ft?.subFixtures?.flatMap((s: any) => s.groups) ?? []),
    ]
    if (allGroups.includes(group)) {
      const name = ft?.name ?? `ch ${fixture.ch}`
      if (!dmxFixtures.includes(name)) dmxFixtures.push(name)
    }
  }

  for (const led of dmx.led.ledFixtures) {
    if ((led.groups ?? []).includes(group)) {
      ledFixtures.push(led.name ?? led.mdns)
    }
  }

  return { dmxFixtures, ledFixtures }
}

function GroupCard({
  group,
  dmx,
  brightness,
  onRename,
  onBrightnessChange,
  onDelete,
}: {
  group: string
  dmx: any
  brightness: number
  onRename: (old: string, next: string) => void
  onBrightnessChange: (v: number) => void
  onDelete: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(group)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { dmxFixtures, ledFixtures } = getFixturesForGroup(group, dmx)

  function commitRename() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== group) {
      onRename(group, trimmed)
    }
    setEditing(false)
  }

  function cancelRename() {
    setEditValue(group)
    setEditing(false)
  }

  return (
    <Card>
      <CardTop>
        {editing ? (
          <RenameRow>
            <RenameInput
              value={editValue}
              autoFocus
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') cancelRename()
              }}
            />
            <IconButton size="small" onClick={commitRename}>
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={cancelRename}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </RenameRow>
        ) : confirmDelete ? (
          <RenameRow>
            <DeleteConfirmText>Delete &ldquo;{group}&rdquo;?</DeleteConfirmText>
            <IconButton size="small" onClick={() => onDelete(group)}>
              <CheckIcon fontSize="small" style={{ color: '#ef5350' }} />
            </IconButton>
            <IconButton size="small" onClick={() => setConfirmDelete(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </RenameRow>
        ) : (
          <GroupNameRow>
            <GroupName>{group}</GroupName>
            <IconButton
              size="small"
              onClick={() => {
                setEditValue(group)
                setEditing(true)
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setConfirmDelete(true)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </GroupNameRow>
        )}

        <BrightnessBlock>
          <BrightnessLabel>
            Brightness&nbsp;&nbsp;{Math.round(brightness * 100)}%
          </BrightnessLabel>
          <Slider
            size="small"
            value={brightness}
            min={0}
            max={1}
            step={0.01}
            onChange={(_, v) => onBrightnessChange(v as number)}
            sx={{ width: '10rem' }}
          />
        </BrightnessBlock>
      </CardTop>

      <FixtureList>
        {dmxFixtures.map((name) => (
          <FixturePill key={name} $type="dmx">
            {name}
          </FixturePill>
        ))}
        {ledFixtures.map((name) => (
          <FixturePill key={name} $type="led">
            {name}
          </FixturePill>
        ))}
        {dmxFixtures.length === 0 && ledFixtures.length === 0 && (
          <EmptyFixtures>No fixtures assigned</EmptyFixtures>
        )}
      </FixtureList>
    </Card>
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
  gap: 0.75rem;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  margin-top: 1rem;
  margin-bottom: 0.25rem;
`

const HeaderTitle = styled.div`
  font-size: 1.3rem;
`

const Hint = styled.div`
  color: ${(p) => p.theme.colors.text.secondary};
  font-size: 0.9rem;
  max-width: 30rem;
  line-height: 1.5;
`

const Card = styled.div`
  border: 1px solid ${(p) => p.theme.colors.divider};
  border-radius: 6px;
  background-color: ${(p) => p.theme.colors.bg.darker};
  padding: 0.65rem 0.9rem 0.55rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const CardTop = styled.div`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
`

const GroupNameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 8rem;
`

const GroupName = styled.div`
  font-size: 1rem;
  font-weight: 600;
`

const RenameRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`

const RenameInput = styled.input`
  font-size: 1rem;
  font-weight: 600;
  background: transparent;
  border: none;
  border-bottom: 1px solid ${(p) => p.theme.colors.text.secondary};
  color: ${(p) => p.theme.colors.text.primary};
  outline: none;
  width: 8rem;
  padding: 0.1rem 0.2rem;
`

const BrightnessBlock = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
`

const BrightnessLabel = styled.div`
  font-size: 0.8rem;
  color: ${(p) => p.theme.colors.text.secondary};
  white-space: nowrap;
  min-width: 7.5rem;
`

const FixtureList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`

const FixturePill = styled.div<{ $type: 'dmx' | 'led' }>`
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid
    ${(p) =>
      p.$type === 'led'
        ? 'rgba(100, 181, 246, 0.5)'
        : 'rgba(255, 167, 38, 0.5)'};
  color: ${(p) =>
    p.$type === 'led'
      ? '#64b5f6'
      : '#ffa726'};
  background-color: ${(p) =>
    p.$type === 'led'
      ? 'rgba(100, 181, 246, 0.08)'
      : 'rgba(255, 167, 38, 0.08)'};
`

const DeleteConfirmText = styled.span`
  font-size: 0.85rem;
  color: ${(p) => p.theme.colors.text.secondary};
`

const EmptyFixtures = styled.div`
  font-size: 0.78rem;
  color: ${(p) => p.theme.colors.text.secondary};
  font-style: italic;
`
