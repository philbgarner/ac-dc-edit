import Modal from './Modal'
import LightEditor from './LightEditor'
import { useData } from '../DataContext'

interface Props {
  onClose: () => void
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  top: 12,
  bottom: 12,
  width: '22rem',
  maxHeight: 'calc(100vh - 24px)',
  zIndex: 50,
  background: '#0e1428',
  border: '1px solid #304080',
  borderRadius: 6,
  color: '#c8d0f8',
  fontFamily: 'monospace',
  fontSize: 13,
  display: 'flex',
  flexDirection: 'column',
}

export default function DungeonLightsModal({ onClose }: Props) {
  const { dungeonLights, setDungeonLights, renderer, selectedCell, selectedCells, rendererSettings } = useData()

  const { tileSize, ceilingHeight, eyeHeightFactor } = rendererSettings
  const cells = selectedCells.length > 0 ? selectedCells : selectedCell ? [selectedCell] : []
  const defaultPosition = cells.length > 0
    ? {
        x: Math.round((cells.reduce((s, c) => s + c.cx, 0) / cells.length * tileSize + tileSize / 2) * 10) / 10,
        y: Math.round(ceilingHeight * eyeHeightFactor * 10) / 10,
        z: Math.round((cells.reduce((s, c) => s + c.cz, 0) / cells.length * tileSize + tileSize / 2) * 10) / 10,
      }
    : undefined

  return (
    <Modal onClose={onClose} title="Dungeon Lights" bare style={panelStyle}>
      {!renderer && (
        <div style={{ color: '#7080b0', fontStyle: 'italic', fontSize: 12, marginBottom: 8 }}>
          Renderer not active — lights will apply once a dungeon is generated.
        </div>
      )}
      <LightEditor lights={dungeonLights} onChange={setDungeonLights} defaultPosition={defaultPosition} />
    </Modal>
  )
}
