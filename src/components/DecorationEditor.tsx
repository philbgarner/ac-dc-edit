import { useState } from 'react'
import type { DecorationPlacement } from '../DataContext'
import SpritePickerModal from './SpritePickerModal'

interface Props {
  cx: number
  cz: number
  decorations: DecorationPlacement[]
  onChange: (decorations: DecorationPlacement[]) => void
}

const inputStyle: React.CSSProperties = {
  background: '#0d1b2a', border: '1px solid #1e3050', borderRadius: 3,
  color: '#e0e8ff', fontSize: 11, padding: '1px 4px',
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #304060', borderRadius: 3,
  color: '#8090c0', cursor: 'pointer', fontSize: 11,
  padding: '1px 5px', lineHeight: 1.4,
}

function NumInput({ value, placeholder, onChange }: { value: number | undefined; placeholder: string; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="number"
      step="0.1"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      style={{ ...inputStyle, width: 56 }}
    />
  )
}

export default function DecorationEditor({ cx, cz, decorations, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [pickingSprite, setPickingSprite] = useState<number | null>(null)

  function toggleExpand(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function update(i: number, patch: Partial<DecorationPlacement>) {
    const next = decorations.map((d, idx) => idx === i ? { ...d, ...patch } : d)
    onChange(next)
  }

  function remove(i: number) {
    onChange(decorations.filter((_, idx) => idx !== i))
    setExpanded(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1) })
      return next
    })
  }

  function addDecoration() {
    onChange([...decorations, { x: cx, z: cz, type: '', sprite: '' }])
    setExpanded(prev => new Set([...prev, decorations.length]))
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {decorations.map((d, i) => (
          <div key={i} style={{ border: '1px solid #1e3050', borderRadius: 4, padding: '4px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => toggleExpand(i)}
                style={{ ...btnStyle, fontSize: 10, padding: '1px 4px', minWidth: 16 }}
              >{expanded.has(i) ? '▾' : '▸'}</button>
              <input
                type="text"
                value={d.type}
                placeholder="type"
                onChange={e => update(i, { type: e.target.value })}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
              />
              <span
                style={{
                  color: d.sprite ? '#e0e8ff' : '#506080', fontSize: 11,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  maxWidth: 72, flexShrink: 1,
                }}
                title={d.sprite || 'no sprite'}
              >
                {d.sprite || 'sprite'}
              </span>
              <button
                onClick={() => setPickingSprite(i)}
                title="Pick sprite"
                style={btnStyle}
              >…</button>
              <button onClick={() => remove(i)} style={{ ...btnStyle, color: '#905050' }}>×</button>
            </div>

            {expanded.has(i) && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>offset X/Y/Z</span>
                  <NumInput value={d.offsetX} placeholder="X" onChange={v => update(i, { offsetX: v })} />
                  <NumInput value={d.offsetY} placeholder="Y" onChange={v => update(i, { offsetY: v })} />
                  <NumInput value={d.offsetZ} placeholder="Z" onChange={v => update(i, { offsetZ: v })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>yaw (rad)</span>
                  <NumInput value={d.yaw} placeholder="0" onChange={v => update(i, { yaw: v })} />
                  <span style={{ color: '#506080', fontSize: 10, marginLeft: 8 }}>scale</span>
                  <NumInput value={d.scale} placeholder="1" onChange={v => update(i, { scale: v })} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>blocksMove</span>
                  <input
                    type="checkbox"
                    checked={d.blocksMove ?? false}
                    onChange={e => update(i, { blocksMove: e.target.checked })}
                    style={{ accentColor: '#5870d0' }}
                  />
                </div>
                {d._entityId && (
                  <div style={{ color: '#304060', fontSize: 10 }}>id: {d._entityId}</div>
                )}
              </div>
            )}
          </div>
        ))}

        <button onClick={addDecoration} style={{ ...btnStyle, marginTop: 2 }}>+ add decoration</button>

        {decorations.length > 0 && (
          <div style={{ color: '#506080', fontSize: 10 }}>
            {decorations.length} decoration{decorations.length !== 1 ? 's' : ''} at ({cx}, {cz})
          </div>
        )}
      </div>

      {pickingSprite !== null && (
        <SpritePickerModal
          selected={decorations[pickingSprite]?.sprite ?? ''}
          onSelect={name => update(pickingSprite, { sprite: name })}
          onClose={() => setPickingSprite(null)}
        />
      )}
    </>
  )
}
