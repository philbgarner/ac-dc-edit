import { useState } from "react";
import Modal from "./Modal";
import { useModalSearch } from "./ModalSearchContext";
import AccordionSection from "./AccordionSection";
import OverlayPaintModal from "./OverlayPaintModal";
import SkirtPaintModal from "./SkirtPaintModal";
import ColliderFlagsEditor from "./ColliderFlagsEditor";
import DecorationEditor from "./DecorationEditor";
import { useData } from "../DataContext";
import type { DecorationPlacement } from "../DataContext";
import { createDecoration } from "atomic-core";
import type { SpriteMap } from "atomic-core";
import styles from "./CellDetailsModal.module.css";

type RoomEntry = {
  id?: number;
  type: string;
  rect: { x: number; y: number; w: number; h: number };
  connections?: number[];
};

function computeRegionRect(
  data: Uint8Array,
  W: number,
  H: number,
  id: number,
): { x: number; y: number; w: number; h: number } | null {
  let minX = W,
    maxX = -1,
    minZ = H,
    maxZ = -1;
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (data[z * W + x] === id) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minZ, w: maxX - minX + 1, h: maxZ - minZ + 1 };
}

function readR8(
  tex: { image: { data: ArrayLike<number> } },
  width: number,
  cx: number,
  cz: number,
): number {
  return tex.image.data[cz * width + cx] ?? 0;
}

function highlight(text: string, filter: string): React.ReactNode {
  if (!filter) return text;
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const lowerFilter = filter.toLowerCase();
  let last = 0, idx: number;
  while ((idx = lower.indexOf(lowerFilter, last)) !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark key={idx} style={{ background: "#4a62c8", color: "#fff", borderRadius: 2 }}>
        {text.slice(idx, idx + filter.length)}
      </mark>
    );
    last = idx + filter.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? <>{parts}</> : text;
}

interface RowProps {
  label: string;
  value: string | number;
}
function Row({ label, value }: RowProps) {
  const { filter } = useModalSearch();
  const valueStr = String(value);
  return (
    <div className={styles.row}>
      <span className={styles.labelWide}>{highlight(label, filter)}</span>
      <span className={styles.value}>{highlight(valueStr, filter)}</span>
    </div>
  );
}

const OFFSET_NEUTRAL = 128;
const OFFSET_STEP_MIN = -127,
  OFFSET_STEP_MAX = 127;

