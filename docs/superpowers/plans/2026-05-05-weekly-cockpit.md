# Weekly Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Home as a 3-zone weekly cockpit (Control + GdD + Roadmap), improve minuta with MQLs by channel and roadmap, remove alerts from Home.

**Architecture:** Extract `getSprintRoadmap()` into utils.js as shared filter logic. Create new `RoadmapTimeline.jsx` component. Modify `TabHome.jsx` to use 3-zone layout (remove OverdueSection + alerts, keep GdD + add Roadmap). Extend `generateMinuta()` signature to accept `mqlBreakdown` and `items`. Wire new params through `Dashboard.jsx`.

**Tech Stack:** React 18, Next.js 14, CSS inline (project pattern), design tokens from `lib/tokens.js`, no new dependencies.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/utils.js` | Modify | Add `getSprintRoadmap()` shared filter function |
| `app/lib/__tests__/getSprintRoadmap.test.js` | Create | Tests for roadmap filtering logic |
| `app/components/RoadmapTimeline.jsx` | Create | Visual timeline component (desktop Gantt + mobile list) |
| `app/lib/minuta.js` | Modify | New signature, dual GdD, MQL channel table, roadmap section |
| `app/lib/__tests__/minuta.test.js` | Create | Tests for updated generateMinuta output |
| `app/components/TabHome.jsx` | Modify | Remove OverdueSection + alerts, add RoadmapTimeline, restructure 3 zones |
| `app/Dashboard.jsx` | Modify | Pass mqlBreakdown + items to generateMinuta |

---

### Task 1: Add `getSprintRoadmap()` to utils.js

**Files:**
- Modify: `app/lib/utils.js`
- Create: `app/lib/__tests__/getSprintRoadmap.test.js`

- [ ] **Step 1: Write the failing test**

Create `app/lib/__tests__/getSprintRoadmap.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { getSprintRoadmap } from '../utils'

const makeItem = (id, phase, deadline, squad, timeline, person) => ({
  id,
  name: `Project ${id}`,
  column_values: {
    color_mkz09na: phase,
    date_mm1b10rx: deadline,
    color_mkz0s203: squad,
    timerange_mkzcqv0j: timeline || null,
    person: person || 'Test Person',
  },
})

