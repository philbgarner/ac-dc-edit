import { useState } from 'react'
import Modal from './Modal'
import OverlayPaintModal from './OverlayPaintModal'
import { useData } from '../DataContext'

function readR8(tex: { image: { data: ArrayLike<number> } }, width: number, cx: number, cz: number): number {
  return tex.image.data[cz * width + cx] ?? 0
}

interface RowProps { label: string; value: string | number }
function Row({ label, value }: RowProps) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ color: '#7080b0', minWidth: 160 }}>{label}</span>
      <span style={{ color: '#e0e8ff' }}>{value}</span>
    </div>
  )
}

interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color: '#5870d0', fontWeight: 'bold', marginBottom: 2, borderBottom: '1px solid #203060', paddingBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

const OFFSET_NEUTRAL = 128
const OFFSET_STEP_MIN = -127, OFFSET_STEP_MAX = 127

interface SliderRowProps { label: string; steps: number; isPit?: boolean; onChange: (steps: number) => void; onPitToggle?: () => void }
function SliderRow({ label, steps, isPit, onChange, onPitToggle }: SliderRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#7080b0', minWidth: 120 }}>{label}</span>
      <input
        type="range" min={OFFSET_STEP_MIN} max={OFFSET_STEP_MAX} step={1}
        value={isPit ? OFFSET_STEP_MIN : steps}
        disabled={isPit}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#5870d0' }}
      />
      {isPit
        ? <span style={{ color: '#e06060', minWidth: 46, textAlign: 'right', fontSize: 11 }}>pit</span>
        : <span style={{ color: '#e0e8ff', minWidth: 46, textAlign: 'right' }}>{steps > 0 ? `+${steps}` : steps}</span>
      }
      {onPitToggle && (
        <button
          onClick={onPitToggle}
          title={isPit ? 'Remove pit' : 'Set as pit'}
          style={{
            background: isPit ? '#502020' : 'none', border: `1px solid ${isPit ? '#804040' : '#304060'}`,
            borderRadius: 3, color: isPit ? '#e06060' : '#8090c0', cursor: 'pointer',
            fontSize: 11, padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
          }}
        >pit</button>
      )}
    </div>
  )
}

interface Props {
  onClose: () => void
}

