import { useRef, useEffect, useCallback, useState } from "react";
import type { CellInfo } from "atomic-core";
import { useData } from "../DataContext";
import type { PaintTool } from "../DataContext";
import styles from "./TopDownEditorModal.module.css";

// ── Geometry helpers ───────────────────────────────────────────────────────────

function makeCell(cx: number, cz: number, regionId?: number): CellInfo {
  return { cx, cz, regionId: (regionId ?? 0) as unknown as number };
}

function getRectBorderCells(a: CellInfo, b: CellInfo): CellInfo[] {
  const minX = Math.min(a.cx, b.cx),
    maxX = Math.max(a.cx, b.cx);
  const minZ = Math.min(a.cz, b.cz),
    maxZ = Math.max(a.cz, b.cz);
  const cells: CellInfo[] = [];
  for (let cx = minX; cx <= maxX; cx++)
    for (let cz = minZ; cz <= maxZ; cz++)
      if (cx === minX || cx === maxX || cz === minZ || cz === maxZ)
        cells.push(makeCell(cx, cz));
  return cells;
}

function getFilledRectCells(a: CellInfo, b: CellInfo): CellInfo[] {
  const minX = Math.min(a.cx, b.cx),
    maxX = Math.max(a.cx, b.cx);
  const minZ = Math.min(a.cz, b.cz),
    maxZ = Math.max(a.cz, b.cz);
  const cells: CellInfo[] = [];
  for (let cx = minX; cx <= maxX; cx++)
    for (let cz = minZ; cz <= maxZ; cz++) cells.push(makeCell(cx, cz));
  return cells;
}

