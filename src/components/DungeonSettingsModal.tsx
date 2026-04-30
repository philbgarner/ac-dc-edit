import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import { useData, DEFAULT_RENDERER_SETTINGS } from "../DataContext";
import type { RendererSettings } from "../DataContext";

interface Props {
  onClose: () => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  const display = format ? format(value) : String(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "#7080b0", minWidth: 160 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: "#5870d0" }}
      />
      <span style={{ color: "#e0e8ff", minWidth: 52, textAlign: "right" }}>{display}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
function Section({ title, children }: SectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ color: "#5870d0", fontWeight: "bold", marginBottom: 2, borderBottom: "1px solid #203060", paddingBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Skybox helpers ────────────────────────────────────────────────────────────

const FACES = ["px", "nx", "py", "ny", "pz", "nz"] as const;
type FaceName = typeof FACES[number];
type SkyboxTab = "individual" | "atlas";
interface FaceRect { x: number; y: number; w: number; h: number; }

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function bakeAtlasFace(atlasImg: HTMLImageElement, rect: FaceRect): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, rect.w);
  canvas.height = Math.max(1, rect.h);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(atlasImg, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.toDataURL("image/png");
}

function FaceThumb({ src }: { src?: string }) {
  return (
    <div style={{ width: 32, height: 32, border: "1px solid #1e3050", borderRadius: 2, background: "#0d1b2a", overflow: "hidden", flexShrink: 0 }}>
      {src && <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </div>
  );
}

function AtlasCropPreview({ atlasDataUrl, rect }: { atlasDataUrl: string | null; rect: FaceRect | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const x = rect?.x, y = rect?.y, w = rect?.w, h = rect?.h;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 32, 32);
    if (!atlasDataUrl || !w || !h) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 32, 32);
      const scale = Math.min(32 / w, 32 / h);
      const dw = w * scale, dh = h * scale;
      ctx.drawImage(img, x ?? 0, y ?? 0, w, h, (32 - dw) / 2, (32 - dh) / 2, dw, dh);
    };
    img.src = atlasDataUrl;
  }, [atlasDataUrl, x, y, w, h]);

  return (
    <canvas ref={canvasRef} width={32} height={32}
      style={{ border: "1px solid #1e3050", borderRadius: 2, background: "#0d1b2a", flexShrink: 0 }} />
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DungeonSettingsModal({ onClose }: Props) {
  const { rendererSettings, setRendererSettings, skyboxConfig, setSkyboxConfig } = useData();
  const [local, setLocal] = useState<RendererSettings>({ ...rendererSettings });

  const [skyboxTab, setSkyboxTab] = useState<SkyboxTab>("individual");
  const [indivFaces, setIndivFaces] = useState<Partial<Record<FaceName, string>>>(
    () => skyboxConfig?.faces ?? {}
  );
  const [atlasDataUrl, setAtlasDataUrl] = useState<string | null>(null);
  const [atlasRects, setAtlasRects] = useState<Partial<Record<FaceName, FaceRect>>>({});
  const [rotationY, setRotationY] = useState<number | undefined>(skyboxConfig?.rotationY);

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function set<K extends keyof RendererSettings>(key: K, value: RendererSettings[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function setSL<K extends keyof RendererSettings["surfaceLighting"]>(key: K, value: number) {
    setLocal((prev) => ({ ...prev, surfaceLighting: { ...prev.surfaceLighting, [key]: value } }));
  }

  async function handleFaceUpload(face: FaceName, file: File) {
    const dataUrl = await readFileAsDataURL(file);
    setIndivFaces((prev) => ({ ...prev, [face]: dataUrl }));
  }

  async function handleAtlasUpload(file: File) {
    const dataUrl = await readFileAsDataURL(file);
    setAtlasDataUrl(dataUrl);
  }

  function handleRectChange(face: FaceName, field: keyof FaceRect, value: number) {
    setAtlasRects((prev) => ({
      ...prev,
      [face]: { ...(prev[face] ?? { x: 0, y: 0, w: 0, h: 0 }), [field]: value },
    }));
  }

  async function buildFaces(): Promise<Record<FaceName, string> | null> {
    const empty: Record<FaceName, string> = { px: "", nx: "", py: "", ny: "", pz: "", nz: "" };
    if (skyboxTab === "individual") {
      const faces = { ...empty };
      for (const face of FACES) faces[face] = indivFaces[face] ?? "";
      return Object.values(faces).some((v) => v !== "") ? faces : null;
    }
    if (!atlasDataUrl) return null;
    const img = await loadImage(atlasDataUrl);
    const faces = { ...empty };
    for (const face of FACES) {
      const rect = atlasRects[face];
      if (rect && rect.w > 0 && rect.h > 0) faces[face] = bakeAtlasFace(img, rect);
    }
    return Object.values(faces).some((v) => v !== "") ? faces : null;
  }

  async function apply() {
    setRendererSettings(local);
    const faces = await buildFaces();
    setSkyboxConfig(faces ? { faces, rotationY } : null);
    onClose();
  }

  function reset() {
    setLocal({ ...DEFAULT_RENDERER_SETTINGS });
  }

  function clearSkybox() {
    setIndivFaces({});
    setAtlasDataUrl(null);
    setAtlasRects({});
    setRotationY(undefined);
  }

  async function exportAsSixPNGs() {
    let faces: Record<FaceName, string>;
    if (skyboxTab === "individual") {
      faces = { px: "", nx: "", py: "", ny: "", pz: "", nz: "" };
      for (const face of FACES) faces[face] = indivFaces[face] ?? "";
    } else {
      faces = { px: "", nx: "", py: "", ny: "", pz: "", nz: "" };
      if (atlasDataUrl) {
        const img = await loadImage(atlasDataUrl);
        for (const face of FACES) {
          const rect = atlasRects[face];
          if (rect && rect.w > 0 && rect.h > 0) faces[face] = bakeAtlasFace(img, rect);
        }
      }
    }
    for (const face of FACES) {
      const url = faces[face];
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = `skybox_${face}.png`;
      a.click();
    }
  }

  async function exportAsAtlasImage() {
    const facesResult = await buildFaces();
    if (!facesResult) return;
    const pairs = FACES.map((f) => [f, facesResult[f]] as const).filter(([, url]) => !!url);
    const imgs = await Promise.all(pairs.map(([, url]) => loadImage(url)));
    const totalW = imgs.reduce((s, img) => s + img.naturalWidth, 0);
    const maxH = Math.max(...imgs.map((img) => img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = totalW;
    canvas.height = maxH;
    const ctx = canvas.getContext("2d")!;
    let x = 0;
    for (const img of imgs) {
      ctx.drawImage(img, x, 0);
      x += img.naturalWidth;
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "skybox_atlas.png";
    a.click();
  }

  const hasIndivFaces = Object.values(indivFaces).some((v) => v && v !== "");
  const hasAtlasData = !!atlasDataUrl && Object.values(atlasRects).some((r) => r && r.w > 0 && r.h > 0);
  const canExport = skyboxTab === "individual" ? hasIndivFaces : hasAtlasData;

  const inputSm = {
    background: "#0d1b2a", border: "1px solid #1e3050", borderRadius: 3,
    color: "#e0e8ff", fontSize: 11, padding: "2px 4px",
  };

  function tabBtn(active: boolean) {
    return {
      background: active ? "#1a2040" : "none",
      border: `1px solid ${active ? "#4060c0" : "#304060"}`,
      borderRadius: 3,
      color: active ? "#c8d0f8" : "#8090c0",
      cursor: "pointer" as const,
      fontSize: 11,
      padding: "3px 10px",
    };
  }

  const ghostBtn = {
    background: "none", border: "1px solid #304060", borderRadius: 3,
    color: "#8090c0", cursor: "pointer" as const, fontSize: 11, padding: "2px 8px",
  };

  return (
    <Modal onClose={onClose} title="Dungeon Settings">
      <Section title="Camera">
        <SliderRow label="FOV (degrees)" value={local.fov} min={30} max={120} step={1} onChange={(v) => set("fov", v)} />
        <SliderRow label="Eye height factor" value={local.eyeHeightFactor} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set("eyeHeightFactor", v)} />
        <SliderRow label="Lerp factor" value={local.lerpFactor} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set("lerpFactor", v)} />
      </Section>

      <Section title="Fog">
        <SliderRow label="Fog near" value={local.fogNear} min={1} max={50} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set("fogNear", v)} />
        <SliderRow label="Fog far" value={local.fogFar} min={2} max={100} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set("fogFar", v)} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#7080b0", minWidth: 160 }}>Fog color</span>
          <input type="color" value={local.fogColor} onChange={(e) => set("fogColor", e.target.value)}
            style={{ width: 40, height: 24, border: "1px solid #304080", borderRadius: 3, cursor: "pointer", background: "none", padding: 1 }} />
          <span style={{ color: "#e0e8ff" }}>{local.fogColor}</span>
        </div>
      </Section>

      <Section title="Geometry">
        <SliderRow label="Tile size" value={local.tileSize} min={1} max={10} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set("tileSize", v)} />
        <SliderRow label="Ceiling height" value={local.ceilingHeight} min={1} max={10} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set("ceilingHeight", v)} />
        <SliderRow label="Offset factor" value={local.offsetFactor} min={0} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => set("offsetFactor", v)} />
      </Section>

      <Section title="Lighting">
        <SliderRow label="Ambient occlusion" value={local.ambientOcclusion} min={0} max={1} step={0.01} format={(v) => v?.toFixed(2) ?? 0} onChange={(v) => set("ambientOcclusion", v)} />
        <SliderRow label="Open sky lighting" value={local.openSkyLighting ?? 0} min={0} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set("openSkyLighting", v)} />
        <SliderRow label="Surface light (floor)" value={local.surfaceLighting.floor} min={0} max={2} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => setSL("floor", v)} />
        <SliderRow label="Surface light (ceiling)" value={local.surfaceLighting.ceiling} min={0} max={2} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => setSL("ceiling", v)} />
        <SliderRow label="Wall light min" value={local.surfaceLighting.wallMin} min={0} max={2} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => setSL("wallMin", v)} />
        <SliderRow label="Wall light max" value={local.surfaceLighting.wallMax} min={0} max={2} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => setSL("wallMax", v)} />
      </Section>

      <Section title="Skybox">
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4 }}>
          <button style={tabBtn(skyboxTab === "individual")} onClick={() => setSkyboxTab("individual")}>Individual faces</button>
          <button style={tabBtn(skyboxTab === "atlas")} onClick={() => setSkyboxTab("atlas")}>Atlas</button>
        </div>

        {/* Individual faces tab */}
        {skyboxTab === "individual" && FACES.map((face) => (
          <div key={face} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7080b0", minWidth: 28, fontFamily: "monospace", fontSize: 11 }}>{face}</span>
            <FaceThumb src={indivFaces[face]} />
            <input
              ref={(el) => { fileRefs.current[face] = el; }}
              type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFaceUpload(face, f); e.target.value = ""; }}
            />
            <button style={ghostBtn} onClick={() => fileRefs.current[face]?.click()}>
              {indivFaces[face] ? "Replace" : "Upload"}
            </button>
            {indivFaces[face] && (
              <button style={ghostBtn} onClick={() => setIndivFaces((p) => { const n = { ...p }; delete n[face]; return n; })}>
                Clear
              </button>
            )}
          </div>
        ))}

        {/* Atlas tab */}
        {skyboxTab === "atlas" && (
          <>
            {/* Atlas image row */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "#7080b0", minWidth: 28, fontSize: 11 }}>img</span>
              <FaceThumb src={atlasDataUrl ?? undefined} />
              <input
                ref={(el) => { fileRefs.current["atlas"] = el; }}
                type="file" accept="image/*" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAtlasUpload(f); e.target.value = ""; }}
              />
              <button style={ghostBtn} onClick={() => fileRefs.current["atlas"]?.click()}>
                {atlasDataUrl ? "Replace" : "Upload atlas"}
              </button>
              {atlasDataUrl && (
                <button style={ghostBtn} onClick={() => setAtlasDataUrl(null)}>Clear</button>
              )}
            </div>

            {/* Per-face rect rows */}
            {FACES.map((face) => (
              <div key={face} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "#7080b0", minWidth: 28, fontFamily: "monospace", fontSize: 11 }}>{face}</span>
                <AtlasCropPreview atlasDataUrl={atlasDataUrl} rect={atlasRects[face]} />
                {(["x", "y", "w", "h"] as const).map((field) => (
                  <label key={field} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <span style={{ color: "#7080b0", fontSize: 10 }}>{field}</span>
                    <input
                      type="number"
                      min={field === "w" || field === "h" ? 1 : 0}
                      value={atlasRects[face]?.[field] ?? 0}
                      onChange={(e) =>
                        handleRectChange(face, field, Math.max(field === "w" || field === "h" ? 1 : 0, parseInt(e.target.value) || 0))
                      }
                      style={{ ...inputSm, width: 50 }}
                    />
                  </label>
                ))}
              </div>
            ))}
          </>
        )}

        {/* Rotation Y */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#7080b0", minWidth: 28, fontSize: 11 }}>rotY</span>
          <input
            type="number" step="0.01" placeholder="0"
            value={rotationY ?? ""}
            onChange={(e) => setRotationY(e.target.value === "" ? undefined : Number(e.target.value))}
            style={{ ...inputSm, width: 80 }}
          />
        </div>

        {/* Export + clear */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {canExport && (
            <>
              <button style={ghostBtn} onClick={() => void exportAsSixPNGs()}>Export 6 PNGs</button>
              <button style={ghostBtn} onClick={() => void exportAsAtlasImage()}>Export atlas image</button>
            </>
          )}
          <button style={ghostBtn} onClick={clearSkybox}>Clear skybox</button>
        </div>
      </Section>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <button onClick={reset} style={{ background: "none", border: "1px solid #304060", borderRadius: 3, color: "#8090c0", cursor: "pointer", fontSize: 12, padding: "4px 12px" }}>
          Reset defaults
        </button>
        <button onClick={onClose} style={{ background: "none", border: "1px solid #304060", borderRadius: 3, color: "#8090c0", cursor: "pointer", fontSize: 12, padding: "4px 12px" }}>
          Cancel
        </button>
        <button onClick={() => void apply()} style={{ background: "#1a2040", border: "1px solid #4060c0", borderRadius: 3, color: "#c8d0f8", cursor: "pointer", fontSize: 12, padding: "4px 12px" }}>
          Apply
        </button>
      </div>
    </Modal>
  );
}
