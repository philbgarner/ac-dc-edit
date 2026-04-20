import { useEffect, useRef, useCallback } from 'react'
import { createGame, createDungeonRenderer, attachKeybindings } from 'atomic-core'
import type { DungeonRenderer, DungeonRendererOptions, LayerHandle, CellInfo } from 'atomic-core'
import { useData } from '../DataContext'
import type { PaintTool } from '../DataContext'

// ── Geometry helpers ────────────────────────────────────────────────────────

function cell(cx: number, cz: number): CellInfo {
  return { cx, cz, regionId: undefined as unknown as number }
}

function getRectBorderCells(a: CellInfo, b: CellInfo): CellInfo[] {
  const minX = Math.min(a.cx, b.cx), maxX = Math.max(a.cx, b.cx)
  const minZ = Math.min(a.cz, b.cz), maxZ = Math.max(a.cz, b.cz)
  const cells: CellInfo[] = []
  for (let cx = minX; cx <= maxX; cx++)
    for (let cz = minZ; cz <= maxZ; cz++)
      if (cx === minX || cx === maxX || cz === minZ || cz === maxZ)
        cells.push(cell(cx, cz))
  return cells
}

function getFilledRectCells(a: CellInfo, b: CellInfo): CellInfo[] {
  const minX = Math.min(a.cx, b.cx), maxX = Math.max(a.cx, b.cx)
  const minZ = Math.min(a.cz, b.cz), maxZ = Math.max(a.cz, b.cz)
  const cells: CellInfo[] = []
  for (let cx = minX; cx <= maxX; cx++)
    for (let cz = minZ; cz <= maxZ; cz++)
      cells.push(cell(cx, cz))
  return cells
}

function getCircleEdgeCells(center: CellInfo, edge: CellInfo): CellInfo[] {
  const r = Math.sqrt((edge.cx - center.cx) ** 2 + (edge.cz - center.cz) ** 2)
  const seen = new Set<string>()
  const cells: CellInfo[] = []
  const steps = Math.max(32, Math.ceil(2 * Math.PI * r * 3))
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI
    const cx = Math.round(center.cx + r * Math.cos(angle))
    const cz = Math.round(center.cz + r * Math.sin(angle))
    const key = `${cx},${cz}`
    if (!seen.has(key)) { seen.add(key); cells.push(cell(cx, cz)) }
  }
  return cells
}

function getFilledCircleCells(center: CellInfo, edge: CellInfo): CellInfo[] {
  const r = Math.sqrt((edge.cx - center.cx) ** 2 + (edge.cz - center.cz) ** 2)
  const rCeil = Math.ceil(r)
  const cells: CellInfo[] = []
  for (let dz = -rCeil; dz <= rCeil; dz++)
    for (let dx = -rCeil; dx <= rCeil; dx++)
      if (dx * dx + dz * dz <= r * r)
        cells.push(cell(center.cx + dx, center.cz + dz))
  return cells
}

function getFloodFillCells(info: CellInfo, game: ReturnType<typeof createGame> | null): CellInfo[] {
  if (!info.regionId || !game) return [info]
  const outputs = game.dungeon.outputs as { rooms?: Map<number, { rect: { x: number; y: number; w: number; h: number } }> } | null
  if (!outputs) return [info]
  const room = outputs.rooms?.get(info.regionId)
  if (!room) return [info]
  const { x, y, w, h } = room.rect
  const cells: CellInfo[] = []
  for (let cz = y; cz < y + h; cz++)
    for (let cx = x; cx < x + w; cx++)
      cells.push({ cx, cz, regionId: info.regionId })
  return cells
}

// ── Component ───────────────────────────────────────────────────────────────