export default function CellDetailsModal({ onClose }: Props) {
  const { selectedCell, game, atlasConfig, cellPaints, cellHeights, setCellHeights, renderer } = useData()
  const [paintOpen, setPaintOpen] = useState(false)

  if (!selectedCell) return null

  const { cx, cz, regionId } = selectedCell
  const outputs = game?.dungeon.outputs
  const width = outputs?.width ?? 0

  let isSolid: boolean | null = null
  let distToWall: number | null = null
  let hazard: number | null = null
  let temperature: number | null = null
  let floorType: number | null = null
  let wallType: number | null = null
  let ceilType: number | null = null

  if (outputs) {
    const t = outputs.textures
    isSolid = readR8(t.solid as never, width, cx, cz) !== 0
    distToWall = readR8(t.distanceToWall as never, width, cx, cz)
    hazard = readR8(t.hazards as never, width, cx, cz)
    temperature = readR8(t.temperature as never, width, cx, cz)
    floorType = readR8(t.floorType as never, width, cx, cz)
    wallType = readR8(t.wallType as never, width, cx, cz)
    ceilType = readR8(t.ceilingType as never, width, cx, cz)
  }

  type RoomEntry = { type: string; rect: { x: number; y: number; w: number; h: number } }
  const room = outputs && regionId
    ? (outputs as { rooms?: Map<number, RoomEntry> }).rooms?.get(regionId)
    : null

  const floorTileName = atlasConfig?.floorTile ?? '—'
  const wallTileName = atlasConfig?.wallTile ?? '—'
  const ceilTileName = atlasConfig?.ceilTile ?? '—'

  const floorTileId = floorType != null && atlasConfig ? atlasConfig.resolver(atlasConfig.floorTile) : null
  const wallTileId = wallType != null && atlasConfig ? atlasConfig.resolver(atlasConfig.wallTile) : null
  const ceilTileId = ceilType != null && atlasConfig ? atlasConfig.resolver(atlasConfig.ceilTile) : null

  const paintTarget = cellPaints[`${cx},${cz}`] ?? {}
  const key = `${cx},${cz}`

  const texFloor = outputs?.textures.floorHeightOffset
  const texCeil = outputs?.textures.ceilingHeightOffset
  const fallback = cellHeights[key]

  const floorR8: number = texFloor?.image.data
    ? ((texFloor.image.data as Uint8Array)[cz * width + cx] ?? OFFSET_NEUTRAL)
    : (fallback?.floor ?? OFFSET_NEUTRAL)
  const ceilR8: number = texCeil?.image.data
    ? ((texCeil.image.data as Uint8Array)[cz * width + cx] ?? OFFSET_NEUTRAL)
    : (fallback?.ceil ?? OFFSET_NEUTRAL)

  const floorIsPit = floorR8 === 0
  const floorSteps = floorIsPit ? 0 : floorR8 - OFFSET_NEUTRAL
  const ceilSteps = OFFSET_NEUTRAL - ceilR8

  function writeFloor(r8: number) {
    if (texFloor?.image.data) {
      ;(texFloor.image.data as Uint8Array)[cz * width + cx] = r8
    }
    setCellHeights({ ...cellHeights, [key]: { floor: r8, ceil: ceilR8 } })
    renderer?.rebuild()
  }

  function writeCeil(r8: number) {
    if (texCeil?.image.data) {
      ;(texCeil.image.data as Uint8Array)[cz * width + cx] = r8
    }
    setCellHeights({ ...cellHeights, [key]: { floor: floorR8, ceil: r8 } })
    renderer?.rebuild()
  }

  return (
    <>
      <Modal
        onClose={onClose}
        title={`Cell (${cx}, ${cz})`}
        bare
        style={{
          position: 'fixed',
          left: 12,
          top: 12,
          bottom: 12,
          minWidth: 280,
          maxWidth: 340,
          maxHeight: 'calc(100vh - 24px)',
          zIndex: 50,
        }}
      >
        <Section title="Position">
          <Row label="Column (cx)" value={cx} />
          <Row label="Row (cz)" value={cz} />
          <Row label="Region ID" value={regionId || '0 (unassigned)'} />
          {room && <>
            <Row label="Room type" value={room.type} />
            <Row label="Room origin" value={`(${room.rect.x}, ${room.rect.y})`} />
            <Row label="Room size" value={`${room.rect.w} × ${room.rect.h}`} />
          </>}
        </Section>

        {outputs && <Section title="Cell Flags">
          <Row label="Solid (wall)" value={isSolid ? 'yes' : 'no'} />
          <Row label="Distance to wall" value={distToWall ?? '—'} />
          <Row label="Hazard" value={hazard ?? '—'} />
          <Row label="Temperature" value={temperature != null ? `${temperature} / 255` : '—'} />
        </Section>}

        {outputs && <Section title="Floor Layer">
          <Row label="Floor type index" value={floorType ?? '—'} />
          <Row label="Default floor tile" value={floorTileName} />
          {floorTileId != null && <Row label="Atlas tile ID" value={floorTileId} />}
        </Section>}

        {outputs && <Section title="Wall Layer">
          <Row label="Wall type index" value={wallType ?? '—'} />
          <Row label="Default wall tile" value={wallTileName} />
          {wallTileId != null && <Row label="Atlas tile ID" value={wallTileId} />}
        </Section>}

        {outputs && <Section title="Ceiling Layer">
          <Row label="Ceiling type index" value={ceilType ?? '—'} />
          <Row label="Default ceiling tile" value={ceilTileName} />
          {ceilTileId != null && <Row label="Atlas tile ID" value={ceilTileId} />}
        </Section>}

        {atlasConfig && (texFloor || texCeil) && <Section title={`Height Offsets (floor: ${floorIsPit ? 'pit' : floorSteps > 0 ? `+${floorSteps}` : floorSteps}, ceil: ${ceilSteps > 0 ? `+${ceilSteps}` : ceilSteps})`}>
          <SliderRow
            label="Floor offset"
            steps={floorSteps}
            isPit={floorIsPit}
            onChange={s => writeFloor(Math.max(1, OFFSET_NEUTRAL + s))}
            onPitToggle={() => writeFloor(floorIsPit ? OFFSET_NEUTRAL : 0)}
          />
          <SliderRow
            label="Ceiling offset"
            steps={ceilSteps}
            onChange={s => writeCeil(OFFSET_NEUTRAL - s)}
          />
          {!texFloor && !texCeil && (
            <span style={{ color: '#506080', fontSize: 11 }}>stored locally — generate dungeon to apply</span>
          )}
        </Section>}

        {outputs && <Section title="Surface Layers">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(['floor', 'wall', 'ceil'] as const).map(f => {
                const names = paintTarget[f]
                if (!names?.length) return null
                return (
                  <div key={f} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: '#7080b0', minWidth: 44 }}>{f}</span>
                    <span style={{ color: '#e0e8ff' }}>{names.join(', ')}</span>
                  </div>
                )
              })}
              {!paintTarget.floor?.length && !paintTarget.wall?.length && !paintTarget.ceil?.length &&
                <span style={{ color: '#506080' }}>none</span>
              }
            </div>
            <button
              onClick={() => setPaintOpen(true)}
              title="Edit surface layers"
              style={{
                background: 'none', border: '1px solid #304060', borderRadius: 3,
                color: '#8090c0', cursor: 'pointer', fontSize: 12,
                padding: '1px 7px', lineHeight: 1.4, flexShrink: 0,
              }}
            >
              …
            </button>
          </div>
        </Section>}

        {!outputs && (
          <div style={{ color: '#7080b0', fontStyle: 'italic' }}>
            Dungeon outputs not yet available — generate a dungeon first.
          </div>
        )}
      </Modal>

      {paintOpen && (
        <OverlayPaintModal cx={cx} cz={cz} onClose={() => setPaintOpen(false)} />
      )}
    </>
  )
}
