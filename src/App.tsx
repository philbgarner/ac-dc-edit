import DungeonView from './components/DungeonView'
import Toolbar from './components/Toolbar'
import Minimap from './components/Minimap'
import CellDetailsModal from './components/CellDetailsModal'
import { useData } from './DataContext'

export default function App() {
  const { selectedCell, setSelectedCell } = useData()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DungeonView />
      <Minimap />
      <Toolbar />
      {selectedCell && <CellDetailsModal onClose={() => setSelectedCell(null)} />}
    </div>
  )
}
