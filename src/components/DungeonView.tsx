import { useEffect, useRef } from 'react'
import { createGame, createDungeonRenderer, attachKeybindings } from 'atomic-core'
import { useData } from '../DataContext'

export default function DungeonView() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const { setGame } = useData()

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const game = createGame(document.body, {
      dungeon: {
        width: 40,
        height: 40,
        seed: 0xdeadbeef,
        roomMinSize: 5,
        roomMaxSize: 11,
        roomCount: 12,
      },
      player: { hp: 30, maxHp: 30, attack: 5, defense: 2, speed: 5 },
    })

    setGame(game)

    const atlasImg = new Image()
    atlasImg.onload = () => {
      createDungeonRenderer(el, game, {
        atlas: {
          image: atlasImg,
          tileWidth: 64,
          tileHeight: 64,
          sheetWidth: 512,
          sheetHeight: 1024,
          columns: 8,
        },
        floorTileId: 20,
        ceilTileId: 19,
        wallTileId: 16,
      })
      game.generate()
    }
    atlasImg.src = '/atlas.png'

    attachKeybindings(game, {
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
        if (!game.player.alive) return
        const yaw = game.player.facing
        const fx = Math.round(-Math.sin(yaw))
        const fz = Math.round(-Math.cos(yaw))
        const sx = Math.round(Math.cos(yaw))
        const sz = Math.round(-Math.sin(yaw))
        function relativeMove(fwd: number, strafe: number) {
          return game.player.move(fwd * fx + strafe * sx, fwd * fz + strafe * sz)
        }
        let a
        switch (action) {
          case 'moveForward': a = relativeMove(1, 0); break
          case 'moveBackward': a = relativeMove(-1, 0); break
          case 'moveLeft': a = relativeMove(0, -1); break
          case 'moveRight': a = relativeMove(0, 1); break
          case 'turnLeft': a = game.player.rotate(Math.PI / 2); break
          case 'turnRight': a = game.player.rotate(-Math.PI / 2); break
          case 'wait': a = game.player.wait(); break
        }
        if (a) game.turns.commit(a)
      },
    })

    return () => {
      // atomic-core does not expose a destroy API; clearing innerHTML cleans up the canvas
      el.innerHTML = ''
    }
  }, [])

  return (
    <div
      ref={viewportRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
