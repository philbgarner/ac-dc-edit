import {
  useEffect,
  ReactNode,
  useState,
  Children,
  isValidElement,
} from "react";
import { ModalSearchContext } from "./ModalSearchContext";
import AccordionSection from "./AccordionSection";

interface ModalProps {
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** When true, renders without the full-screen backdrop overlay. */
  bare?: boolean;
  style?: React.CSSProperties;
  className?: string;
  searchFilter?: boolean;
}

function hasAccordionChild(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (c) => isValidElement(c) && c.type === AccordionSection,
  );
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#8090c0",
  cursor: "pointer",
  fontSize: 11,
  lineHeight: 1,
  padding: "0 3px",
  letterSpacing: "-1px",
};

export default function Modal({
  onClose,
  title,
  children,
  bare,
  style,
  className,
  searchFilter = false,
}: ModalProps) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [filter, setSearchFilter] = useState("");
  const [forceExpand, setForceExpand] = useState(0);
  const [forceCollapse, setForceCollapse] = useState(0);

  const showAccordionControls = hasAccordionChild(children);

  const panel = (
    <div
      className={className}
      style={
        !className
          ? {
              background: "#0e1428",
              border: "1px solid #304080",
              borderRadius: 6,
              minWidth: 600,
              maxWidth: "90vw",
              maxHeight: "85vh",
              color: "#c8d0f8",
              fontFamily: "monospace",
              fontSize: 13,
              display: "flex",
              flexDirection: "column",
              ...style,
            }
          : style
      }
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: "0",
          background: "linear-gradient(180deg, #1a2050, #0e1428)",
          padding: "1rem",
          margin: 0,
        }}
      >
        {title && (
          <span style={{ fontWeight: "bold", fontSize: 14 }}>{title}</span>
        )}

        {searchFilter && (
          <div
            style={{
              marginLeft: "2rem",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <input
              type="text"
              value={filter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="search"
              style={{
                background: "transparent",
                border: "0px",
                borderBottom: "#c8d0f8a1 solid 1px",
                color: "#c8d0f8",
                outline: "none",
                maxWidth: "60%",
              }}
            />
            {filter && (
              <button
                onClick={() => setSearchFilter("")}
                title="Clear search"
                style={{ ...btnStyle, fontSize: 14 }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {showAccordionControls && (
          <div
            style={{
              marginLeft: "1rem",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <button
              onClick={() => setForceExpand((n) => n + 1)}
              title="Expand all sections"
              style={{ ...btnStyle, fontSize: 14 }}
            >
              ⊞
            </button>
            <button
              onClick={() => setForceCollapse((n) => n + 1)}
              title="Collapse all sections"
              style={{ ...btnStyle, fontSize: 14 }}
            >
              ⊟
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: "#8090c0",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          ×
        </button>
      </div>
      {/* Container */}
      <div style={{ padding: "1rem", overflow: "auto", height: "100%" }}>
        <ModalSearchContext.Provider
          value={{ filter, forceExpand, forceCollapse }}
        >
          {children}
        </ModalSearchContext.Provider>
      </div>
      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          bottom: "0",
          background: "linear-gradient(0deg, #1a2050, #0e1428)",
          padding: 0,
          margin: 0,
          height: "0.5rem",
        }}
      >
        &nbsp;
      </div>
    </div>
  );

  if (bare) return panel;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{panel}</div>
    </div>
  );
}
