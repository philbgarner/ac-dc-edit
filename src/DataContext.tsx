import { createContext, useContext, useState, ReactNode } from 'react'
import { createGame } from 'atomic-core'
import type { PackedAtlas, CellInfo, TextureAtlasJson } from 'atomic-core'

type GameInstance = ReturnType<typeof createGame>

export type { CellInfo }

export interface AtlasEntry {
  id: string
  pngName: string
  jsonName: string
  objectUrl: string
  json: TextureAtlasJson
  spriteNames: string[]
}

export interface AtlasConfig {
  packed: PackedAtlas
  resolver: (name: string) => number
  spriteNames: string[]  // union across all entries, later entries win on duplicates
  floorTile: string
  wallTile: string
  ceilTile: string
}

interface DataContextValue {
  game: GameInstance | null
  setGame: (game: GameInstance) => void
  atlasEntries: AtlasEntry[]
  setAtlasEntries: (entries: AtlasEntry[]) => void
  atlasConfig: AtlasConfig | null
  setAtlasConfig: (config: AtlasConfig | null) => void
  selectedCell: CellInfo | null
  setSelectedCell: (cell: CellInfo | null) => void
  hoveredCell: CellInfo | null
  setHoveredCell: (cell: CellInfo | null) => void
}

const DataContext = createContext<DataContextValue>({
  game: null,
  setGame: () => {},
  atlasEntries: [],
  setAtlasEntries: () => {},
  atlasConfig: null,
  setAtlasConfig: () => {},
  selectedCell: null,
  setSelectedCell: () => {},
  hoveredCell: null,
  setHoveredCell: () => {},
})

export function DataProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameInstance | null>(null)
  const [atlasEntries, setAtlasEntries] = useState<AtlasEntry[]>([])
  const [atlasConfig, setAtlasConfig] = useState<AtlasConfig | null>(null)
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null)

  return (
    <DataContext.Provider value={{
      game, setGame,
      atlasEntries, setAtlasEntries,
      atlasConfig, setAtlasConfig,
      selectedCell, setSelectedCell,
      hoveredCell, setHoveredCell,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
