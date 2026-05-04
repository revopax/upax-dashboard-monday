'use client'
import React, { useState, useEffect } from 'react'
// components/TabPanorama.jsx — Squads breakdown + Alertas completas
import { SQUADS, TODAY } from '../lib/constants'
import { parseTL, daysDiff, shortName, normalizeSquad } from '../lib/utils'
import { Bar, Card, Chip } from './ui'

const TabPanorama = React.memo(function TabPanorama({ analysis: an, items }) {
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
          {["squads", "alertas"].map((s) => <Chip key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} active={sec === s} color="var(--purple)" onClick={() => setSecPersist(s)} />)}
        </div>
      </div>

      {sec === "squads" && (() => {
        const hasData = SQUADS.some(sq => an.bySquad[sq.name]);
        if (!hasData) return (
          <Card style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx3)" }}>Sin datos de Monday</div>
            <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 4 }}>Presiona Sync para conectar.</div>
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
              <span style={{ fontSize: 14, fontWeight: 700, color: sq.color }}>{sq.name} <span style={{ fontWeight: 500, color: "var(--tx3)", fontSize: 12 }}>· {sq.lead}</span></span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--tx3)" }}>{act} activos</span>
                {sqOverdue.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)" }}>🔴 {sqOverdue.length} venc.</span>}
                {(d.phases["🚫 Detenido"] || 0) > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)" }}>🚫 {d.phases["🚫 Detenido"]} det.</span>}
              </div>
            </div>
            <Bar h={14} segs={[{ l: "Spr", v: d.phases["🚧 Sprint"] || 0, c: "var(--yellow)" }, { l: "Rev", v: d.phases["👀 Review"] || 0, c: "var(--cyan)" }, { l: "Mod", v: d.phases["⚙️ Modificación"] || 0, c: "var(--purple)" }, { l: "Det", v: d.phases["🚫 Detenido"] || 0, c: "var(--red)" }, { l: "BL", v: d.phases["⏳Backlog"] || 0, c: "var(--bg4)" }]} />
            {sqOverdue.length > 0 && (
              <div style={{ marginTop: 8, background: "rgba(255,59,48,.06)", borderRadius: 8, padding: "6px 10px", borderLeft: "3px solid var(--red)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Vencidos · {sqOverdue.length}</div>
                {sqOverdue.map((it) => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); const dd = tl.end ? daysDiff(TODAY, tl.end) : 0; return <div key={it.id} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, padding: "1px 0" }}><span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 28, fontSize: 10 }}>-{dd}d</span><span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>; })}
              </div>
            )}
            {sqNoCrono.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--yellow)", padding: "6px 10px", background: "rgba(255,159,10,.06)", borderRadius: 8, borderLeft: "3px solid var(--yellow)" }}>
                <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>⚠️ {sqNoCrono.length} en Sprint sin Fecha</div>
                {sqNoCrono.map((it) => <div key={it.id} style={{ display: "flex", gap: 4, padding: "1px 0", color: "var(--tx2)" }}><span style={{ color: "var(--yellow)" }}>•</span><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span><span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span></div>)}
              </div>
            )}
          </Card>
        );
      });
      })()}

      {sec === "alertas" && (
        <div>
          {[
            { items: (an.overdue || []).sort((a, b) => (parseTL(a.column_values?.timerange_mkzcqv0j).end || TODAY) - (parseTL(b.column_values?.timerange_mkzcqv0j).end || TODAY)), label: "🔴 Vencidos", color: "var(--red)", extra: (it) => { const d = parseTL(it.column_values?.timerange_mkzcqv0j).end ? daysDiff(TODAY, parseTL(it.column_values?.timerange_mkzcqv0j).end) : 0; return <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 30, fontSize: 10 }}>-{d}d</span>; } },
            { items: an.stoppedWeek || [], label: "🚫 Detenidos esta semana", color: "var(--red)" },
            { items: an.noCrono || [], label: "📅 Sprint sin Fecha", color: "var(--yellow)" },
            { items: an.backlogWithDates || [], label: "📅 Backlog con Fecha", color: "var(--yellow)" },
            { items: an.noResp || [], label: "👤 Sin responsable", color: "var(--tx3)", showSquad: true },
          ].filter((g) => g.items.length > 0).map((g, gi) => (
            <Card key={gi} style={{ marginBottom: 8, borderLeft: `4px solid ${g.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: g.color }}>{g.items.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                {g.items.map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  return (
                    <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--bg3)", fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sq?.color || "var(--tx3)", flexShrink: 0 }} />
                      {g.extra && g.extra(it)}
                      <span style={{ flex: 1, color: "var(--tx)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      {g.showSquad
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: sq?.color || "var(--tx3)", background: (sq?.color || "#888") + "20", borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{sq?.name?.split(" ")[0] || "?"}</span>
                        : <span style={{ color: "var(--tx3)", fontSize: 11 }}>{shortName(it.column_values?.person)}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
          {(an.overdue || []).length === 0 && (an.stoppedWeek || []).length === 0 && (an.noCrono || []).length === 0 && (
            <Card style={{ textAlign: "center", padding: 24 }}><div style={{ fontSize: 28, marginBottom: 4 }}>✅</div><div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600 }}>Sin alertas de gobernanza</div></Card>
          )}
        </div>
      )}
    </div>
  );
});

export { TabPanorama }