export default function DungeonView() {
  const {
    setGame, game, atlasConfig,
    setSelectedCell, setHoveredCell,
    setRenderer, rendererSettings,
    activeTool, selectedCells, setSelectedCells,
  } = useData()

  const viewportRef = useRef<HTMLDivElement>(null)
  const hoverHandleRef = useRef<LayerHandle | null>(null)
  const selectHandleRef = useRef<LayerHandle | null>(null)
  const rendererRef = useRef<DungeonRenderer | null>(null)
  const activeToolRef = useRef<PaintTool | null>(null)
  const selectedCellsRef = useRef<Map<string, CellInfo>>(new Map())
  const pendingCellRef = useRef<CellInfo | null>(null)
  const gameRef = useRef(game)

  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])

  const refreshSelectHighlight = useCallback(() => {
    selectHandleRef.current?.remove()
    selectHandleRef.current = null
    const r = rendererRef.current
    if (!r) return
    const cellMap = selectedCellsRef.current
    const pending = pendingCellRef.current
    if (cellMap.size === 0 && !pending) return
    selectHandleRef.current = r.highlightCells((cx, cz) => {
      if (cellMap.has(`${cx},${cz}`)) return 'rgba(255, 230, 20, 0.5)'
      if (pending && cx === pending.cx && cz === pending.cz) return 'rgba(0, 220, 80, 0.6)'
      return null
    })
  }, [])

  useEffect(() => {
    selectedCellsRef.current = new Map(selectedCells.map(c => [`${c.cx},${c.cz}`, c]))
    refreshSelectHighlight()
  }, [selectedCells, refreshSelectHighlight])

  // Clear pending first-click when tool changes
  useEffect(() => {
    pendingCellRef.current = null
    refreshSelectHighlight()
  }, [activeTool, refreshSelectHighlight])

  // Effect 1: create game, generate dungeon, attach keybindings — runs once
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const g = createGame(document.body, {
      dungeon: {
        width: 40,
        height: 40,
        seed: 0xdeadbeef,
        minRoomSize: 5,
        maxRoomSize: 11,
      },
      player: { hp: 30, maxHp: 30, attack: 5, defense: 2, speed: 5 },
    })

    g.generate()
    setGame(g)

    attachKeybindings(g, {
      bindings: {
        moveForward: ['w', 'W', 'ArrowUp'],
        moveBackward: ['s', 'S', 'ArrowDown'],
        moveLeft: ['a', 'A', 'ArrowLeft'],
        moveRight: ['d', 'D', 'ArrowRight'],
        turnLeft: ['q', 'Q'],
        turnRight: ['e', 'E'],
        wait: [' '],
      },
      onAction(action, event) {
        event.preventDefault()
        if (!g.player.alive) return
        const yaw = g.player.facing
        const fx = Math.round(-Math.sin(yaw))
        const fz = Math.round(-Math.cos(yaw))
        const sx = Math.round(Math.cos(yaw))
        const sz = Math.round(-Math.sin(yaw))
        function relativeMove(fwd: number, strafe: number) {
          return g.player.move(fwd * fx + strafe * sx, fwd * fz + strafe * sz)
        }
        let a
        switch (action) {
          case 'moveForward':  a = relativeMove(1, 0); break
          case 'moveBackward': a = relativeMove(-1, 0); break
          case 'moveLeft':     a = relativeMove(0, -1); break
          case 'moveRight':    a = relativeMove(0, 1); break
          case 'turnLeft':     a = g.player.rotate(Math.PI / 2); break
          case 'turnRight':    a = g.player.rotate(-Math.PI / 2); break
          case 'wait':         a = g.player.wait(); break
        }
        if (a) g.turns.commit(a)
      },
    })
  }, [])

  // Effect 2: create renderer when game is ready; recreate when atlas or settings change
  useEffect(() => {
    const el = viewportRef.current
    if (!el || !game) return

    let renderer: DungeonRenderer

    const atlasOptions: DungeonRendererOptions = atlasConfig
      ? {
          packedAtlas: atlasConfig.packed,
          tileNameResolver: atlasConfig.resolver,
          floorTile: atlasConfig.floorTile,
          ceilTile: atlasConfig.ceilTile,
          wallTile: atlasConfig.wallTile,
          ...(atlasConfig.floorSkirtTile ? {
            floorSkirtTiles: {
              north: { tile: atlasConfig.floorSkirtTile },
              south: { tile: atlasConfig.floorSkirtTile },
              east:  { tile: atlasConfig.floorSkirtTile },
              west:  { tile: atlasConfig.floorSkirtTile },
            },
          } : {}),
          ...(atlasConfig.ceilSkirtTile ? {
            ceilSkirtTiles: {
              north: { tile: atlasConfig.ceilSkirtTile },
              south: { tile: atlasConfig.ceilSkirtTile },
              east:  { tile: atlasConfig.ceilSkirtTile },
              west:  { tile: atlasConfig.ceilSkirtTile },
            },
          } : {}),
        }
      : {}

    const initTimer = setTimeout(() => game.events.emit('turn', { turn: 0 }), 0)

    renderer = createDungeonRenderer(el, game, {
      ...atlasOptions,
      ...rendererSettings,

      onCellHover(info) {
        hoverHandleRef.current?.remove()
        hoverHandleRef.current = null
        if (!info) { setHoveredCell(null); return }
        setHoveredCell(info)
        hoverHandleRef.current = renderer.highlightCells((cx, cz) =>
          cx === info.cx && cz === info.cz ? 'rgba(20, 80, 255, 0.55)' : null,
        )
      },

      onCellClick(info) {
        const tool = activeToolRef.current

        if (!tool) {
          // Default: single-cell selection, clear multi-selection
          setSelectedCells([])
          setSelectedCell(info)
          // Single-cell highlight via refreshSelectHighlight after state update
          selectHandleRef.current?.remove()
          selectHandleRef.current = renderer.highlightCells((cx, cz) =>
            cx === info.cx && cz === info.cz ? 'rgba(255, 230, 20, 0.5)' : null,
          )
          return
        }

        // Clear single-cell selection when using tools
        setSelectedCell(null)

        const pending = pendingCellRef.current

        if (tool === 'pencil') {
          const key = `${info.cx},${info.cz}`
          const next = new Map(selectedCellsRef.current)
          if (next.has(key)) next.delete(key)
          else next.set(key, info)
          setSelectedCells(Array.from(next.values()))
          return
        }

        if (tool === 'floodFill') {
          setSelectedCells(getFloodFillCells(info, gameRef.current))
          return
        }

        // Two-click tools
        if (!pending) {
          pendingCellRef.current = info
          refreshSelectHighlight()
          return
        }

        pendingCellRef.current = null
        let cells: CellInfo[]
        if (tool === 'rect') cells = getRectBorderCells(pending, info)
        else if (tool === 'filledRect') cells = getFilledRectCells(pending, info)
        else if (tool === 'circle') cells = getCircleEdgeCells(pending, info)
        else cells = getFilledCircleCells(pending, info)
        setSelectedCells(cells)
      },
    })

    rendererRef.current = renderer
    setRenderer(renderer)

    // Restore selection highlight after renderer recreate
    refreshSelectHighlight()

    return () => {
      clearTimeout(initTimer)
      hoverHandleRef.current?.remove()
      selectHandleRef.current?.remove()
      hoverHandleRef.current = null
      selectHandleRef.current = null
      rendererRef.current = null
      setRenderer(null)
      renderer.destroy()
    }
  }, [game, atlasConfig, rendererSettings])

  return (
    <div
      ref={viewportRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
