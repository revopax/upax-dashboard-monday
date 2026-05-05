'use client'
import React, { useState } from 'react'
import { SQUADS, TODAY_STR } from '../lib/constants'
import { getSprintRoadmap, parseTL, shortName, normalizeSquad } from '../lib/utils'
import { C, F } from '../lib/tokens'
import { Card } from './ui'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getMonthInfo() {
  const now = new Date(TODAY_STR + 'T12:00:00')
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDay = now.getDate()
  return { year, month, daysInMonth, todayDay, monthName: MONTHS_ES[month] }
}

const PHASE_STYLES = {
  '🚧 Sprint': { label: 'Sprint', pattern: 'solid' },
  '👀 Review': { label: 'Review', pattern: 'striped' },
  '⚙️ Modificación': { label: 'Mod', pattern: 'dotted' },
}

function barStyle(color, pattern, opacity) {
  const base = { height: 18, borderRadius: 3, position: 'relative', minWidth: 4 }
  if (pattern === 'striped') {
    return {
      ...base,
      background: `repeating-linear-gradient(45deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`,
      opacity: opacity || 1,
    }
  }
  if (pattern === 'dotted') {
    return {
      ...base,
      background: 'transparent',
      border: `2px dashed ${color}`,
      opacity: opacity || 1,
    }
  }
  return { ...base, background: color, opacity: opacity || 1 }
}

function Tooltip({ text }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
      background: '#1a1a2e', color: '#fff', padding: '6px 10px', borderRadius: 6,
      fontSize: 11, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none',
      marginBottom: 4, boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    }}>
      {text}
    </div>
  )
}

function TimelineBar({ item, daysInMonth, todayDay, squadColor }) {
  const [hover, setHover] = useState(false)
  const cv = item.column_values || {}
  const phase = cv.color_mkz09na || '🚧 Sprint'
  const deadline = cv.date_mm1b10rx
  const deadlineDay = deadline ? parseInt(deadline.split('-')[2], 10) : daysInMonth
  const tl = parseTL(cv.timerange_mkzcqv0j)
  const startDay = tl.start ? Math.max(tl.start.getDate(), 1) : Math.max(todayDay, 1)
  const isOverdue = deadlineDay < todayDay
  const barColor = isOverdue ? 'var(--red)' : squadColor
  const phaseInfo = PHASE_STYLES[phase] || PHASE_STYLES['🚧 Sprint']

  const leftPct = ((startDay - 1) / daysInMonth) * 100
  const widthPct = Math.max(((deadlineDay - startDay + 1) / daysInMonth) * 100, 1.5)

  const filledDays = Math.min(Math.max(todayDay - startDay, 0), deadlineDay - startDay + 1)
  const filledPct = deadlineDay > startDay ? (filledDays / (deadlineDay - startDay + 1)) * 100 : 100

  const personName = shortName(cv.person)
  const projectName = (item.name || '').length > 25 ? item.name.slice(0, 25) + '...' : item.name

  const tooltipText = `${item.name} · ${normalizeSquad(cv.color_mkz0s203)} · ${deadline} · ${phaseInfo.label}`

  return (
    <div
      style={{ position: 'relative', height: 26, marginBottom: 2 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && <Tooltip text={tooltipText} />}
      <div style={{ position: 'absolute', left: leftPct + '%', width: widthPct + '%', top: 4, ...barStyle(barColor, phaseInfo.pattern, 0.35) }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: filledPct + '%', borderRadius: 3,
          ...(phaseInfo.pattern === 'dotted'
            ? { background: barColor, opacity: 0.4 }
            : phaseInfo.pattern === 'striped'
              ? { background: `repeating-linear-gradient(45deg, ${barColor}, ${barColor} 3px, transparent 3px, transparent 6px)`, opacity: 1 }
              : { background: barColor, opacity: 1 }),
        }} />
      </div>
      <div style={{
        position: 'absolute',
        left: `calc(${leftPct + widthPct}% + 6px)`,
        top: 5,
        fontSize: 10,
        color: C.tx2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 200,
      }}>
        <span style={{ fontWeight: 600 }}>{projectName}</span>
        <span style={{ color: C.tx3, marginLeft: 4 }}>{personName}</span>
      </div>
    </div>
  )
}

