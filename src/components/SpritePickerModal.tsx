import Modal from './Modal'
import { useData } from '../DataContext'
import type { PackedAtlas } from 'atomic-core'

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

interface Props {
  selected: string
  onSelect: (name: string) => void
  onClose: () => void
}

export default function SpritePickerModal({ selected, onSelect, onClose }: Props) {
  const { atlasConfig, packedAtlasUrl } = useData()

  const packed = atlasConfig?.packed
  const spriteNames = atlasConfig?.spriteNames ?? []

  function pick(name: string) {
    onSelect(name)
    onClose()
  }

  return (
    <Modal title="Pick Sprite" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {packed && packedAtlasUrl ? (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 3,
            maxHeight: 320, overflowY: 'auto',
            background: '#0d1020', borderRadius: 4, padding: 6,
            border: '1px solid #1e2a50',
          }}>
            {spriteNames.map(name => {
              const style = spriteStyle(packed, packedAtlasUrl, name, TILE_SIZE)
              if (!style) return null
              const isSelected = name === selected
              return (
                <div
                  key={name}
                  title={name}
                  onClick={() => pick(name)}
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
        ) : (
          <span style={{ color: '#506080', fontSize: 12, fontStyle: 'italic' }}>
            Load an atlas first to pick sprites.
          </span>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #304060', borderRadius: 3,
              color: '#8090c0', padding: '4px 14px', cursor: 'pointer', fontSize: 12,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
