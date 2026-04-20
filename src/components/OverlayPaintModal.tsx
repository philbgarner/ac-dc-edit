import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../DataContext'
import type { AtlasEntry, SurfacePaintTarget, CellInfo } from '../DataContext'

type Face = 'floor' | 'wall' | 'ceil'
const FACES: Face[] = ['floor', 'wall', 'ceil']
const FACE_LABEL: Record<Face, string> = { floor: 'Floor', wall: 'Wall', ceil: 'Ceiling' }

const TILE_SIZE = 44

function TileGrid({ entries, spriteNames, selected, onSelect }: {
  entries: AtlasEntry[]
  spriteNames: string[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 3,
      maxHeight: 180, overflowY: 'auto',
      background: '#0d1020', borderRadius: 4, padding: 6,
      border: '1px solid #1e2a50',
    }}>
      {spriteNames.map(name => {
        const entry = entries.find(e => e.spriteNames.includes(name))
        if (!entry) return null
        const frame = entry.json.frames[name]?.frame
        const meta = entry.json.meta.size
        if (!frame) return null
        const scale = TILE_SIZE / Math.max(frame.w, frame.h)
        const dispW = Math.round(frame.w * scale)
        const dispH = Math.round(frame.h * scale)
        const atlasW = Math.round(meta.w * scale)
        const atlasH = Math.round(meta.h * scale)
        const isSelected = name === selected
        return (
          <div
            key={name}
            title={name}
            onClick={() => onSelect(name)}
            style={{
              width: TILE_SIZE, height: TILE_SIZE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, cursor: 'pointer', flexShrink: 0,
              outline: isSelected ? '2px solid #4080ff' : '1px solid transparent',
              background: isSelected ? '#1a2a50' : '#111828',
            }}
          >
            <div style={{
              width: dispW, height: dispH,
              backgroundImage: `url(${entry.objectUrl})`,
              backgroundPosition: `-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`,
              backgroundSize: `${atlasW}px ${atlasH}px`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
            }} />
          </div>
        )
      })}
    </div>
  )
}

