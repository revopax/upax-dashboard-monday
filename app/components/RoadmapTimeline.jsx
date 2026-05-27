'use client'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { SQUADS, TODAY_STR } from '../lib/constants'
import { getRoadmapInRange, parseTL, shortName, normalizeSquad } from '../lib/utils'
import { C, F } from '../lib/tokens'
import { Card } from './ui'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const DAY_MS = 86400000
const diffDays = (a, b) => Math.round((a - b) / DAY_MS)
const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Cadence = axis granularity (column width). Independent from the visible range.
const CADENCE = {
  semana:    { label: 'Semana', pxPerDay: 16, step: 'week' },
  mes:       { label: 'Mes',    pxPerDay: 6,  step: 'month' },
  trimestre: { label: 'Trim.',  pxPerDay: 2.4, step: 'quarter' },
}
const CADENCE_OPTS = ['semana', 'mes', 'trimestre']

const RANGE_OPTS = [
  { key: 'mes', label: 'Este mes' },
  { key: 'trimestre', label: 'Este trim.' },
  { key: 'q1', label: 'Q1' },
  { key: 'q2', label: 'Q2' },
  { key: 'q3', label: 'Q3' },
  { key: 'q4', label: 'Q4' },
]

// Resolve a range preset to { start, end } (both at midnight, inclusive).
function getRange(preset, baseDate) {
  const y = baseDate.getFullYear()
  const m = baseDate.getMonth()
  const monthRange = (year, fromMonth, toMonth) => ({
    start: new Date(year, fromMonth, 1),
    end: new Date(year, toMonth + 1, 0),
  })
  switch (preset) {
    case 'trimestre': // mes anterior + actual + siguiente (rolling 3 meses)
      return { start: new Date(y, m - 1, 1), end: new Date(y, m + 2, 0) }
    case 'q1': return monthRange(y, 0, 2)
    case 'q2': return monthRange(y, 3, 5)
    case 'q3': return monthRange(y, 6, 8)
    case 'q4': return monthRange(y, 9, 11)
    case 'mes':
    default:
      return monthRange(y, m, m)
  }
}

function rangeTitle(preset, range) {
  const sy = range.start.getFullYear()
  const ey = range.end.getFullYear()
  if (preset === 'mes') return `${MONTHS_ES[range.start.getMonth()]} ${sy}`
  if (/^q[1-4]$/.test(preset)) return `${preset.toUpperCase()} ${sy}`
  const sm = MONTHS_SHORT[range.start.getMonth()]
  const em = MONTHS_SHORT[range.end.getMonth()]
  return sy === ey ? `${sm}–${em} ${sy}` : `${sm} ${sy} – ${em} ${ey}`
}

function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1))
  return x
}

