import { useState } from 'react'
import Modal from './Modal'
import { useData } from '../DataContext'
import type { GeneratorOptions } from '../DataContext'

const THEMES = ['dungeon', 'crypt', 'catacomb', 'industrial', 'ruins'] as const

interface Props {
  onClose: () => void
}

type ExtendedOpts = GeneratorOptions & {
  generator?: string
  theme?: string
  fillRatio?: number
  iterations?: number
  minLeafSize?: number
  maxLeafSize?: number
  minRoomSize?: number
  maxRoomSize?: number
}

export default function NewMapModal({ onClose }: Props) {
  const { generatorOptions, setImportRequest } = useData()

  const rawOpts = generatorOptions as ExtendedOpts | null

  const [seedInput, setSeedInput] = useState(String(rawOpts?.seed ?? 0xdeadbeef))
  const [width, setWidth] = useState(rawOpts?.width ?? 40)
  const [height, setHeight] = useState(rawOpts?.height ?? 40)
  const [generator, setGenerator] = useState<'bsp' | 'cellular'>(
    rawOpts?.generator === 'cellular' ? 'cellular' : 'bsp'
  )
  const [theme, setTheme] = useState<string>(rawOpts?.theme ?? '')
  const [fillRatio, setFillRatio] = useState(rawOpts?.fillRatio ?? 0.45)
  const [iterations, setIterations] = useState(rawOpts?.iterations ?? 5)
  const [minLeafSize, setMinLeafSize] = useState(rawOpts?.minLeafSize ?? 8)
  const [maxLeafSize, setMaxLeafSize] = useState(rawOpts?.maxLeafSize ?? 20)
  const [minRoomSize, setMinRoomSize] = useState(rawOpts?.minRoomSize ?? 5)
  const [maxRoomSize, setMaxRoomSize] = useState(rawOpts?.maxRoomSize ?? 11)
  const [showAdvanced, setShowAdvanced] = useState(false)

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

    const opts: Record<string, unknown> = { width, height, seed }

    if (generator === 'cellular') {
      opts.generator = 'cellular'
      opts.fillRatio = fillRatio
      opts.iterations = iterations
    } else {
      opts.minRoomSize = minRoomSize
      opts.maxRoomSize = maxRoomSize
      opts.minLeafSize = minLeafSize
      opts.maxLeafSize = maxLeafSize
    }
    if (theme) opts.theme = theme

    setImportRequest({ options: opts as unknown as GeneratorOptions, seq: Date.now() })
    onClose()
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

  const numInputStyle: React.CSSProperties = {
    ...inputStyle,
    flex: 'none',
    width: 72,
  }

  const labelStyle: React.CSSProperties = {
    color: '#7080b0',
    minWidth: 120,
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

  function genBtn(active: boolean): React.CSSProperties {
    return {
      flex: 1,
      background: active ? '#1a2040' : 'none',
      border: `1px solid ${active ? '#4060c0' : '#304060'}`,
      borderRadius: 3,
      color: active ? '#c8d0f8' : '#8090c0',
      cursor: 'pointer',
      fontSize: 12,
      padding: '4px 0',
    }
  }

  const sectionLabel: React.CSSProperties = {
    color: '#5870d0',
    fontWeight: 'bold',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    borderBottom: '1px solid #203060',
    paddingBottom: 4,
    marginTop: 4,
  }

  return (
    <Modal onClose={onClose} title="New Map" style={{ minWidth: 400 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Generator type */}
        <div>
          <div style={sectionLabel}>Generator</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            <button style={genBtn(generator === 'bsp')} onClick={() => setGenerator('bsp')}>BSP (rooms)</button>
            <button style={genBtn(generator === 'cellular')} onClick={() => setGenerator('cellular')}>Cellular (caves)</button>
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <div style={sectionLabel}>Dimensions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={labelStyle}>Width</span>
            <input
              type="number" min={8} max={256} value={width}
              onChange={e => setWidth(Math.max(8, Math.min(256, Number(e.target.value))))}
              style={numInputStyle}
            />
            <span style={{ ...labelStyle, minWidth: 'auto', marginLeft: 8 }}>Height</span>
            <input
              type="number" min={8} max={256} value={height}
              onChange={e => setHeight(Math.max(8, Math.min(256, Number(e.target.value))))}
              style={numInputStyle}
            />
          </div>
        </div>

        {/* Seed */}
        <div>
          <div style={sectionLabel}>Seed</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input
              type="text" value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              style={inputStyle}
              spellCheck={false}
            />
            <button onClick={rollSeed} style={ghostBtn}>Roll</button>
          </div>
          <div style={{ color: '#506090', fontSize: 11, marginTop: 4 }}>
            Enter a number, hex (0x…), or text seed.
          </div>
        </div>

        {/* Theme */}
        <div>
          <div style={sectionLabel}>Theme</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value)}
              style={{ ...inputStyle, flex: 'none', width: 160 }}
            >
              <option value="">None (default)</option>
              {THEMES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span style={{ color: '#506090', fontSize: 11 }}>
              {theme === 'crypt' && 'Flagstone / Concrete / Flagstone'}
              {theme === 'catacomb' && 'Cobblestone / Plaster / Concrete'}
              {theme === 'industrial' && 'Steel / Concrete / Steel'}
              {theme === 'ruins' && 'Dirt / Cobblestone / Cobblestone'}
              {theme === 'dungeon' && 'Cobblestone / Cobblestone / Cobblestone'}
              {theme === '' && 'Uses atlas default tile assignments'}
            </span>
          </div>
        </div>

        {/* Generator-specific options */}
        {generator === 'cellular' ? (
          <div>
            <div style={sectionLabel}>Cellular Options</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={labelStyle}>Fill ratio</span>
                <input
                  type="range" min={0.2} max={0.7} step={0.01} value={fillRatio}
                  onChange={e => setFillRatio(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#5870d0' }}
                />
                <span style={{ color: '#e0e8ff', minWidth: 36, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>
                  {fillRatio.toFixed(2)}
                </span>
              </div>
              <div style={{ color: '#506090', fontSize: 11, marginTop: -2 }}>
                Initial wall density (0.2–0.7). Higher = denser caves.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={labelStyle}>Smoothing passes</span>
                <input
                  type="number" min={1} max={20} value={iterations}
                  onChange={e => setIterations(Math.max(1, Math.min(20, Number(e.target.value))))}
                  style={numInputStyle}
                />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowAdvanced(v => !v)}
              style={{ ...ghostBtn, alignSelf: 'flex-start' }}
            >
              {showAdvanced ? '▾' : '▸'} BSP Options
            </button>
            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingLeft: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={labelStyle}>Min room size</span>
                  <input type="number" min={3} max={32} value={minRoomSize}
                    onChange={e => setMinRoomSize(Math.max(3, Math.min(32, Number(e.target.value))))}
                    style={numInputStyle} />
                  <span style={{ ...labelStyle, minWidth: 'auto', marginLeft: 8 }}>Max</span>
                  <input type="number" min={3} max={64} value={maxRoomSize}
                    onChange={e => setMaxRoomSize(Math.max(3, Math.min(64, Number(e.target.value))))}
                    style={numInputStyle} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={labelStyle}>Min leaf size</span>
                  <input type="number" min={4} max={64} value={minLeafSize}
                    onChange={e => setMinLeafSize(Math.max(4, Math.min(64, Number(e.target.value))))}
                    style={numInputStyle} />
                  <span style={{ ...labelStyle, minWidth: 'auto', marginLeft: 8 }}>Max</span>
                  <input type="number" min={4} max={128} value={maxLeafSize}
                    onChange={e => setMaxLeafSize(Math.max(4, Math.min(128, Number(e.target.value))))}
                    style={numInputStyle} />
                </div>
                <div style={{ color: '#506090', fontSize: 11 }}>
                  Leaf size controls BSP split boundaries. Rooms are carved inside leaves.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
        <button onClick={onClose} style={ghostBtn}>Cancel</button>
        <button onClick={generate} style={primaryBtn}>Generate</button>
      </div>
    </Modal>
  )
}