function SpriteSwatch({ name, entries }: { name: string; entries: AtlasEntry[] }) {
  const entry = entries.find(e => e.spriteNames.includes(name))
  if (!entry) return <span style={{ color: '#506080', fontSize: 11 }}>{name}</span>
  const frame = entry.json.frames[name]?.frame
  const meta = entry.json.meta.size
  if (!frame) return <span style={{ color: '#506080', fontSize: 11 }}>{name}</span>
  const SIZE = 24
  const scale = SIZE / Math.max(frame.w, frame.h)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: SIZE, height: SIZE, flexShrink: 0,
        backgroundImage: `url(${entry.objectUrl})`,
        backgroundPosition: `-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`,
        backgroundSize: `${Math.round(meta.w * scale)}px ${Math.round(meta.h * scale)}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        borderRadius: 2,
      }} />
      <span style={{ color: '#c0c8f0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
    </div>
  )
}

interface Props {
  cx: number
  cz: number
  /** When provided, paint is applied to all these cells instead of just cx/cz. */
  cells?: CellInfo[]
  onClose: () => void
}

export default function OverlayPaintModal({ cx, cz, cells, onClose }: Props) {
  const { game, atlasEntries, atlasConfig, cellPaints, setCellPaints } = useData()
  const key = `${cx},${cz}`
  const existing = cellPaints[key] ?? {}

  const [face, setFace] = useState<Face>('floor')
  const [faceLayers, setFaceLayers] = useState<Record<Face, string[]>>({
    floor: existing.floor ?? [],
    wall: existing.wall ?? [],
    ceil: existing.ceil ?? [],
  })
  const [picking, setPicking] = useState<string | null>(null)

  const spriteNames = atlasConfig?.spriteNames ?? []
  const layers = faceLayers[face]

  function setFaceAndResetPick(f: Face) {
    setFace(f)
    setPicking(null)
  }

  function addLayer() {
    if (!picking || layers.includes(picking)) return
    setFaceLayers(prev => ({ ...prev, [face]: [...prev[face], picking] }))
    setPicking(null)
  }

  function removeLayer(i: number) {
    setFaceLayers(prev => ({ ...prev, [face]: prev[face].filter((_, idx) => idx !== i) }))
  }

  function apply() {
    if (!game) return
    const target: SurfacePaintTarget = {}
    if (faceLayers.floor.length) target.floor = faceLayers.floor
    if (faceLayers.wall.length) target.wall = faceLayers.wall
    if (faceLayers.ceil.length) target.ceil = faceLayers.ceil

    const applyTo = cells ?? [{ cx, cz }]
    const next = { ...cellPaints }
    const isEmpty = !target.floor && !target.wall && !target.ceil
    for (const cell of applyTo) {
      const k = `${cell.cx},${cell.cz}`
      if (isEmpty) {
        delete next[k]
        game.dungeon.unpaint(cell.cx, cell.cz)
      } else {
        next[k] = target
        game.dungeon.paint(cell.cx, cell.cz, target)
      }
    }
    setCellPaints(next)
    onClose()
  }

  const title = cells && cells.length > 1
    ? `Surface Layers (${cells.length} cells)`
    : `Surface Layers (${cx}, ${cz})`

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Face tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {FACES.map(f => {
            const hasLayers = faceLayers[f].length > 0
            const active = f === face
            return (
              <button
                key={f}
                onClick={() => setFaceAndResetPick(f)}
                style={{
                  flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer', borderRadius: 3,
                  background: active ? '#1a3080' : '#111828',
                  border: active ? '1px solid #4060c0' : '1px solid #1e2a50',
                  color: active ? '#d0e0ff' : hasLayers ? '#a0b8e0' : '#506080',
                  fontWeight: active ? 'bold' : 'normal',
                }}
              >
                {FACE_LABEL[f]}{hasLayers ? ` (${faceLayers[f].length})` : ''}
              </button>
            )
          })}
        </div>

        {/* Current layers for selected face */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#7080b0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            {FACE_LABEL[face]} layers
          </span>
          {layers.length === 0
            ? <span style={{ color: '#506080', fontSize: 12, fontStyle: 'italic' }}>none</span>
            : layers.map((name, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111828', borderRadius: 3, padding: '4px 8px' }}>
                  <span style={{ color: '#6070a0', fontSize: 11, minWidth: 16 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SpriteSwatch name={name} entries={atlasEntries} />
                  </div>
                  <button
                    onClick={() => removeLayer(i)}
                    style={{ background: 'none', border: 'none', color: '#8090c0', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}
                  >×</button>
                </div>
              ))
          }
        </div>

        {/* Add layer */}
        {spriteNames.length > 0 && layers.length < 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#7080b0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              Add to {FACE_LABEL[face].toLowerCase()}
            </span>
            <TileGrid
              entries={atlasEntries}
              spriteNames={spriteNames}
              selected={picking}
              onSelect={setPicking}
            />
            <button
              onClick={addLayer}
              disabled={!picking || layers.includes(picking)}
              style={{
                alignSelf: 'flex-start',
                background: '#1a2040', border: '1px solid #304080', borderRadius: 3,
                color: '#c8d0f8', padding: '3px 12px', cursor: 'pointer', fontSize: 12,
                opacity: picking && !layers.includes(picking) ? 1 : 0.4,
              }}
            >
              + Add {picking ? `"${picking}"` : ''}
            </button>
          </div>
        )}

        {spriteNames.length === 0 && (
          <span style={{ color: '#506080', fontSize: 12, fontStyle: 'italic' }}>
            Load an atlas first to pick tiles.
          </span>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #1e2a50', paddingTop: 8 }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid #304060', borderRadius: 3, color: '#8090c0', padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={!game}
            style={{
              background: '#1a3080', border: '1px solid #4060c0', borderRadius: 3,
              color: '#d0e0ff', padding: '4px 16px', cursor: 'pointer', fontSize: 12,
              opacity: game ? 1 : 0.5,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
