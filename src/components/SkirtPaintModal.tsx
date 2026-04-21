import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../DataContext'
import type { CellInfo } from '../DataContext'
import type { PackedAtlas } from 'atomic-core'
import { setFloorSkirtTiles, setCeilSkirtTiles } from 'atomic-core'

type SkirtFace = 'floor' | 'ceil'
const FACES: SkirtFace[] = ['floor', 'ceil']
const FACE_LABEL: Record<SkirtFace, string> = { floor: 'Floor Skirt', ceil: 'Ceil Skirt' }
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
  cells?: CellInfo[]
  onClose: () => void
}

export default function SkirtPaintModal({ cx, cz, cells, onClose }: Props) {
  const { game, atlasConfig, packedAtlasUrl, cellSkirts, setCellSkirts, renderer } = useData()
  const key = `${cx},${cz}`
  const existing = cellSkirts[key] ?? {}

  const [face, setFace] = useState<SkirtFace>('floor')
  const [faceLayers, setFaceLayers] = useState<Record<SkirtFace, string[]>>({
    floor: existing.floor ?? [],
    ceil: existing.ceil ?? [],
  })
  const [picking, setPicking] = useState<string | null>(null)

  const spriteNames = atlasConfig?.spriteNames ?? []
  const outputs = game?.dungeon.outputs
  const layers = faceLayers[face]

  function setFaceAndResetPick(f: SkirtFace) {
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
    const applyTo = cells ?? [{ cx, cz }]
    const next = { ...cellSkirts }

    for (const cell of applyTo) {
      const k = `${cell.cx},${cell.cz}`
      const entry = { ...(next[k] ?? {}) }

      for (const f of FACES) {
        const names = faceLayers[f]
        if (names.length > 0) {
          entry[f] = names
          if (outputs && atlasConfig) {
            const ids = names.map(n => atlasConfig.resolver(n))
            f === 'floor'
              ? setFloorSkirtTiles(outputs, cell.cx, cell.cz, ids)
              : setCeilSkirtTiles(outputs, cell.cx, cell.cz, ids)
          }
        } else {
          delete entry[f]
          if (outputs) {
            f === 'floor'
              ? setFloorSkirtTiles(outputs, cell.cx, cell.cz, [0, 0, 0, 0])
              : setCeilSkirtTiles(outputs, cell.cx, cell.cz, [0, 0, 0, 0])
          }
        }
      }

      if (Object.keys(entry).length === 0) {
        delete next[k]
      } else {
        next[k] = entry
      }
    }

    setCellSkirts(next)
    renderer?.rebuild()
    onClose()
  }

  const title = cells && cells.length > 1
    ? `Skirt Layers (${cells.length} cells)`
    : `Skirt Layers (${cx}, ${cz})`

  const canShowTiles = spriteNames.length > 0 && atlasConfig && packedAtlasUrl

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

        {/* Current layers */}
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
                  <button
                    onClick={() => removeLayer(i)}
                    style={{ background: 'none', border: 'none', color: '#8090c0', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}
                  >×</button>
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
            <TileGrid
              packed={atlasConfig.packed}
              atlasUrl={packedAtlasUrl}
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

        {!canShowTiles && (
          <span style={{ color: '#506080', fontSize: 12, fontStyle: 'italic' }}>
            Load an atlas first to pick tiles.
          </span>
        )}

        {!outputs && (
          <span style={{ color: '#506080', fontSize: 11 }}>
            Generate a dungeon to apply skirt changes to the renderer.
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
            style={{
              background: '#1a3080', border: '1px solid #4060c0', borderRadius: 3,
              color: '#d0e0ff', padding: '4px 16px', cursor: 'pointer', fontSize: 12,
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
