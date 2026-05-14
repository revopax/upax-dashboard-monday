'use client'
import React from 'react'
import { TODAY } from '../../lib/constants'
import { PREV_WEEK, parseTL, daysDiff } from '../../lib/utils'
import { C, R, F } from '../../lib/tokens'
import { Accordion } from '../ui'

/**
 * SprintStatusSection — KPIs operativos del sprint (activos, vencidos, detenidos, done)
 * Extraido de TabHome.jsx.
 */
export const SprintStatusSection = React.memo(function SprintStatusSection({ analysis: an, items }) {
  if (!an) return null

  const activeCount = (an.byPhase["🚧 Sprint"] || 0) + (an.byPhase["👀 Review"] || 0) + (an.byPhase["⚙️ Modificación"] || 0)
  const activeWeek = (an.byPhaseWeek["🚧 Sprint"] || 0) + (an.byPhaseWeek["👀 Review"] || 0) + (an.byPhaseWeek["⚙️ Modificación"] || 0)

  const thisMonthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
  const doneThisMonth = items.filter(it => {
    const fer = it.column_values?.date_mkzchmsq
    if (!fer || it.column_values?.color_mkz09na !== "✅ Done") return false
    const d = new Date(fer)
    return d >= thisMonthStart && d <= TODAY
  }).length

  const overdueCount = (an.overdue || []).length
  const detCount = an.byPhase["🚫 Detenido"] || 0
  const doneCount = (an.doneLastWeek || []).length

  const KPIop = (label, val, color, line1, line2, icon) => (
    <div style={{ background: C.bg2, border: "1px solid var(--bg4)", borderRadius: R.default, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ position: "absolute", top: 8, right: 12, fontSize: 18, opacity: 0.07 }}>{icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: F.mono, fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.05em", marginBottom: 6 }}>{val}</div>
      <div style={{ paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
        {line1 && <div style={{ fontSize: 11, color: C.tx3, lineHeight: 1.4 }}>{line1}</div>}
        {line2 && <div style={{ fontSize: 11, color: C.tx3, lineHeight: 1.4, marginTop: 2 }}>{line2}</div>}
      </div>
    </div>
  )

  return (
    <Accordion title="Estado del Sprint" defaultOpen={false}>
      <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {KPIop("Esta semana", activeWeek, C.blue, `${activeCount} activos total`, `${activeCount - activeWeek} fuera de semana`, "⚡")}
        {KPIop("Vencidos", overdueCount, overdueCount > 0 ? C.red : C.green, overdueCount > 0 ? `${(an.overdue || []).filter(it => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); return tl.end && daysDiff(TODAY, tl.end) > 7; }).length} con mas de 7 dias` : "Al dia ✓", `${(an.backlogWithDates||[]).length} en backlog con fecha`, "⏰")}
        {KPIop("Detenidos", detCount, detCount > 0 ? C.yellow : C.green, detCount > 0 ? `${(an.stoppedWeek||[]).length} con fecha esta semana` : "Sin bloqueos ✓", `${(an.noResp||[]).length} sin responsable`, "🚫")}
        {KPIop("Done sem.", doneCount, doneCount > 0 ? C.green : C.tx3, `${PREV_WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${PREV_WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})}`, `${doneThisMonth} este mes · ${an.doneTotal||0} total`, "✅")}
      </div>
    </Accordion>
  )
})
