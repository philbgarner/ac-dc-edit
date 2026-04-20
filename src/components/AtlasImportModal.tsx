import { useRef, useState } from 'react'
import { loadMultiAtlas, packedAtlasResolver } from 'atomic-core'
import type { TextureAtlasJson } from 'atomic-core'
import { useData } from '../DataContext'
import type { AtlasEntry } from '../DataContext'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 }
const label: React.CSSProperties = { color: '#8090c0', minWidth: 46, flexShrink: 0 }
const fileBtn: React.CSSProperties = {
  background: '#1a2040', border: '1px solid #304080', borderRadius: 3,
  color: '#c8d0f8', padding: '3px 10px', cursor: 'pointer', fontSize: 12,
}
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8090c0',
  cursor: 'pointer', fontSize: 15, padding: '0 4px', lineHeight: 1,
}
const divider: React.CSSProperties = {
  border: 'none', borderTop: '1px solid #1e2a50', margin: 0,
}

// ── Tile grid picker ──────────────────────────────────────────────────────────

interface TileGridProps {
  entries: AtlasEntry[]
  spriteNames: string[]
  value: string
  onChange: (name: string) => void
}

const TILE_SIZE = 48

function TileGrid({ entries, spriteNames, value, onChange }: TileGridProps) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4,
      maxHeight: 180, overflowY: 'auto',
      background: '#0d1428', borderRadius: 4, padding: 6,
      border: '1px solid #1e2a50',
    }}>
      {spriteNames.map(name => {
        const entry = entries.find(e => e.spriteNames.includes(name))
        if (!entry) return null
        const frame = entry.json.frames[name]?.frame
        const meta = entry.json.meta.size
        if (!frame) return null
        const scale = TILE_SIZE / Math.max(frame.w, frame.h)
        const dispW = Math.round(frame.w * scale)
        const dispH = Math.round(frame.h * scale)
        const atlasW = Math.round(meta.w * scale)
        const atlasH = Math.round(meta.h * scale)
        const selected = name === value
        return (
          <div
            key={name}
            title={name}
            onClick={() => onChange(name)}
            style={{
              width: TILE_SIZE, height: TILE_SIZE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 3, cursor: 'pointer', flexShrink: 0,
              outline: selected ? '2px solid #4080ff' : '1px solid transparent',
              background: selected ? '#1a2a50' : '#111828',
            }}
          >
            <div style={{
              width: dispW, height: dispH,
              backgroundImage: `url(${entry.objectUrl})`,
              backgroundPosition: `-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`,
              backgroundSize: `${atlasW}px ${atlasH}px`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
            }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AtlasImportModal({ onClose }: Props) {
  const { atlasEntries, setAtlasEntries, atlasConfig, setAtlasConfig } = useData()

  // "Add atlas" form — local draft state
  const pngInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const [draftPngUrl, setDraftPngUrl] = useState<string | null>(null)
  const [draftPngName, setDraftPngName] = useState<string | null>(null)
  const [draftPngBlob, setDraftPngBlob] = useState<Blob | null>(null)
  const [draftJson, setDraftJson] = useState<TextureAtlasJson | null>(null)
  const [draftJsonName, setDraftJsonName] = useState<string | null>(null)
  const [draftSpriteNames, setDraftSpriteNames] = useState<string[]>([])
  const [addError, setAddError] = useState<string | null>(null)

  // Tile selection — persisted from atlasConfig or defaulted
  const allSpriteNames = dedupe([
    ...atlasEntries.flatMap(e => e.spriteNames),
    ...draftSpriteNames,
  ])
  const [floorTile, setFloorTile] = useState(atlasConfig?.floorTile ?? '')
  const [wallTile, setWallTile]   = useState(atlasConfig?.wallTile  ?? '')
  const [ceilTile, setCeilTile]   = useState(atlasConfig?.ceilTile  ?? '')

  const [loading, setLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  // ── Draft handlers ──────────────────────────────────────────────────────────

  function handleDraftPng(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (draftPngUrl) URL.revokeObjectURL(draftPngUrl)
    setDraftPngUrl(URL.createObjectURL(file))
    setDraftPngName(file.name)
    setDraftPngBlob(file)
    setAddError(null)
  }

  function handleDraftJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAddError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as TextureAtlasJson
        setDraftJson(json)
        setDraftJsonName(file.name)
        setDraftSpriteNames(Object.keys(json.frames).sort())
      } catch {
        setAddError('Invalid atlas JSON — expected TexturePacker format')
      }
    }
    reader.readAsText(file)
  }

  function handleAddEntry() {
    if (!draftPngUrl || !draftJson || !draftPngName || !draftJsonName || !draftPngBlob) return
    const entry: AtlasEntry = {
      id: crypto.randomUUID(),
      pngName: draftPngName,
      jsonName: draftJsonName,
      objectUrl: draftPngUrl,
      pngBlob: draftPngBlob,
      json: draftJson,
      spriteNames: draftSpriteNames,
    }
    const updated = [...atlasEntries, entry]
    setAtlasEntries(updated)
    // seed tile selects from the first entry
    const combined = dedupe(updated.flatMap(e => e.spriteNames))
    if (!floorTile) setFloorTile(combined[0] ?? '')
    if (!wallTile)  setWallTile(combined[0] ?? '')
    if (!ceilTile)  setCeilTile(combined[0] ?? '')
    // reset draft
    setDraftPngUrl(null)
    setDraftPngName(null)
    setDraftPngBlob(null)
    setDraftJson(null)
    setDraftJsonName(null)
    setDraftSpriteNames([])
    if (pngInputRef.current) pngInputRef.current.value = ''
    if (jsonInputRef.current) jsonInputRef.current.value = ''
    setAddError(null)
  }

  function handleRemoveEntry(id: string) {
    const removed = atlasEntries.find(e => e.id === id)
    if (removed) URL.revokeObjectURL(removed.objectUrl)
    setAtlasEntries(atlasEntries.filter(e => e.id !== id))
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  async function handleApply() {
    if (atlasEntries.length === 0 || !floorTile || !wallTile || !ceilTile) return
    setLoading(true)
    setApplyError(null)
    try {
      const sources = atlasEntries.map(e => ({ imageUrl: e.objectUrl, atlasJson: e.json }))
      const packed = await loadMultiAtlas(sources, { showLoadingScreen: false })
      const resolver = packedAtlasResolver(packed)
      const spriteNames = dedupe(atlasEntries.flatMap(e => e.spriteNames))
      setAtlasConfig({ packed, resolver, spriteNames, floorTile, wallTile, ceilTile })
      onClose()
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : 'Failed to load atlases')
    } finally {
      setLoading(false)
    }
  }

  const canAdd   = !!draftPngUrl && !!draftJson && !!draftPngBlob
  const canApply = atlasEntries.length > 0 && !!floorTile && !!wallTile && !!ceilTile && !loading

  // Include the unsaved draft so the tile grid shows tiles before "+ Add" is clicked
  const entriesForGrid: AtlasEntry[] = draftPngUrl && draftJson && draftPngName && draftJsonName && draftPngBlob
    ? [...atlasEntries, {
        id: '__draft__',
        pngName: draftPngName,
        jsonName: draftJsonName,
        objectUrl: draftPngUrl,
        pngBlob: draftPngBlob,
        json: draftJson,
        spriteNames: draftSpriteNames,
      }]
    : atlasEntries

  return (
    <Modal title="Tile Atlases" onClose={onClose}>

      {/* ── Loaded atlases list ─────────────────────────────────────────────── */}
      {atlasEntries.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atlasEntries.map((entry, i) => (
              <div key={entry.id} style={{ ...row, background: '#111830', borderRadius: 3, padding: '4px 8px' }}>
                <span style={{ color: '#6070a0', fontSize: 11, minWidth: 18 }}>{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {entry.pngName}
                </span>
                <span style={{ color: '#506080', fontSize: 11 }}>{entry.spriteNames.length} sprites</span>
                <button style={iconBtn} title="Remove" onClick={() => handleRemoveEntry(entry.id)}>×</button>
              </div>
            ))}
          </div>
          <hr style={divider} />
        </>
      )}

      {/* ── Add atlas form ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ color: '#8090c0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
          Add atlas
        </span>

        <div style={row}>
          <span style={label}>PNG</span>
          <button style={fileBtn} onClick={() => pngInputRef.current?.click()}>
            {draftPngName ?? 'Choose file…'}
          </button>
          <input ref={pngInputRef} type="file" accept="image/png" style={{ display: 'none' }} onChange={handleDraftPng} />
        </div>

        <div style={row}>
          <span style={label}>JSON</span>
          <button style={fileBtn} onClick={() => jsonInputRef.current?.click()}>
            {draftJsonName ?? 'Choose file…'}
          </button>
          <input ref={jsonInputRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={handleDraftJson} />
        </div>

        {addError && <span style={{ color: '#e05050', fontSize: 11 }}>{addError}</span>}

        <button
          style={{ ...fileBtn, opacity: canAdd ? 1 : 0.45, alignSelf: 'flex-start', borderColor: '#406080' }}
          disabled={!canAdd}
          onClick={handleAddEntry}
        >
          + Add
        </button>
      </div>

      {/* ── Tile selectors — shown once at least one entry exists ───────────── */}
      {allSpriteNames.length > 0 && (
        <>
          <hr style={divider} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ color: '#8090c0', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tile assignments
            </span>

            {([['Floor', floorTile, setFloorTile], ['Wall', wallTile, setWallTile], ['Ceiling', ceilTile, setCeilTile]] as const).map(
              ([name, value, setter]) => (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ ...row }}>
                    <span style={label}>{name}</span>
                    {value
                      ? <span style={{ fontSize: 11, color: '#6080b0' }}>{value}</span>
                      : <span style={{ fontSize: 11, color: '#506080' }}>— choose below —</span>
                    }
                  </div>
                  <TileGrid
                    entries={entriesForGrid}
                    spriteNames={allSpriteNames}
                    value={value}
                    onChange={setter}
                  />
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      {(applyError || canApply) && <hr style={divider} />}

      {applyError && <span style={{ color: '#e05050', fontSize: 11 }}>{applyError}</span>}

      {atlasEntries.length > 0 && (
        <button
          style={{
            background: '#1a3080', border: '1px solid #4060c0', borderRadius: 3,
            color: '#d0e0ff', padding: '5px 16px', cursor: 'pointer', fontSize: 12,
            alignSelf: 'flex-end', opacity: canApply ? 1 : 0.5,
          }}
          disabled={!canApply}
          onClick={handleApply}
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      )}
    </Modal>
  )
}

function dedupe(names: string[]): string[] {
  return [...new Set(names)].sort()
}
