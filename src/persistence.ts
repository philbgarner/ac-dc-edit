import type { RendererSettings } from "./DataContext";
import type { TextureAtlasJson } from "atomic-core";

const DB_NAME = "ac-dc-edit";
const DB_VERSION = 1;
const STORE_ATLAS = "atlasEntries";
const LS_SETTINGS = "ac-dc-edit:settings";
const LS_TILES = "ac-dc-edit:tileAssignments";

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_ATLAS, { keyPath: "id" });
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
