import { useState } from 'react'
import DungeonView from './components/DungeonView'
import Toolbar from './components/Toolbar'
import Minimap from './components/Minimap'
import PaintToolbar from './components/PaintToolbar'
import CellDetailsModal from './components/CellDetailsModal'
import MultiCellDetailsModal from './components/MultiCellDetailsModal'
import TopDownEditorModal from './components/TopDownEditorModal'
import { useData } from './DataContext'

export default function App() {
  const { selectedCell, setSelectedCell, selectedCells, setSelectedCells, setActiveTool } = useData()
  const [showMapEditor, setShowMapEditor] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DungeonView />
      <Minimap />
      <PaintToolbar />
      <Toolbar onOpenMapEditor={() => setShowMapEditor(true)} />
      {selectedCells.length > 0
        ? <MultiCellDetailsModal onClose={() => { setSelectedCells([]); setActiveTool(null) }} />
        : selectedCell && <CellDetailsModal onClose={() => setSelectedCell(null)} />
      }
      {showMapEditor && <TopDownEditorModal onClose={() => setShowMapEditor(false)} />}
    </div>
  )
}