function MobileList({ grouped }) {
  return (
    <div>
      {grouped.map(({ squad, items: groupItems }) => (
        <div key={squad.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: squad.color, marginBottom: 4 }}>{squad.name}</div>
          {groupItems.map(it => {
            const cv = it.column_values || {}
            const phase = PHASE_STYLES[cv.color_mkz09na] || PHASE_STYLES['🚧 Sprint']
            const deadlineDate = cv.date_mm1b10rx
              ? new Date(cv.date_mm1b10rx + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
              : '—'
            const isOverdue = cv.date_mm1b10rx && cv.date_mm1b10rx < TODAY_STR
            return (
              <div key={it.id} style={{ display: 'flex', gap: 6, padding: '3px 0 3px 8px', fontSize: 11, borderBottom: '1px solid var(--bg3)' }}>
                <span style={{ fontFamily: F.mono, color: isOverdue ? C.red : C.tx3, minWidth: 48 }}>{deadlineDate}</span>
                <span style={{ flex: 1, color: C.tx2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                <span style={{ color: C.tx3, fontSize: 10 }}>{shortName(cv.person)}</span>
                <span style={{ fontSize: 9, color: C.tx3 }}>{phase.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export const RoadmapTimeline = React.memo(function RoadmapTimeline({ items }) {
  const [expandedSquads, setExpandedSquads] = useState({})
  const roadmapItems = getSprintRoadmap(items)
  const { daysInMonth, todayDay, monthName, year } = getMonthInfo()

  if (roadmapItems.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>📅</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.tx3 }}>Sin proyectos con deadline este mes</div>
      </Card>
    )
  }

  // Group by squad
  const grouped = []
  const seen = new Set()
  for (const it of roadmapItems) {
    const sqName = normalizeSquad(it.column_values?.color_mkz0s203 || '')
    if (!seen.has(sqName)) {
      seen.add(sqName)
      const sqDef = SQUADS.find(s => s.name === sqName) || { id: sqName, name: sqName, color: C.tx3 }
      grouped.push({ squad: sqDef, items: [] })
    }
    grouped.find(g => g.squad.name === sqName).items.push(it)
  }

  const MAX_PER_SQUAD = 3
  const todayPct = ((todayDay - 0.5) / daysInMonth) * 100

  const markers = []
  for (let d = 1; d <= daysInMonth; d += 5) markers.push(d)
  if (!markers.includes(daysInMonth)) markers.push(daysInMonth)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Roadmap {monthName} {year}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.tx3 }}>{roadmapItems.length} proyecto{roadmapItems.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Desktop: Gantt timeline */}
      <Card className="mobile-hide" style={{ padding: '12px 16px', overflow: 'hidden', position: 'relative' }}>
        {/* Day axis */}
        <div style={{ position: 'relative', height: 20, marginBottom: 8, borderBottom: '1px solid var(--bg4)' }}>
          {markers.map(d => (
            <span key={d} style={{
              position: 'absolute',
              left: ((d - 0.5) / daysInMonth * 100) + '%',
              transform: 'translateX(-50%)',
              fontSize: 9, color: C.tx3, fontFamily: F.mono,
            }}>{d}</span>
          ))}
        </div>

        {/* TODAY line */}
        <div style={{
          position: 'absolute', left: todayPct + '%', top: 32, bottom: 12,
          width: 1, borderLeft: '2px dashed var(--blue)', opacity: 0.5, zIndex: 5,
        }} />

        {/* Squad groups */}
        {grouped.map(({ squad, items: groupItems }) => {
          const isExpanded = expandedSquads[squad.id]
          const visible = isExpanded ? groupItems : groupItems.slice(0, MAX_PER_SQUAD)
          const hasMore = groupItems.length > MAX_PER_SQUAD
          return (
            <div key={squad.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: squad.color, marginBottom: 4 }}>
                {squad.name}
                <span style={{ fontWeight: 400, color: C.tx3, marginLeft: 6 }}>{groupItems.length}</span>
              </div>
              <div style={{ position: 'relative' }}>
                {visible.map(it => (
                  <TimelineBar
                    key={it.id}
                    item={it}
                    daysInMonth={daysInMonth}
                    todayDay={todayDay}
                    squadColor={squad.color}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={() => setExpandedSquads(prev => ({ ...prev, [squad.id]: !prev[squad.id] }))}
                  style={{ fontSize: 10, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 0' }}
                >
                  {isExpanded ? 'Ver menos' : `+${groupItems.length - MAX_PER_SQUAD} más`}
                </button>
              )}
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--bg4)', marginTop: 4 }}>
          {Object.entries(PHASE_STYLES).map(([, info]) => (
            <span key={info.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.tx3 }}>
              <span style={{ width: 16, height: 8, borderRadius: 2, ...barStyle(C.tx3, info.pattern, 0.7) }} />
              {info.label}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.tx3 }}>
            <span style={{ width: 16, height: 0, borderTop: '2px dashed var(--blue)' }} />
            Hoy
          </span>
        </div>
      </Card>

      {/* Mobile: Simple list */}
      <div className="mobile-only" style={{ display: 'none' }}>
        <Card>
          <MobileList grouped={grouped} />
        </Card>
      </div>
    </div>
  )
})
