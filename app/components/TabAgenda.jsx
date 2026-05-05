'use client'
import React, { useState } from 'react'
// components/TabAgenda.jsx
import { AGENDA, SQUADS } from '../lib/constants'
import { C, TS, R, F } from '../lib/tokens'
import { Alerta, Card, PersonSelect } from './ui'

const TabAgenda = React.memo(function TabAgenda({ wd, setWd, save, currentIdx, blockTimes, onJumpToBlock }) {
  const [edit, setEdit] = useState(false);
  const pr = wd.presenters || {};
  const missing = AGENDA.filter((b) => b.squad && !pr[b.id]?.trim());
  const setPr = (id, v) => { const n = { ...wd, presenters: { ...wd.presenters, [id]: v } }; setWd(n); save(n); };

  return (
    <div className="fade">
      {missing.length > 0 && !edit && (
        missing.length >= 3 ? (
          <Card style={{ borderTop: "3px solid var(--yellow)", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.yellow, marginBottom: 8 }}>
              ⚠️ {missing.length} bloques sin presentador
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
              {missing.map(b => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 80 }}>{b.label}</span>
                  <PersonSelect value={pr[b.id] || ""} onChange={(e) => setPr(b.id, e.target.value)} style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Alerta icon="⚠️" text={`Faltan presentadores: ${missing.map((b) => b.label).join(", ")}`} />
        )
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Agenda</h2>
          <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>
            Bloque {currentIdx + 1} de {AGENDA.length} · {AGENDA[currentIdx]?.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {currentIdx < AGENDA.length - 1 && (
            <button onClick={() => onJumpToBlock(currentIdx + 1)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: R.sm, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              ✓ Siguiente →
            </button>
          )}
          <button onClick={() => setEdit(!edit)} style={{ background: edit ? C.purple : C.bg3, color: edit ? "#fff" : C.tx2, border: edit ? "none" : "1px solid var(--border)", borderRadius: R.sm, padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✏ {edit ? "Listo" : "Presentadores"}</button>
        </div>
      </div>
      {AGENDA.map((b, idx) => {
        const isCur = idx === currentIdx;
        const isPast = idx < currentIdx;
        const sq = SQUADS.find((s) => s.id === b.id);
        return (
          <div key={b.id} onClick={() => !edit && onJumpToBlock(idx)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: R.sm, marginBottom: 3, background: isCur ? `${b.color}0D` : (b.squad && !pr[b.id]?.trim()) ? "rgba(255,59,48,.04)" : "transparent", border: isCur ? `1px solid ${b.color}25` : "1px solid transparent", cursor: edit ? "default" : "pointer", opacity: isPast && !edit ? 0.35 : 1,
              transition: "all .2s" }}>
            <span style={{ fontFamily: F.mono, fontWeight: 700, color: isCur ? b.color : `${b.color}80`, minWidth: 38, fontSize: 11 }}>{String(b.start).padStart(2, "0")}:00</span>
            <div style={{ width: 3, height: 22, borderRadius: R.sm, background: isCur ? b.color : isPast ? `${b.color}40` : C.bg4 }} />
            <span style={{ minWidth: 120, fontWeight: isCur ? 700 : 500, fontSize: 13, color: isCur ? C.tx : C.tx2 }}>{b.label}</span>
            {edit && b.squad
              ? <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}><PersonSelect value={pr[b.id] || ""} onChange={(e) => setPr(b.id, e.target.value)} style={{ flex: 1 }} /><span style={{ fontSize: 10, color: C.tx3 }}>Lead: {sq?.lead}</span></div>
              : <span style={{ flex: 1, fontSize: 12, color: C.tx3 }}>{b.squad ? (pr[b.id] ? <><span style={{ color: b.color, fontWeight: 600 }}>{pr[b.id]}</span> · {sq?.lead}</> : <span style={{ color: C.red }}>Sin asignar · {sq?.lead}</span>) : b.fixed}</span>}
            <span style={{ fontFamily: F.mono, color: C.tx3, fontSize: 11 }}>
              {blockTimes?.[b.id] ? <span style={{ color: blockTimes[b.id] > b.dur * 60 ? C.red : C.green }}>{Math.floor(blockTimes[b.id] / 60)}:{String(blockTimes[b.id] % 60).padStart(2, "0")}</span> : `${b.dur}'`}
            </span>
            {isPast && !edit && <span style={{ background: C.green, color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>✓</span>}
            {isCur && !edit && <span style={{ background: b.color, color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>EN CURSO</span>}
          </div>
        );
      })}
      <div style={{ marginTop: 12, padding: 8, borderRadius: R.sm, background: C.bg2, fontSize: 11, color: C.tx3, textAlign: "center" }}>+2 min → "lo sacamos offline" · Sin update Monday = sin voz · Compromiso = Qué + Quién + Cuándo</div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TAB AGENDA
   ═══════════════════════════════════════════════════════════════ */

export { TabAgenda }
