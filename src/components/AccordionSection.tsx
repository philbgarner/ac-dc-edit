import { useState, useEffect } from 'react'
import { useModalSearch } from './ModalSearchContext'

interface Props {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function AccordionSection({ title, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const { filter, forceExpand, forceCollapse } = useModalSearch()

  useEffect(() => { if (forceExpand > 0) setOpen(true) }, [forceExpand])
  useEffect(() => { if (forceCollapse > 0) setOpen(false) }, [forceCollapse])

  const isOpen = filter ? true : open
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#5870d0', fontWeight: 'bold',
          borderBottom: '1px solid #203060', paddingBottom: 4,
          marginBottom: isOpen ? 2 : 0,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 9, color: '#4a62c8', flexShrink: 0, lineHeight: 1 }}>
          {isOpen ? '▾' : '▸'}
        </span>
        {title}
      </div>
      {isOpen && children}
    </div>
  )
}
