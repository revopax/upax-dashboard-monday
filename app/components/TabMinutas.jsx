'use client'
import React, { useState, useEffect } from 'react'
// components/TabMinutas.jsx — Lista de minutas (TabMinutasInline)
import { STORE_KEY } from '../lib/constants'
import { copyToClipboard } from '../lib/utils'
import { storeGet, storeDel, storeList } from '../lib/storage'
import { generateMinuta } from '../lib/minuta'
import { Alerta } from './ui'

const TabMinutasInline = React.memo(function TabMinutasInline({ wd, analysis, gddData, blockTimes, onOpenMinuta }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    (async () => {
      const allKeys = await storeList("weekly:");
      const merged = [...new Set([STORE_KEY, ...allKeys])].sort().reverse();
      setKeys(merged);
      setLoading(false);
    })();
  }, []);

  async function openMinuta(k, editMode = false) {
    const d = await storeGet(k);
    document.body.style.overflow = "hidden";
    onOpenMinuta(k, d, editMode);
  }

  async function copyMinuta(k, e) {
    e.stopPropagation();
    const d = await storeGet(k);
    const text = d?.minutaText || generateMinuta(d, null, gddData, blockTimes);
    copyToClipboard(text);
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  }

  async function deleteMinuta(k, e) {
    e.stopPropagation();
    setConfirmDel(k);
  }

  async function confirmDelete(k) {
    await storeDel(k);
    setKeys(prev => prev.filter(x => x !== k));
    setConfirmDel(null);
  }

  const dateFmt = (k) => {
    const d = new Date(k.replace("weekly:", ""));
    if (isNaN(d.getTime())) return "Fecha no disponible";
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };
  return (
    <div className="fade">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Minutas</h2>
      {confirmDel && (
        <div style={{ background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.2)", borderRadius: "var(--r-sm)", padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: "var(--tx2)" }}>¿Eliminar minuta del {dateFmt(confirmDel)}?</span>
          <button onClick={() => confirmDelete(confirmDel)} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
          <button onClick={() => setConfirmDel(null)} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--tx3)" }}>Cargando...</div>
      ) : keys.length === 0 ? (
        <Alerta icon="ℹ️" text="No hay minutas aún. Se generan al terminar una weekly." color="var(--blue)" />
      ) : keys.map((k) => {
        const isToday = k === STORE_KEY;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--r)", marginBottom: 8, background: "var(--bg2)", border: "1px solid " + (isToday ? "var(--blue)" : "var(--bg4)"), boxShadow: isToday ? "0 0 0 1px var(--blue)" : "var(--shadow)" }}>
            <div onClick={() => openMinuta(k)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", background: isToday ? "var(--blue)" : "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {isToday ? "📝" : "📋"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {dateFmt(k)}
                  {isToday && <span style={{ fontSize: 10, background: "var(--blue)", color: "#fff", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>HOY</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>Weekly Mkt Corp · click para ver</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={(e) => copyMinuta(k, e)} style={{ background: copied === k ? "var(--green)" : "var(--bg3)", color: copied === k ? "#fff" : "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {copied === k ? "✓" : "📋"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); openMinuta(k, true); }} style={{ background: "var(--bg3)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                ✏️
              </button>
              <button onClick={(e) => deleteMinuta(k, e)} style={{ background: "var(--bg3)", color: "var(--red)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                🗑
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export { TabMinutasInline }
