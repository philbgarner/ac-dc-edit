# Bug: Sky panels emit on wrong faces — follow-up to v0.9.2 fix

## File

`src/lib/rendering/dungeonRenderer.ts` (compiled: `dist/atomic-core.js`)

## Context

The v0.9.2 fix replaced `isSolid(neighbour)` with `isOpenSkyCeil(neighbour)` in the sky-panel emission block (dist lines ~5622–5625). That correctly enables sky panels on non-sky cells that face open-sky neighbours. However it introduced a new defect: **open-sky cells with `skyPanelCount > 0` now emit panels toward every adjacent open-sky neighbour**, producing unwanted extra panels at 90-degree rotations.

The original intent was two distinct behaviours:

| Cell type | Correct trigger |
|---|---|
| Open-sky cell (`isOpenSky = true`) | Face borders a **solid wall** — panel sits above the wall top (original feature) |
| Non-sky cell (`isOpenSky = false`) | Face borders an **open-sky neighbour** — panel sits above the ceiling edge facing the sky opening (new feature) |

Applying `isOpenSkyCeil` unconditionally collapses both cases into one and causes open-sky cells to emit panels toward other sky cells.

---

## Root Cause

Current code after the v0.9.2 fix (around dist line 5622 / source line 1670):

```typescript
if (isOpenSkyCeil(cx, cz - 1)) emitSkyPanels(wx, cz * tileSize, 0);
if (isOpenSkyCeil(cx, cz + 1)) emitSkyPanels(wx, (cz + 1) * tileSize, Math.PI);
if (isOpenSkyCeil(cx - 1, cz)) emitSkyPanels(cx * tileSize, wz, HALF_PI);
if (isOpenSkyCeil(cx + 1, cz)) emitSkyPanels((cx + 1) * tileSize, wz, -HALF_PI);
```

When the current cell is open-sky and all its walkable neighbours are also open-sky, all four calls fire — generating panels on every side. Only the face pointing toward the non-sky room should emit; the lateral faces (rotated 90°) should not.

---

## Fix

Branch on `isOpenSky` so each cell type uses the correct predicate. `isOpenSky` is already computed just above this block from `ceilVal === 0`.

```typescript
// Sky panels: open-sky cells emit toward solid walls (above wall-top trim);
// non-sky cells emit toward open-sky neighbours (ceiling-edge trim facing sky opening).
const skyCount = skyPanelCountData ? (skyPanelCountData[idx] ?? 0) : 0;
if (skyCount > 0) {
  function emitSkyPanels(mx: number, mz: number, ry: number) {
    for (let i = 0; i < skyCount; i++) {
      skyPanelEdges.push(makeFaceMatrix(mx, ceilingH + i * tileSize + tileSize / 2, mz, 0, ry, 0, tileSize, tileSize));
      skyPanelRects.push(getUvRect(wallId));
      skyPanelRots.push(0);
      skyPanelHeightScales.push(1.0);
      skyPanelRowIndexes.push(i);
      skyPanelCellMap.push({ cx, cz });
    }
  }
  if (isOpenSky) {
    // Original behaviour: sky cell facing a wall.
    if (isSolid(cx, cz - 1)) emitSkyPanels(wx, cz * tileSize, 0);
    if (isSolid(cx, cz + 1)) emitSkyPanels(wx, (cz + 1) * tileSize, Math.PI);
    if (isSolid(cx - 1, cz)) emitSkyPanels(cx * tileSize, wz, HALF_PI);
    if (isSolid(cx + 1, cz)) emitSkyPanels((cx + 1) * tileSize, wz, -HALF_PI);
  } else {
    // New behaviour: non-sky cell facing an open-sky neighbour.
    if (isOpenSkyCeil(cx, cz - 1)) emitSkyPanels(wx, cz * tileSize, 0);
    if (isOpenSkyCeil(cx, cz + 1)) emitSkyPanels(wx, (cz + 1) * tileSize, Math.PI);
    if (isOpenSkyCeil(cx - 1, cz)) emitSkyPanels(cx * tileSize, wz, HALF_PI);
    if (isOpenSkyCeil(cx + 1, cz)) emitSkyPanels((cx + 1) * tileSize, wz, -HALF_PI);
  }
}
```

No new helpers are needed. `isOpenSky`, `isSolid`, and `isOpenSkyCeil` are all already in scope.

---

## Behaviour matrix

| Cell type | Neighbour type | Before v0.9.2 | After v0.9.2 | After this fix |
|---|---|---|---|---|
| Open-sky | Solid wall | Panel ✓ | No panel ✗ | Panel ✓ |
| Open-sky | Open-sky | No panel ✓ | Panel ✗ (the bug) | No panel ✓ |
| Non-sky | Solid wall | Panel ✗ | No panel ✓ | No panel ✓ |
| Non-sky | Open-sky | No panel ✗ | Panel ✓ | Panel ✓ |