interface SliderRowProps {
  label: string;
  steps: number;
  isPit?: boolean;
  isSky?: boolean;
  onChange: (steps: number) => void;
  onPitToggle?: () => void;
  onSkyToggle?: () => void;
}
function SliderRow({
  label,
  steps,
  isPit,
  isSky,
  onChange,
  onPitToggle,
  onSkyToggle,
}: SliderRowProps) {
  return (
    <div className={styles.sliderRow}>
      <span className={styles.sliderLabel}>{label}</span>
      <input
        type="range"
        min={OFFSET_STEP_MIN}
        max={OFFSET_STEP_MAX}
        step={1}
        value={isPit ? OFFSET_STEP_MIN : isSky ? OFFSET_STEP_MAX : steps}
        disabled={isPit || isSky}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.slider}
      />
      {isPit ? (
        <span className={styles.sliderValuePit}>pit</span>
      ) : isSky ? (
        <span className={styles.sliderValuePit}>sky</span>
      ) : (
        <span className={styles.sliderValue}>
          {steps > 0 ? `+${steps}` : steps}
        </span>
      )}
      {onPitToggle && (
        <button
          onClick={onPitToggle}
          title={isPit ? "Remove pit" : "Set as pit"}
          className={`${styles.pitBtn} ${isPit ? styles.pitBtnActive : styles.pitBtnInactive}`}
        >
          pit
        </button>
      )}
      {onSkyToggle && (
        <button
          onClick={onSkyToggle}
          title={isSky ? "Remove sky" : "Set as sky"}
          className={`${styles.pitBtn} ${isSky ? styles.pitBtnActive : styles.pitBtnInactive}`}
        >
          sky
        </button>
      )}
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function CellDetailsModal({ onClose }: Props) {
  const {
    selectedCell,
    setSelectedCell,
    game,
    atlasConfig,
    cellPaints,
    cellSkirts,
    cellHeights,
    setCellHeights,
    cellColliderFlags,
    setCellColliderFlags,
    customFlagNames,
    setCustomFlagNames,
    cellDecorations,
    setCellDecorations,
    renderer,
  } = useData();
  const [paintOpen, setPaintOpen] = useState(false);
  const [skirtOpen, setSkirtOpen] = useState(false);

  if (!selectedCell) return null;

  const { cx, cz, regionId } = selectedCell;
  const outputs = game?.dungeon.outputs;
  const width = outputs?.width ?? 0;

  let isSolid: boolean | null = null;
  let distToWall: number | null = null;
  let hazard: number | null = null;
  let temperature: number | null = null;
  let floorType: number | null = null;
  let wallType: number | null = null;
  let ceilType: number | null = null;

  if (outputs) {
    const t = outputs.textures;
    isSolid = readR8(t.solid as never, width, cx, cz) !== 0;
    distToWall = readR8(t.distanceToWall as never, width, cx, cz);
    hazard = readR8(t.hazards as never, width, cx, cz);
    temperature = readR8(t.temperature as never, width, cx, cz);
    floorType = readR8(t.floorType as never, width, cx, cz);
    wallType = readR8(t.wallType as never, width, cx, cz);
    ceilType = readR8(t.ceilingType as never, width, cx, cz);
  }

  const bspOutputs = outputs as {
    rooms?: Map<number, RoomEntry>;
    fullRegionIds?: Uint8Array;
  } | null;
  const roomsMap = bspOutputs?.rooms;
  const regionIds = roomsMap
    ? Array.from(roomsMap.keys()).sort((a, b) => a - b)
    : [];
  const texRegionData = (
    outputs?.textures as unknown as {
      regionId?: { image?: { data?: Uint8Array } };
    }
  )?.regionId?.image?.data;
  const currentRegionId: number = texRegionData
    ? (texRegionData[cz * width + cx] ?? 0)
    : (regionId ?? 0);
  const room =
    outputs && currentRegionId ? roomsMap?.get(currentRegionId) : null;

  function writeRegionId(newId: number) {
    if (!outputs) return;
    if (texRegionData) texRegionData[cz * width + cx] = newId;
    if (bspOutputs?.fullRegionIds)
      bspOutputs.fullRegionIds[cz * width + cx] = newId;
    if (roomsMap && texRegionData) {
      const H = outputs.height;
      if (currentRegionId > 0) {
        const rect = computeRegionRect(
          texRegionData,
          width,
          H,
          currentRegionId,
        );
        if (rect) roomsMap.get(currentRegionId)!.rect = rect;
        else roomsMap.delete(currentRegionId);
      }
      if (newId > 0) {
        const rect = computeRegionRect(texRegionData, width, H, newId);
        if (rect) {
          if (roomsMap.has(newId)) roomsMap.get(newId)!.rect = rect;
          else
            roomsMap.set(newId, {
              id: newId,
              type: "room",
              rect,
              connections: [],
            });
        }
      }
    }
    setSelectedCell({ cx, cz, regionId: newId });
    renderer?.rebuild();
  }

  function writeRoomType(newType: "room" | "corridor") {
    if (roomsMap && currentRegionId > 0 && roomsMap.has(currentRegionId)) {
      roomsMap.get(currentRegionId)!.type = newType;
    }
    setSelectedCell({ cx, cz, regionId: currentRegionId });
    renderer?.rebuild();
  }

  const floorTileName = atlasConfig?.floorTile ?? "—";
  const wallTileName = atlasConfig?.wallTile ?? "—";
  const ceilTileName = atlasConfig?.ceilTile ?? "—";

  const floorTileId =
    floorType != null && atlasConfig
      ? atlasConfig.resolver(atlasConfig.floorTile)
      : null;
  const wallTileId =
    wallType != null && atlasConfig
      ? atlasConfig.resolver(atlasConfig.wallTile)
      : null;
  const ceilTileId =
    ceilType != null && atlasConfig
      ? atlasConfig.resolver(atlasConfig.ceilTile)
      : null;

  const paintTarget = cellPaints[`${cx},${cz}`] ?? {};
  const skirtTarget = cellSkirts[`${cx},${cz}`] ?? {};
  const key = `${cx},${cz}`;

  const texFloor = outputs?.textures.floorHeightOffset;
  const texCeil = outputs?.textures.ceilingHeightOffset;
  const fallback = cellHeights[key];

  const floorR8: number = texFloor?.image.data
    ? ((texFloor.image.data as Uint8Array)[cz * width + cx] ?? OFFSET_NEUTRAL)
    : (fallback?.floor ?? OFFSET_NEUTRAL);
  const ceilR8: number = texCeil?.image.data
    ? ((texCeil.image.data as Uint8Array)[cz * width + cx] ?? OFFSET_NEUTRAL)
    : (fallback?.ceil ?? OFFSET_NEUTRAL);

  const floorIsPit = floorR8 === 0;
  const floorSteps = floorIsPit ? 0 : floorR8 - OFFSET_NEUTRAL;
  const ceilIsSky = ceilR8 === 127;
  const ceilSteps = ceilIsSky ? 0 : OFFSET_NEUTRAL - ceilR8;

  function writeFloor(r8: number) {
    if (texFloor?.image.data) {
      (texFloor.image.data as Uint8Array)[cz * width + cx] = r8;
    }
    setCellHeights({ ...cellHeights, [key]: { floor: r8, ceil: ceilR8 } });
    renderer?.rebuild();
  }

  function writeCeil(r8: number) {
    if (texCeil?.image.data) {
      (texCeil.image.data as Uint8Array)[cz * width + cx] = r8;
    }
    setCellHeights({ ...cellHeights, [key]: { floor: floorR8, ceil: r8 } });
    renderer?.rebuild();
  }

  const floorSkirtLayers = skirtTarget.floor ?? [];
  const ceilSkirtLayers = skirtTarget.ceil ?? [];

  const texCollider = outputs?.textures.colliderFlags as
    | { image: { data: Uint8Array } }
    | undefined;
  const colliderValue: number = texCollider?.image.data
    ? (texCollider.image.data[cz * width + cx] ?? 0)
    : (cellColliderFlags[key] ?? 0);

  function writeColliderFlags(v: number) {
    if (texCollider?.image.data) {
      texCollider.image.data[cz * width + cx] = v;
    }
    setCellColliderFlags({ ...cellColliderFlags, [key]: v });
    renderer?.rebuild();
  }

  function syncDecorations(decs: DecorationPlacement[]) {
    const prev = cellDecorations[key] ?? [];
    if (game) {
      for (const d of prev) {
        if (d._entityId) game.dungeon.decorations.remove(d._entityId);
      }
    }
    const synced = decs.map((d) => {
      if (!game || !d.sprite) return { ...d, _entityId: undefined };

      let spriteMap: SpriteMap | undefined;
      if (atlasConfig) {
        const packedSprite = atlasConfig.packed.getByName(d.sprite);
        if (packedSprite) {
          const atlasW = atlasConfig.packed.texture.width;
          const atlasH = atlasConfig.packed.texture.height;
          spriteMap = {
            frameSize: {
              w: Math.round(packedSprite.uvW * atlasW),
              h: Math.round(packedSprite.uvH * atlasH),
            },
            layers: [{ tile: d.sprite }],
          };
        }
      }

      const entity = createDecoration({
        type: d.type || "decoration",
        sprite: d.sprite,
        x: d.x,
        z: d.z,
        yaw: d.yaw,
        scale: d.scale,
        blocksMove: d.blocksMove,
        spriteMap,
      });
      entity.alive = true;
      game.dungeon.decorations.add(entity);
      return { ...d, _entityId: entity.id };
    });

    if (game && renderer) {
      renderer.setEntities(game.dungeon.decorations.list);
    }
    setCellDecorations({ ...cellDecorations, [key]: synced });
    renderer?.rebuild();
  }

  return (
    <>
      <Modal
        onClose={onClose}
        title={`Cell (${cx}, ${cz})`}
        bare
        className={styles.panel}
        searchFilter
      >
        <AccordionSection title="Position">
          <Row label="Column (cx)" value={cx} />
          <Row label="Row (cz)" value={cz} />
          <div className={styles.rowCenter}>
            <span className={styles.labelWide}>Region ID</span>
            {outputs ? (
              <select
                value={currentRegionId}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    const maxId =
                      regionIds.length > 0 ? Math.max(...regionIds) : 0;
                    writeRegionId(Math.min(maxId + 1, 255));
                  } else {
                    writeRegionId(Number(v));
                  }
                }}
                className={styles.select}
              >
                <option value={0}>0 (unassigned)</option>
                {regionIds.map((id) => (
                  <option key={id} value={id}>
                    {id} ({roomsMap?.get(id)?.type ?? "room"})
                  </option>
                ))}
                <option value="__new__">+ Add new region</option>
              </select>
            ) : (
              <span className={styles.value}>
                {currentRegionId || "0 (unassigned)"}
              </span>
            )}
          </div>
          {currentRegionId > 0 && roomsMap?.has(currentRegionId) && outputs && (
            <div className={styles.rowCenter}>
              <span className={styles.labelWide}>Room type</span>
              <select
                value={room?.type ?? "room"}
                onChange={(e) =>
                  writeRoomType(e.target.value as "room" | "corridor")
                }
                className={styles.select}
              >
                <option value="room">Room</option>
                <option value="corridor">Corridor</option>
              </select>
            </div>
          )}
          {room && (
            <>
              <Row
                label="Room origin"
                value={`(${room.rect.x}, ${room.rect.y})`}
              />
              <Row
                label="Room size"
                value={`${room.rect.w} × ${room.rect.h}`}
              />
            </>
          )}
        </AccordionSection>

        {outputs && (
          <AccordionSection title="Cell Flags">
            <Row label="Solid (wall)" value={isSolid ? "yes" : "no"} />
            <Row label="Distance to wall" value={distToWall ?? "—"} />
            <Row label="Hazard" value={hazard ?? "—"} />
            <Row
              label="Temperature"
              value={temperature != null ? `${temperature} / 255` : "—"}
            />
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Collision Flags">
            <ColliderFlagsEditor
              value={colliderValue}
              onChange={writeColliderFlags}
              customFlagNames={customFlagNames}
              onCustomFlagNamesChange={setCustomFlagNames}
            />
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Floor Layer">
            <Row label="Floor type index" value={floorType ?? "—"} />
            <Row label="Default floor tile" value={floorTileName} />
            {floorTileId != null && (
              <Row label="Atlas tile ID" value={floorTileId} />
            )}
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Wall Layer">
            <Row label="Wall type index" value={wallType ?? "—"} />
            <Row label="Default wall tile" value={wallTileName} />
            {wallTileId != null && (
              <Row label="Atlas tile ID" value={wallTileId} />
            )}
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Ceiling Layer">
            <Row label="Ceiling type index" value={ceilType ?? "—"} />
            <Row label="Default ceiling tile" value={ceilTileName} />
            {ceilTileId != null && (
              <Row label="Atlas tile ID" value={ceilTileId} />
            )}
          </AccordionSection>
        )}

        {atlasConfig && (texFloor || texCeil) && (
          <AccordionSection
            title={`Height Offsets (floor: ${floorIsPit ? "pit" : floorSteps > 0 ? `+${floorSteps}` : floorSteps}, ceil: ${ceilIsSky ? "sky" : ceilSteps > 0 ? `+${ceilSteps}` : ceilSteps})`}
          >
            <SliderRow
              label="Floor offset"
              steps={floorSteps}
              isPit={floorIsPit}
              onChange={(s) => writeFloor(Math.max(1, OFFSET_NEUTRAL + s))}
              onPitToggle={() => writeFloor(floorIsPit ? OFFSET_NEUTRAL : 0)}
            />
            <SliderRow
              label="Ceiling offset"
              steps={ceilSteps}
              isSky={ceilIsSky}
              onChange={(s) => writeCeil(OFFSET_NEUTRAL - s)}
              onSkyToggle={() => writeCeil(ceilIsSky ? OFFSET_NEUTRAL : 127)}
            />
            {!texFloor && !texCeil && (
              <span className={styles.mutedNoteSm}>
                stored locally — generate dungeon to apply
              </span>
            )}
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Surface Layers">
            <div className={styles.rowFlexStart}>
              <div className={styles.paintColumn}>
                {(["floor", "wall", "ceil"] as const).map((f) => {
                  const names = paintTarget[f];
                  if (!names?.length) return null;
                  return (
                    <div key={f} className={styles.paintRow}>
                      <span className={styles.paintLabel}>{f}</span>
                      <span className={styles.value}>{names.join(", ")}</span>
                    </div>
                  );
                })}
                {!paintTarget.floor?.length &&
                  !paintTarget.wall?.length &&
                  !paintTarget.ceil?.length && (
                    <span className={styles.mutedNote}>none</span>
                  )}
              </div>
              <button
                onClick={() => setPaintOpen(true)}
                title="Edit surface layers"
                className={styles.ellipsisBtn}
              >
                …
              </button>
            </div>
            <div className={styles.rowCenter} style={{ marginTop: 4 }}>
              <div className={styles.paintColumn}>
                <div className={styles.paintRow}>
                  <span className={styles.paintLabelSm}>floor skirt</span>
                  <span
                    className={
                      floorSkirtLayers.length
                        ? styles.valueSm
                        : styles.mutedValueSm
                    }
                  >
                    {floorSkirtLayers.length
                      ? floorSkirtLayers.join(", ")
                      : "default"}
                  </span>
                </div>
                <div className={styles.paintRow}>
                  <span className={styles.paintLabelSm}>ceil skirt</span>
                  <span
                    className={
                      ceilSkirtLayers.length
                        ? styles.valueSm
                        : styles.mutedValueSm
                    }
                  >
                    {ceilSkirtLayers.length
                      ? ceilSkirtLayers.join(", ")
                      : "default"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSkirtOpen(true)}
                title="Edit skirt tiles"
                className={styles.ellipsisBtn}
              >
                …
              </button>
            </div>
          </AccordionSection>
        )}

        <AccordionSection
          title={`Decorations${(cellDecorations[key]?.length ?? 0) > 0 ? ` (${cellDecorations[key].length})` : ""}`}
        >
          <DecorationEditor
            cx={cx}
            cz={cz}
            decorations={cellDecorations[key] ?? []}
            onChange={syncDecorations}
          />
        </AccordionSection>

        {!outputs && (
          <div className={styles.emptyNote}>
            Dungeon outputs not yet available — generate a dungeon first.
          </div>
        )}
      </Modal>

      {paintOpen && (
        <OverlayPaintModal
          cx={cx}
          cz={cz}
          onClose={() => setPaintOpen(false)}
        />
      )}
      {skirtOpen && (
        <SkirtPaintModal cx={cx} cz={cz} onClose={() => setSkirtOpen(false)} />
      )}
    </>
  );
}
