import { useState } from 'react'
import AtlasImportModal from './AtlasImportModal'

export default function Toolbar() {
  const [showImport, setShowImport] = useState(false)

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid #304080',
          borderRadius: 4,
          padding: '8px 16px',
          color: '#c8d0f8',
          fontFamily: 'monospace',
          fontSize: 12,
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      >
        <span>WASD/Arrows: move</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>Q/E: turn</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>Space: wait</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <button
          onClick={() => setShowImport(true)}
          style={{
            background: '#1a2040',
            border: '1px solid #4060c0',
            borderRadius: 3,
            color: '#c8d0f8',
            padding: '3px 10px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Import Atlas
        </button>
      </div>

      {showImport && <AtlasImportModal onClose={() => setShowImport(false)} />}
    </>
  )
}
