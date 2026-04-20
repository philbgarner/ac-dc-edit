import { useState } from 'react'
import Modal from './Modal'
import OverlayPaintModal from './OverlayPaintModal'
import { useData } from '../DataContext'

const OFFSET_NEUTRAL = 128
const OFFSET_STEP_MIN = -10, OFFSET_STEP_MAX = 10

interface SliderRowProps {
  label: string
  steps: number
  isPit?: boolean
  onChange: (steps: number) => void
  onPitToggle?: () => void
}

function SliderRow({ label, steps, isPit, onChange, onPitToggle }: SliderRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#7080b0', minWidth: 120 }}>{label}</span>
      <input
        type="range" min={OFFSET_STEP_MIN} max={OFFSET_STEP_MAX} step={1}
        value={isPit ? OFFSET_STEP_MIN : steps}
        disabled={isPit}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#5870d0' }}
      />
      {isPit
        ? <span style={{ color: '#e06060', minWidth: 46, textAlign: 'right', fontSize: 11 }}>pit</span>
        : <span style={{ color: '#e0e8ff', minWidth: 46, textAlign: 'right' }}>{steps > 0 ? `+${steps}` : steps}</span>
      }
      {onPitToggle && (
        <button
          onClick={onPitToggle}
          title={isPit ? 'Remove pit' : 'Set as pit'}
          style={{
            background: isPit ? '#502020' : 'none', border: `1px solid ${isPit ? '#804040' : '#304060'}`,
            borderRadius: 3, color: isPit ? '#e06060' : '#8090c0', cursor: 'pointer',
            fontSize: 11, padding: '1px 5px', lineHeight: 1.4, flexShrink: 0,
          }}
        >pit</button>
      )}
    </div>
  )
}

interface SectionProps { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color: '#5870d0', fontWeight: 'bold', marginBottom: 2, borderBottom: '1px solid #203060', paddingBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

interface Props {
  onClose: () => void
}

export default function MultiCellDetailsModal({ onClose }: Props) {
  const { selectedCells, game, cellHeights, setCellHeights, renderer } = useData()
  const [floorSteps, setFloorSteps] = useState(0)
  const [ceilSteps, setCeilSteps] = useState(0)
  const [floorIsPit, setFloorIsPit] = useState(false)
  const [paintOpen, setPaintOpen] = useState(false)

  if (selectedCells.length === 0) return null

  const outputs = game?.dungeon.outputs
  const width = outputs?.width ?? 0
  const texFloor = outputs?.textures.floorHeightOffset
  const texCeil = outputs?.textures.ceilingHeightOffset

  function writeAllFloor(r8: number) {
    if (texFloor?.image.data) {
      for (const { cx, cz } of selectedCells)
        (texFloor.image.data as Uint8Array)[cz * width + cx] = r8
    }
    const next = { ...cellHeights }
    for (const { cx, cz } of selectedCells) {
      const key = `${cx},${cz}`
      next[key] = { floor: r8, ceil: next[key]?.ceil ?? OFFSET_NEUTRAL }
    }
    setCellHeights(next)
    renderer?.rebuild()
  }

  function writeAllCeil(r8: number) {
    if (texCeil?.image.data) {
      for (const { cx, cz } of selectedCells)
        (texCeil.image.data as Uint8Array)[cz * width + cx] = r8
    }
    const next = { ...cellHeights }
    for (const { cx, cz } of selectedCells) {
      const key = `${cx},${cz}`
      next[key] = { floor: next[key]?.floor ?? OFFSET_NEUTRAL, ceil: r8 }
    }
    setCellHeights(next)
    renderer?.rebuild()
  }

  // Bounding box of selection for display
  const minX = Math.min(...selectedCells.map(c => c.cx))
  const maxX = Math.max(...selectedCells.map(c => c.cx))
  const minZ = Math.min(...selectedCells.map(c => c.cz))
  const maxZ = Math.max(...selectedCells.map(c => c.cz))

  const firstCell = selectedCells[0]

  return (
    <>
      <Modal
        onClose={onClose}
        title={`Selection (${selectedCells.length} cells)`}
        bare
        style={{
          position: 'fixed',
          left: 12,
          top: 12,
          bottom: 12,
          minWidth: 280,
          maxWidth: 340,
          maxHeight: 'calc(100vh - 24px)',
          zIndex: 50,
        }}
      >
        <Section title="Selection">
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#7080b0', minWidth: 120 }}>Cell count</span>
            <span style={{ color: '#e0e8ff' }}>{selectedCells.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#7080b0', minWidth: 120 }}>X range</span>
            <span style={{ color: '#e0e8ff' }}>{minX} – {maxX}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#7080b0', minWidth: 120 }}>Z range</span>
            <span style={{ color: '#e0e8ff' }}>{minZ} – {maxZ}</span>
          </div>
        </Section>

        {outputs && (texFloor || texCeil) && (
          <Section title="Height Offsets (all cells)">
            <SliderRow
              label="Floor offset"
              steps={floorSteps}
              isPit={floorIsPit}
              onChange={s => { setFloorSteps(s); writeAllFloor(Math.max(1, OFFSET_NEUTRAL + s)) }}
              onPitToggle={() => {
                const next = !floorIsPit
                setFloorIsPit(next)
                writeAllFloor(next ? 0 : OFFSET_NEUTRAL)
              }}
            />
            <SliderRow
              label="Ceiling offset"
              steps={ceilSteps}
              onChange={s => { setCeilSteps(s); writeAllCeil(OFFSET_NEUTRAL - s) }}
            />
          </Section>
        )}

        {outputs && (
          <Section title="Surface Layers (all cells)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#7080b0', flex: 1, fontSize: 12 }}>
                Apply paint layers to all {selectedCells.length} selected cells
              </span>
              <button
                onClick={() => setPaintOpen(true)}
                title="Edit surface layers for all selected cells"
                style={{
                  background: 'none', border: '1px solid #304060', borderRadius: 3,
                  color: '#8090c0', cursor: 'pointer', fontSize: 12,
                  padding: '1px 7px', lineHeight: 1.4, flexShrink: 0,
                }}
              >
                …
              </button>
            </div>
          </Section>
        )}

        {!outputs && (
          <div style={{ color: '#7080b0', fontStyle: 'italic' }}>
            Generate a dungeon first to enable height and layer editing.
          </div>
        )}
      </Modal>

      {paintOpen && firstCell && (
        <OverlayPaintModal
          cx={firstCell.cx}
          cz={firstCell.cz}
          cells={selectedCells}
          onClose={() => setPaintOpen(false)}
        />
      )}
    </>
  )
}
