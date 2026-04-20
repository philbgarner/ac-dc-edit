import { useEffect, ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  title?: string
  children: ReactNode
  /** When true, renders without the full-screen backdrop overlay. */
  bare?: boolean
  style?: React.CSSProperties
}

export default function Modal({ onClose, title, children, bare, style }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const panel = (
      <div
        style={{
          background: '#0e1428',
          border: '1px solid #304080',
          borderRadius: 6,
          padding: '20px 24px',
          minWidth: 600,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          color: '#c8d0f8',
          fontFamily: 'monospace',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          ...style,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {title && <span style={{ fontWeight: 'bold', fontSize: 14, color: '#d0dcff' }}>{title}</span>}
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#8090c0',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>
  )

  if (bare) return panel

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div onClick={e => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  )
}
