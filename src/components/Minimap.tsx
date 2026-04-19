import { useEffect, useRef } from 'react'
import { attachMinimap } from 'atomic-core'
import { useData } from '../DataContext'

const SIZE = 180

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { game } = useData()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !game) return

    attachMinimap(game, canvas, {
      size: SIZE,
      showEntities: true,
      colors: {
        explored: '#1e2a40',
        visible: '#6080c0',
        player: '#40e080',
        enemy: '#e04040',
      },
    })
  }, [game])

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        width: SIZE,
        height: SIZE,
        borderRadius: 4,
        border: '1px solid #304080',
        background: '#060c18',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
