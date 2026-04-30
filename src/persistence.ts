import type { RendererSettings } from "./DataContext";
import type { TextureAtlasJson } from "atomic-core";

const DB_NAME = "ac-dc-edit";
const DB_VERSION = 2;
const STORE_ATLAS = "atlasEntries";
const STORE_SKYBOX = "skyboxConfig";
const LS_SETTINGS = "ac-dc-edit:settings";
const LS_TILES = "ac-dc-edit:tileAssignments";
const LS_SKYBOX_LEGACY = "ac-dc-edit:skybox";

export interface StoredAtlasEntry {
  id: string;
  pngName: string;
  jsonName: string;
  pngBlob: Blob;
  json: TextureAtlasJson;
  spriteNames: string[];
}

export interface TileAssignments {
  floorTile: string;
  wallTile: string;
  ceilTile: string;
  floorSkirtTile?: string;
  ceilSkirtTile?: string;
}

export interface StoredSkyboxConfig {
  faces: { px: string; nx: string; py: string; ny: string; pz: string; nz: string; };
  rotationY?: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ATLAS)) {
        db.createObjectStore(STORE_ATLAS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SKYBOX)) {
        db.createObjectStore(STORE_SKYBOX, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAtlasEntries(
  entries: StoredAtlasEntry[],
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATLAS, "readwrite");
    const store = tx.objectStore(STORE_ATLAS);
    store.clear();
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAtlasEntries(): Promise<StoredAtlasEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATLAS, "readonly");
    const req = tx.objectStore(STORE_ATLAS).getAll();
    req.onsuccess = () => resolve(req.result as StoredAtlasEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSkyboxConfig(config: StoredSkyboxConfig | null): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SKYBOX, "readwrite");
    const store = tx.objectStore(STORE_SKYBOX);
    store.clear();
    if (config) store.put({ id: "skybox", ...config });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSkyboxConfig(): Promise<StoredSkyboxConfig | null> {
  const db = await openDb();
  const fromIdb = await new Promise<StoredSkyboxConfig | null>((resolve, reject) => {
    const tx = db.transaction(STORE_SKYBOX, "readonly");
    const req = tx.objectStore(STORE_SKYBOX).get("skybox");
    req.onsuccess = () => {
      const row = req.result as ({ id: string } & StoredSkyboxConfig) | undefined;
      resolve(row ? { faces: row.faces, rotationY: row.rotationY } : null);
    };
    req.onerror = () => reject(req.error);
  });

  if (fromIdb) return fromIdb;

  // One-time migration from localStorage (pre-IDB skybox storage).
  try {
    const raw = localStorage.getItem(LS_SKYBOX_LEGACY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSkyboxConfig;
      localStorage.removeItem(LS_SKYBOX_LEGACY);
      void saveSkyboxConfig(parsed);
      return parsed;
    }
  } catch { /* ignore */ }

  return null;
}

export function saveSettings(settings: RendererSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function loadSettings(): RendererSettings | null {
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? (JSON.parse(raw) as RendererSettings) : null;
  } catch {
    return null;
  }
}

export function saveTileAssignments(a: TileAssignments): void {
  try {
    localStorage.setItem(LS_TILES, JSON.stringify(a));
  } catch {
    // ignore quota errors
  }
}

export function loadTileAssignments(): TileAssignments | null {
  try {
    const raw = localStorage.getItem(LS_TILES);
    return raw ? (JSON.parse(raw) as TileAssignments) : null;
  } catch {
    return null;
  }
}
