import { useRef, useState } from "react";
import { loadMultiAtlas, packedAtlasResolver } from "atomic-core";
import type { TextureAtlasJson, PackedAtlas } from "atomic-core";
import { useData } from "../DataContext";
import type { AtlasEntry } from "../DataContext";
import Modal from "./Modal";

interface Props {
  onClose: () => void;
}

// ── Shared micro-styles ───────────────────────────────────────────────────────

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const label: React.CSSProperties = {
  color: "#8090c0",
  minWidth: 46,
  flexShrink: 0,
};
const fileBtn: React.CSSProperties = {
  background: "#1a2040",
  border: "1px solid #304080",
  borderRadius: 3,
  color: "#c8d0f8",
  padding: "3px 10px",
  cursor: "pointer",
  fontSize: 12,
};
const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#8090c0",
  cursor: "pointer",
  fontSize: 15,
  padding: "0 4px",
  lineHeight: 1,
};
const divider: React.CSSProperties = {
  border: "none",
  borderTop: "1px solid #1e2a50",
  margin: 0,
};
const sectionLabel: React.CSSProperties = {
  color: "#8090c0",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 1,
};

// ── Tile grid picker ──────────────────────────────────────────────────────────

interface TileGridProps {
  packed: PackedAtlas | null;
  atlasUrl: string | null;
  entries: AtlasEntry[];
  spriteNames: string[];
  value: string;
  onChange: (name: string) => void;
}

const TILE_SIZE = 48;

function resolveSprite(
  name: string,
  displaySize: number,
  packed: PackedAtlas | null,
  atlasUrl: string | null,
  entries: AtlasEntry[],
) {
  if (packed && atlasUrl) {
    const sprite = packed.getByName(name);
    if (sprite) {
      const atlasW = packed.texture.width;
      const atlasH = packed.texture.height;
      const spriteW = sprite.uvW * atlasW;
      const spriteH = sprite.uvH * atlasH;
      const scale = displaySize / Math.max(spriteW, spriteH);
      return {
        width: Math.round(spriteW * scale),
        height: Math.round(spriteH * scale),
        backgroundImage: `url(${atlasUrl})`,
        backgroundPosition: `-${Math.round(sprite.uvX * atlasW * scale)}px -${Math.round(sprite.uvY * atlasH * scale)}px`,
        backgroundSize: `${Math.round(atlasW * scale)}px ${Math.round(atlasH * scale)}px`,
        backgroundRepeat: "no-repeat" as const,
        imageRendering: "pixelated" as const,
      };
    }
  }
  const entry = entries.find((e) => e.spriteNames.includes(name));
  if (!entry) return null;
  const frame = entry.json.frames[name]?.frame;
  const meta = entry.json.meta.size;
  if (!frame) return null;
  const scale = displaySize / Math.max(frame.w, frame.h);
  return {
    width: Math.round(frame.w * scale),
    height: Math.round(frame.h * scale),
    backgroundImage: `url(${entry.objectUrl})`,
    backgroundPosition: `-${Math.round(frame.x * scale)}px -${Math.round(frame.y * scale)}px`,
    backgroundSize: `${Math.round(meta.w * scale)}px ${Math.round(meta.h * scale)}px`,
    backgroundRepeat: "no-repeat" as const,
    imageRendering: "pixelated" as const,
  };
}

