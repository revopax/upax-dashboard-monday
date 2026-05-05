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
