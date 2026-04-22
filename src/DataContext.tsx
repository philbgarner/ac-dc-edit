import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { createGame, loadMultiAtlas, packedAtlasResolver } from "atomic-core";
import type {
  PackedAtlas,
  CellInfo,
  TextureAtlasJson,
  DungeonRenderer,
  SurfacePaintTarget,
  ImportResult,
} from "atomic-core";

export type GeneratorOptions = ImportResult["generatorOptions"];
import {
  loadSettings,
  saveSettings,
  loadAtlasEntries,
  saveAtlasEntries,
  loadTileAssignments,
  saveTileAssignments,
} from "./persistence";

export type { SurfacePaintTarget };

/** Mirrors atomic-core's ObjectPlacement — a static decoration placed in a cell. */
export interface DecorationPlacement {
  x: number
  z: number
  type: string
  sprite: string
  offsetX?: number
  offsetZ?: number
  offsetY?: number
  yaw?: number
  scale?: number
  blocksMove?: boolean
  /** Runtime id of the live DecorationEntity in game.dungeon.decorations, if synced. */
  _entityId?: string
}

export interface CellSkirtTarget {
  floor?: string[]
  ceil?: string[]
}

/** Maps bit values (8, 16, 32, 64, 128) to user-defined names. */
export type CustomFlagNames = Record<number, string>

export type PaintTool = 'pencil' | 'rect' | 'filledRect' | 'circle' | 'filledCircle' | 'floodFill'

export interface RendererSettings {
  fov: number;
  tileSize: number;
  ceilingHeight: number;
  fogNear: number;
  fogFar: number;
  fogColor: string;
  lerpFactor: number;
  offsetFactor: number;
  eyeHeightFactor: number;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
  fov: 75,
  tileSize: 3,
  ceilingHeight: 3,
  fogNear: 5,
  fogFar: 24,
  fogColor: "#000000",
  lerpFactor: 0.18,
  offsetFactor: 1 / 12,
  eyeHeightFactor: 0.66,
};

type GameInstance = ReturnType<typeof createGame>;

export type { CellInfo };

export interface AtlasEntry {
  id: string;
  pngName: string;
  jsonName: string;
  objectUrl: string;
  pngBlob: Blob;
  json: TextureAtlasJson;
  spriteNames: string[];
}

export interface AtlasConfig {
  packed: PackedAtlas;
  resolver: (name: string) => number;
  spriteNames: string[]; // union across all entries, later entries win on duplicates
  floorTile: string;
  wallTile: string;
  ceilTile: string;
  floorSkirtTile: string;
  ceilSkirtTile: string;
}

interface DataContextValue {
  game: GameInstance | null;
  setGame: (game: GameInstance) => void;
  renderer: DungeonRenderer | null;
  setRenderer: (r: DungeonRenderer | null) => void;
  atlasEntries: AtlasEntry[];
  setAtlasEntries: (entries: AtlasEntry[]) => void;
  atlasConfig: AtlasConfig | null;
  setAtlasConfig: (config: AtlasConfig | null) => void;
  packedAtlasUrl: string | null;
  selectedCell: CellInfo | null;
  setSelectedCell: (cell: CellInfo | null) => void;
  hoveredCell: CellInfo | null;
  setHoveredCell: (cell: CellInfo | null) => void;
  /** Per-face surface paint targets, keyed by "cx,cz". */
  cellPaints: Record<string, SurfacePaintTarget>;
  setCellPaints: (paints: Record<string, SurfacePaintTarget>) => void;
  /**
   * Per-cell height offset overrides, keyed by "cx,cz".
   * Stores R8 byte values matching DungeonOutputs texture encoding:
   * floor — 128 = neutral, 129+ = raised, 127– = lowered, 0 = pit
   * ceil  — 128 = neutral, 127 = raised, 129+ = lowered (inverted)
   * Used as a fallback store when textures are absent; textures are the authoritative source.
   */
  cellHeights: Record<string, { floor: number; ceil: number }>;
  setCellHeights: (
    heights: Record<string, { floor: number; ceil: number }>,
  ) => void;
  rendererSettings: RendererSettings;
  setRendererSettings: (settings: RendererSettings) => void;
  activeTool: PaintTool | null;
  setActiveTool: (tool: PaintTool | null) => void;
  selectedCells: CellInfo[];
  setSelectedCells: (cells: CellInfo[]) => void;
  cellSkirts: Record<string, CellSkirtTarget>;
  setCellSkirts: (skirts: Record<string, CellSkirtTarget>) => void;
  /** Per-cell collider flag overrides, keyed by "cx,cz". Stores raw R8 byte. Fallback when texture absent. */
  cellColliderFlags: Record<string, number>;
  setCellColliderFlags: (flags: Record<string, number>) => void;
  /** User-defined names for custom flag bits (8, 16, 32, 64, 128). */
  customFlagNames: Record<number, string>;
  setCustomFlagNames: (names: Record<number, string>) => void;
  /** Per-cell decoration placements, keyed by "cx,cz". */
  cellDecorations: Record<string, DecorationPlacement[]>;
  setCellDecorations: (decorations: Record<string, DecorationPlacement[]>) => void;
  generatorOptions: GeneratorOptions | null;
  setGeneratorOptions: (opts: GeneratorOptions | null) => void;
  importRequest: { options: GeneratorOptions; seq: number; importResult?: ImportResult } | null;
  setImportRequest: (req: { options: GeneratorOptions; seq: number; importResult?: ImportResult } | null) => void;
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
  packedAtlasUrl: null,
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
  activeTool: null,
  setActiveTool: () => {},
  selectedCells: [],
  setSelectedCells: () => {},
  cellSkirts: {},
  setCellSkirts: () => {},
  cellColliderFlags: {},
  setCellColliderFlags: () => {},
  customFlagNames: {},
  setCustomFlagNames: () => {},
  cellDecorations: {},
  setCellDecorations: () => {},
  generatorOptions: null,
  setGeneratorOptions: () => {},
  importRequest: null,
  setImportRequest: () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameInstance | null>(null);
  const [renderer, setRenderer] = useState<DungeonRenderer | null>(null);
  const [atlasEntries, setAtlasEntries] = useState<AtlasEntry[]>([]);
  const [atlasConfig, setAtlasConfig] = useState<AtlasConfig | null>(null);
  const [packedAtlasUrl, setPackedAtlasUrl] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [cellPaints, setCellPaints] = useState<
    Record<string, SurfacePaintTarget>
  >({});
  const [cellHeights, setCellHeights] = useState<
    Record<string, { floor: number; ceil: number }>
  >({});
  const [rendererSettings, setRendererSettings] = useState<RendererSettings>(
    () => loadSettings() ?? DEFAULT_RENDERER_SETTINGS,
  );
  const [activeTool, setActiveTool] = useState<PaintTool | null>(null);
  const [selectedCells, setSelectedCells] = useState<CellInfo[]>([]);
  const [cellSkirts, setCellSkirts] = useState<Record<string, CellSkirtTarget>>({});
  const [cellColliderFlags, setCellColliderFlags] = useState<Record<string, number>>({});
  const [customFlagNames, setCustomFlagNames] = useState<Record<number, string>>({});
  const [cellDecorations, setCellDecorations] = useState<Record<string, DecorationPlacement[]>>({});
  const [generatorOptions, setGeneratorOptions] = useState<GeneratorOptions | null>(null);
  const [importRequest, setImportRequest] = useState<{ options: GeneratorOptions; seq: number; importResult?: ImportResult } | null>(null);

