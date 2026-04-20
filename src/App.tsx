import DungeonView from './components/DungeonView'
import Toolbar from './components/Toolbar'
import Minimap from './components/Minimap'
import PaintToolbar from './components/PaintToolbar'
import CellDetailsModal from './components/CellDetailsModal'
import MultiCellDetailsModal from './components/MultiCellDetailsModal'
import { useData } from './DataContext'

export default function App() {
  const { selectedCell, setSelectedCell, selectedCells, setSelectedCells, setActiveTool } = useData()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DungeonView />
      <Minimap />
      <PaintToolbar />
      <Toolbar />
      {selectedCells.length > 0
        ? <MultiCellDetailsModal onClose={() => { setSelectedCells([]); setActiveTool(null) }} />
        : selectedCell && <CellDetailsModal onClose={() => setSelectedCell(null)} />
      }
    </div>
  )
}
