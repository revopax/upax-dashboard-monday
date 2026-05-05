'use client'
import React, { useState, useEffect } from 'react'
// components/TabPanorama.jsx — Squads breakdown + Alertas completas
import { SQUADS, TODAY } from '../lib/constants'
import { parseTL, daysDiff, shortName, normalizeSquad } from '../lib/utils'
import { C, TS, F } from '../lib/tokens'
import { Bar, Card, Chip } from './ui'

const TabPanorama = React.memo(function TabPanorama({ analysis: an, items, onDrillDown }) {
  const [sec, setSec] = useState("squads");
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("panorama-tab");
      if (saved === "squads" || saved === "alertas") setSec(saved);
    } catch {}
  }, []);
  const setSecPersist = (s) => {
    setSec(s);
    try { sessionStorage.setItem("panorama-tab", s); } catch {}
  };

  return (
    <div className="fade">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Panorama Semanal</h2>
        <div style={{ display: "flex", gap: 3 }}>
          {["squads", "alertas"].map((s) => <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={sec === s} color={C.purple} onClick={() => setSecPersist(s)} />)}
        </div>
      </div>

      {sec === "squads" && (() => {
        const hasData = SQUADS.some(sq => an.bySquad[sq.name]);
        if (!hasData) return (
          <Card style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.tx3 }}>Sin datos de Monday</div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 4 }}>Presiona Sync para conectar.</div>
          </Card>
        );
        return SQUADS.map((sq) => {
        const d = an.bySquad[sq.name]; if (!d) return null;
        const act = (d.phases["🚧 Sprint"] || 0) + (d.phases["👀 Review"] || 0) + (d.phases["⚙️ Modificación"] || 0);
        const sqOverdue = (an.overdue || []).filter((it) => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name);
        const sqNoCrono = (an.noCrono || []).filter((it) => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name);
        return (
          <Card key={sq.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: sq.color }}>{sq.name} <span style={{ fontWeight: 500, color: C.tx3, fontSize: 12 }}>· {sq.lead}</span></span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: C.tx3 }}>{act} activos</span>
                {sqOverdue.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>🔴 {sqOverdue.length} venc.</span>}
                {(d.phases["🚫 Detenido"] || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>🚫 {d.phases["🚫 Detenido"]} det.</span>}
              </div>
            </div>
            <Bar h={14} segs={[{ l: "Spr", v: d.phases["🚧 Sprint"] || 0, c: C.yellow, ph: "🚧 Sprint" }, { l: "Rev", v: d.phases["👀 Review"] || 0, c: C.cyan, ph: "👀 Review" }, { l: "Mod", v: d.phases["⚙️ Modificación"] || 0, c: C.purple, ph: "⚙️ Modificación" }, { l: "Det", v: d.phases["🚫 Detenido"] || 0, c: C.red, ph: "🚫 Detenido" }, { l: "BL", v: d.phases["⏳Backlog"] || 0, c: C.bg4, ph: "⏳Backlog" }]} onSegmentClick={onDrillDown ? (seg) => {
              const filtered = items.filter(it => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name && it.column_values?.color_mkz09na === seg.ph);
              onDrillDown({ phase: `${sq.name} — ${seg.l}`, items: filtered });
            } : undefined} />
            {sqOverdue.length > 0 && (
              <div style={{ marginTop: 8, background: "rgba(255,59,48,.06)", borderRadius: 8, padding: "6px 10px", borderLeft: "3px solid var(--red)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Vencidos · {sqOverdue.length}</div>
                {sqOverdue.map((it) => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); const dd = tl.end ? daysDiff(TODAY, tl.end) : 0; return <div key={it.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, padding: "1px 0" }}><span style={{ fontFamily: F.mono, color: C.red, fontWeight: 700, minWidth: 28, fontSize: 10 }}>-{dd}d</span><span style={{ flex: 1, color: C.tx2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: C.tx3, fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>; })}
              </div>
            )}
            {sqNoCrono.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: C.yellow, padding: "6px 10px", background: "rgba(255,159,10,.06)", borderRadius: 8, borderLeft: "3px solid var(--yellow)" }}>
                <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>⚠️ {sqNoCrono.length} en Sprint sin Fecha</div>
                {sqNoCrono.map((it) => <div key={it.id} style={{ display: "flex", gap: 4, padding: "1px 0", color: C.tx2 }}><span style={{ color: C.yellow }}>•</span><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: C.tx3, fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>)}
              </div>
            )}
          </Card>
        );
      });
      })()}

      {sec === "squads" && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "8px 0", marginTop: 4, borderTop: "1px solid var(--bg4)" }}>
          {[
            { label: "Sprint", color: C.yellow },
            { label: "Review", color: C.cyan },
            { label: "Mod", color: C.purple },
            { label: "Detenido", color: C.red },
            { label: "Backlog", color: C.bg4 },
          ].map(p => (
            <span key={p.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: C.tx3 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
              {p.label}
            </span>
          ))}
        </div>
      )}

      {sec === "alertas" && (
        <div>
          {[
            { items: (an.overdue || []).sort((a, b) => (parseTL(a.column_values?.timerange_mkzcqv0j).end || TODAY) - (parseTL(b.column_values?.timerange_mkzcqv0j).end || TODAY)), label: "🔴 Vencidos", color: C.red, extra: (it) => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); const d = tl.end ? daysDiff(TODAY, tl.end) : 0; return <span style={{ fontFamily: F.mono, color: C.red, fontWeight: 700, minWidth: 30, fontSize: 10 }}>-{d}d</span>; } },
            { items: an.stoppedWeek || [], label: "🚫 Detenidos esta semana", color: C.red },
            { items: an.noCrono || [], label: "📅 Sprint sin Fecha", color: C.yellow },
            { items: an.backlogWithDates || [], label: "📅 Backlog con Fecha", color: C.yellow },
            { items: an.noResp || [], label: "👤 Sin responsable", color: C.tx3, showSquad: true },
          ].filter((g) => g.items.length > 0).map((g, gi) => (
            <Card key={gi} style={{ marginBottom: 8, borderLeft: `4px solid ${g.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
                <span style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 700, color: g.color }}>{g.items.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {g.items.map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  return (
                    <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--bg3)", fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || C.tx3, flexShrink: 0 }} />
                      {g.extra && g.extra(it)}
                      <span style={{ flex: 1, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      {g.showSquad
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: sq?.color || C.tx3, background: (sq?.color || "#888") + "20", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{sq?.name?.split(" ")[0] || "?"}</span>
                        : <span style={{ color: C.tx3, fontSize: 11 }}>{shortName(it.column_values?.person)}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          {(an.overdue || []).length === 0 && (an.stoppedWeek || []).length === 0 && (an.noCrono || []).length === 0 && (
            <Card style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 28, marginBottom: 4 }}>✅</div><div style={{ color: C.green, fontSize: 14, fontWeight: 600 }}>Sin alertas de gobernanza</div></Card>
          )}
        </div>
      )}
    </div>
  );
});

export { TabPanorama }