function TileGrid({
  packed,
  atlasUrl,
  entries,
  spriteNames,
  value,
  onChange,
}: TileGridProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        maxHeight: 160,
        overflowY: "auto",
        background: "#0d1428",
        borderRadius: 4,
        padding: 6,
        border: "1px solid #1e2a50",
      }}
    >
      {spriteNames.map((name) => {
        const style = resolveSprite(name, TILE_SIZE, packed, atlasUrl, entries);
        if (!style) return null;
        const selected = name === value;
        return (
          <div
            key={name}
            title={name}
            onClick={() => onChange(name)}
            style={{
              width: TILE_SIZE,
              height: TILE_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 3,
              cursor: "pointer",
              flexShrink: 0,
              outline: selected ? "2px solid #4080ff" : "1px solid transparent",
              background: selected ? "#1a2a50" : "#111828",
            }}
          >
            <div style={style} />
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AtlasImportModal({ onClose }: Props) {
  const {
    atlasEntries,
    setAtlasEntries,
    atlasConfig,
    setAtlasConfig,
    packedAtlasUrl,
  } = useData();

  const pngInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [draftPngUrl, setDraftPngUrl] = useState<string | null>(null);
  const [draftPngName, setDraftPngName] = useState<string | null>(null);
  const [draftPngBlob, setDraftPngBlob] = useState<Blob | null>(null);
  const [draftJson, setDraftJson] = useState<TextureAtlasJson | null>(null);
  const [draftJsonName, setDraftJsonName] = useState<string | null>(null);
  const [draftSpriteNames, setDraftSpriteNames] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

  const allSpriteNames = dedupe([
    ...atlasEntries.flatMap((e) => e.spriteNames),
    ...draftSpriteNames,
  ]);
  const [floorTile, setFloorTile] = useState(atlasConfig?.floorTile ?? "");
  const [wallTile, setWallTile] = useState(atlasConfig?.wallTile ?? "");
  const [ceilTile, setCeilTile] = useState(atlasConfig?.ceilTile ?? "");
  const [floorSkirtTile, setFloorSkirtTile] = useState(
    atlasConfig?.floorSkirtTile ?? "",
  );
  const [ceilSkirtTile, setCeilSkirtTile] = useState(
    atlasConfig?.ceilSkirtTile ?? "",
  );

  const [loading, setLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // ── Draft handlers ──────────────────────────────────────────────────────────

  function handleDraftPng(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (draftPngUrl) URL.revokeObjectURL(draftPngUrl);
    setDraftPngUrl(URL.createObjectURL(file));
    setDraftPngName(file.name);
    setDraftPngBlob(file);
    setAddError(null);
  }

  function handleDraftJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(
          ev.target?.result as string,
        ) as TextureAtlasJson;
        setDraftJson(json);
        setDraftJsonName(file.name);
        setDraftSpriteNames(Object.keys(json.frames).sort());
      } catch {
        setAddError("Invalid atlas JSON — expected TexturePacker format");
      }
    };
    reader.readAsText(file);
  }

  function handleAddEntry() {
    if (
      !draftPngUrl ||
      !draftJson ||
      !draftPngName ||
      !draftJsonName ||
      !draftPngBlob
    )
      return;
    const entry: AtlasEntry = {
      id: crypto.randomUUID(),
      pngName: draftPngName,
      jsonName: draftJsonName,
      objectUrl: draftPngUrl,
      pngBlob: draftPngBlob,
      json: draftJson,
      spriteNames: draftSpriteNames,
    };
    const updated = [...atlasEntries, entry];
    setAtlasEntries(updated);
    const combined = dedupe(updated.flatMap((e) => e.spriteNames));
    if (!floorTile) setFloorTile(combined[0] ?? "");
    if (!wallTile) setWallTile(combined[0] ?? "");
    if (!ceilTile) setCeilTile(combined[0] ?? "");
    setDraftPngUrl(null);
    setDraftPngName(null);
    setDraftPngBlob(null);
    setDraftJson(null);
    setDraftJsonName(null);
    setDraftSpriteNames([]);
    if (pngInputRef.current) pngInputRef.current.value = "";
    if (jsonInputRef.current) jsonInputRef.current.value = "";
    setAddError(null);
  }

  function handleRemoveEntry(id: string) {
    const removed = atlasEntries.find((e) => e.id === id);
    if (removed) URL.revokeObjectURL(removed.objectUrl);
    setAtlasEntries(atlasEntries.filter((e) => e.id !== id));
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  async function handleApply() {
    if (atlasEntries.length === 0 || !floorTile || !wallTile || !ceilTile)
      return;
    setLoading(true);
    setApplyError(null);
    try {
      const sources = atlasEntries.map((e) => ({
        imageUrl: e.objectUrl,
        atlasJson: e.json,
      }));
      const packed = await loadMultiAtlas(sources, {
        showLoadingScreen: false,
      });
      const resolver = packedAtlasResolver(packed);
      const spriteNames = dedupe(atlasEntries.flatMap((e) => e.spriteNames));
      setAtlasConfig({
        packed,
        resolver,
        spriteNames,
        floorTile,
        wallTile,
        ceilTile,
        floorSkirtTile,
        ceilSkirtTile,
      });
      onClose();
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Failed to load atlases");
    } finally {
      setLoading(false);
    }
  }

  const canAdd = !!draftPngUrl && !!draftJson && !!draftPngBlob;
  const canApply =
    atlasEntries.length > 0 &&
    !!floorTile &&
    !!wallTile &&
    !!ceilTile &&
    !loading;

  const entriesForGrid: AtlasEntry[] =
    draftPngUrl && draftJson && draftPngName && draftJsonName && draftPngBlob
      ? [
          ...atlasEntries,
          {
            id: "__draft__",
            pngName: draftPngName,
            jsonName: draftJsonName,
            objectUrl: draftPngUrl,
            pngBlob: draftPngBlob,
            json: draftJson,
            spriteNames: draftSpriteNames,
          },
        ]
      : atlasEntries;

  const tileRows: [string, string, (v: string) => void, boolean][] = [
    ["Floor", floorTile, setFloorTile, true],
    ["Wall", wallTile, setWallTile, true],
    ["Ceiling", ceilTile, setCeilTile, true],
    ["Floor Skirt", floorSkirtTile, setFloorSkirtTile, false],
    ["Ceil Skirt", ceilSkirtTile, setCeilSkirtTile, false],
  ];

  return (
    <Modal
      title="Tile Atlases"
      onClose={onClose}
      style={{
        minWidth: 860,
        maxWidth: "95vw",
        maxHeight: "85vh",
        overflow: "hidden",
        gap: 0,
      }}
    >
      {/* ── Two-panel body ───────────────────────────────────────────────────── */}
      <div
        style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
      >
        {/* Left panel: atlas list + add form */}
        <div
          style={{
            flex: "0 0 320px",
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            borderRight: "1px solid #1e2a50",
          }}
        >
          {atlasEntries.length > 0 && (
            <>
              <span style={sectionLabel}>Loaded atlases</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {atlasEntries.map((entry, i) => (
                  <div
                    key={entry.id}
                    style={{
                      ...row,
                      background: "#111830",
                      borderRadius: 3,
                      padding: "4px 8px",
                    }}
                  >
                    <span
                      style={{ color: "#6070a0", fontSize: 11, minWidth: 18 }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      {entry.pngName}
                    </span>
                    <span style={{ color: "#506080", fontSize: 11 }}>
                      {entry.spriteNames.length} sprites
                    </span>
                    <button
                      style={iconBtn}
                      title="Remove"
                      onClick={() => handleRemoveEntry(entry.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <hr style={divider} />
            </>
          )}

          <span style={sectionLabel}>Add atlas</span>

          <div style={row}>
            <span style={label}>PNG</span>
            <button
              style={fileBtn}
              onClick={() => pngInputRef.current?.click()}
            >
              {draftPngName ?? "Choose file…"}
            </button>
            <input
              ref={pngInputRef}
              type="file"
              accept="image/png"
              style={{ display: "none" }}
              onChange={handleDraftPng}
            />
          </div>

          <div style={row}>
            <span style={label}>JSON</span>
            <button
              style={fileBtn}
              onClick={() => jsonInputRef.current?.click()}
            >
              {draftJsonName ?? "Choose file…"}
            </button>
            <input
              ref={jsonInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleDraftJson}
            />
          </div>

          {addError && (
            <span style={{ color: "#e05050", fontSize: 11 }}>{addError}</span>
          )}

          <button
            style={{
              ...fileBtn,
              opacity: canAdd ? 1 : 0.45,
              alignSelf: "flex-start",
              borderColor: "#406080",
            }}
            disabled={!canAdd}
            onClick={handleAddEntry}
          >
            + Add
          </button>
        </div>

        {/* Right panel: tile assignments */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            height: "60vh",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <span style={sectionLabel}>Tile assignments</span>

          {allSpriteNames.length === 0 ? (
            <span style={{ color: "#506080", fontSize: 12 }}>
              Add an atlas to assign tiles.
            </span>
          ) : (
            tileRows.map(([name, value, setter, required]) => (
              <div
                key={name}
                style={{ display: "flex", flexDirection: "column", gap: 6 }}
              >
                <div style={{ ...row }}>
                  <span style={{ ...label, minWidth: 72 }}>
                    {name}
                    {required && <span style={{ color: "#e05050" }}> *</span>}
                  </span>
                  {value ? (
                    <span style={{ fontSize: 11, color: "#6080b0" }}>
                      {value}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#506080" }}>
                      {required ? "— choose below —" : "— optional —"}
                    </span>
                  )}
                </div>
                <TileGrid
                  packed={atlasConfig?.packed ?? null}
                  atlasUrl={packedAtlasUrl}
                  entries={entriesForGrid}
                  spriteNames={allSpriteNames}
                  value={value}
                  onChange={setter}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Sticky bottom footer ─────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid #1e2a50",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          background: "#0e1428",
        }}
      >
        {applyError && (
          <span style={{ color: "#e05050", fontSize: 11, flex: 1 }}>
            {applyError}
          </span>
        )}
        <button
          style={{
            background: "#1a3080",
            border: "1px solid #4060c0",
            borderRadius: 3,
            color: "#d0e0ff",
            padding: "5px 20px",
            cursor: "pointer",
            fontSize: 12,
            opacity: canApply ? 1 : 0.5,
          }}
          disabled={!canApply}
          onClick={handleApply}
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>
    </Modal>
  );
}

function dedupe(names: string[]): string[] {
  return [...new Set(names)].sort();
}
