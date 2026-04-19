export default function Toolbar() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 8,
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
    </div>
  )
}
