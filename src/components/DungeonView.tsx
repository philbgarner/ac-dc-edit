import { useEffect, useRef } from 'react'
import { createGame, createDungeonRenderer, attachKeybindings } from 'atomic-core'
import type { DungeonRenderer, DungeonRendererOptions, LayerHandle } from 'atomic-core'
import { useData } from '../DataContext'

export default function DungeonView() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const { setGame, game, atlasConfig, setSelectedCell, setHoveredCell, setRenderer, rendererSettings } = useData()

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
    let hoverHandle: LayerHandle | null = null
    let selectHandle: LayerHandle | null = null

    const atlasOptions: DungeonRendererOptions = atlasConfig
      ? {
          packedAtlas: atlasConfig.packed,
          tileNameResolver: atlasConfig.resolver,
          floorTile: atlasConfig.floorTile,
          ceilTile: atlasConfig.ceilTile,
          wallTile: atlasConfig.wallTile,
        }
      : {}

    // Emit a synthetic turn so the renderer initialises its camera position
    // and the minimap draws its initial state. Deferred to the next event-loop
    // tick so sibling effects (e.g. attachMinimap in Minimap) are registered first.
    const initTimer = setTimeout(() => game.events.emit('turn', { turn: 0 }), 0)

    renderer = createDungeonRenderer(el, game, {
      ...atlasOptions,
      ...rendererSettings,

      onCellHover(info) {
        if (hoverHandle) { hoverHandle.remove(); hoverHandle = null }
        if (!info) { setHoveredCell(null); return }
        setHoveredCell(info)
        hoverHandle = renderer.highlightCells((cx, cz) =>
          cx === info.cx && cz === info.cz ? 'rgba(20, 80, 255, 0.55)' : null,
        )
      },

      onCellClick(info) {
        if (selectHandle) { selectHandle.remove(); selectHandle = null }
        setSelectedCell(info)
        selectHandle = renderer.highlightCells((cx, cz) =>
          cx === info.cx && cz === info.cz ? 'rgba(255, 230, 20, 0.5)' : null,
        )
      },
    })

    setRenderer(renderer)

    return () => {
      clearTimeout(initTimer)
      hoverHandle?.remove()
      selectHandle?.remove()
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