function getCircleEdgeCells(center: CellInfo, edge: CellInfo): CellInfo[] {
  const r = Math.sqrt((edge.cx - center.cx) ** 2 + (edge.cz - center.cz) ** 2);
  const seen = new Set<string>();
  const cells: CellInfo[] = [];
  const steps = Math.max(32, Math.ceil(2 * Math.PI * r * 3));
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const cx = Math.round(center.cx + r * Math.cos(angle));
    const cz = Math.round(center.cz + r * Math.sin(angle));
    const key = `${cx},${cz}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push(makeCell(cx, cz));
    }
  }
  return cells;
}

function getFilledCircleCells(center: CellInfo, edge: CellInfo): CellInfo[] {
  const r = Math.sqrt((edge.cx - center.cx) ** 2 + (edge.cz - center.cz) ** 2);
  const rCeil = Math.ceil(r);
  const cells: CellInfo[] = [];
  for (let dz = -rCeil; dz <= rCeil; dz++)
    for (let dx = -rCeil; dx <= rCeil; dx++)
      if (dx * dx + dz * dz <= r * r)
        cells.push(makeCell(center.cx + dx, center.cz + dz));
  return cells;
}

function getFloodFillCells(info: CellInfo, outputs: unknown): CellInfo[] {
  const o = outputs as {
    rooms?: Map<
      number,
      { rect: { x: number; y: number; w: number; h: number } }
    >;
  } | null;
  const rooms = o?.rooms;
  const rid = info.regionId as unknown as number;
  if (!rooms || !rid) return [info];
  const room = rooms.get(rid);
  if (!room) return [info];
  const { x, y, w, h } = room.rect;
  const cells: CellInfo[] = [];
  for (let cz = y; cz < y + h; cz++)
    for (let cx = x; cx < x + w; cx++) cells.push(makeCell(cx, cz, rid));
  return cells;
}

function findRegionId(
  cx: number,
  cz: number,
  outputs: unknown,
): number | undefined {
  const o = outputs as {
    rooms?: Map<
      number,
      { rect: { x: number; y: number; w: number; h: number } }
    >;
  } | null;
  const rooms = o?.rooms;
  if (!rooms) return undefined;
  for (const [rid, room] of rooms) {
    if (
      cx >= room.rect.x &&
      cx < room.rect.x + room.rect.w &&
      cz >= room.rect.y &&
      cz < room.rect.y + room.rect.h
    )
      return rid;
  }
  return undefined;
}

function recomputeDistToWall(solidData: Uint8Array, W: number, H: number): Uint8Array {
  const INF = 65535
  const dist = new Uint16Array(W * H).fill(INF)
  const q: number[] = []
  for (let i = 0; i < W * H; i++) {
    if (solidData[i] !== 0) { dist[i] = 0; q.push(i) }
  }
  let head = 0
  while (head < q.length) {
    const i = q[head++]
    const x = i % W, y = (i / W) | 0
    const next = dist[i] + 1
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
      const ni = ny * W + nx
      if (next < dist[ni]) { dist[ni] = next; q.push(ni) }
    }
  }
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const d = dist[i]
    out[i] = d === INF ? 255 : d > 255 ? 255 : d
  }
  return out
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TOOLS: { id: PaintTool; icon: string; label: string; title: string }[] = [
  {
    id: "pencil",
    icon: "✏",
    label: "Pencil",
    title: "Click/drag to toggle cells",
  },
  {
    id: "rect",
    icon: "▭",
    label: "Rect",
    title: "Two clicks: rectangle border",
  },
  {
    id: "filledRect",
    icon: "▬",
    label: "Fill Rect",
    title: "Two clicks: filled rectangle",
  },
  {
    id: "circle",
    icon: "○",
    label: "Circle",
    title: "Two clicks: circle outline",
  },
  {
    id: "filledCircle",
    icon: "●",
    label: "Fill Circ",
    title: "Two clicks: filled circle",
  },
  {
    id: "floodFill",
    icon: "⬛",
    label: "Room",
    title: "Click to select entire room",
  },
];

const IS_WALKABLE = 0x01;
const IS_BLOCKED = 0x02;
const IS_LIGHT_PASSABLE = 0x04;
const CUSTOM_BITS = [0x08, 0x10, 0x20, 0x40, 0x80];

type EditLayer = "solid" | "colliderFlags";
type FlagMode = "set" | "clear";

function readR8(tex: unknown, width: number, cx: number, cz: number): number {
  const t = tex as { image?: { data?: ArrayLike<number> } } | null;
  return t?.image?.data?.[cz * width + cx] ?? 0;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function TopDownEditorModal({ onClose }: Props) {
  const {
    game,
    renderer,
    selectedCell,
    setSelectedCell,
    selectedCells,
    setSelectedCells,
    activeTool,
    setActiveTool,
    cellColliderFlags,
    setCellColliderFlags,
    customFlagNames,
  } = useData();

  const outputs = game?.dungeon.outputs ?? null;
  const mapWidth = outputs?.width ?? 0;
  const mapHeight = outputs?.height ?? 0;

  // ── Editor state ─────────────────────────────────────────────────────────────
  const [editLayer, setEditLayer] = useState<EditLayer>("solid");
  const [solidValue, setSolidValue] = useState<0 | 1>(1);
  const [flagsMask, setFlagsMask] = useState<number>(IS_WALKABLE);
  const [flagMode, setFlagMode] = useState<FlagMode>("set");
  const [visibleLayers, setVisibleLayers] = useState({
    solid: true,
    collision: false,
  });

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeToolRef = useRef<PaintTool | null>(null);
  const selectedCellsRef = useRef<Map<string, CellInfo>>(new Map());
  const selectedCellRef = useRef<CellInfo | null>(null);
  const pendingClickRef = useRef<CellInfo | null>(null);
  const isDraggingRef = useRef(false);
  const dragAddedRef = useRef<Set<string>>(new Set());
  const drawRef = useRef<() => void>(() => {});
  const outputsRef = useRef(outputs);
  const cellColliderFlagsRef = useRef(cellColliderFlags);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    outputsRef.current = outputs;
  }, [outputs]);
  useEffect(() => {
    cellColliderFlagsRef.current = cellColliderFlags;
  }, [cellColliderFlags]);
  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  useEffect(() => {
    selectedCellsRef.current = new Map(
      selectedCells.map((c) => [`${c.cx},${c.cz}`, c]),
    );
  }, [selectedCells]);

  useEffect(() => {
    pendingClickRef.current = null;
  }, [activeTool]);

  // Escape closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Draw ─────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !outputs || mapWidth === 0 || mapHeight === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const cellW = cw / mapWidth;
    const cellH = ch / mapHeight;

    ctx.clearRect(0, 0, cw, ch);

    const solidTex = outputs.textures.solid;
    const colliderTex = (outputs.textures as Record<string, unknown>)
      .colliderFlags;

    const selMap = selectedCellsRef.current;
    const pending = pendingClickRef.current;

    for (let cz = 0; cz < mapHeight; cz++) {
      for (let cx = 0; cx < mapWidth; cx++) {
        const x = cx * cellW;
        const y = cz * cellH;
        const solidVal = readR8(solidTex, mapWidth, cx, cz);

        // Base: solid layer
        ctx.fillStyle = visibleLayers.solid
          ? solidVal
            ? "#0b0b17"
            : "#1e2d45"
          : "#141c2e";
        ctx.fillRect(x, y, cellW, cellH);

        // Collision overlay
        if (visibleLayers.collision && colliderTex) {
          const flags = readR8(colliderTex, mapWidth, cx, cz);
          if (flags !== 0) {
            if (flags & IS_BLOCKED) ctx.fillStyle = "rgba(200,60,60,0.45)";
            else if (flags & IS_WALKABLE)
              ctx.fillStyle = "rgba(60,180,80,0.38)";
            else if (flags & IS_LIGHT_PASSABLE)
              ctx.fillStyle = "rgba(60,180,220,0.38)";
            else ctx.fillStyle = "rgba(180,140,60,0.32)";
            ctx.fillRect(x, y, cellW, cellH);
          }
        }

        // Subtle grid lines when cells are large enough
        if (cellW >= 5) {
          ctx.strokeStyle = "rgba(255,255,255,0.04)";
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 0.25, y + 0.25, cellW - 0.5, cellH - 0.5);
        }

        // Pending first-click marker
        if (pending && cx === pending.cx && cz === pending.cz) {
          ctx.fillStyle = "rgba(0,220,80,0.6)";
          ctx.fillRect(x, y, cellW, cellH);
        }

        // Selection highlight
        if (selMap.has(`${cx},${cz}`)) {
          ctx.fillStyle = "rgba(255,230,20,0.52)";
          ctx.fillRect(x, y, cellW, cellH);
        }
      }
    }

    // Single-cell selection cross-hair
    const sc = selectedCellRef.current;
    if (sc && selMap.size === 0) {
      const x = sc.cx * cellW;
      const y = sc.cz * cellH;
      ctx.fillStyle = "rgba(255,230,20,0.52)";
      ctx.fillRect(x, y, cellW, cellH);
    }
  }, [
    outputs,
    mapWidth,
    mapHeight,
    visibleLayers,
    selectedCells,
    selectedCell,
  ]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  useEffect(() => {
    draw();
  }, [draw]);

  // ── Resize observer ───────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const obs = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      drawRef.current();
    });
    obs.observe(container);
    canvas.width = container.clientWidth || 800;
    canvas.height = container.clientHeight || 600;
    drawRef.current();

    return () => obs.disconnect();
  }, []);

  // ── Canvas interaction ────────────────────────────────────────────────────────
  function getMousePos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function getCellAt(x: number, y: number): CellInfo | null {
    const canvas = canvasRef.current;
    if (!canvas || !outputs || mapWidth === 0 || mapHeight === 0) return null;
    const cellW = canvas.width / mapWidth;
    const cellH = canvas.height / mapHeight;
    const cx = Math.floor(x / cellW);
    const cz = Math.floor(y / cellH);
    if (cx < 0 || cx >= mapWidth || cz < 0 || cz >= mapHeight) return null;
    return makeCell(cx, cz, findRegionId(cx, cz, outputsRef.current));
  }

  function handleCellInteract(info: CellInfo) {
    const tool = activeToolRef.current;

    if (!tool) {
      setSelectedCells([]);
      setSelectedCell(info);
      return;
    }

    setSelectedCell(null);

    if (tool === "pencil") {
      const key = `${info.cx},${info.cz}`;
      const next = new Map(selectedCellsRef.current);
      if (!isDraggingRef.current) {
        if (next.has(key)) next.delete(key);
        else next.set(key, info);
      } else {
        if (!dragAddedRef.current.has(key)) {
          dragAddedRef.current.add(key);
          next.set(key, info);
        }
      }
      setSelectedCells(Array.from(next.values()));
      return;
    }

    if (tool === "floodFill") {
      setSelectedCells(getFloodFillCells(info, outputsRef.current));
      return;
    }

    // Two-click tools
    const pending = pendingClickRef.current;
    if (!pending) {
      pendingClickRef.current = info;
      drawRef.current();
      return;
    }

    pendingClickRef.current = null;
    let cells: CellInfo[];
    if (tool === "rect") cells = getRectBorderCells(pending, info);
    else if (tool === "filledRect") cells = getFilledRectCells(pending, info);
    else if (tool === "circle") cells = getCircleEdgeCells(pending, info);
    else cells = getFilledCircleCells(pending, info);
    setSelectedCells(cells);
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragAddedRef.current = new Set();
    const { x, y } = getMousePos(e);
    const c = getCellAt(x, y);
    if (c) handleCellInteract(c);
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current || activeToolRef.current !== "pencil") return;
    const { x, y } = getMousePos(e);
    const c = getCellAt(x, y);
    if (c) handleCellInteract(c);
  }

  function onMouseUp() {
    isDraggingRef.current = false;
    dragAddedRef.current = new Set();
  }

  // ── Apply ─────────────────────────────────────────────────────────────────────
  function handleApply() {
    if (!outputs) return;

    const cells =
      selectedCells.length > 0
        ? selectedCells
        : selectedCell
          ? [selectedCell]
          : [];
    if (cells.length === 0) return;

    if (editLayer === "solid") {
      const solidTex = outputs.textures.solid as unknown as {
        image?: { data?: Uint8Array };
      };
      if (solidTex?.image?.data) {
        for (const { cx, cz } of cells) {
          solidTex.image.data[cz * mapWidth + cx] = solidValue;
        }
        const distTex = (outputs.textures as unknown as { distanceToWall?: { image?: { data?: Uint8Array } } }).distanceToWall;
        if (distTex?.image?.data) {
          const newDist = recomputeDistToWall(solidTex.image.data, mapWidth, mapHeight);
          distTex.image.data.set(newDist);
        }
      }
    } else {
      const colliderTex = (outputs.textures as Record<string, unknown>)
        .colliderFlags as { image?: { data?: Uint8Array } } | undefined;
      const newFlags = { ...cellColliderFlagsRef.current };
      for (const { cx, cz } of cells) {
        const key = `${cx},${cz}`;
        const current = colliderTex?.image?.data
          ? (colliderTex.image.data[cz * mapWidth + cx] ?? 0)
          : (cellColliderFlagsRef.current[key] ?? 0);
        const newVal =
          flagMode === "set" ? current | flagsMask : current & ~flagsMask;
        if (colliderTex?.image?.data) {
          colliderTex.image.data[cz * mapWidth + cx] = newVal;
        }
        newFlags[key] = newVal;
      }
      setCellColliderFlags(newFlags);
    }

    renderer?.rebuild();
    drawRef.current();
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const allFlagBits = [
    { bit: IS_WALKABLE, label: "Walkable" },
    { bit: IS_BLOCKED, label: "Blocked" },
    { bit: IS_LIGHT_PASSABLE, label: "Light Passable" },
    ...CUSTOM_BITS.filter((b) => b in customFlagNames).map((b) => ({
      bit: b,
      label: customFlagNames[b],
    })),
  ];

  const selectionCount = selectedCells.length;
  const hasSelection = selectionCount > 0 || selectedCell !== null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.modal}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>Wall Editor</span>
        <button onClick={onClose} className={styles.closeBtn}>
          ×
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Edit layer */}
          <div className={styles.fieldGroup}>
            <span className={styles.sectionLabel}>Edit Layer</span>
            <select
              value={editLayer}
              onChange={(e) => setEditLayer(e.target.value as EditLayer)}
              className={styles.layerSelect}
            >
              <option value="solid">Solid (Wall / Floor)</option>
              <option value="colliderFlags">Collision Flags</option>
            </select>
          </div>

          {/* Paint value */}
          <div className={styles.fieldGroup}>
            <span className={styles.sectionLabel}>Paint Value</span>
            {editLayer === "solid" ? (
              <div className={styles.radioGroup}>
                {([1, 0] as const).map((v) => (
                  <label key={v} className={styles.checkLabel}>
                    <input
                      type="radio"
                      name="solidValue"
                      checked={solidValue === v}
                      onChange={() => setSolidValue(v)}
                      className={styles.accentInput}
                    />
                    <span className={styles.radioText}>
                      {v === 1 ? "Wall (solid)" : "Floor (walkable)"}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className={styles.fieldGroup}>
                <div className={styles.flagModeRow}>
                  {(["set", "clear"] as FlagMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFlagMode(m)}
                      className={`${styles.flagModeBtn}${flagMode === m ? ` ${styles.flagModeBtnActive}` : ""}`}
                    >
                      {m === "set" ? "+ Set" : "− Clear"}
                    </button>
                  ))}
                </div>
                {allFlagBits.map(({ bit, label }) => (
                  <label key={bit} className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={!!(flagsMask & bit)}
                      onChange={() => setFlagsMask((prev) => prev ^ bit)}
                      className={styles.accentInput}
                    />
                    <span className={styles.flagCheckFlex}>{label}</span>
                    <span className={styles.flagHex}>
                      {`0x${bit.toString(16).toUpperCase()}`}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Legend / visibility */}
          <div className={styles.fieldGroup}>
            <span className={styles.sectionLabel}>Legend</span>

            {/* Layer toggles */}
            {(
              [
                { key: "solid", label: "Solid layer" },
                { key: "collision", label: "Collision flags" },
              ] as const
            ).map(({ key, label }) => (
              <label key={key} className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={visibleLayers[key]}
                  onChange={() =>
                    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={styles.accentInput}
                />
                <span className={styles.radioText}>{label}</span>
              </label>
            ))}

            {/* Color key */}
            <div className={styles.colorKey}>
              {[
                { bg: "#0b0b17", label: "Wall" },
                { bg: "#1e2d45", label: "Floor" },
                { bg: "rgba(60,180,80,0.55)", label: "Walkable flag" },
                { bg: "rgba(200,60,60,0.55)", label: "Blocked flag" },
                { bg: "rgba(60,180,220,0.55)", label: "Light passable" },
                { bg: "rgba(255,230,20,0.52)", label: "Selected" },
              ].map(({ bg, label }) => (
                <div key={label} className={styles.colorKeyRow}>
                  <span
                    className={styles.colorSwatch}
                    style={{ background: bg }}
                  />
                  <span className={styles.colorLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Paint tools */}
          <div className={styles.fieldGroup}>
            <div className={styles.toolsHeader}>
              <span className={styles.sectionLabel}>Select Tool</span>
              <button
                onClick={() => {
                  setActiveTool(null);
                  setSelectedCells([]);
                }}
                className={styles.clearBtn}
              >
                clear
              </button>
            </div>
            <div className={styles.toolsGrid}>
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  title={t.title}
                  onClick={() =>
                    setActiveTool(activeTool === t.id ? null : t.id)
                  }
                  className={`${styles.toolBtn}${activeTool === t.id ? ` ${styles.toolBtnActive}` : ""}`}
                >
                  <span className={styles.toolBtnIcon}>{t.icon}</span>
                  <span className={styles.toolBtnLabel}>{t.label}</span>
                </button>
              ))}
            </div>
            {activeTool && (
              <div className={styles.toolHint}>
                {activeTool === "pencil" &&
                  "Click/drag to add · click to remove"}
                {activeTool === "floodFill" &&
                  "Click a cell to select its room"}
                {(activeTool === "rect" || activeTool === "filledRect") &&
                  "Click corner 1, then corner 2"}
                {(activeTool === "circle" || activeTool === "filledCircle") &&
                  "Click center, then edge"}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Selection summary */}
          <div className={styles.selectionSummary}>
            {selectionCount > 0
              ? `${selectionCount} cell${selectionCount !== 1 ? "s" : ""} selected`
              : selectedCell
                ? `Cell (${selectedCell.cx}, ${selectedCell.cz})`
                : "No selection"}
          </div>

          {/* Apply */}
          <button
            onClick={handleApply}
            disabled={!hasSelection}
            className={`${styles.applyBtn}${hasSelection ? ` ${styles.applyBtnEnabled}` : ""}`}
          >
            Apply to Selection
          </button>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className={styles.canvasArea}
          style={{ cursor: activeTool ? "crosshair" : "default" }}
        >
          {!outputs ? (
            <div className={styles.emptyOverlay}>No dungeon loaded</div>
          ) : (
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
          )}
        </div>
      </div>
    </div>
  );
}
