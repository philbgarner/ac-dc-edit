import { useState } from 'react'

export const IS_WALKABLE = 0x01
export const IS_BLOCKED = 0x02
export const IS_LIGHT_PASSABLE = 0x04

const STANDARD_FLAGS = [
  { bit: IS_WALKABLE, label: 'Walkable' },
  { bit: IS_BLOCKED, label: 'Blocked' },
  { bit: IS_LIGHT_PASSABLE, label: 'Light passable' },
]

const CUSTOM_BITS = [0x08, 0x10, 0x20, 0x40, 0x80]

interface Props {
  value: number
  onChange: (newValue: number) => void
  customFlagNames: Record<number, string>
  onCustomFlagNamesChange: (names: Record<number, string>) => void
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #304060', borderRadius: 3,
  color: '#8090c0', cursor: 'pointer', fontSize: 11,
  padding: '1px 5px', lineHeight: 1.4,
}

export default function ColliderFlagsEditor({ value, onChange, customFlagNames, onCustomFlagNamesChange }: Props) {
  const [addingBit, setAddingBit] = useState<number | null>(null)
  const [pendingName, setPendingName] = useState('')

  const definedCustomBits = CUSTOM_BITS.filter(b => b in customFlagNames)
  const availableBits = CUSTOM_BITS.filter(b => !(b in customFlagNames))

  function toggleBit(bit: number) {
    onChange(value ^ bit)
  }

  function removeCustom(bit: number) {
    const next = { ...customFlagNames }
    delete next[bit]
    onCustomFlagNamesChange(next)
    if (value & bit) onChange(value & ~bit)
  }

  function confirmAdd() {
    if (addingBit === null) return
    onCustomFlagNamesChange({ ...customFlagNames, [addingBit]: pendingName.trim() || `Custom (0x${addingBit.toString(16).padStart(2, '0').toUpperCase()})` })
    setAddingBit(null)
    setPendingName('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {STANDARD_FLAGS.map(({ bit, label }) => (
        <label key={bit} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!(value & bit)}
            onChange={() => toggleBit(bit)}
            style={{ accentColor: '#5870d0' }}
          />
          <span style={{ color: '#e0e8ff', fontSize: 12 }}>{label}</span>
          <span style={{ color: '#506080', fontSize: 11 }}>{`0x${bit.toString(16).padStart(2, '0').toUpperCase()}`}</span>
        </label>
      ))}

      {definedCustomBits.length > 0 && (
        <div style={{ marginTop: 4, borderTop: '1px solid #1e2e45', paddingTop: 4 }}>
          {definedCustomBits.map(bit => (
            <div key={bit} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <input
                type="checkbox"
                checked={!!(value & bit)}
                onChange={() => toggleBit(bit)}
                style={{ accentColor: '#5870d0' }}
              />
              <input
                value={customFlagNames[bit]}
                onChange={e => onCustomFlagNamesChange({ ...customFlagNames, [bit]: e.target.value })}
                style={{
                  flex: 1, background: '#0d1b2a', border: '1px solid #1e3050', borderRadius: 3,
                  color: '#e0e8ff', fontSize: 11, padding: '1px 4px',
                }}
              />
              <span style={{ color: '#506080', fontSize: 11 }}>{`0x${bit.toString(16).padStart(2, '0').toUpperCase()}`}</span>
              <button onClick={() => removeCustom(bit)} style={{ ...btnStyle, color: '#905050' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {availableBits.length > 0 && (
        <div style={{ marginTop: 2 }}>
          {addingBit === null ? (
            <button
              onClick={() => { setAddingBit(availableBits[0]); setPendingName('') }}
              style={btnStyle}
            >+ custom flag</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <select
                value={addingBit}
                onChange={e => setAddingBit(Number(e.target.value))}
                style={{
                  background: '#0d1b2a', border: '1px solid #1e3050', borderRadius: 3,
                  color: '#e0e8ff', fontSize: 11, padding: '1px 2px',
                }}
              >
                {availableBits.map(b => (
                  <option key={b} value={b}>{`0x${b.toString(16).padStart(2, '0').toUpperCase()}`}</option>
                ))}
              </select>
              <input
                value={pendingName}
                onChange={e => setPendingName(e.target.value)}
                placeholder="Flag name"
                onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAddingBit(null) }}
                autoFocus
                style={{
                  flex: 1, background: '#0d1b2a', border: '1px solid #1e3050', borderRadius: 3,
                  color: '#e0e8ff', fontSize: 11, padding: '1px 4px',
                }}
              />
              <button onClick={confirmAdd} style={btnStyle}>Add</button>
              <button onClick={() => setAddingBit(null)} style={{ ...btnStyle, color: '#905050' }}>✕</button>
            </div>
          )}
        </div>
      )}

      <div style={{ color: '#506080', fontSize: 10, marginTop: 2 }}>
        raw: 0x{value.toString(16).padStart(2, '0').toUpperCase()} ({value})
      </div>
    </div>
  )
}
