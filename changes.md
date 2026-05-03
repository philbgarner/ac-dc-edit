# atomic-core change request: `snapCameraToFloor`

## Background

The dungeon renderer supports per-cell floor height offsets via the `floorHeightOffset` texture (R8 encoding: 128 = neutral, >128 = raised, <128 = lowered, 0 = pit). These offsets affect rendered floor geometry but the camera Y position ignores them — it is always hardcoded to `ceilingHeight * eyeHeightFactor` every frame in the RAF loop.

This change adds opt-in behaviour so the camera Y tracks the floor height at the player's current cell, creating a true first-person "step up / step down" effect as the player moves between height-offset cells.

---

## File: `src/lib/rendering/dungeonRenderer.ts`

### Change 1 — Add option to `DungeonRendererOptions`

After the `eyeHeightFactor` option (currently around line 117), add:

```typescript
  /**
   * When true, the camera Y position tracks the floor height offset at the
   * player's current cell (in addition to the normal eyeHeightFactor offset).
   * Transitions are smoothed by the same lerpFactor used for X/Z movement.
   * Default: false.
   */
  snapCameraToFloor?: boolean;
```

---

### Change 2 — Hoist `offsetStep` to the outer function scope

`offsetStep` is currently computed inside `buildDungeon` / `buildFloors` as a local:

```typescript
const offsetStep = tileSize * (options.offsetFactor ?? 0.5);
```

Hoist this to the outer scope of `createDungeonRenderer` (near where `tileSize`, `ceilingH`, and `eyeHeightFactor` are captured from options) so the `onTurn` handler can reference it without entering the build path:

```typescript
const offsetStep = tileSize * (options.offsetFactor ?? 0.5);
```

Remove or replace the local declaration inside the build function with a reference to the hoisted variable. (There are two local declarations — around lines 1008 and 1261 — both can reference the hoisted value instead.)

---

### Change 3 — Add `tgtY` / `curY` to the camera lerp state

The existing lerp state block (around line 1939) is:

```typescript
// ── Camera lerp state ─────────────────────────────────────────────────────
let tgtX = 0,
  tgtZ = 0,
  tgtYaw = 0;
let curX = 0,
  curZ = 0,
  curYaw = 0;
let initialized = false;
```

Add `tgtY` and `curY`:

```typescript
// ── Camera lerp state ─────────────────────────────────────────────────────
let tgtX = 0,
  tgtZ = 0,
  tgtYaw = 0;
let tgtY = ceilingH * eyeHeightFactor;
let curX = 0,
  curZ = 0,
  curYaw = 0;
let curY = ceilingH * eyeHeightFactor;
let initialized = false;
```

---

### Change 4 — Compute `tgtY` in `onTurn`

Add a mutable flag that the runtime setter (Change 6) can toggle:

```typescript
let snapToFloor = options.snapCameraToFloor ?? false;
```

Place this near the other captured option values.

Then update `onTurn` to compute `tgtY`. The full updated function:

```typescript
const onTurn = () => {
  buildDungeon();
  tgtX = (game.player.x + 0.5) * tileSize;
  tgtZ = (game.player.z + 0.5) * tileSize;
  tgtYaw = game.player.facing;

  if (snapToFloor) {
    const outputs = game.dungeon.outputs;
    const floorOffData = outputs?.textures.floorHeightOffset?.image.data as Uint8Array | undefined;
    if (floorOffData && outputs) {
      const idx = game.player.z * outputs.width + game.player.x;
      const floorVal = floorOffData[idx];
      // floorVal === 0 means pit — treat as neutral for camera purposes
      const floorOffset = floorVal !== 0 ? (floorVal - 128) * offsetStep : 0;
      tgtY = ceilingH * eyeHeightFactor + floorOffset;
    } else {
      tgtY = ceilingH * eyeHeightFactor;
    }
  } else {
    tgtY = ceilingH * eyeHeightFactor;
  }

  if (!initialized) {
    curX = tgtX;
    curZ = tgtZ;
    curYaw = tgtYaw;
    curY = tgtY;
    initialized = true;
  }
};
```

---

### Change 5 — Lerp `curY` and use it in `camera.position.set`

In the `tick` function, the existing lerp + camera set block is:

```typescript
const k = 1 - Math.pow(1 - lerpFactor, dt * 60);
curX += (tgtX - curX) * k;
curZ += (tgtZ - curZ) * k;

let dy = tgtYaw - curYaw;
if (dy > Math.PI) dy -= 2 * Math.PI;
if (dy < -Math.PI) dy += 2 * Math.PI;
curYaw += dy * k;

camera.position.set(curX, ceilingH * eyeHeightFactor, curZ);
```

Replace with:

```typescript
const k = 1 - Math.pow(1 - lerpFactor, dt * 60);
curX += (tgtX - curX) * k;
curY += (tgtY - curY) * k;
curZ += (tgtZ - curZ) * k;

let dy = tgtYaw - curYaw;
if (dy > Math.PI) dy -= 2 * Math.PI;
if (dy < -Math.PI) dy += 2 * Math.PI;
curYaw += dy * k;

camera.position.set(curX, curY, curZ);
```

---

### Change 6 — Add `setSnapCameraToFloor` to the returned `DungeonRenderer` object

Following the pattern of `setAmbientOcclusion` and `setSurfaceLighting`, add to the returned object literal (around line 2217):

```typescript
setSnapCameraToFloor(enabled: boolean) {
  snapToFloor = enabled;
  tgtY = ceilingH * eyeHeightFactor;
  if (enabled && initialized) {
    const outputs = game.dungeon.outputs;
    const floorOffData = outputs?.textures.floorHeightOffset?.image.data as Uint8Array | undefined;
    if (floorOffData && outputs) {
      const idx = game.player.z * outputs.width + game.player.x;
      const floorVal = floorOffData[idx];
      const floorOffset = floorVal !== 0 ? (floorVal - 128) * offsetStep : 0;
      tgtY = ceilingH * eyeHeightFactor + floorOffset;
    }
  }
},
```

---

## File: `src/lib/rendering/dungeonRenderer.d.ts` (or wherever `DungeonRenderer` type is declared)

### Change 7 — Add option to `DungeonRendererOptions` type

After `eyeHeightFactor`:

```typescript
  /**
   * When true, the camera Y position tracks the floor height offset at the
   * player's current cell (in addition to the normal eyeHeightFactor offset).
   * Transitions are smoothed by the same lerpFactor used for X/Z movement.
   * Default: false.
   */
  snapCameraToFloor?: boolean;
```

### Change 8 — Add method to `DungeonRenderer` type

After `setSurfaceLighting` (and before `setSkybox`):

```typescript
  /**
   * Enable or disable floor-height camera tracking at runtime without
   * rebuilding the renderer. When enabled, the camera Y lerps to
   * `ceilingHeight * eyeHeightFactor + floorOffset` at the player's cell.
   * Takes effect immediately on the next rendered frame.
   */
  setSnapCameraToFloor(enabled: boolean): void;
```

---

## Summary of changes

| Location | What |
|---|---|
| `DungeonRendererOptions` | Add `snapCameraToFloor?: boolean` option |
| outer scope of `createDungeonRenderer` | Hoist `offsetStep`, add `snapToFloor` flag, add `tgtY`/`curY` lerp variables |
| `onTurn` | Compute `tgtY` from floor texture when `snapToFloor` is true |
| `tick` RAF loop | Lerp `curY`; pass `curY` to `camera.position.set` instead of the hardcoded expression |
| returned object | Add `setSnapCameraToFloor(enabled)` method |
| type declarations | Mirror both additions in the public types |
