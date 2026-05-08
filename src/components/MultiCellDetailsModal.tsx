import { useState } from "react";
import Modal from "./Modal";
import AccordionSection from "./AccordionSection";
import OverlayPaintModal from "./OverlayPaintModal";
import SkirtPaintModal from "./SkirtPaintModal";
import ColliderFlagsEditor from "./ColliderFlagsEditor";
import { useData } from "../DataContext";
import { setSkyPanelCount, setCeilingPanelCount } from "atomic-core";
import styles from "./CellDetailsModal.module.css";

const OFFSET_NEUTRAL = 128;

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

export default function MultiCellDetailsModal({ onClose }: Props) {
  const {
    selectedCells,
    setSelectedCells,
    game,
    cellHeights,
    setCellHeights,
    cellColliderFlags,
    setCellColliderFlags,
    customFlagNames,
    setCustomFlagNames,
    renderer,
  } = useData();
  const [floorSteps, setFloorSteps] = useState(0);
  const [ceilSteps, setCeilSteps] = useState(0);
  const [floorIsPit, setFloorIsPit] = useState(false);
  const [ceilIsSky, setCeilIsSky] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const [skirtOpen, setSkirtOpen] = useState(false);
  const [panelTileOpen, setPanelTileOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  if (selectedCells.length === 0) return null;

  const outputs = game?.dungeon.outputs;
  const width = outputs?.width ?? 0;
  const texFloor = outputs?.textures.floorHeightOffset;
  const texCeil = outputs?.textures.ceilingHeightOffset;

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

  const firstCell = selectedCells[0];
  const commonRegionId: number = texRegionData
    ? (texRegionData[firstCell.cz * width + firstCell.cx] ?? 0)
    : (firstCell.regionId ?? 0);
  const allSameRegion = selectedCells.every(
    (c) =>
      (texRegionData ? texRegionData[c.cz * width + c.cx] : c.regionId) ===
      commonRegionId,
  );

  function writeAllRegionId(newId: number) {
    if (!outputs || !texRegionData) return;
    const affectedOldIds = new Set<number>();
    for (const { cx, cz } of selectedCells) {
      const oldId = texRegionData[cz * width + cx];
      if (oldId > 0) affectedOldIds.add(oldId);
      texRegionData[cz * width + cx] = newId;
      if (bspOutputs?.fullRegionIds)
        bspOutputs.fullRegionIds[cz * width + cx] = newId;
    }
    if (roomsMap) {
      const H = outputs.height;
      for (const oldId of affectedOldIds) {
        const rect = computeRegionRect(texRegionData, width, H, oldId);
        if (rect) roomsMap.get(oldId)!.rect = rect;
        else roomsMap.delete(oldId);
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
    setSelectedCells(selectedCells.map((c) => ({ ...c, regionId: newId })));
    renderer?.rebuild();
  }

  function writeRoomType(newType: "room" | "corridor") {
    if (roomsMap && commonRegionId > 0 && roomsMap.has(commonRegionId)) {
      roomsMap.get(commonRegionId)!.type = newType;
    }
    setSelectedCells([...selectedCells]);
    renderer?.rebuild();
  }

  function writeAllFloor(r8: number) {
    if (texFloor?.image.data) {
      for (const { cx, cz } of selectedCells)
        (texFloor.image.data as Uint8Array)[cz * width + cx] = r8;
    }
    const next = { ...cellHeights };
    for (const { cx, cz } of selectedCells) {
      const key = `${cx},${cz}`;
      next[key] = { floor: r8, ceil: next[key]?.ceil ?? OFFSET_NEUTRAL };
    }
    setCellHeights(next);
    renderer?.rebuild();
  }

  function writeAllCeil(r8: number) {
    if (texCeil?.image.data) {
      for (const { cx, cz } of selectedCells)
        (texCeil.image.data as Uint8Array)[cz * width + cx] = r8;
    }
    const next = { ...cellHeights };
    for (const { cx, cz } of selectedCells) {
      const key = `${cx},${cz}`;
      next[key] = { floor: next[key]?.floor ?? OFFSET_NEUTRAL, ceil: r8 };
    }
    setCellHeights(next);
    renderer?.rebuild();
  }

  const texSkyPanels = (outputs?.textures as unknown as { skyPanelCount?: { image: { data: Uint8Array } } })?.skyPanelCount;
  const texCeilPanels = (outputs?.textures as unknown as { ceilingPanelCount?: { image: { data: Uint8Array } } })?.ceilingPanelCount;
  const skyPanelCount = texSkyPanels ? (texSkyPanels.image.data[firstCell.cz * width + firstCell.cx] ?? 0) : 0;
  const ceilPanelCount = texCeilPanels ? (texCeilPanels.image.data[firstCell.cz * width + firstCell.cx] ?? 0) : 0;

  function writeAllSkyPanelCount(count: number) {
    if (!outputs) return;
    for (const { cx, cz } of selectedCells)
      setSkyPanelCount(outputs as Parameters<typeof setSkyPanelCount>[0], cx, cz, count);
    renderer?.rebuild();
    forceUpdate(n => n + 1);
  }

  function writeAllCeilPanelCount(count: number) {
    if (!outputs) return;
    for (const { cx, cz } of selectedCells)
      setCeilingPanelCount(outputs as Parameters<typeof setCeilingPanelCount>[0], cx, cz, count);
    renderer?.rebuild();
    forceUpdate(n => n + 1);
  }

  const minX = Math.min(...selectedCells.map((c) => c.cx));
  const maxX = Math.max(...selectedCells.map((c) => c.cx));
  const minZ = Math.min(...selectedCells.map((c) => c.cz));
  const maxZ = Math.max(...selectedCells.map((c) => c.cz));

  const texCollider = outputs?.textures.colliderFlags as
    | { image: { data: Uint8Array } }
    | undefined;
  const firstKey = `${firstCell.cx},${firstCell.cz}`;
  const colliderValue: number = texCollider?.image.data
    ? (texCollider.image.data[firstCell.cz * width + firstCell.cx] ?? 0)
    : (cellColliderFlags[firstKey] ?? 0);

  function writeAllColliderFlags(v: number) {
    if (texCollider?.image.data) {
      for (const { cx, cz } of selectedCells)
        texCollider.image.data[cz * width + cx] = v;
    }
    const next = { ...cellColliderFlags };
    for (const { cx, cz } of selectedCells) next[`${cx},${cz}`] = v;
    setCellColliderFlags(next);
    renderer?.rebuild();
  }

  return (
    <>
      <Modal
        onClose={onClose}
        title={`Selection (${selectedCells.length} cells)`}
        bare
        className={styles.panel}
        searchFilter
      >
        <AccordionSection title="Selection">
          <div className={styles.row}>
            <span className={styles.label}>Cell count</span>
            <span className={styles.value}>{selectedCells.length}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>X range</span>
            <span className={styles.value}>
              {minX} – {maxX}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Z range</span>
            <span className={styles.value}>
              {minZ} – {maxZ}
            </span>
          </div>
        </AccordionSection>

        {outputs && texRegionData && (
          <AccordionSection title="Region">
            <div className={styles.mutedNoteSm} style={{ marginBottom: 4 }}>
              {allSameRegion
                ? `All cells in region ${commonRegionId || "(unassigned)"}`
                : "Mixed regions — assigning will override all"}
            </div>
            <div className={styles.rowCenter}>
              <span className={styles.labelSm}>Region ID</span>
              <select
                value={allSameRegion ? commonRegionId : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    const maxId =
                      regionIds.length > 0 ? Math.max(...regionIds) : 0;
                    writeAllRegionId(Math.min(maxId + 1, 255));
                  } else if (v !== "") {
                    writeAllRegionId(Number(v));
                  }
                }}
                className={styles.select}
              >
                {!allSameRegion && <option value="">— mixed —</option>}
                <option value={0}>0 (unassigned)</option>
                {regionIds.map((id) => (
                  <option key={id} value={id}>
                    {id} ({roomsMap?.get(id)?.type ?? "room"})
                  </option>
                ))}
                <option value="__new__">+ Add new region</option>
              </select>
            </div>
            {allSameRegion &&
              commonRegionId > 0 &&
              roomsMap?.has(commonRegionId) && (
                <div className={styles.rowCenter} style={{ marginTop: 4 }}>
                  <span className={styles.labelSm}>Room type</span>
                  <select
                    value={roomsMap.get(commonRegionId)?.type ?? "room"}
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
          </AccordionSection>
        )}

        {outputs && (texFloor || texCeil) && (
          <AccordionSection
            title={`Height Offsets (floor: ${floorIsPit ? "pit" : floorSteps > 0 ? `+${floorSteps}` : floorSteps}, ceil: ${ceilIsSky ? "sky" : ceilSteps > 0 ? `+${ceilSteps}` : ceilSteps})`}
          >
            <SliderRow
              label="Floor offset"
              steps={floorSteps}
              isPit={floorIsPit}
              onChange={(s) => {
                setFloorSteps(s);
                writeAllFloor(Math.max(1, OFFSET_NEUTRAL + s));
              }}
              onPitToggle={() => {
                const next = !floorIsPit;
                setFloorIsPit(next);
                writeAllFloor(next ? 0 : OFFSET_NEUTRAL);
              }}
            />
            <SliderRow
              label="Ceiling offset"
              steps={ceilSteps}
              isSky={ceilIsSky}
              onChange={(s) => {
                setCeilSteps(s);
                writeAllCeil(OFFSET_NEUTRAL - s);
              }}
              onSkyToggle={() => {
                const next = !ceilIsSky;
                setCeilIsSky(next);
                writeAllCeil(next ? 0 : OFFSET_NEUTRAL);
              }}
            />
          </AccordionSection>
        )}

        {outputs && (texSkyPanels || texCeilPanels) && (
          <AccordionSection title={`Panels (sky: ${skyPanelCount}, ceil: ${ceilPanelCount})`}>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>Sky panels</span>
              <input
                type="range" min={0} max={4} step={1} value={skyPanelCount}
                onChange={e => writeAllSkyPanelCount(Number(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.sliderValue}>{skyPanelCount}</span>
            </div>
            <div className={styles.sliderRow}>
              <span className={styles.sliderLabel}>Ceiling panels</span>
              <input
                type="range" min={0} max={4} step={1} value={ceilPanelCount}
                onChange={e => writeAllCeilPanelCount(Number(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.sliderValue}>{ceilPanelCount}</span>
            </div>
            <div className={styles.rowCenter} style={{ marginTop: 4 }}>
              <span className={styles.labelFlex}>Per-row tile overrides</span>
              <button
                onClick={() => setPanelTileOpen(true)}
                title="Edit per-row tiles for sky and ceiling panels"
                className={styles.ellipsisBtn}
              >
                …
              </button>
            </div>
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Surface Layers">
            <div className={styles.rowCenter}>
              <span className={styles.labelFlex}>
                Apply paint layers to all {selectedCells.length} selected cells
              </span>
              <button
                onClick={() => setPaintOpen(true)}
                title="Edit surface layers for all selected cells"
                className={styles.ellipsisBtn}
              >
                …
              </button>
            </div>
            <div className={styles.rowCenter} style={{ marginTop: 4 }}>
              <span className={styles.labelFlex}>
                Apply skirt tiles to all {selectedCells.length} selected cells
              </span>
              <button
                onClick={() => setSkirtOpen(true)}
                title="Edit skirt tiles for all selected cells"
                className={styles.ellipsisBtn}
              >
                …
              </button>
            </div>
          </AccordionSection>
        )}

        {outputs && (
          <AccordionSection title="Collision Flags">
            <div className={styles.mutedNoteSm} style={{ marginBottom: 4 }}>
              Applies to all {selectedCells.length} selected cells (shown from
              first cell)
            </div>
            <ColliderFlagsEditor
              value={colliderValue}
              onChange={writeAllColliderFlags}
              customFlagNames={customFlagNames}
              onCustomFlagNamesChange={setCustomFlagNames}
            />
          </AccordionSection>
        )}

        {!outputs && (
          <div className={styles.emptyNote}>
            Generate a dungeon first to enable height and layer editing.
          </div>
        )}
      </Modal>

      {paintOpen && firstCell && (
        <OverlayPaintModal
          cx={firstCell.cx}
          cz={firstCell.cz}
          cells={selectedCells}
          onClose={() => setPaintOpen(false)}
        />
      )}
      {skirtOpen && firstCell && (
        <SkirtPaintModal
          cx={firstCell.cx}
          cz={firstCell.cz}
          cells={selectedCells}
          onClose={() => setSkirtOpen(false)}
        />
      )}
      {panelTileOpen && firstCell && (
        <OverlayPaintModal
          cx={firstCell.cx}
          cz={firstCell.cz}
          cells={selectedCells}
          initialShowExt
          initialExtFace="skyPanels"
          onClose={() => setPanelTileOpen(false)}
        />
      )}
    </>
  );
}
