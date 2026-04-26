import { useState, useRef } from "react";
import { dungeonMapToJson, dungeonMapFromJson } from "atomic-core";
import type { BspDungeonOutputs } from "atomic-core";
import { useData } from "../DataContext";
import AtlasImportModal from "./AtlasImportModal";
import DungeonSettingsModal from "./DungeonSettingsModal";
import DungeonLightsModal from "./DungeonLightsModal";
import NewMapModal from "./NewMapModal";

interface Props {
  onOpenMapEditor: () => void;
}

export default function Toolbar({ onOpenMapEditor }: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNewMap, setShowNewMap] = useState(false);
  const [showLights, setShowLights] = useState(false);
  const { game, generatorOptions, setImportRequest } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!game?.dungeon.outputs || !generatorOptions) return;
    const json = dungeonMapToJson(game.dungeon.outputs as BspDungeonOutputs, {
      generatorOptions,
      paintMap: game.dungeon.paintMap,
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dungeon.acmap";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = dungeonMapFromJson(ev.target?.result as string);
        setImportRequest({
          options: result.generatorOptions,
          seq: Date.now(),
          importResult: result,
        });
      } catch {
        alert("Failed to import dungeon map. The file may be invalid.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const btnStyle: React.CSSProperties = {
    background: "#1a2040",
    border: "1px solid #4060c0",
    borderRadius: 3,
    color: "#c8d0f8",
    padding: "3px 10px",
    cursor: "pointer",
    fontSize: 12,
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".acmap,.json"
        onChange={handleImportFile}
        style={{ display: "none" }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          right: "1rem",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(0,0,0,0.75)",
          border: "1px solid #304080",
          borderRadius: 4,
          padding: "8px 16px",
          color: "#c8d0f8",
          fontFamily: "monospace",
          fontSize: 12,
          zIndex: 10,
          pointerEvents: "auto",
        }}
      >
        <span>WASD/Arrows: move</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>Q/E: turn</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <button onClick={() => setShowNewMap(true)} style={btnStyle}>
          New Map
        </button>
        <button onClick={handleExport} style={btnStyle}>
          Export Map
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={btnStyle}>
          Import Map
        </button>
        <button onClick={() => setShowImport(true)} style={btnStyle}>
          Import Atlas
        </button>
        <button onClick={() => setShowLights(true)} style={btnStyle}>
          Lights
        </button>
        <button onClick={() => setShowSettings(true)} style={btnStyle}>
          Settings
        </button>
        <button onClick={onOpenMapEditor} style={btnStyle}>
          Wall Editor
        </button>
      </div>

      {showNewMap && <NewMapModal onClose={() => setShowNewMap(false)} />}
      {showImport && <AtlasImportModal onClose={() => setShowImport(false)} />}
      {showSettings && (
        <DungeonSettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showLights && (
        <DungeonLightsModal onClose={() => setShowLights(false)} />
      )}
    </>
  );
}
