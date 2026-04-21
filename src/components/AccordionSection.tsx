import { useState } from 'react'

interface Props {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function AccordionSection({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#5870d0', fontWeight: 'bold',
          borderBottom: '1px solid #203060', paddingBottom: 4,
          marginBottom: open ? 2 : 0,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 9, color: '#4a62c8', flexShrink: 0, lineHeight: 1 }}>
          {open ? '▾' : '▸'}
        </span>
        {title}
      </div>
      {open && children}
    </div>
  )
}
