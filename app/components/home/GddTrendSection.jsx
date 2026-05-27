'use client'
import React, { useState, useEffect, useRef } from 'react'
import { C, R, F } from '../../lib/tokens'
import { Card, Accordion } from '../ui'

const fmtDate = (s) => {
  if (!s) return ""
  const d = new Date(s + "T12:00:00")
  return isNaN(d) ? s : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

// MqlChannelList — subcomponente con "ver mas" para la lista de canales MQL
function MqlChannelList({ channels, maxCount, showMax, needsMore, compact }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? channels : channels.slice(0, showMax)
  const channelColors = [C.blue, C.purple, C.green, C.yellow, C.red, "#FF6B6B", "#4ECDC4", "#45B7D1"]
  const padding = compact ? "3px 0" : "5px 0"
  const fontSize = compact ? 11 : 12
  const barHeight = compact ? 10 : 14
  return (
    <div>
      {visible.map((ch, i) => (
        <div key={ch.origen} style={{ display: "flex", alignItems: "center", gap: 8, padding, borderBottom: i < visible.length - 1 ? "1px solid var(--bg3)" : "none" }}>
          <span style={{ fontSize, color: C.tx2, flex: "0 0 100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.origen}</span>
          <div style={{ flex: 1, height: barHeight, background: C.bg3, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: Math.max((ch.count / maxCount) * 100, 4) + "%", height: "100%", background: channelColors[i % channelColors.length], borderRadius: 4, transition: "width .4s ease" }} />
          </div>
          <span style={{ fontFamily: F.mono, fontSize: fontSize + 1, fontWeight: 700, color: C.tx, minWidth: 28, textAlign: "right" }}>{ch.count}</span>
          <span style={{ fontFamily: F.mono, fontSize: 10, color: C.tx3, minWidth: 32, textAlign: "right" }}>{ch.pct}%</span>
        </div>
      ))}
      {needsMore && (
        <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 10, color: C.blue, background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginTop: 6, padding: 0 }}>
          {showAll ? "Ver menos ↑" : `+${channels.length - showMax} mas ↓`}
        </button>
      )}
    </div>
  )
}

/**
 * MqlChannelSection — MQLs por Canal con selector de semana
 */
export const MqlChannelSection = React.memo(function MqlChannelSection({ mqlBreakdown, mqlBreakdownPrev, gddHistory, gddData, gddLoading, gddWeekView }) {
  const [mqlWeekIdx, setMqlWeekIdx] = useState(-1)
  const [liveFetch, setLiveFetch] = useState(null) // { data, loading, weekKey }
  const liveFetchRef = useRef(null)

  // When a historical week has no por_origen, fetch live from HubSpot
  useEffect(() => {
    if (mqlWeekIdx === -1) { setLiveFetch(null); return }
    const entry = gddHistory?.[mqlWeekIdx]
    if (!entry) { setLiveFetch(null); return }
    const hasPorOrigen = Array.isArray(entry.por_origen) && entry.por_origen.length > 0
    if (hasPorOrigen) { setLiveFetch(null); return }

    const sd = entry.semana_desde || entry.id
    const sh = entry.semana_hasta || sd
    if (!sd) { setLiveFetch(null); return }

    const weekKey = `${sd}_${sh}`
    // Avoid re-fetching same week
    if (liveFetchRef.current === weekKey) return
    liveFetchRef.current = weekKey

    setLiveFetch({ data: null, loading: true, weekKey })

    const authHeaders = process.env.NEXT_PUBLIC_API_SECRET
      ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}

    fetch(`/api/hubspot-mqls?semana_desde=${encodeURIComponent(sd)}&semana_hasta=${encodeURIComponent(sh)}`, {
      headers: authHeaders, cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.error) {
          setLiveFetch({ data: d, loading: false, weekKey })
        } else {
          setLiveFetch({ data: null, loading: false, weekKey })
        }
      })
      .catch(() => setLiveFetch({ data: null, loading: false, weekKey }))

    return () => { liveFetchRef.current = null }
  }, [mqlWeekIdx, gddHistory])

  const mqlData = (() => {
    if (mqlWeekIdx === -1) {
      return gddWeekView === "prev" ? (mqlBreakdownPrev || mqlBreakdown) : mqlBreakdown
    }
    const entry = gddHistory?.[mqlWeekIdx]
    if (!entry) return null
    const hasPorOrigen = Array.isArray(entry.por_origen) && entry.por_origen.length > 0

    // Use stored por_origen if available
    if (hasPorOrigen) {
      return {
        total: entry.por_origen.reduce((sum, o) => sum + o.count, 0),
        por_origen: entry.por_origen,
        breakdown_macro: entry.breakdown_macro || { inbound: 0, outbound: 0, unknown: 0 },
      }
    }

    // Use live fetch data if available
    if (liveFetch?.data) {
      return liveFetch.data
    }

    // Still loading live data
    if (liveFetch?.loading) return '__loading__'

    // No data at all — show entry mqls count as fallback
    return {
      total: entry.mqls || 0,
      por_origen: [],
      breakdown_macro: entry.breakdown_macro || { inbound: 0, outbound: 0, unknown: 0 },
    }
  })()

  // La semana en curso ya se muestra como "Esta semana" (value -1, datos en
  // vivo). Se excluye del listado para no duplicarla con números distintos.
  const currentWeekDesde = gddData?.fechas?.semana_desde
  const weeksWithBreakdown = (gddHistory || [])
    .map((w, i) => ({ ...w, _idx: i }))
    .filter(w => w.semana_desde !== currentWeekDesde)

  return (
    <Accordion title="📊 MQLs por Canal" defaultOpen={false}>
    {(() => {
      if (gddLoading) {
        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>📊 MQLs por Canal</div>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 28, background: C.bg3, borderRadius: 6, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite", opacity: 0.5 }} />
            ))}
          </Card>
        )
      }
      if (!mqlData) return null
      if (mqlData === '__loading__') {
        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>📊 MQLs por Canal</div>
            <div style={{ fontSize: 11, color: C.tx3, padding: "12px 0" }}>Cargando datos de HubSpot...</div>
          </Card>
        )
      }
      const { total, por_origen, breakdown_macro } = mqlData
      const inb = breakdown_macro?.inbound || 0
      const outb = breakdown_macro?.outbound || 0
      const unk = breakdown_macro?.unknown || 0
      const macroTotal = inb + outb + unk || 1
      const maxCount = por_origen[0]?.count || 1
      const showMax = 8
      const needsMore = por_origen.length > showMax

      return (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              📊 MQLs por Canal
              {mqlWeekIdx === -1 && gddWeekView === "prev" && !mqlBreakdownPrev && mqlBreakdown && (
                <span style={{ fontSize: 9, color: C.yellow, fontWeight: 600, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>(datos sem. actual)</span>
              )}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {weeksWithBreakdown.length > 0 && (
                <select
                  value={mqlWeekIdx}
                  onChange={e => setMqlWeekIdx(Number(e.target.value))}
                  style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--bg4)", background: C.bg2, color: C.tx2, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <option value={-1}>Esta semana</option>
                  {weeksWithBreakdown.map(w => (
                    <option key={w._idx} value={w._idx}>
                      {fmtDate(w.semana_desde)} – {fmtDate(w.semana_hasta || w.semana_desde)}
                    </option>
                  ))}
                </select>
              )}
              <span style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 800, color: C.purple }}>{total}</span>
            </div>
          </div>
          {/* Barra macro Inbound / Outbound */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: C.bg3 }}>
              {inb > 0 && (
                <div style={{ width: (inb / macroTotal * 100) + "%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{inb} Inbound</span>
                </div>
              )}
              {outb > 0 && (
                <div style={{ width: (outb / macroTotal * 100) + "%", background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{outb} Outbound</span>
                </div>
              )}
              {unk > 0 && (
                <div style={{ width: (unk / macroTotal * 100) + "%", background: C.tx3, display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{unk}</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: C.tx3 }}>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.green, marginRight: 4, verticalAlign: "middle" }} />Inbound {Math.round(inb / macroTotal * 100)}%</span>
              <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.blue, marginRight: 4, verticalAlign: "middle" }} />Outbound {Math.round(outb / macroTotal * 100)}%</span>
            </div>
          </div>
          <MqlChannelList channels={por_origen} maxCount={maxCount} showMax={showMax} needsMore={needsMore} />
        </Card>
      )
    })()}
    </Accordion>
  )
})

