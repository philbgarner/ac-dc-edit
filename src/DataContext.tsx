import { createContext, useContext, useState, ReactNode } from 'react'
import { createGame } from 'atomic-core'
import type { PackedAtlas, CellInfo, TextureAtlasJson, DungeonRenderer, SurfacePaintTarget } from 'atomic-core'

export type { SurfacePaintTarget }

export interface RendererSettings {
  fov: number
  tileSize: number
  ceilingHeight: number
  fogNear: number
  fogFar: number
  fogColor: string
  lerpFactor: number
  offsetFactor: number
  eyeHeightFactor: number
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  fov: 75,
  tileSize: 3,
  ceilingHeight: 3,
  fogNear: 5,
  fogFar: 24,
  fogColor: '#000000',
  lerpFactor: 0.18,
  offsetFactor: 0.5,
  eyeHeightFactor: 0.66,
}

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
  /**
   * Per-cell height offset overrides, keyed by "cx,cz".
   * Stores R8 byte values matching DungeonOutputs texture encoding:
   * floor — 128 = neutral, 129+ = raised, 127– = lowered, 0 = pit
   * ceil  — 128 = neutral, 127 = raised, 129+ = lowered (inverted)
   * Used as a fallback store when textures are absent; textures are the authoritative source.
   */
  cellHeights: Record<string, { floor: number; ceil: number }>
  setCellHeights: (heights: Record<string, { floor: number; ceil: number }>) => void
  rendererSettings: RendererSettings
  setRendererSettings: (settings: RendererSettings) => void
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
  rendererSettings: DEFAULT_RENDERER_SETTINGS,
  setRendererSettings: () => {},
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
  const [rendererSettings, setRendererSettings] = useState<RendererSettings>(DEFAULT_RENDERER_SETTINGS)

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
      rendererSettings, setRendererSettings,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
