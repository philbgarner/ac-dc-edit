import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../DataContext'

interface Props {
  onClose: () => void
}

export default function NewMapModal({ onClose }: Props) {
  const { generatorOptions, setImportRequest } = useData()

  const initialSeed = generatorOptions?.seed ?? 0xdeadbeef
  const [seedInput, setSeedInput] = useState(String(initialSeed))
  const [width, setWidth] = useState(generatorOptions?.width ?? 40)
  const [height, setHeight] = useState(generatorOptions?.height ?? 40)

  function rollSeed() {
    setSeedInput(String(Math.floor(Math.random() * 0xffffffff)))
  }

  function generate() {
    const raw = seedInput.trim()
    const seed = /^0x[0-9a-f]+$/i.test(raw)
      ? parseInt(raw, 16)
      : /^\d+$/.test(raw)
        ? parseInt(raw, 10)
        : raw
    const base = generatorOptions ?? { minRoomSize: 5, maxRoomSize: 11 }
    setImportRequest({ options: { ...base, width, height, seed }, seq: Date.now() })
    onClose()
  }

  const dimStyle: React.CSSProperties = {
    color: '#7080b0',
    minWidth: 120,
  }

  const inputStyle: React.CSSProperties = {
    background: '#0a0f20',
    border: '1px solid #304080',
    borderRadius: 3,
    color: '#c8d0f8',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: '4px 8px',
    flex: 1,
  }

  const ghostBtn: React.CSSProperties = {
    background: 'none',
    border: '1px solid #304060',
    borderRadius: 3,
    color: '#8090c0',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 12px',
  }

  const primaryBtn: React.CSSProperties = {
    background: '#1a2040',
    border: '1px solid #4060c0',
    borderRadius: 3,
    color: '#c8d0f8',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 12px',
  }

  return (
    <Modal onClose={onClose} title="New Map" style={{ minWidth: 360 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={dimStyle}>Width</span>
          <input
            type="number"
            min={8}
            max={256}
            value={width}
            onChange={e => setWidth(Math.max(8, Math.min(256, Number(e.target.value))))}
            style={{ ...inputStyle, width: 64, flex: 'none' }}
          />
          <span style={{ ...dimStyle, minWidth: 'auto', marginLeft: 16 }}>Height</span>
          <input
            type="number"
            min={8}
            max={256}
            value={height}
            onChange={e => setHeight(Math.max(8, Math.min(256, Number(e.target.value))))}
            style={{ ...inputStyle, width: 64, flex: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={dimStyle}>Seed</span>
          <input
            type="text"
            value={seedInput}
            onChange={e => setSeedInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            style={inputStyle}
            spellCheck={false}
          />
          <button onClick={rollSeed} style={ghostBtn}>Roll</button>
        </div>

        <div style={{ color: '#506090', fontSize: 11 }}>
          Enter a seed as a number or text. Leave unchanged to regenerate with the same seed.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={generate} style={primaryBtn}>Generate</button>
      </div>
    </Modal>
  )
}
