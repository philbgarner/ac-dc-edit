import { useState } from 'react'
import type { LightPlacement } from '../DataContext'

interface Props {
  lights: LightPlacement[]
  onChange: (lights: LightPlacement[]) => void
  defaultPosition?: { x: number; y: number; z: number }
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

function NumInput({ value, placeholder, onChange, disabled, width = 56 }: {
  value: number
  placeholder: string
  onChange: (v: number) => void
  disabled?: boolean
  width?: number
}) {
  return (
    <input
      type="number"
      step="0.1"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={e => onChange(Number(e.target.value))}
      style={{ ...inputStyle, width, opacity: disabled ? 0.4 : 1 }}
    />
  )
}

export default function LightEditor({ lights, onChange, defaultPosition }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleExpand(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function update(i: number, patch: Partial<LightPlacement>) {
    onChange(lights.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  function remove(i: number) {
    onChange(lights.filter((_, idx) => idx !== i))
    setExpanded(prev => {
      const next = new Set<number>()
      prev.forEach(idx => { if (idx < i) next.add(idx); else if (idx > i) next.add(idx - 1) })
      return next
    })
  }

  function addLight() {
    const id = crypto.randomUUID()
    onChange([...lights, {
      id,
      color: '#ff8844',
      intensity: 4,
      distance: 20,
      decay: 2,
      x: defaultPosition?.x ?? 0,
      y: defaultPosition?.y ?? 1.5,
      z: defaultPosition?.z ?? 0,
      attachToCamera: false,
    }])
    setExpanded(prev => new Set([...prev, lights.length]))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lights.map((l, i) => (
        <div key={l.id} style={{ border: '1px solid #1e3050', borderRadius: 4, padding: '4px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => toggleExpand(i)}
              style={{ ...btnStyle, fontSize: 10, padding: '1px 4px', minWidth: 16 }}
            >{expanded.has(i) ? '▾' : '▸'}</button>
            <span style={{ color: l.color, fontSize: 14, lineHeight: 1 }}>●</span>
            <span style={{ color: '#c8d0f8', fontSize: 11, flex: 1 }}>
              {l.attachToCamera ? 'camera light' : `(${l.x.toFixed(1)}, ${l.y.toFixed(1)}, ${l.z.toFixed(1)})`}
            </span>
            <input
              type="color"
              value={l.color}
              onChange={e => update(i, { color: e.target.value })}
              title="Light color"
              style={{ width: 28, height: 20, border: '1px solid #304060', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 1 }}
            />
            <button onClick={() => remove(i)} style={{ ...btnStyle, color: '#905050' }}>×</button>
          </div>

          {expanded.has(i) && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>color</span>
                <input
                  type="color"
                  value={l.color}
                  onChange={e => update(i, { color: e.target.value })}
                  style={{ width: 36, height: 22, border: '1px solid #304060', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 1 }}
                />
                <span style={{ color: '#e0e8ff', fontSize: 11 }}>{l.color}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>intensity</span>
                <NumInput value={l.intensity} placeholder="4" onChange={v => update(i, { intensity: v })} />
                <span style={{ color: '#506080', fontSize: 10, marginLeft: 4 }}>distance</span>
                <NumInput value={l.distance} placeholder="20" onChange={v => update(i, { distance: v })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>decay</span>
                <NumInput value={l.decay} placeholder="2" onChange={v => update(i, { decay: v })} width={44} />
                <span style={{ color: '#506080', fontSize: 10, marginLeft: 4 }}>
                  (1=linear, 2=physical)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>position</span>
                <NumInput value={l.x} placeholder="X" onChange={v => update(i, { x: v })} disabled={l.attachToCamera} />
                <NumInput value={l.y} placeholder="Y" onChange={v => update(i, { y: v })} disabled={l.attachToCamera} />
                <NumInput value={l.z} placeholder="Z" onChange={v => update(i, { z: v })} disabled={l.attachToCamera} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#506080', fontSize: 10, minWidth: 52 }}>camera</span>
                <input
                  type="checkbox"
                  checked={l.attachToCamera}
                  onChange={e => update(i, { attachToCamera: e.target.checked })}
                  style={{ accentColor: '#5870d0' }}
                />
                <span style={{ color: '#506080', fontSize: 10 }}>attach to camera</span>
              </div>
              <div style={{ color: '#304060', fontSize: 10 }}>id: {l.id}</div>
            </div>
          )}
        </div>
      ))}

      <button onClick={addLight} style={{ ...btnStyle, marginTop: 2 }}>+ add light</button>

      {lights.length > 0 && (
        <div style={{ color: '#506080', fontSize: 10 }}>
          {lights.length} light{lights.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