// Build axis ticks (gridlines + labels) for the given cadence, clipped to range.
function buildTicks(rangeStart, rangeEnd, step, pxPerDay) {
  const ticks = []
  let cur
  if (step === 'week') {
    cur = mondayOf(rangeStart)
    while (cur <= rangeEnd) {
      ticks.push({ date: new Date(cur), label: `${cur.getDate()} ${MONTHS_SHORT[cur.getMonth()]}` })
      cur = new Date(cur); cur.setDate(cur.getDate() + 7)
    }
  } else if (step === 'month') {
    cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (cur <= rangeEnd) {
      const label = cur.getMonth() === 0 ? `${MONTHS_SHORT[0]} ${cur.getFullYear()}` : MONTHS_SHORT[cur.getMonth()]
      ticks.push({ date: new Date(cur), label })
      cur = new Date(cur); cur.setMonth(cur.getMonth() + 1)
    }
  } else { // quarter
    const qStartMonth = Math.floor(rangeStart.getMonth() / 3) * 3
    cur = new Date(rangeStart.getFullYear(), qStartMonth, 1)
    while (cur <= rangeEnd) {
      const q = Math.floor(cur.getMonth() / 3) + 1
      ticks.push({ date: new Date(cur), label: `Q${q} ${cur.getFullYear()}` })
      cur = new Date(cur); cur.setMonth(cur.getMonth() + 3)
    }
  }
  return ticks
    .map(t => ({ ...t, px: diffDays(atMidnight(t.date), rangeStart) * pxPerDay }))
    .filter(t => t.px >= 0)
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

function TimelineBar({ item, rangeStart, pxPerDay, today, squadColor }) {
  const [hover, setHover] = useState(false)
  const cv = item.column_values || {}
  const phase = cv.color_mkz09na || '🚧 Sprint'
  const phaseInfo = PHASE_STYLES[phase] || PHASE_STYLES['🚧 Sprint']

  const [dy, dm, dd] = (cv.date_mm1b10rx || '').split('-').map(Number)
  const deadline = dy ? new Date(dy, dm - 1, dd) : today
  const tl = parseTL(cv.timerange_mkzcqv0j)
  let start = tl.start ? atMidnight(tl.start) : new Date(today)
  if (start.getTime() > deadline.getTime()) start = new Date(deadline)

  const rs = rangeStart.getTime()
  const isOverdue = deadline.getTime() < today.getTime()
  const barColor = isOverdue ? 'var(--red)' : squadColor

  const clampedStart = Math.max(start.getTime(), rs)
  const leftPx = diffDays(clampedStart, rs) * pxPerDay
  const rightPx = (diffDays(deadline.getTime(), rs) + 1) * pxPerDay
  const widthPx = Math.max(rightPx - leftPx, 4)

  const spanDays = diffDays(deadline.getTime(), start.getTime()) + 1
  const elapsed = Math.min(Math.max(diffDays(today.getTime(), start.getTime()), 0), spanDays)
  const filledPct = spanDays > 0 ? (elapsed / spanDays) * 100 : 100

  const personName = shortName(cv.person)
  const projectName = (item.name || '').length > 25 ? item.name.slice(0, 25) + '...' : item.name
  const tooltipText = `${item.name} · ${normalizeSquad(cv.color_mkz0s203)} · ${cv.date_mm1b10rx} · ${phaseInfo.label}`

  return (
    <div
      style={{ position: 'relative', height: 26, marginBottom: 2 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && <Tooltip text={tooltipText} />}
      <div style={{ position: 'absolute', left: leftPx, width: widthPx, top: 4, ...barStyle(barColor, phaseInfo.pattern, 0.35) }}>
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
        left: leftPx + widthPx + 6,
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

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 0, border: '1px solid var(--bg4)', borderRadius: 6, overflow: 'hidden' }}>
      {options.map(opt => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              fontSize: 10, padding: '3px 8px',
              background: active ? C.blue : C.bg2,
              color: active ? '#fff' : C.tx3,
              border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const MAX_PER_SQUAD = 3

export const RoadmapTimeline = React.memo(function RoadmapTimeline({ items }) {
  const [expandedSquads, setExpandedSquads] = useState({})
  const [cadence, setCadence] = useState('semana')
  const [rangePreset, setRangePreset] = useState('trimestre')
  const scrollRef = useRef(null)

  const baseDate = useMemo(() => new Date(TODAY_STR + 'T12:00:00'), [])
  const today = useMemo(() => atMidnight(baseDate), [baseDate])

  const range = useMemo(() => getRange(rangePreset, baseDate), [rangePreset, baseDate])
  const rangeStart = useMemo(() => atMidnight(range.start), [range])
  const rangeEnd = useMemo(() => atMidnight(range.end), [range])

  const { pxPerDay, step } = CADENCE[cadence]
  const totalDays = diffDays(rangeEnd, rangeStart) + 1
  const totalWidth = Math.max(totalDays * pxPerDay, 320)
  const ticks = useMemo(() => buildTicks(rangeStart, rangeEnd, step, pxPerDay), [rangeStart, rangeEnd, step, pxPerDay])

  const roadmapItems = useMemo(() => getRoadmapInRange(items, rangeStart, rangeEnd), [items, rangeStart, rangeEnd])

  const todayInRange = today >= rangeStart && today <= rangeEnd
  const todayPx = (diffDays(today, rangeStart) + 0.5) * pxPerDay

  // Center the scroll on "today" whenever range/cadence changes (desktop only).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = todayInRange
      ? Math.max(0, todayPx - el.clientWidth / 2)
      : 0
    el.scrollLeft = target
  }, [todayPx, todayInRange, totalWidth])

  // Group by squad (preserves squad order from getRoadmapInRange sort).
  const grouped = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const it of roadmapItems) {
      const sqName = normalizeSquad(it.column_values?.color_mkz0s203 || '')
      if (!seen.has(sqName)) {
        seen.add(sqName)
        const sqDef = SQUADS.find(s => s.name === sqName) || { id: sqName, name: sqName, color: C.tx3 }
        out.push({ squad: sqDef, items: [] })
      }
      out.find(g => g.squad.name === sqName).items.push(it)
    }
    return out
  }, [roadmapItems])

  const title = rangeTitle(rangePreset, range)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Roadmap {title}
          <span style={{ fontWeight: 400, color: C.tx3, marginLeft: 8 }}>
            {roadmapItems.length} proyecto{roadmapItems.length !== 1 ? 's' : ''}
          </span>
        </span>
        {/* Controls: cadencia + rango — desktop only */}
        <div className="mobile-hide" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented
            options={CADENCE_OPTS.map(k => ({ key: k, label: CADENCE[k].label }))}
            value={cadence}
            onChange={setCadence}
          />
          <Segmented options={RANGE_OPTS} value={rangePreset} onChange={setRangePreset} />
        </div>
      </div>

      {/* Desktop: Gantt timeline with horizontal scroll */}
      <Card className="mobile-hide" style={{ padding: '12px 16px', overflow: 'hidden', position: 'relative' }}>
        {roadmapItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.tx3 }}>Sin proyectos con deadline en este rango</div>
          </div>
        ) : (
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4 }}>
            <div style={{ position: 'relative', width: totalWidth, minWidth: '100%' }}>
              {/* Gridlines */}
              {ticks.map((t, i) => (
                <div key={'g' + i} style={{
                  position: 'absolute', left: t.px, top: 24, bottom: 0,
                  width: 1, borderLeft: '1px solid var(--bg4)', opacity: 0.5,
                }} />
              ))}

              {/* Axis labels */}
              <div style={{ position: 'relative', height: 22, marginBottom: 6, borderBottom: '1px solid var(--bg4)' }}>
                {ticks.map((t, i) => (
                  <span key={'t' + i} style={{
                    position: 'absolute', left: t.px + 3, top: 4,
                    fontSize: 9, color: C.tx3, fontFamily: F.mono, whiteSpace: 'nowrap',
                  }}>{t.label}</span>
                ))}
              </div>

              {/* TODAY line */}
              {todayInRange && (
                <div style={{
                  position: 'absolute', left: todayPx, top: 24, bottom: 0,
                  width: 1, borderLeft: '2px dashed var(--blue)', opacity: 0.6, zIndex: 4,
                }} />
              )}

              {/* Squad groups */}
              {grouped.map(({ squad, items: groupItems }) => {
                const isExpanded = expandedSquads[squad.id]
                const visible = isExpanded ? groupItems : groupItems.slice(0, MAX_PER_SQUAD)
                const hasMore = groupItems.length > MAX_PER_SQUAD
                return (
                  <div key={squad.id} style={{ marginBottom: 10 }}>
                    <div style={{
                      position: 'sticky', left: 0, zIndex: 5, display: 'inline-block',
                      fontSize: 11, fontWeight: 700, color: squad.color, marginBottom: 4,
                      background: C.bg2, paddingRight: 8, borderRadius: 3,
                    }}>
                      {squad.name}
                      <span style={{ fontWeight: 400, color: C.tx3, marginLeft: 6 }}>{groupItems.length}</span>
                    </div>
                    <div style={{ position: 'relative' }}>
                      {visible.map(it => (
                        <TimelineBar
                          key={it.id}
                          item={it}
                          rangeStart={rangeStart}
                          pxPerDay={pxPerDay}
                          today={today}
                          squadColor={squad.color}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => setExpandedSquads(prev => ({ ...prev, [squad.id]: !prev[squad.id] }))}
                        style={{ position: 'sticky', left: 0, fontSize: 10, color: C.blue, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 0' }}
                      >
                        {isExpanded ? 'Ver menos' : `+${groupItems.length - MAX_PER_SQUAD} más`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Legend (static, outside scroll) */}
        {roadmapItems.length > 0 && (
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
        )}
      </Card>

      {/* Mobile: Simple list (no controls) */}
      <div className="mobile-only" style={{ display: 'none' }}>
        <Card>
          {grouped.length === 0
            ? <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: C.tx3 }}>Sin proyectos con deadline en este rango</div>
            : <MobileList grouped={grouped} />}
        </Card>
      </div>
    </div>
  )
})
