import { useData } from '../DataContext'
import type { PaintTool } from '../DataContext'

const MINIMAP_SIZE = 180
const MINIMAP_TOP = 16

interface ToolDef {
  id: PaintTool
  icon: string
  label: string
  title: string
}

const TOOLS: ToolDef[] = [
  { id: 'pencil',      icon: '✏',  label: 'Pencil',    title: 'Click cells to toggle selection' },
  { id: 'rect',        icon: '▭',  label: 'Rect',      title: 'Click two corners: rectangle border' },
  { id: 'filledRect',  icon: '▬',  label: 'Fill Rect', title: 'Click two corners: filled rectangle' },
  { id: 'circle',      icon: '○',  label: 'Circle',    title: 'Click center then edge: circle outline' },
  { id: 'filledCircle',icon: '●',  label: 'Fill Circ', title: 'Click center then edge: filled circle' },
  { id: 'floodFill',   icon: '⬛', label: 'Room',      title: 'Click a cell to select its entire room' },
]

export default function PaintToolbar() {
  const { activeTool, setActiveTool, setSelectedCells } = useData()

  function selectTool(id: PaintTool) {
    setActiveTool(activeTool === id ? null : id)
  }

  function clearAll() {
    setActiveTool(null)
    setSelectedCells([])
  }

  return (
    <div style={{
      position: 'fixed',
      top: MINIMAP_TOP + MINIMAP_SIZE + 8,
      right: 16,
      width: MINIMAP_SIZE,
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#5870d0', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
          Select Tool
        </span>
        {(activeTool || true) && (
          <button
            onClick={clearAll}
            style={{
              background: 'none', border: 'none', color: '#506080',
              cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1,
            }}
          >
            clear
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {TOOLS.map(t => {
          const active = activeTool === t.id
          return (
            <button
              key={t.id}
              title={t.title}
              onClick={() => selectTool(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 2,
                padding: '6px 2px',
                background: active ? '#1a3080' : '#0d1020',
                border: `1px solid ${active ? '#4060c0' : '#203060'}`,
                borderRadius: 4, cursor: 'pointer',
                color: active ? '#d0e0ff' : '#8090c0',
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: 9, lineHeight: 1 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
      {activeTool && (
        <div style={{ color: '#506080', fontSize: 10, textAlign: 'center' }}>
          {activeTool === 'pencil' && 'Click cells to add/remove'}
          {activeTool === 'floodFill' && 'Click a cell to select its room'}
          {(activeTool === 'rect' || activeTool === 'filledRect') && 'Click corner 1, then corner 2'}
          {(activeTool === 'circle' || activeTool === 'filledCircle') && 'Click center, then edge'}
        </div>
      )}
    </div>
  )
}
