import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../DataContext'
import type { SurfacePaintTarget, CellInfo } from '../DataContext'
import type { PackedAtlas } from 'atomic-core'

type Face = 'floor' | 'wall' | 'ceil'
const FACES: Face[] = ['floor', 'wall', 'ceil']
const FACE_LABEL: Record<Face, string> = { floor: 'Floor', wall: 'Wall', ceil: 'Ceiling' }

type ExtFace = 'skyPanels' | 'ceilingPanels' | 'ceilSkirtBase' | 'floorSkirtBase'
const EXT_FACES: ExtFace[] = ['skyPanels', 'ceilingPanels', 'ceilSkirtBase', 'floorSkirtBase']
const EXT_FACE_LABEL: Record<ExtFace, string> = {
  skyPanels: 'Sky Panels',
  ceilingPanels: 'Ceil Panels',
  ceilSkirtBase: 'Ceil Skirt Rows',
  floorSkirtBase: 'Floor Skirt Rows',
}
const EXT_FACE_HINT: Record<ExtFace, string> = {
  skyPanels: 'Per-row tile above wall top on open-sky cells. Row 0 = closest to wall top.',
  ceilingPanels: 'Per-row tile hanging below the ceiling. Row 0 = closest to ceiling.',
  ceilSkirtBase: 'Per-row base tile for ceiling wall-adjacent skirts. Row 0 = closest to wall top.',
  floorSkirtBase: 'Per-row base tile for floor wall-adjacent skirts. Row 0 = closest to wall bottom.',
}

const TILE_SIZE = 44

function spriteStyle(packed: PackedAtlas, atlasUrl: string, name: string, displaySize: number) {
  const sprite = packed.getByName(name)
  if (!sprite) return null
  const atlasW = packed.texture.width
  const atlasH = packed.texture.height
  const spriteW = sprite.uvW * atlasW
  const spriteH = sprite.uvH * atlasH
  const scale = displaySize / Math.max(spriteW, spriteH)
  return {
    width: Math.round(spriteW * scale),
    height: Math.round(spriteH * scale),
    backgroundImage: `url(${atlasUrl})`,
    backgroundPosition: `-${Math.round(sprite.uvX * atlasW * scale)}px -${Math.round(sprite.uvY * atlasH * scale)}px`,
    backgroundSize: `${Math.round(atlasW * scale)}px ${Math.round(atlasH * scale)}px`,
    backgroundRepeat: 'no-repeat' as const,
    imageRendering: 'pixelated' as const,
  }
}

function TileGrid({ packed, atlasUrl, spriteNames, selected, onSelect }: {
  packed: PackedAtlas
  atlasUrl: string
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
        const style = spriteStyle(packed, atlasUrl, name, TILE_SIZE)
        if (!style) return null
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
            <div style={style} />
          </div>
        )
      })}
    </div>
  )
}

function SpriteSwatch({ name, packed, atlasUrl }: { name: string; packed: PackedAtlas; atlasUrl: string }) {
  const style = spriteStyle(packed, atlasUrl, name, 24)
  if (!style) return <span style={{ color: '#506080', fontSize: 11 }}>{name}</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ ...style, flexShrink: 0, borderRadius: 2 }} />
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
  /** Open the per-row overrides panel immediately. */
  initialShowExt?: boolean
  /** Which per-row tab to activate on open. */
  initialExtFace?: ExtFace
}

