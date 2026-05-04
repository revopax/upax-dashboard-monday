'use client'
import React, { useEffect } from 'react'
import { SQUADS } from '../lib/constants'
import { normalizeSquad, parseTL, isOverdue, shortName } from '../lib/utils'

function PhaseModal({ phaseModal, onClose }) {
  useEffect(() => {
    if (!phaseModal) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phaseModal, onClose]);

  if (!phaseModal) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={phaseModal.phase} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 24px 60px rgba(0,0,0,.2)", width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--bg4)", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{phaseModal.phase}</div>
            <div style={{ fontSize: 12, color: "var(--tx3)", marginTop: 2 }}>{phaseModal.items.length} items</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: "var(--bg3)", border: "none", width: 30, height: 30, borderRadius: 15, cursor: "pointer", color: "var(--tx3)", fontSize: 14 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
          {phaseModal.items.length === 0
            ? <div style={{ textAlign: "center", padding: "24px 0", color: "var(--tx3)", fontSize: 13 }}>Sin items</div>
            : phaseModal.items.map((it, i) => {
                const sq = SQUADS.find(s => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
                const od = isOverdue(it);
                return (
                  <div key={it.id || i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--bg3)" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0, marginTop: 4 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: od ? "var(--red)" : "var(--tx)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11, color: "var(--tx3)", flexWrap: "wrap" }}>
                        {sq && <span style={{ color: sq.color, fontWeight: 600 }}>{sq.name.split(" ")[0]}</span>}
                        {it.column_values?.person && <span>{shortName(it.column_values.person)}</span>}
                        {tl.end && <span style={{ color: od ? "var(--red)" : "var(--tx3)", fontWeight: od ? 700 : 400 }}>{tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}

export { PhaseModal }