/**
 * GddTrendSection — Tendencia Semanal agrupada por mes
 */
export const GddTrendSection = React.memo(function GddTrendSection({ gddData, gddHistory, gddLoading }) {
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [expandedWeek, setExpandedWeek] = useState(null)

  if (gddLoading || !gddHistory || gddHistory.length === 0) return null

  const metrics = ["leads", "mqls", "sqls", "opps"]
  const labels = { leads: "Leads", mqls: "MQLs", sqls: "SQLs", opps: "Opps" }
  const arrow = (cur, prev) => {
    if (prev === undefined || prev === null) return null
    if (cur > prev) return { symbol: "▲", color: C.green }
    if (cur < prev) return { symbol: "▼", color: C.red }
    return { symbol: "–", color: C.tx3 }
  }

  const byMonth = {}
  gddHistory.forEach((w, i) => {
    const key = (w.semana_desde || w.id || "").slice(0, 7)
    if (!key || key.length < 7) return
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push({ ...w, _globalIdx: i })
  })
  const monthKeys = Object.keys(byMonth).sort().reverse()

  const monthLabelFn = (mKey) => {
    const d = new Date(mKey + "-15T12:00:00")
    const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  const calcTotals = (weeks) => weeks.reduce((acc, w) => ({
    leads: acc.leads + (w.leads || 0),
    mqls: acc.mqls + (w.mqls || 0),
    sqls: acc.sqls + (w.sqls || 0),
    opps: acc.opps + (w.opps || 0),
  }), { leads: 0, mqls: 0, sqls: 0, opps: 0 })

  const globalTotals = calcTotals(gddHistory)

  return (
    <Accordion title="📈 Tendencia Semanal" defaultOpen={false}>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          📈 Tendencia Semanal
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: F.mono }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, color: C.tx3, fontWeight: 700, borderBottom: "1px solid var(--bg4)" }}>Semana</th>
                {metrics.map(m => (
                  <th key={m} style={{ textAlign: "right", padding: "6px 8px", fontSize: 10, color: C.tx3, fontWeight: 700, borderBottom: "1px solid var(--bg4)" }}>{labels[m]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthKeys.map((mKey, mi) => {
                const weeks = byMonth[mKey]
                const isMonthExpanded = mi === 0 || expandedMonth === mKey
                const mTotals = calcTotals(weeks)

                return (
                  <React.Fragment key={mKey}>
                    <tr
                      onClick={() => { setExpandedMonth(isMonthExpanded && mi !== 0 ? null : mKey); setExpandedWeek(null) }}
                      style={{ cursor: "pointer", background: C.bg2 }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                      onMouseLeave={e => e.currentTarget.style.background = C.bg2}
                    >
                      <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 700, color: C.tx, borderBottom: "1px solid var(--bg4)" }}>
                        <span style={{ fontSize: 9, marginRight: 6, color: C.tx3, display: "inline-block", transform: isMonthExpanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
                        {monthLabelFn(mKey)}
                        <span style={{ fontSize: 10, fontWeight: 400, color: C.tx3, marginLeft: 6 }}>{weeks.length} sem.</span>
                      </td>
                      {metrics.map(m => (
                        <td key={m} style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, color: isMonthExpanded ? C.tx3 : C.tx2, borderBottom: "1px solid var(--bg4)" }}>
                          {mTotals[m].toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    {isMonthExpanded && weeks.map((w, wi) => {
                      const isFirst = w.semana_desde === gddData?.fechas?.semana_desde
                      const prev = weeks[wi + 1]
                      const weekKey = w.id || w._globalIdx
                      const isWeekExpanded = expandedWeek === weekKey
                      const hasPorOrigen = Array.isArray(w.por_origen) && w.por_origen.length > 0
                      return (
                        <React.Fragment key={weekKey}>
                          <tr
                            onClick={() => hasPorOrigen && setExpandedWeek(isWeekExpanded ? null : weekKey)}
                            style={{
                              background: isFirst ? "rgba(0,122,255,.06)" : "transparent",
                              cursor: hasPorOrigen ? "pointer" : "default",
                              transition: "background .15s",
                            }}
                            onMouseEnter={e => { if (hasPorOrigen && !isFirst) e.currentTarget.style.background = C.bg3 }}
                            onMouseLeave={e => { if (!isFirst) e.currentTarget.style.background = "transparent" }}
                          >
                            <td style={{ padding: "6px 8px 6px 24px", fontSize: 11, color: isFirst ? C.blue : C.tx2, fontWeight: isFirst ? 700 : 400, borderBottom: isWeekExpanded ? "none" : "1px solid var(--bg4)", whiteSpace: "nowrap" }}>
                              {hasPorOrigen && <span style={{ fontSize: 8, marginRight: 4, color: C.tx3, display: "inline-block", transform: isWeekExpanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>}
                              {fmtDate(w.semana_desde)}
                              {isFirst && <span style={{ fontSize: 9, marginLeft: 4, color: C.blue, fontWeight: 700 }}>actual</span>}
                            </td>
                            {metrics.map(m => {
                              const val = w[m] || 0
                              const a = prev ? arrow(val, prev[m] || 0) : null
                              return (
                                <td key={m} style={{ textAlign: "right", padding: "6px 8px", borderBottom: isWeekExpanded ? "none" : "1px solid var(--bg4)", fontWeight: isFirst ? 700 : 400, color: isFirst ? C.tx : C.tx2 }}>
                                  {val.toLocaleString()}
                                  {a && <span style={{ fontSize: 9, marginLeft: 3, color: a.color, fontWeight: 700 }}>{a.symbol}</span>}
                                </td>
                              )
                            })}
                          </tr>
                          {isWeekExpanded && hasPorOrigen && (
                            <tr>
                              <td colSpan={5} style={{ padding: "0 8px 8px 24px", borderBottom: "1px solid var(--bg4)" }}>
                                <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 10, color: C.tx3 }}>
                                  {w.breakdown_macro && (
                                    <>
                                      <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: C.green, marginRight: 3, verticalAlign: "middle" }} />Inbound: {w.breakdown_macro.inbound || 0}</span>
                                      <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: C.blue, marginRight: 3, verticalAlign: "middle" }} />Outbound: {w.breakdown_macro.outbound || 0}</span>
                                    </>
                                  )}
                                </div>
                                <MqlChannelList
                                  channels={w.por_origen}
                                  maxCount={w.por_origen[0]?.count || 1}
                                  showMax={5}
                                  needsMore={w.por_origen.length > 5}
                                  compact
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
              <tr style={{ background: C.bg2, borderTop: "2px solid var(--bg4)" }}>
                <td style={{ padding: "10px 8px", fontSize: 12, fontWeight: 800, color: C.tx }}>Total</td>
                {metrics.map(m => (
                  <td key={m} style={{ textAlign: "right", padding: "10px 8px", fontSize: 13, fontWeight: 800, color: C.tx }}>
                    {globalTotals[m].toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </Accordion>
  )
})
