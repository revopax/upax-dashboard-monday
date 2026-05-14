'use client'
import React, { useState, useEffect } from 'react'
import { C, R, F } from '../../lib/tokens'

const fmtDate = (s) => {
  if (!s) return ""
  const d = new Date(s + "T12:00:00")
  return isNaN(d) ? s : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

/**
 * GddKpiSection — KPIs de Generacion de Demanda (4 metricas + pipeline + conversion rates)
 * Extraido de TabHome.jsx para reducir tamanio del archivo compositor.
 */
export const GddKpiSection = React.memo(function GddKpiSection({ gddData, gddTargets, gddLoading }) {
  const [gddWeekView, setGddWeekView] = useState("current")
  useEffect(() => { if (new Date().getDay() === 1) setGddWeekView("prev") }, [])

  if (gddLoading && !gddData) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>📊 Generacion de Demanda</div>
        <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: C.bg2, border: "1px solid var(--bg4)", borderRadius: R.default, padding: "12px 14px", height: 100, animation: "pulse 1.5s ease-in-out infinite", opacity: 0.5 }} />
          ))}
        </div>
      </div>
    )
  }

  const raw = gddData || { semana: {}, anterior: {}, ytd: {} }
  const showingPrev = gddWeekView === "prev"
  const d = showingPrev
    ? { ...raw, semana: raw.anterior, anterior: raw.semana }
    : raw
  const metrics = ["leads", "mqls", "sqls", "opps"]
  const labels = { leads: "Leads", mqls: "MQLs", sqls: "SQLs", opps: "Opps" }
  const colors = { leads: C.blue, mqls: C.purple, sqls: C.green, opps: C.yellow }
  const icons = { leads: "👤", mqls: "⭐", sqls: "🎯", opps: "💼" }
  const pctChange = (cur, prev) => (!prev || prev === 0) ? null : Math.round(((cur - prev) / prev) * 100)

  const sourceBadge = (() => {
    const src = gddData?.source
    if (src === "hubspot_live") return <span style={{ background: "rgba(52,199,89,.12)", border: "1px solid #34C759", color: "#34C759", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", marginLeft: 6 }}>● LIVE</span>
    if (src === "hubspot_partial") return <span style={{ background: "rgba(255,159,10,.12)", border: "1px solid var(--yellow)", color: C.yellow, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", marginLeft: 6 }}>PARCIAL</span>
    if (gddLoading && !src) return null
    if (src === "empty" || !src) return <span style={{ fontSize: 9, color: C.red, marginLeft: 6 }}>sin datos</span>
    return null
  })()

  const weekLabel = (() => {
    if (!gddData?.fechas?.semana_desde) return null
    if (showingPrev) {
      const desde = new Date(gddData.fechas.semana_desde + "T12:00:00")
      const prevDesde = new Date(desde); prevDesde.setDate(desde.getDate() - 7)
      const prevHasta = new Date(desde); prevHasta.setDate(desde.getDate() - 1)
      return `${fmtDate(prevDesde.toISOString().slice(0,10))} – ${fmtDate(prevHasta.toISOString().slice(0,10))}`
    }
    return `${fmtDate(gddData.fechas.semana_desde)}${gddData.fechas.semana_hasta ? " – " + fmtDate(gddData.fechas.semana_hasta) : ""}`
  })()

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          📊 Generacion de Demanda{sourceBadge}
          {weekLabel && <span style={{ fontWeight: 400, marginLeft: 6, color: C.tx3, fontSize: 11 }}>{weekLabel}</span>}
        </span>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--bg4)", borderRadius: 6, overflow: "hidden" }}>
          <button onClick={() => setGddWeekView("prev")} style={{ fontSize: 10, padding: "3px 8px", background: showingPrev ? C.blue : C.bg2, color: showingPrev ? "#fff" : C.tx3, border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Sem. anterior</button>
          <button onClick={() => setGddWeekView("current")} style={{ fontSize: 10, padding: "3px 8px", background: !showingPrev ? C.blue : C.bg2, color: !showingPrev ? "#fff" : C.tx3, border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Esta semana</button>
        </div>
      </div>
      <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 4 }}>
        {metrics.map((m) => {
          const rawCur = d.semana?.[m]
          const isNoData = rawCur === null || rawCur === undefined
          const cur = rawCur || 0
          const prev = d.anterior?.[m] || 0
          const pct = pctChange(cur, prev)
          const col = colors[m]
          const mesVal = (gddData?.mes || {})[m] || 0
          return (
            <div key={m} style={{ background: C.bg2, border: "1px solid var(--bg4)", borderRadius: R.default, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: isNoData ? C.bg4 : (pct !== null && pct < 0) ? C.red : (pct !== null && pct >= 0) ? C.green : col }} />
              <div style={{ position: "absolute", top: 8, right: 10, fontSize: 18, opacity: 0.06 }}>{icons[m]}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{labels[m]}</div>
              <div style={{ fontFamily: F.mono, fontSize: 32, fontWeight: 800, color: isNoData ? C.tx3 : C.tx, opacity: isNoData ? 0.4 : 1, lineHeight: 1, letterSpacing: "-0.04em" }}>{cur.toLocaleString()}</div>
              {d.semana?.[`${m}_mkt`] != null && d.semana?.[`${m}_com`] != null && (
                <div style={{ fontSize: 10, marginTop: 3, color: C.tx3, fontFamily: F.mono }}>
                  <span style={{ color: C.blue }}>Mkt:{d.semana[`${m}_mkt`]}</span>{" | "}
                  <span style={{ color: C.purple }}>Com:{d.semana[`${m}_com`]}</span>
                </div>
              )}
              {isNoData && <div style={{ fontSize: 9, color: C.tx3, marginTop: 2, fontStyle: "italic" }}>sin datos</div>}
              {pct !== null && !showingPrev && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? C.green : C.red }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%</span>
                  <span style={{ fontSize: 10, color: C.tx3 }}>vs sem. ant.</span>
                </div>
              )}
              {mesVal > 0 && (
                <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid var(--bg4)", fontSize: 10, color: C.tx3 }}>
                  <span style={{ color: C.tx2, fontWeight: 700, fontFamily: F.mono }}>{mesVal.toLocaleString()}</span> acum. mes
                </div>
              )}
              {(() => {
                const target = gddTargets?.targets?.[m] || 0
                if (target <= 0) return null
                const pctTarget = Math.min((mesVal / target) * 100, 100)
                const targetColor = pctTarget >= 90 ? C.green : pctTarget >= 60 ? C.yellow : C.red
                return (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ height: 2, background: C.bg4, borderRadius: 1, overflow: "hidden" }}>
                      <div style={{ width: pctTarget + "%", height: "100%", background: targetColor, borderRadius: 1, transition: "width .4s ease" }} />
                    </div>
                    <div style={{ fontSize: 9, color: C.tx3, marginTop: 2, fontFamily: F.mono }}>
                      {mesVal}/{target} meta mes
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
      {/* Pipeline row */}
      {(() => {
        const pt = d.semana?.pipeline_total || 0
        const pm = d.semana?.pipeline_mkt || 0
        const pc = d.semana?.pipeline_com || 0
        if (pt <= 0) return null
        const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: C.bg2, border: "1px solid var(--bg4)", borderRadius: R.default, marginTop: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 16 }}>🏦</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.tx2 }}>Pipeline</span>
            <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 800, color: C.tx }}>{fmtM(pt)}</span>
            <span style={{ fontSize: 10, color: C.tx3, fontFamily: F.mono }}>
              <span style={{ color: C.blue }}>Mkt {fmtM(pm)}</span>{" | "}
              <span style={{ color: C.purple }}>Com {fmtM(pc)}</span>
            </span>
          </div>
        )
      })()}
      {/* Conversion rates */}
      {(() => {
        const ytd = gddData?.ytd || {}
        const sem = d.semana || {}
        const rates = [
          { label: "Lead→MQL", from: sem.leads ?? ytd.leads, to: sem.mqls ?? ytd.mqls },
          { label: "MQL→SQL", from: sem.mqls ?? ytd.mqls, to: sem.sqls ?? ytd.sqls },
          { label: "SQL→OPP", from: sem.sqls ?? ytd.sqls, to: sem.opps ?? ytd.opps },
        ].map(r => ({ ...r, pct: r.from > 0 ? ((r.to / r.from) * 100).toFixed(1) : null, warn: r.from > 0 && r.to > r.from }))
        if (rates.every(r => r.pct === null)) return null
        return (
          <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "8px 0 4px", fontSize: 11, fontFamily: F.mono, color: C.tx3 }}>
            {rates.filter(r => r.pct !== null).map(r => (
              <span key={r.label}>{r.label}: <span style={{ fontWeight: 700, color: r.warn ? C.yellow : C.tx2 }}>{r.pct}%{r.warn ? " ⚠" : ""}</span></span>
            ))}
          </div>
        )
      })()}
      {gddData?.lastUpdate && <div style={{ fontSize: 10, color: C.tx3, textAlign: "right" }}>Actualizado: {gddData.lastUpdate}</div>}
    </div>
  )
})