  useEffect(() => {
    if (!atlasConfig) { setPackedAtlasUrl(null); return; }
    const canvas = atlasConfig.packed.texture;
    let url: string;
    let revoked = false;
    (async () => {
      let blob: Blob;
      if (canvas instanceof HTMLCanvasElement) {
        blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!)));
      } else {
        blob = await (canvas as OffscreenCanvas).convertToBlob();
      }
      if (revoked) return;
      url = URL.createObjectURL(blob);
      setPackedAtlasUrl(url);
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [atlasConfig]);

  // Prevent saving empty state before the initial IndexedDB load completes.
  const storageLoadedRef = useRef(false);

  // Restore atlas entries and config from IndexedDB on mount.
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadAtlasEntries();
        if (stored.length === 0) {
          storageLoadedRef.current = true;
          return;
        }
        const entries: AtlasEntry[] = stored.map((s) => ({
          ...s,
          objectUrl: URL.createObjectURL(s.pngBlob),
        }));
        storageLoadedRef.current = true;
        setAtlasEntries(entries);

        const tiles = loadTileAssignments();
        if (!tiles) return;
        const { floorTile, wallTile, ceilTile, floorSkirtTile = '', ceilSkirtTile = '' } = tiles;
        const sources = entries.map((e) => ({
          imageUrl: e.objectUrl,
          atlasJson: e.json,
        }));
        const packed = await loadMultiAtlas(sources, {
          showLoadingScreen: false,
        });
        const resolver = packedAtlasResolver(packed);
        const spriteNames = [
          ...new Set(entries.flatMap((e) => e.spriteNames)),
        ].sort();
        setAtlasConfig({ packed, resolver, spriteNames, floorTile, wallTile, ceilTile, floorSkirtTile, ceilSkirtTile });
      } catch (e) {
        console.warn("Failed to restore atlas from storage:", e);
        storageLoadedRef.current = true;
      }
    })();
  }, []);

  // Persist renderer settings whenever they change.
  useEffect(() => {
    saveSettings(rendererSettings);
  }, [rendererSettings]);

  // Persist atlas entries whenever they change (skip until initial load done).
  useEffect(() => {
    if (!storageLoadedRef.current) return;
    saveAtlasEntries(
      atlasEntries.map(({ id, pngName, jsonName, pngBlob, json, spriteNames }) => ({
        id,
        pngName,
        jsonName,
        pngBlob,
        json,
        spriteNames,
      })),
    );
  }, [atlasEntries]);

  // Persist tile assignments whenever atlasConfig changes.
  useEffect(() => {
    if (!atlasConfig) return;
    saveTileAssignments({
      floorTile: atlasConfig.floorTile,
      wallTile: atlasConfig.wallTile,
      ceilTile: atlasConfig.ceilTile,
      floorSkirtTile: atlasConfig.floorSkirtTile,
      ceilSkirtTile: atlasConfig.ceilSkirtTile,
    });
  }, [atlasConfig]);

  return (
    <DataContext.Provider
      value={{
        game,
        setGame,
        renderer,
        setRenderer,
        atlasEntries,
        setAtlasEntries,
        atlasConfig,
        setAtlasConfig,
        packedAtlasUrl,
        selectedCell,
        setSelectedCell,
        hoveredCell,
        setHoveredCell,
        cellPaints,
        setCellPaints,
        cellHeights,
        setCellHeights,
        rendererSettings,
        setRendererSettings,
        activeTool,
        setActiveTool,
        selectedCells,
        setSelectedCells,
        cellSkirts,
        setCellSkirts,
        cellColliderFlags,
        setCellColliderFlags,
        customFlagNames,
        setCustomFlagNames,
        cellDecorations,
        setCellDecorations,
        generatorOptions,
        setGeneratorOptions,
        importRequest,
        setImportRequest,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
