import { createContext, useContext, useState, ReactNode } from 'react'
import { createGame } from 'atomic-core'
import type { PackedAtlas, CellInfo, TextureAtlasJson, DungeonRenderer, SurfacePaintTarget } from 'atomic-core'

export type { SurfacePaintTarget }

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
  renderer: DungeonRenderer | null
  setRenderer: (r: DungeonRenderer | null) => void
  atlasEntries: AtlasEntry[]
  setAtlasEntries: (entries: AtlasEntry[]) => void
  atlasConfig: AtlasConfig | null
  setAtlasConfig: (config: AtlasConfig | null) => void
  selectedCell: CellInfo | null
  setSelectedCell: (cell: CellInfo | null) => void
  hoveredCell: CellInfo | null
  setHoveredCell: (cell: CellInfo | null) => void
  /** Per-face surface paint targets, keyed by "cx,cz". */
  cellPaints: Record<string, SurfacePaintTarget>
  setCellPaints: (paints: Record<string, SurfacePaintTarget>) => void
  /** Per-cell height overrides, keyed by "cx,cz". Values are world-unit heights. */
  cellHeights: Record<string, { floor: number; ceil: number }>
  setCellHeights: (heights: Record<string, { floor: number; ceil: number }>) => void
}

const DataContext = createContext<DataContextValue>({
  game: null,
  setGame: () => {},
  renderer: null,
  setRenderer: () => {},
  atlasEntries: [],
  setAtlasEntries: () => {},
  atlasConfig: null,
  setAtlasConfig: () => {},
  selectedCell: null,
  setSelectedCell: () => {},
  hoveredCell: null,
  setHoveredCell: () => {},
  cellPaints: {},
  setCellPaints: () => {},
  cellHeights: {},
  setCellHeights: () => {},
})

export function DataProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameInstance | null>(null)
  const [renderer, setRenderer] = useState<DungeonRenderer | null>(null)
  const [atlasEntries, setAtlasEntries] = useState<AtlasEntry[]>([])
  const [atlasConfig, setAtlasConfig] = useState<AtlasConfig | null>(null)
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null)
  const [cellPaints, setCellPaints] = useState<Record<string, SurfacePaintTarget>>({})
  const [cellHeights, setCellHeights] = useState<Record<string, { floor: number; ceil: number }>>({})

  return (
    <DataContext.Provider value={{
      game, setGame,
      renderer, setRenderer,
      atlasEntries, setAtlasEntries,
      atlasConfig, setAtlasConfig,
      selectedCell, setSelectedCell,
      hoveredCell, setHoveredCell,
      cellPaints, setCellPaints,
      cellHeights, setCellHeights,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
