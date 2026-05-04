'use client'
import React, { useState, useEffect } from 'react'
// components/TabCompromisos.jsx
import { TODAY_STR, STORE_KEY } from '../lib/constants'
import { shortName, pctColor } from '../lib/utils'
import { storeGet, storeSet, storeList } from '../lib/storage'
import { createMondayItem } from '../lib/api'
import { generateMinuta } from '../lib/minuta'
import { Card, PersonSelect } from './ui'

const TabCompromisos = React.memo(function TabCompromisos({ wd, setWd, save, analysis, onCopy, gddData }) {
  const comps = wd.compromisos || [], synced = wd.synced || [];
  const [syncing, setSyncing] = useState(null);
  const [prevComps, setPrevComps] = useState([]);
  const [loadingPrev, setLoadingPrev] = useState(true);
  const [confirmDelIdx, setConfirmDelIdx] = useState(null);
  const setComps = (c) => { const n = { ...wd, compromisos: c }; setWd(n); save(n); };

  useEffect(() => {
    (async () => {
      try {
        const allKeys = await storeList("weekly:");
        const prevKeys = allKeys.filter((k) => k < STORE_KEY).sort().reverse().slice(0, 8);
        // Cargar en paralelo en lugar de secuencial — 8 requests simultáneos (P3.9)
        const dataList = await Promise.all(
          prevKeys.map(async (key) => {
            let data = await storeGet(key);
            if (!data) return { key, data: null };
            return { key, data };
          })
        );
        const historical = [];
        for (const { key, data } of dataList) {
          if (!data?.compromisos?.length) continue;
          data.compromisos.forEach((c) => {
            if (c.que?.trim()) historical.push({ ...c, weekDate: key.replace("weekly:", ""), weekKey: key, pct: c.pct || (c.status === "done" ? 100 : 0) });
          });
        }
        setPrevComps(historical);
      } catch {}
      setLoadingPrev(false);
    })();
  }, []);

  async function updatePrevPct(weekKey, compQue, newPct) {
    let data = await storeGet(weekKey);
    if (!data) return;
    if (!data?.compromisos) return;
    const idx = data.compromisos.findIndex((c) => c.que === compQue);
    if (idx < 0) return;
    const updated = { ...data, compromisos: data.compromisos.map((c, i) =>
      i === idx ? { ...c, pct: newPct, ...(newPct >= 100 ? { status: "done" } : {}) } : c
    )};
    await storeSet(weekKey, updated);
    setPrevComps((prev) => prev.map((c) => c.weekKey === weekKey && c.que === compQue ? { ...c, pct: newPct, status: newPct >= 100 ? "done" : c.status } : c));
  }

  async function syncToMonday(i) {
    const c = comps[i]; if (!c.que) return;
    setSyncing(i);
    const ok = await createMondayItem(`WEEKLY ${TODAY_STR} | ${c.que}`, c.cuando || null, c.quien || null);
    if (ok) { const n = { ...wd, synced: [...synced, i] }; setWd(n); save(n); }
    setSyncing(null);
  }

  async function syncAllToMonday() {
    const pending = comps.map((c, i) => ({ c, i })).filter(({ c, i }) => !synced.includes(i) && c.que?.trim() && c.quien);
    if (!pending.length) return;
    setSyncing("all");
    const results = await Promise.allSettled(
      pending.map(({ c, i }) => createMondayItem(`WEEKLY ${TODAY_STR} | ${c.que}`, c.cuando || null, c.quien || null).then(ok => ({ ok, i })))
    );
    const newSynced = [...(wd.synced || [])];
    results.forEach(r => { if (r.status === "fulfilled" && r.value.ok) newSynced.push(r.value.i); });
    const n = { ...wd, synced: newSynced };
    setWd(n); save(n);
    setSyncing(null);
  }

  const unsyncedCount = comps.filter((c, i) => !synced.includes(i) && c.que?.trim() && c.quien).length;
  const openPrev = prevComps.filter((c) => (c.pct || 0) < 100);
  const donePrev = prevComps.filter((c) => (c.pct || 0) >= 100);
  const dateFmt = (d) => new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compromisos</h2>
        <div style={{ display: "flex", gap: 4 }}>
          {unsyncedCount > 0 && <button onClick={syncAllToMonday} disabled={syncing !== null} style={{ background: "var(--blue)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: syncing !== null ? "default" : "pointer", fontFamily: "var(--mono)", textTransform: "uppercase", opacity: syncing !== null ? 0.5 : 1 }}>{syncing === "all" ? `SYNCING ${unsyncedCount}...` : syncing !== null ? "SYNCING..." : `↑ SYNC ${unsyncedCount} → MONDAY`}</button>}
          <button onClick={() => onCopy(generateMinuta(wd, analysis, gddData))} style={{ background: "var(--bg2)", color: "var(--tx2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📤 Minuta</button>
          <button onClick={() => setComps([...comps, { id: Date.now(), que: "", quien: "", cuando: "", status: "pending" }])} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", borderRadius: "var(--r-sm)", padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--mono)", textTransform: "uppercase" }}>+ AGREGAR</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--tx3)", marginBottom: 12, fontFamily: "var(--mono)" }}>→ Monday: grupo "Acuerdos Weeklys" · Qué + Quién + Cuándo</div>

      {!comps.length
        ? <Card style={{ textAlign: "center", padding: 36, border: "2px dashed var(--border)" }}><div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx2)", marginBottom: 6 }}>Sin compromisos aún</div>
          <div style={{ fontSize: 12, color: "var(--tx3)", marginBottom: 16 }}>Cada compromiso: Qué + Quién + Cuándo</div>
          <button onClick={() => setComps([...comps, { id: Date.now(), que: "", quien: "", cuando: "", status: "pending" }])} style={{ background: "var(--tx)", color: "var(--bg)", border: "none", borderRadius: "var(--r-sm)", padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Agregar compromiso</button>
        </Card>
        : <Card>
          <div className="mobile-hide" style={{ display: "grid", gridTemplateColumns: "26px 1fr 130px 110px 50px 50px", gap: 4, padding: "4px 0 6px", fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid var(--border)" }}><span /><span>Qué</span><span>Quién</span><span>Cuándo</span><span>%</span><span>Mon</span></div>
          {comps.map((c, i) => (
            <div key={c.id || i} className="compromisos-row" style={{ display: "grid", gridTemplateColumns: "26px 1fr 130px 110px 50px 50px", gap: 4, padding: "7px 0", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <button onClick={() => { const ns = c.status === "done" ? "pending" : "done"; setComps(comps.map((x, j) => j === i ? { ...x, status: ns, pct: ns === "done" ? 100 : (x.pct || 0) } : x)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 0 }}>{c.status === "done" ? "✅" : "⬜"}</button>
              <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                <input value={c.que} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, que: e.target.value } : x))} placeholder="Compromiso..." style={{ flex: 1, background: "transparent", border: "none", fontSize: 12, fontFamily: "var(--sans)", color: c.status === "done" ? "var(--tx3)" : "var(--tx)", outline: "none", textDecoration: c.status === "done" ? "line-through" : "none" }} />
                {confirmDelIdx === i
                  ? <><button onClick={() => { setComps(comps.filter((_, j) => j !== i)); setConfirmDelIdx(null); }} style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Eliminar</button><button onClick={() => setConfirmDelIdx(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx3)", fontSize: 10 }}>No</button></>
                  : <button onClick={() => setConfirmDelIdx(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--border)", fontSize: 11 }}>✕</button>}
              </div>
              <PersonSelect value={c.quien} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, quien: e.target.value } : x))} />
              <input type="date" value={c.cuando} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, cuando: e.target.value } : x))} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "3px 4px", fontSize: 10, color: "var(--tx)", outline: "none" }} />
              <div style={{ textAlign: "center" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: (c.pct || 0) >= 100 ? "var(--green)" : (c.pct || 0) >= 50 ? "var(--yellow)" : "var(--tx3)", cursor: "pointer" }} onClick={() => { const next = Math.min(100, (c.pct || 0) + 25); setComps(comps.map((x, j) => j === i ? { ...x, pct: next, status: next >= 100 ? "done" : x.status } : x)); }}>{c.pct || 0}%</span>
              </div>
              <div style={{ textAlign: "center" }}>
                {synced.includes(i) ? <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>✓</span>
                  : <button onClick={() => syncToMonday(i)} disabled={!c.que || !c.quien || syncing === i || syncing === "all"} style={{ background: "var(--bg2)", color: "var(--blue)", border: "1px solid var(--bg4)", borderRadius: "var(--r-sm)", padding: "2px 6px", fontSize: 10, fontWeight: 600, cursor: "pointer", opacity: (!c.que?.trim() || !c.quien) ? 0.3 : 1 }}>{(syncing === i || (syncing === "all" && !synced.includes(i))) ? "..." : "→"}</button>}
              </div>
            </div>
          ))}
        </Card>}

      <Card style={{ marginTop: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx3)", marginBottom: 6 }}>📝 Notas de cierre</div>
        <textarea value={wd.notasCierre || ""} onChange={(e) => { const n = { ...wd, notasCierre: e.target.value }; setWd(n); save(n); }} placeholder="Temas offline, decisiones tomadas, seguimientos..." style={{ width: "100%", minHeight: 60, background: "var(--bg3)", border: "none", borderRadius: "var(--r-sm)", padding: 10, fontSize: 12, fontFamily: "var(--sans)", color: "var(--tx)", outline: "none", resize: "vertical" }} />
      </Card>

      {!loadingPrev && openPrev.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            📋 Compromisos Anteriores Abiertos <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--red)", fontWeight: 700 }}>{openPrev.length}</span>
          </div>
          <Card>
            {openPrev.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: i < openPrev.length - 1 ? "1px solid var(--bg3)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500 }}>{c.que}</div>
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 2, display: "flex", gap: 8 }}>
                    <span>👤 {shortName(c.quien)}</span>
                    <span>📅 {dateFmt(c.weekDate)}</span>
                    {c.cuando && <span>⏰ {dateFmt(c.cuando)}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: pctColor(c.pct || 0), minWidth: 36, textAlign: "right" }}>{c.pct || 0}%</span>
                  <input type="range" min="0" max="100" step="10" value={c.pct || 0} onChange={(e) => updatePrevPct(c.weekKey, c.que, parseInt(e.target.value))} style={{ width: 80, accentColor: pctColor(c.pct || 0) }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {!loadingPrev && donePrev.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx3)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            ✅ Completados anteriores <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)" }}>{donePrev.length}</span>
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto" }}>
            {donePrev.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontSize: 12, opacity: 0.5 }}>
                <span>✅</span>
                <span style={{ flex: 1, color: "var(--tx3)", textDecoration: "line-through" }}>{c.que}</span>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>{shortName(c.quien)}</span>
                <span style={{ fontSize: 10, color: "var(--tx3)" }}>{dateFmt(c.weekDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export { TabCompromisos }
