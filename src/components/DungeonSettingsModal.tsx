import { useState } from 'react'
import Modal from './Modal'
import { useData, DEFAULT_RENDERER_SETTINGS } from '../DataContext'
import type { RendererSettings } from '../DataContext'

interface Props {
  onClose: () => void
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  const display = format ? format(value) : String(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#7080b0', minWidth: 160 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#5870d0' }}
      />
      <span style={{ color: '#e0e8ff', minWidth: 52, textAlign: 'right' }}>{display}</span>
    </div>
  )
}

interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ color: '#5870d0', fontWeight: 'bold', marginBottom: 2, borderBottom: '1px solid #203060', paddingBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

export default function DungeonSettingsModal({ onClose }: Props) {
  const { rendererSettings, setRendererSettings } = useData()
  const [local, setLocal] = useState<RendererSettings>({ ...rendererSettings })

  function set<K extends keyof RendererSettings>(key: K, value: RendererSettings[K]) {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  function apply() {
    setRendererSettings(local)
    onClose()
  }

  function reset() {
    setLocal({ ...DEFAULT_RENDERER_SETTINGS })
  }

  return (
    <Modal onClose={onClose} title="Dungeon Settings">
      <Section title="Camera">
        <SliderRow label="FOV (degrees)" value={local.fov} min={30} max={120} step={1} onChange={v => set('fov', v)} />
        <SliderRow
          label="Eye height factor"
          value={local.eyeHeightFactor}
          min={0}
          max={1}
          step={0.01}
          format={v => v.toFixed(2)}
          onChange={v => set('eyeHeightFactor', v)}
        />
        <SliderRow
          label="Lerp factor"
          value={local.lerpFactor}
          min={0}
          max={1}
          step={0.01}
          format={v => v.toFixed(2)}
          onChange={v => set('lerpFactor', v)}
        />
      </Section>

      <Section title="Fog">
        <SliderRow label="Fog near" value={local.fogNear} min={1} max={50} step={0.5} format={v => v.toFixed(1)} onChange={v => set('fogNear', v)} />
        <SliderRow label="Fog far" value={local.fogFar} min={2} max={100} step={0.5} format={v => v.toFixed(1)} onChange={v => set('fogFar', v)} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#7080b0', minWidth: 160 }}>Fog color</span>
          <input
            type="color"
            value={local.fogColor}
            onChange={e => set('fogColor', e.target.value)}
            style={{ width: 40, height: 24, border: '1px solid #304080', borderRadius: 3, cursor: 'pointer', background: 'none', padding: 1 }}
          />
          <span style={{ color: '#e0e8ff' }}>{local.fogColor}</span>
        </div>
      </Section>

      <Section title="Geometry">
        <SliderRow label="Tile size" value={local.tileSize} min={1} max={10} step={0.5} format={v => v.toFixed(1)} onChange={v => set('tileSize', v)} />
        <SliderRow label="Ceiling height" value={local.ceilingHeight} min={1} max={10} step={0.5} format={v => v.toFixed(1)} onChange={v => set('ceilingHeight', v)} />
        <SliderRow
          label="Offset factor"
          value={local.offsetFactor}
          min={0}
          max={2}
          step={0.05}
          format={v => v.toFixed(2)}
          onChange={v => set('offsetFactor', v)}
        />
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <button
          onClick={reset}
          style={{
            background: 'none',
            border: '1px solid #304060',
            borderRadius: 3,
            color: '#8090c0',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 12px',
          }}
        >
          Reset defaults
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #304060',
            borderRadius: 3,
            color: '#8090c0',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 12px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={apply}
          style={{
            background: '#1a2040',
            border: '1px solid #4060c0',
            borderRadius: 3,
            color: '#c8d0f8',
            cursor: 'pointer',
            fontSize: 12,
            padding: '4px 12px',
          }}
        >
          Apply
        </button>
      </div>
    </Modal>
  )
}
