'use client'
import React, { useState, useEffect, useMemo } from 'react'
// components/TabMinutas.jsx — Lista de minutas (TabMinutasInline), agrupada por mes.
import { STORE_KEY, TODAY_STR } from '../lib/constants'
import { copyToClipboard, formatLongDate, formatMonthYear } from '../lib/utils'
import { storeGet, storeDel, storeList } from '../lib/storage'
import { generateMinuta } from '../lib/minuta'
import { C, R, F } from '../lib/tokens'
import { Alerta } from './ui'

const TabMinutasInline = React.memo(function TabMinutasInline({ wd, analysis, gddData, blockTimes, onOpenMinuta }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);
  const [copied, setCopied] = useState(null);

  const CURRENT_YM = TODAY_STR.slice(0, 7);
  // Meses colapsados. Arranca vacio: el mes en curso queda abierto y los demas se
  // cierran por defecto via `isOpen()`, sin necesidad de precargar el estado.
  const [collapsed, setCollapsed] = useState({});
  const isOpen = (ym) => (ym in collapsed ? !collapsed[ym] : ym === CURRENT_YM);
  const toggle = (ym) => setCollapsed((p) => ({ ...p, [ym]: isOpen(ym) }));

  useEffect(() => {
    (async () => {
      const allKeys = await storeList("weekly:");
      // Excluye los backups `weekly:<fecha>:before_reset` que crea el reset de sesion:
      // no son minutas y su fecha no parsea, salian como "Fecha no disponible".
      const onlyWeeklies = allKeys.filter((k) => /^weekly:\d{4}-\d{2}-\d{2}$/.test(k));
      const merged = [...new Set([STORE_KEY, ...onlyWeeklies])].sort().reverse();
      setKeys(merged);
      setLoading(false);
    })();
  }, []);

  // Agrupa por mes (YYYY-MM), meses y minutas mas recientes primero.
  const groups = useMemo(() => {
    const m = new Map();
    keys.forEach((k) => {
      const ym = k.replace("weekly:", "").slice(0, 7);
      if (!m.has(ym)) m.set(ym, []);
      m.get(ym).push(k);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [keys]);

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

  const dateFmt = (k) => formatLongDate(k.replace("weekly:", ""));
  return (
    <div className="fade">
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Minutas</h2>
      {confirmDel && (
        <div style={{ background: "rgba(255,59,48,.08)", border: "1px solid rgba(255,59,48,.2)", borderRadius: R.sm, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: C.tx2 }}>¿Eliminar minuta del {dateFmt(confirmDel)}?</span>
          <button onClick={() => confirmDelete(confirmDel)} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Eliminar</button>
          <button onClick={() => setConfirmDel(null)} style={{ background: C.bg3, color: C.tx2, border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.tx3 }}>Cargando...</div>
      ) : keys.length === 0 ? (
        <Alerta icon="ℹ️" text="No hay minutas aún. Se generan al terminar una weekly." color={C.blue} />
      ) : groups.map(([ym, monthKeys]) => {
        const open = isOpen(ym);
        const label = formatMonthYear(ym);
        return (
        <div key={ym} style={{ marginBottom: 10 }}>
          <button onClick={() => toggle(ym)} aria-expanded={open} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", borderBottom: `1px solid ${C.bg4}`, padding: "8px 2px", cursor: "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 10, color: C.tx3, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block" }}>▶</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: ym === CURRENT_YM ? C.blue : C.tx2, textTransform: "capitalize" }}>{label}</span>
            <span style={{ fontSize: 10, color: C.tx3, fontFamily: F.mono }}>{monthKeys.length}</span>
            {ym === CURRENT_YM && <span style={{ fontSize: 9, background: C.blue, color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>MES EN CURSO</span>}
          </button>
          {open && <div style={{ paddingTop: 8 }}>{monthKeys.map((k) => {
        const isToday = k === STORE_KEY;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: R.default, marginBottom: 8, background: C.bg2, border: `1px solid ${isToday ? C.blue : C.bg4}`, boxShadow: isToday ? `0 0 0 1px ${C.blue}` : C.shadow }}>
            <div onClick={() => openMinuta(k)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer", minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: R.sm, background: isToday ? C.blue : C.bg3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {isToday ? "📝" : "📋"}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.tx, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {dateFmt(k)}
                  {isToday && <span style={{ fontSize: 10, background: C.blue, color: "#fff", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>HOY</span>}
                </div>
                <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Weekly Mkt Corp · click para ver</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button onClick={(e) => copyMinuta(k, e)} aria-label="Copiar minuta" style={{ background: copied === k ? C.green : C.bg3, color: copied === k ? "#fff" : C.tx2, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {copied === k ? "✓" : "📋"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); openMinuta(k, true); }} aria-label="Editar minuta" style={{ background: C.bg3, color: C.tx2, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                ✏️
              </button>
              <button onClick={(e) => deleteMinuta(k, e)} aria-label="Eliminar minuta" style={{ background: C.bg3, color: C.red, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                🗑
              </button>
            </div>
          </div>
        );
      })}</div>}
        </div>
        );
      })}
    </div>
  );
});

export { TabMinutasInline }
