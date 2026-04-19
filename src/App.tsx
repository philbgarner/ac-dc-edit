import DungeonView from './components/DungeonView'
import Toolbar from './components/Toolbar'

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DungeonView />
      <Toolbar />
    </div>
  )
}