export default function OverlayPaintModal({ cx, cz, cells, onClose, initialShowExt, initialExtFace }: Props) {
  const { game, atlasConfig, packedAtlasUrl, cellPaints, setCellPaints } = useData()
  const key = `${cx},${cz}`
  const existing = cellPaints[key] ?? {}

  const [face, setFace] = useState<Face>('floor')
  const [faceLayers, setFaceLayers] = useState<Record<Face, string[]>>({
    floor: existing.floor ?? [],
    wall: existing.wall ?? [],
    ceil: existing.ceil ?? [],
  })
  const [picking, setPicking] = useState<string | null>(null)

  // Extended per-row tab state
  const [extFace, setExtFace] = useState<ExtFace>(initialExtFace ?? 'skyPanels')
  const [extRows, setExtRows] = useState<Record<ExtFace, (string | null)[]>>({
    skyPanels: (existing as SurfacePaintTarget).skyPanels ?? [],
    ceilingPanels: (existing as SurfacePaintTarget).ceilingPanels ?? [],
    ceilSkirtBase: (existing as SurfacePaintTarget).ceilSkirtBase ?? [],
    floorSkirtBase: (existing as SurfacePaintTarget).floorSkirtBase ?? [],
  })
  const [extPicking, setExtPicking] = useState<string | null>(null)
  const [showExt, setShowExt] = useState(
    initialShowExt ?? EXT_FACES.some(f => (existing as SurfacePaintTarget)[f]?.some(v => v != null))
  )

  const spriteNames = atlasConfig?.spriteNames ?? []
  const layers = faceLayers[face]
  const extCurrent = extRows[extFace]

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

  function setExtFaceAndReset(f: ExtFace) {
    setExtFace(f)
    setExtPicking(null)
  }

  function setExtRow(rowIdx: number, val: string | null) {
    setExtRows(prev => {
      const rows = [...prev[extFace]]
      rows[rowIdx] = val
      // trim trailing nulls
      let end = rows.length
      while (end > 0 && rows[end - 1] == null) end--
      return { ...prev, [extFace]: rows.slice(0, end) }
    })
  }

  function addExtRow() {
    if (!extPicking) return
    setExtRows(prev => {
      const rows = [...prev[extFace], extPicking]
      return { ...prev, [extFace]: rows }
    })
    setExtPicking(null)
  }

  function apply() {
    if (!game) return
    const target: SurfacePaintTarget = {}
    if (faceLayers.floor.length) target.floor = faceLayers.floor
    if (faceLayers.wall.length) target.wall = faceLayers.wall
    if (faceLayers.ceil.length) target.ceil = faceLayers.ceil

    // Extended fields — only include non-empty arrays
    for (const ef of EXT_FACES) {
      const rows = extRows[ef]
      if (rows.length > 0) (target as Record<string, unknown>)[ef] = rows
    }

    const applyTo = cells ?? [{ cx, cz }]
    const next = { ...cellPaints }
    const isEmpty = !target.floor && !target.wall && !target.ceil &&
      EXT_FACES.every(ef => !(target as Record<string, unknown>)[ef])
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

  const canShowTiles = spriteNames.length > 0 && atlasConfig && packedAtlasUrl

  const tabBtn = (active: boolean, hasContent: boolean) => ({
    flex: 1, padding: '4px 0', fontSize: 12, cursor: 'pointer' as const, borderRadius: 3,
    background: active ? '#1a3080' : '#111828',
    border: active ? '1px solid #4060c0' : '1px solid #1e2a50',
    color: active ? '#d0e0ff' : hasContent ? '#a0b8e0' : '#506080',
    fontWeight: active ? 'bold' : 'normal',
  })

  const extTabBtn = (active: boolean, hasContent: boolean) => ({
    flex: 1, padding: '3px 4px', fontSize: 11, cursor: 'pointer' as const, borderRadius: 3,
    background: active ? '#102040' : '#0d1828',
    border: active ? '1px solid #305090' : '1px solid #1a2840',
    color: active ? '#b0c8f0' : hasContent ? '#809cb8' : '#405060',
  })

  const ghostBtn = {
    background: 'none', border: '1px solid #304060', borderRadius: 3,
    color: '#8090c0', cursor: 'pointer' as const, fontSize: 11, padding: '2px 8px',
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Face tabs (floor / wall / ceil) ── */}
        <div style={{ display: 'flex', gap: 2 }}>
          {FACES.map(f => (
            <button key={f} onClick={() => setFaceAndResetPick(f)}
              style={tabBtn(f === face, faceLayers[f].length > 0)}>
              {FACE_LABEL[f]}{faceLayers[f].length ? ` (${faceLayers[f].length})` : ''}
            </button>
          ))}
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
                    {canShowTiles
                      ? <SpriteSwatch name={name} packed={atlasConfig.packed} atlasUrl={packedAtlasUrl} />
                      : <span style={{ color: '#c0c8f0', fontSize: 12 }}>{name}</span>
                    }
                  </div>
                  <button onClick={() => removeLayer(i)}
                    style={{ background: 'none', border: 'none', color: '#8090c0', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))
          }
        </div>

        {/* Add layer */}
        {canShowTiles && layers.length < 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: '#7080b0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              Add to {FACE_LABEL[face].toLowerCase()}
            </span>
            <TileGrid packed={atlasConfig.packed} atlasUrl={packedAtlasUrl}
              spriteNames={spriteNames} selected={picking} onSelect={setPicking} />
            <button onClick={addLayer}
              disabled={!picking || layers.includes(picking)}
              style={{
                alignSelf: 'flex-start',
                background: '#1a2040', border: '1px solid #304080', borderRadius: 3,
                color: '#c8d0f8', padding: '3px 12px', cursor: 'pointer', fontSize: 12,
                opacity: picking && !layers.includes(picking) ? 1 : 0.4,
              }}>
              + Add {picking ? `"${picking}"` : ''}
            </button>
          </div>
        )}

        {!canShowTiles && (
          <span style={{ color: '#506080', fontSize: 12, fontStyle: 'italic' }}>
            Load an atlas first to pick tiles.
          </span>
        )}

        {/* ── Extended per-row fields ── */}
        <div style={{ borderTop: '1px solid #1a2840', paddingTop: 8 }}>
          <button onClick={() => setShowExt(v => !v)}
            style={{ ...ghostBtn, fontSize: 12, padding: '3px 10px', marginBottom: showExt ? 8 : 0 }}>
            {showExt ? '▾' : '▸'} Per-row tile overrides
            {EXT_FACES.some(f => extRows[f].length > 0) && (
              <span style={{ color: '#5090d0', marginLeft: 6 }}>●</span>
            )}
          </button>

          {showExt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Extended face tabs */}
              <div style={{ display: 'flex', gap: 2 }}>
                {EXT_FACES.map(f => (
                  <button key={f} onClick={() => setExtFaceAndReset(f)}
                    style={extTabBtn(f === extFace, extRows[f].length > 0)}>
                    {EXT_FACE_LABEL[f]}{extRows[f].length ? ` (${extRows[f].length})` : ''}
                  </button>
                ))}
              </div>

              <span style={{ color: '#506080', fontSize: 11, fontStyle: 'italic' }}>
                {EXT_FACE_HINT[extFace]}
              </span>

              {/* Current rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {extCurrent.length === 0
                  ? <span style={{ color: '#405060', fontSize: 12, fontStyle: 'italic' }}>no overrides — all rows use default tile</span>
                  : extCurrent.map((name, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0d1828', borderRadius: 3, padding: '4px 8px' }}>
                        <span style={{ color: '#506080', fontSize: 11, minWidth: 36 }}>row {i}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {name == null
                            ? <span style={{ color: '#405060', fontSize: 12, fontStyle: 'italic' }}>default</span>
                            : canShowTiles
                              ? <SpriteSwatch name={name} packed={atlasConfig.packed} atlasUrl={packedAtlasUrl} />
                              : <span style={{ color: '#c0c8f0', fontSize: 12 }}>{name}</span>
                          }
                        </div>
                        <button onClick={() => setExtRow(i, null)}
                          title="Set to default"
                          style={{ background: 'none', border: 'none', color: '#6080a0', cursor: 'pointer', fontSize: 11, padding: '0 2px' }}>
                          default
                        </button>
                        {name != null && (
                          <button onClick={() => setExtRow(i, null)}
                            style={{ background: 'none', border: 'none', color: '#8090c0', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                        )}
                      </div>
                    ))
                }
              </div>

              {/* Add row */}
              {canShowTiles && extCurrent.length < 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: '#506080', fontSize: 11 }}>
                    Add row {extCurrent.length}
                  </span>
                  <TileGrid packed={atlasConfig.packed} atlasUrl={packedAtlasUrl}
                    spriteNames={spriteNames} selected={extPicking} onSelect={setExtPicking} />
                  <button onClick={addExtRow}
                    disabled={!extPicking}
                    style={{
                      alignSelf: 'flex-start',
                      background: '#0d1828', border: '1px solid #203050', borderRadius: 3,
                      color: '#a0b8d8', padding: '3px 12px', cursor: 'pointer', fontSize: 12,
                      opacity: extPicking ? 1 : 0.4,
                    }}>
                    + Add row {extCurrent.length} {extPicking ? `"${extPicking}"` : ''}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #1e2a50', paddingTop: 8 }}>
          <button onClick={onClose}
            style={{ background: 'none', border: '1px solid #304060', borderRadius: 3, color: '#8090c0', padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}>
            Cancel
          </button>
          <button onClick={apply} disabled={!game}
            style={{
              background: '#1a3080', border: '1px solid #4060c0', borderRadius: 3,
              color: '#d0e0ff', padding: '4px 16px', cursor: 'pointer', fontSize: 12,
              opacity: game ? 1 : 0.5,
            }}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