describe('getSprintRoadmap', () => {
  it('returns Sprint items with deadline in current month', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const deadline = `${y}-${m}-15`

    const items = [
      makeItem('1', '🚧 Sprint', deadline, 'Inbound Studio'),
      makeItem('2', '⏳Backlog', deadline, 'Inbound Studio'),
      makeItem('3', '✅ Done', deadline, 'Inbound Studio'),
    ]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('includes Review and Modificacion phases', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const deadline = `${y}-${m}-20`

    const items = [
      makeItem('1', '🚧 Sprint', deadline, 'Inbound Studio'),
      makeItem('2', '👀 Review', deadline, 'Performance y Conversión'),
      makeItem('3', '⚙️ Modificación', deadline, 'RevOps & Analytics'),
    ]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(3)
  })

  it('excludes items without deadline', () => {
    const items = [makeItem('1', '🚧 Sprint', null, 'Inbound Studio')]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(0)
  })

  it('excludes items with deadline outside current month', () => {
    const items = [makeItem('1', '🚧 Sprint', '2020-01-15', 'Inbound Studio')]
    const result = getSprintRoadmap(items)
    expect(result).toHaveLength(0)
  })

  it('groups by squad then sorts by deadline ascending', () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')

    const items = [
      makeItem('1', '🚧 Sprint', `${y}-${m}-20`, 'Performance y Conversión'),
      makeItem('2', '🚧 Sprint', `${y}-${m}-10`, 'Inbound Studio'),
      makeItem('3', '🚧 Sprint', `${y}-${m}-15`, 'Inbound Studio'),
    ]
    const result = getSprintRoadmap(items)
    // Grouped by squad order (SQUADS array order), then by deadline
    expect(result[0].id).toBe('2') // Inbound first (index 0 in SQUADS), earlier deadline
    expect(result[1].id).toBe('3') // Inbound, later deadline
    expect(result[2].id).toBe('1') // Performance (index 1 in SQUADS)
  })

  it('returns empty array for empty items', () => {
    expect(getSprintRoadmap([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run app/lib/__tests__/getSprintRoadmap.test.js`
Expected: FAIL — `getSprintRoadmap` is not exported from `../utils`

- [ ] **Step 3: Implement getSprintRoadmap in utils.js**

Add at the end of `app/lib/utils.js` (before the closing of the file, after `normalizeFocos`):

```js
// Shared roadmap filter: active phases with deadline in current month, grouped by squad
export function getSprintRoadmap(items) {
  const now = new Date(TODAY_STR + 'T12:00:00')
  const year = now.getFullYear()
  const month = now.getMonth()
  const ACTIVE_PHASES = ['🚧 Sprint', '👀 Review', '⚙️ Modificación']

  const filtered = items.filter(it => {
    const cv = it.column_values || {}
    const phase = cv.color_mkz09na
    const deadline = cv.date_mm1b10rx
    if (!ACTIVE_PHASES.includes(phase) || !deadline) return false
    const [dy, dm] = deadline.split('-').map(Number)
    return dy === year && dm === month + 1
  })

  // Sort by SQUADS order, then by deadline ascending
  const SQUAD_ORDER = SQUADS.map(s => s.name)
  filtered.sort((a, b) => {
    const sqA = SQUAD_ORDER.indexOf(normalizeSquad(a.column_values?.color_mkz0s203 || ''))
    const sqB = SQUAD_ORDER.indexOf(normalizeSquad(b.column_values?.color_mkz0s203 || ''))
    const orderA = sqA >= 0 ? sqA : 999
    const orderB = sqB >= 0 ? sqB : 999
    if (orderA !== orderB) return orderA - orderB
    return (a.column_values?.date_mm1b10rx || '').localeCompare(b.column_values?.date_mm1b10rx || '')
  })

  return filtered
}
```

Note: Add `SQUADS` to the import from `'./constants'` at the top of utils.js. The existing import on line 4 is:
```js
import { TODAY_STR, TODAY, PERSONAS, SQUAD_ALIASES } from './constants'
```
Change to:
```js
import { TODAY_STR, TODAY, PERSONAS, SQUAD_ALIASES, SQUADS } from './constants'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run app/lib/__tests__/getSprintRoadmap.test.js`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/lib/utils.js app/lib/__tests__/getSprintRoadmap.test.js
git commit -m "feat: add getSprintRoadmap() shared filter for roadmap data"
```

---

### Task 2: Create RoadmapTimeline component

**Files:**
- Create: `app/components/RoadmapTimeline.jsx`

- [ ] **Step 1: Create the RoadmapTimeline component**

Create `app/components/RoadmapTimeline.jsx`:

```jsx
'use client'
import React, { useState } from 'react'
import { SQUADS, TODAY_STR, TODAY } from '../lib/constants'
import { getSprintRoadmap, parseTL, shortName, normalizeSquad } from '../lib/utils'
import { C, F, R } from '../lib/tokens'
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

function BarStyle(color, pattern, opacity) {
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

  // Calculate positions as percentages
  const leftPct = ((startDay - 1) / daysInMonth) * 100
  const widthPct = Math.max(((deadlineDay - startDay + 1) / daysInMonth) * 100, 1.5)

  // Split: filled (past) vs remaining (future)
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
      {/* Bar container */}
      <div style={{ position: 'absolute', left: leftPct + '%', width: widthPct + '%', top: 4, ...BarStyle(barColor, phaseInfo.pattern, 0.35) }}>
        {/* Filled portion */}
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
      {/* Label to the right of bar */}
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

  // Day markers every 5 days
  const markers = []
  for (let d = 1; d <= daysInMonth; d += 5) markers.push(d)
  if (!markers.includes(daysInMonth)) markers.push(daysInMonth)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          📅 Roadmap {monthName} {year}
        </span>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.tx3 }}>{roadmapItems.length} proyecto{roadmapItems.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Desktop: Gantt timeline */}
      <Card className="mobile-hide" style={{ padding: '12px 16px', overflow: 'hidden' }}>
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
                  {isExpanded ? 'Ver menos ↑' : `+${groupItems.length - MAX_PER_SQUAD} más ↓`}
                </button>
              )}
            </div>
          )
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid var(--bg4)', marginTop: 4 }}>
          {Object.entries(PHASE_STYLES).map(([, info]) => (
            <span key={info.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.tx3 }}>
              <span style={{ width: 16, height: 8, borderRadius: 2, ...BarStyle(C.tx3, info.pattern, 0.7) }} />
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
```

- [ ] **Step 2: Verify component renders without errors**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx next build 2>&1 | tail -20`
Expected: Build succeeds (RoadmapTimeline is not imported yet, so no impact — this is a sanity check)

- [ ] **Step 3: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/components/RoadmapTimeline.jsx
git commit -m "feat: add RoadmapTimeline component with Gantt view and mobile fallback"
```

---

### Task 3: Extend generateMinuta() with dual GdD, MQL channels, and roadmap

**Files:**
- Modify: `app/lib/minuta.js`
- Create: `app/lib/__tests__/minuta.test.js`

- [ ] **Step 1: Write failing tests for the new minuta sections**

Create `app/lib/__tests__/minuta.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generateMinuta } from '../minuta'

const makeWd = () => ({
  date: '2026-05-04',
  presenters: {},
  focos: {},
  compromisos: [],
  synced: [],
})

const makeAnalysis = () => ({
  byPhase: { '🚧 Sprint': 10, '👀 Review': 5 },
  byPhaseWeek: { '🚧 Sprint': 8, '👀 Review': 3 },
  bySquad: {},
  bySquadWeek: {},
  byPerson: {},
  byPersonWeek: {},
  overdue: [],
  noResp: [],
  noCrono: [],
  stoppedWeek: [],
  backlogWithDates: [],
  doneLastWeek: [{ id: '1' }, { id: '2' }],
  doneThisWeek: [],
  overdueThisWeek: [],
  overdueLastWeek: [],
  stoppedLastWeek: [],
  velocity: { active: 8, done: 2, overdue: 0 },
  semaphore: 'green',
  doneTotal: 20,
})

const makeGddData = () => ({
  semana: { leads: 38, mqls: 15, sqls: 4, opps: 1, leads_mkt: 25, leads_com: 13, mqls_mkt: 10, mqls_com: 5, sqls_mkt: 3, sqls_com: 1, opps_mkt: 0, opps_com: 1, pipeline_total: 800000, pipeline_mkt: 500000, pipeline_com: 300000 },
  anterior: { leads: 45, mqls: 12, sqls: 3, opps: 2, leads_mkt: 30, leads_com: 15, mqls_mkt: 8, mqls_com: 4, sqls_mkt: 2, sqls_com: 1, opps_mkt: 1, opps_com: 1, pipeline_total: 1200000, pipeline_mkt: 800000, pipeline_com: 400000 },
  fechas: { semana_desde: '2026-05-04', semana_hasta: '2026-05-10' },
})

const makeMqlBreakdown = () => ({
  total: 12,
  por_origen: [
    { origen: 'Paid Social', count: 5, pct: 42 },
    { origen: 'Organic Search', count: 3, pct: 25 },
    { origen: 'Offline / SDR', count: 2, pct: 17 },
    { origen: 'Direct Traffic', count: 1, pct: 8 },
    { origen: 'Email Marketing', count: 1, pct: 8 },
  ],
})

const makeItems = () => [
  {
    id: '100', name: 'Credenciales RL',
    column_values: { color_mkz09na: '🚧 Sprint', date_mm1b10rx: '2026-05-05', color_mkz0s203: 'Inbound Studio', person: 'Jean Pierre Barroilhet', timerange_mkzcqv0j: '2026-05-01 - 2026-05-05' },
  },
  {
    id: '101', name: 'Landing MC',
    column_values: { color_mkz09na: '👀 Review', date_mm1b10rx: '2026-05-12', color_mkz0s203: 'Performance y Conversión', person: 'Paul Zárate', timerange_mkzcqv0j: '2026-05-05 - 2026-05-12' },
  },
]

describe('generateMinuta — updated', () => {
  it('includes dual GdD sections (anterior + actual)', () => {
    const result = generateMinuta(makeWd(), makeAnalysis(), makeGddData(), makeMqlBreakdown(), {}, makeItems())
    expect(result).toContain('Semana anterior')
    expect(result).toContain('Semana actual')
  })

  it('includes MQLs por canal section', () => {
    const result = generateMinuta(makeWd(), makeAnalysis(), makeGddData(), makeMqlBreakdown(), {}, makeItems())
    expect(result).toContain('MQLs por canal')
    expect(result).toContain('Paid Social')
    expect(result).toContain('Organic Search')
  })

  it('includes ROADMAP section with projects', () => {
    const result = generateMinuta(makeWd(), makeAnalysis(), makeGddData(), makeMqlBreakdown(), {}, makeItems())
    expect(result).toContain('ROADMAP')
    expect(result).toContain('Credenciales RL')
    expect(result).toContain('Landing MC')
  })

  it('handles null mqlBreakdown gracefully', () => {
    const result = generateMinuta(makeWd(), makeAnalysis(), makeGddData(), null, {}, makeItems())
    expect(result).not.toContain('MQLs por canal')
    expect(result).toContain('GENERACION DE DEMANDA')
  })

  it('handles empty items for roadmap gracefully', () => {
    const result = generateMinuta(makeWd(), makeAnalysis(), makeGddData(), makeMqlBreakdown(), {}, [])
    expect(result).not.toContain('ROADMAP')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run app/lib/__tests__/minuta.test.js`
Expected: FAIL — current `generateMinuta` has 4 params, not 6; no "Semana anterior" / "MQLs por canal" / "ROADMAP" sections

- [ ] **Step 3: Rewrite generateMinuta() in minuta.js**

Replace the content of `app/lib/minuta.js` with:

```js
'use client'
// lib/minuta.js — generador de texto plano de la minuta
import { TODAY_STR, SQUADS, PERSONAS } from './constants'
import { WEEK, shortName, normalizeSquad, getSprintRoadmap } from './utils'

export function generateMinuta(wd, analysis, gddData, mqlBreakdown, blockTimes, items) {
  const an = analysis, comps = wd?.compromisos || [];
  const dateStr = new Date(TODAY_STR).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const LINE = "─".repeat(48);
  const arrow = (cur, prev) => { if (!prev) return ""; const p = Math.abs(Math.round(((cur-prev)/prev)*100)); return cur >= prev ? `▲${p}%` : `▼${p}%`; };
  const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v||0}`;
  let t = "";

  t += `WEEKLY MKT CORP · ${dateStr.toUpperCase()}\n${LINE}\n\n`;

  // 1. GENERACIÓN DE DEMANDA — dual: anterior + actual
  {
    const gdd = gddData || { semana: {}, anterior: {}, ytd: {}, fechas: {} };
    const s = gdd.semana || {}, a = gdd.anterior || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
    const hasData = s.leads || s.mqls || s.sqls || s.opps || a.leads || a.mqls || a.sqls || a.opps;

    t += `1. GENERACION DE DEMANDA`;
    t += `\n`;

    if (hasData) {
      const fmt4 = (label, val, mktVal, comVal) => {
        let line = `   · ${label.padEnd(8)} ${String(val.toLocaleString()).padStart(6)}`;
        if (mktVal != null && comVal != null) line += `  (Mkt: ${mktVal} | Com: ${comVal})`;
        return line + '\n';
      };

      const fmt4Delta = (label, cur, prev, mktVal, comVal) => {
        const pct = arrow(cur, prev);
        let line = `   · ${label.padEnd(8)} ${String(cur.toLocaleString()).padStart(6)}${pct ? "  "+pct : ""}`;
        if (mktVal != null && comVal != null) line += `  (Mkt: ${mktVal} | Com: ${comVal})`;
        return line + '\n';
      };

      // Calculate prev week date range for label
      const prevDesde = f.semana_desde ? (() => {
        const d = new Date(f.semana_desde + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      })() : '';
      const prevHasta = f.semana_desde ? (() => {
        const d = new Date(f.semana_desde + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      })() : '';
      const curDesde = f.semana_desde ? new Date(f.semana_desde + 'T12:00:00').toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : '';
      const curHasta = f.semana_hasta ? new Date(f.semana_hasta + 'T12:00:00').toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : '';

      // Semana anterior (datos cerrados)
      if (a.leads || a.mqls || a.sqls || a.opps) {
        t += `   Semana anterior${prevDesde ? ` (${prevDesde} – ${prevHasta})` : ''}\n`;
        t += fmt4("Leads", a.leads||0, a.leads_mkt, a.leads_com);
        t += fmt4("MQLs",  a.mqls||0,  a.mqls_mkt,  a.mqls_com);
        t += fmt4("SQLs",  a.sqls||0,  a.sqls_mkt,  a.sqls_com);
        t += fmt4("Opps",  a.opps||0,  a.opps_mkt,  a.opps_com);
        const aPipeline = a.pipeline_total || ((a.pipeline_mkt||0) + (a.pipeline_com||0));
        if (aPipeline > 0) t += `   · Pipeline  ${fmtM(aPipeline)}  (Mkt ${fmtM(a.pipeline_mkt||0)} | Com ${fmtM(a.pipeline_com||0)})\n`;
        t += `\n`;
      }

      // Semana actual (con deltas vs anterior)
      t += `   Semana actual${curDesde ? ` (${curDesde} – ${curHasta})` : ''}\n`;
      t += fmt4Delta("Leads", s.leads||0, a.leads||0, s.leads_mkt, s.leads_com);
      t += fmt4Delta("MQLs",  s.mqls||0,  a.mqls||0,  s.mqls_mkt,  s.mqls_com);
      t += fmt4Delta("SQLs",  s.sqls||0,  a.sqls||0,  s.sqls_mkt,  s.sqls_com);
      t += fmt4Delta("Opps",  s.opps||0,  a.opps||0,  s.opps_mkt,  s.opps_com);
      const pTotal = s.pipeline_total || ((s.pipeline_mkt||0) + (s.pipeline_com||0));
      if (pTotal > 0) t += `   · Pipeline  ${fmtM(pTotal)}  (Mkt ${fmtM(s.pipeline_mkt||0)} | Com ${fmtM(s.pipeline_com||0)})\n`;

      if (y.leads) t += `   · YTD: Leads ${y.leads.toLocaleString()} · MQLs ${y.mqls||0} · SQLs ${y.sqls||0} · Opps ${y.opps||0}\n`;
    } else {
      t += `   (sin datos — editar en Home > GdD)\n`;
    }

    // MQLs por canal (semana anterior, datos cerrados)
    if (mqlBreakdown && mqlBreakdown.por_origen && mqlBreakdown.por_origen.length > 0) {
      t += `\n   MQLs por canal (sem anterior · datos cerrados)\n`;
      mqlBreakdown.por_origen.forEach(ch => {
        t += `   · ${ch.origen.padEnd(20)} ${String(ch.count).padStart(3)}   ${String(ch.pct).padStart(2)}%\n`;
      });
    }

    t += `\n`;
  }

  // 2. PANORAMA OPERATIVO
  if (an) {
    const spr = an.byPhase["🚧 Sprint"]||0, rev = an.byPhase["👀 Review"]||0;
    const mod = an.byPhase["⚙️ Modificación"]||0, det = an.byPhase["🚫 Detenido"]||0;
    const ven = (an.overdue||[]).length, done = (an.doneLastWeek||[]).length;
    t += `2. PANORAMA OPERATIVO\n`;
    const actSem = (an.byPhaseWeek?.["🚧 Sprint"]||0)+(an.byPhaseWeek?.["👀 Review"]||0)+(an.byPhaseWeek?.["⚙️ Modificación"]||0);
    t += `   Esta semana: ${actSem}  |  Total activos: ${spr+rev+mod}  |  Detenidos: ${det}  |  Vencidos: ${ven}  |  Done sem.: ${done}\n`;
    SQUADS.forEach(sq => {
      const d = an.bySquad[sq.name]; if (!d) return;
      const act = (d.phases["🚧 Sprint"]||0)+(d.phases["👀 Review"]||0)+(d.phases["⚙️ Modificación"]||0);
      const det2 = d.phases["🚫 Detenido"]||0;
      const ven2 = (an.overdue||[]).filter(it => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name).length;
      if (act > 0 || det2 > 0 || ven2 > 0) {
        t += `   · ${sq.name}: ${act} activos`;
        if (det2) t += `, ${det2} detenido${det2>1?"s":""}`;
        if (ven2) t += `, ${ven2} vencido${ven2>1?"s":""}`;
        t += `\n`;
      }
    });
    t += `\n`;
  }

  // 3. FOCOS POR SQUAD
  const hasEntries = SQUADS.some(sq => {
    const raw = wd?.focos?.[sq.id];
    const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
    return arr.some(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
  });

  if (hasEntries) {
    t += `3. FOCOS POR SQUAD\n`;
    SQUADS.forEach(sq => {
      const raw = wd?.focos?.[sq.id];
      const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
      const filled = arr.filter(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
      if (!filled.length) return;
      const presenter = wd?.presenters?.[sq.id] || sq.lead;
      t += `\n   ${sq.name.toUpperCase()} (${presenter})\n`;
      filled.forEach(f => {
        if (f.focos?.trim()) {
          const parts = f.focos.split(/\d+\)/).map(s => s.trim()).filter(Boolean);
          if (parts.length > 1) parts.forEach(l => { t += `   · ${l}\n`; });
          else t += `   · ${f.focos.trim()}\n`;
        }
        if (f.blocker?.trim()) {
          t += `   ⚠ BLOCKER: ${f.blocker.trim()}`;
          if (f.blocker_quien) t += ` → ${shortName(f.blocker_quien)}`;
          if (f.blocker_cuando) t += ` (${new Date(f.blocker_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
        if (f.necesito?.trim()) {
          t += `   ✋ NECESITO: ${f.necesito.trim()}`;
          if (f.necesito_quien) t += ` → ${shortName(f.necesito_quien)}`;
          if (f.necesito_cuando) t += ` (${new Date(f.necesito_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
      });
    });
    t += `\n`;
  }

  // 4. COMPROMISOS
  const openComps = comps.filter(c => c.que?.trim());
  if (openComps.length) {
    t += `4. COMPROMISOS\n`;
    openComps.forEach(c => {
      const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
      const status = c.status === "done" ? "✓" : "○";
      t += `   ${status} ${c.que.trim()} · ${shortName(c.quien)||"sin asignar"} · ${fecha}\n`;
    });
    t += `\n`;
  }

  // 5. CARGA SEMANAL
  if (an) {
    const all = Object.entries(an.byPersonWeek)
      .filter(([name]) => PERSONAS.some(p => p.name === name && !p.sdr))
      .sort((a, b) => b[1].total - a[1].total);
    if (all.length) {
      const maxVal = all[0][1].total || 1;
      t += `5. CARGA SEMANAL (${WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})})\n`;
      const half = Math.ceil(all.length / 2);
      const col1 = all.slice(0, half);
      const col2 = all.slice(half);
      const maxLen = col1.length;
      for (let i = 0; i < maxLen; i++) {
        const [p1, d1] = col1[i] || ["", { total: 0, stopped: 0 }];
        const bar1 = p1 ? "█".repeat(Math.min(Math.round((d1.total/maxVal)*8), 8)) + (d1.total > 10 ? "▸" : " ") : "";
        const flag1 = d1.stopped > 0 ? "🚫" : "  ";
        const left = p1 ? `   ${String(i+1).padStart(2)}. ${shortName(p1).padEnd(14)} ${bar1.padEnd(10)} ${String(d1.total).padStart(2)} ${flag1}` : "";
        const [p2, d2] = col2[i] || ["", { total: 0, stopped: 0 }];
        const bar2 = p2 ? "█".repeat(Math.min(Math.round((d2.total/maxVal)*8), 8)) + (d2.total > 10 ? "▸" : " ") : "";
        const flag2 = d2 ? (d2.stopped > 0 ? "🚫" : "  ") : "";
        const right = p2 ? `  ${String(i+half+1).padStart(2)}. ${shortName(p2).padEnd(14)} ${bar2.padEnd(10)} ${String(d2.total).padStart(2)} ${flag2}` : "";
        t += `${left}${right}\n`;
      }
      t += `\n`;
    }
  }

  // 6. ROADMAP
  const roadmapItems = getSprintRoadmap(items || []);
  if (roadmapItems.length > 0) {
    const monthName = new Date(TODAY_STR + 'T12:00:00').toLocaleDateString("es-MX", { month: "long" }).toUpperCase();
    t += `6. ROADMAP ${monthName}\n`;

    const PHASE_LABELS = { '🚧 Sprint': 'Sprint', '👀 Review': 'Review', '⚙️ Modificación': 'Modificacion' };
    let currentSquad = '';
    roadmapItems.forEach(it => {
      const cv = it.column_values || {};
      const sqName = normalizeSquad(cv.color_mkz0s203 || '');
      if (sqName !== currentSquad) {
        currentSquad = sqName;
        t += `   ${sqName}\n`;
      }
      const deadline = cv.date_mm1b10rx || '';
      const deadlineLabel = deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : '—';
      const phase = PHASE_LABELS[cv.color_mkz09na] || cv.color_mkz09na || '';
      t += `   ${deadlineLabel} · ${it.name} — ${shortName(cv.person)} · ${phase}\n`;
    });
    t += `\n`;
  }

  t += `${LINE}\nWeekly Mkt Corp · ${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}\n`;
  return t;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run app/lib/__tests__/minuta.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Run existing tests to check for regressions**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run`
Expected: All tests PASS (the existing tests in normalizeFocos, tokens, css, a11y should not be affected)

- [ ] **Step 6: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/lib/minuta.js app/lib/__tests__/minuta.test.js
git commit -m "feat: extend generateMinuta with dual GdD, MQL channels, and roadmap section"
```

---

### Task 4: Wire new params in Dashboard.jsx

**Files:**
- Modify: `app/Dashboard.jsx:162` (generateMinuta call in useEffect)
- Modify: `app/Dashboard.jsx:503` (Regenerar button onClick)
- Modify: `app/Dashboard.jsx:543` (TabHome props — remove onViewAlerts)

- [ ] **Step 1: Update generateMinuta calls in Dashboard.jsx**

In `app/Dashboard.jsx`, find the `useEffect` that calls `generateMinuta` (around line 162):

```js
// BEFORE (line 162):
const draft = generateMinuta(wdRef.current, analysisRef.current, appGddData, blockTimesRef.current);

// AFTER:
const draft = generateMinuta(wdRef.current, analysisRef.current, appGddData, mqlBreakdown, blockTimesRef.current, items);
```

Find the "Regenerar" button onClick (around line 503):

```js
// BEFORE:
onClick={() => setMinutaDraft(generateMinuta(wd, an, appGddData, blockTimes))}

// AFTER:
onClick={() => setMinutaDraft(generateMinuta(wd, an, appGddData, mqlBreakdown, blockTimes, items))}
```

- [ ] **Step 2: Remove onViewAlerts from TabHome props**

In `app/Dashboard.jsx`, find the TabHome render (around line 543):

```jsx
// BEFORE:
<TabHome analysis={an} items={items} elapsed={elapsed} onStart={startTimer} onViewAlerts={() => { setTab("panorama"); try { sessionStorage.setItem("panorama-tab","alertas"); } catch {} }} gddData={appGddData} mqlBreakdown={mqlBreakdown} mqlBreakdownPrev={mqlBreakdownPrev} gddTargets={gddTargets} gddHistory={gddHistory} setGddHistory={setGddHistory} gddLoading={gddLoading} />

// AFTER:
<TabHome analysis={an} items={items} elapsed={elapsed} onStart={startTimer} gddData={appGddData} mqlBreakdown={mqlBreakdown} mqlBreakdownPrev={mqlBreakdownPrev} gddTargets={gddTargets} gddHistory={gddHistory} setGddHistory={setGddHistory} gddLoading={gddLoading} />
```

- [ ] **Step 3: Verify build succeeds**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/Dashboard.jsx
git commit -m "feat: wire mqlBreakdown and items to generateMinuta, remove onViewAlerts"
```

---

### Task 5: Restructure TabHome.jsx — remove alerts, add Roadmap

**Files:**
- Modify: `app/components/TabHome.jsx`

This is the largest task. The changes:
1. Remove `OverdueSection` export and component (lines 9-37)
2. Remove the alerts Accordion section (lines 170-216)
3. Remove `onViewAlerts` from props (line 114)
4. Add `RoadmapTimeline` import and render at Zona 3
5. Remove `alertGroupsExpanded` state (line 115)

- [ ] **Step 1: Remove OverdueSection component**

Delete lines 9-37 of `app/components/TabHome.jsx` (the entire `OverdueSection` function). This export is not used by any other file — TabPanorama has its own alerts.

- [ ] **Step 2: Remove alerts state and Accordion**

In `TabHome` function (around line 114-115), remove:
```js
const [alertGroupsExpanded, setAlertGroupsExpanded] = useState({});
```

Remove `onViewAlerts` from the function params:
```js
// BEFORE:
const TabHome = React.memo(function TabHome({ analysis: an, items, elapsed, onStart, onViewAlerts, gddData: propGddData, ...

// AFTER:
const TabHome = React.memo(function TabHome({ analysis: an, items, elapsed, onStart, gddData: propGddData, ...
```

Delete the entire `{/* Alertas compactas */}` Accordion block (lines 170-216 approximately).

Also remove these unused variables that were only used by alerts:
```js
const stoppedSquads = SQUADS.filter((sq) => an.bySquad[sq.name]?.phases["🚫 Detenido"] > 0);
const overdueCritical = (an.overdue || []).filter((it) => { ... }).length;
```

- [ ] **Step 3: Add RoadmapTimeline import and render**

At the top of `app/components/TabHome.jsx`, add the import:
```js
import { RoadmapTimeline } from './RoadmapTimeline'
```

At the end of the TabHome return JSX (after the last section, before the closing `</div>`), add:

```jsx
{/* Zona 3 — Roadmap Timeline */}
<RoadmapTimeline items={items} />
```

- [ ] **Step 4: Verify build and all tests pass**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run && npx next build 2>&1 | tail -20`
Expected: All tests PASS and build succeeds

- [ ] **Step 5: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/components/TabHome.jsx
git commit -m "feat: restructure TabHome — remove alerts, add RoadmapTimeline (Zona 3)"
```

---

### Task 6: Add mobile CSS for RoadmapTimeline

**Files:**
- Modify: `app/lib/css.js` (or `app/globals.css` — check which has media queries)

- [ ] **Step 1: Check where mobile styles live**

Run: `cd /Users/1146767f/upax-dashboard-monday && grep -n "mobile-hide\|mobile-only\|640px\|768px" app/lib/css.js app/globals.css`

- [ ] **Step 2: Add mobile-only display rule**

The RoadmapTimeline uses `className="mobile-hide"` for the desktop Gantt and `className="mobile-only"` for the list. Add to the CSS file that already defines `mobile-hide`:

```css
.mobile-only { display: none !important; }
@media (max-width: 640px) {
  .mobile-only { display: block !important; }
}
```

If `mobile-hide` already has a media query hiding at 640px, just add `mobile-only` alongside it.

- [ ] **Step 3: Verify no regressions**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
cd /Users/1146767f/upax-dashboard-monday
git add app/lib/css.js app/globals.css
git commit -m "style: add mobile-only CSS class for RoadmapTimeline responsive"
```

---

### Task 7: Final integration test and cleanup

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run all tests**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run production build**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx next build 2>&1 | tail -30`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run dev server and smoke test**

Run: `cd /Users/1146767f/upax-dashboard-monday && npx next dev &`

Open http://localhost:3000 and verify:
1. Home loads with 3 zones (no alerts section)
2. GdD cards show semana anterior / actual toggle
3. MQLs por canal accordion works
4. Roadmap Timeline shows at bottom of Home (if Sprint items with deadlines exist)
5. Semaforo pills in header still work
6. Panorama > Alertas still shows full alert list
7. Start Weekly -> timer works -> Terminar Weekly -> minuta generates with all 6 sections

- [ ] **Step 4: Kill dev server and commit if any fixes needed**

```bash
kill %1 2>/dev/null
```

If fixes were needed, commit them:
```bash
cd /Users/1146767f/upax-dashboard-monday
git add -A
git commit -m "fix: integration fixes for weekly cockpit"
```
