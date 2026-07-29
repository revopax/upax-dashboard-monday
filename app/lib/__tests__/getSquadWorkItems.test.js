import { describe, it, expect } from 'vitest'
import { getSquadWorkItems, isOverdueWork } from '../utils'

// Columnas reales de Monday: la tarea y la subtarea NO comparten las suyas.
const task = (id, name, phase, opts = {}) => ({
  id, name,
  column_values: {
    color_mkz0s203: opts.squad ?? 'RevOps & Analytics',
    color_mkz09na: phase,
    timerange_mkzcqv0j: opts.timeline ?? null,
    person: opts.person ?? 'César Mejía',
  },
  subitems: opts.subitems ?? [],
})

const sub = (id, name, phase, opts = {}) => ({
  id, name,
  column_values: {
    color_mkzjvp66: phase,
    timerange_mkzx7r55: opts.timeline ?? null,
    person: opts.person ?? 'Diego Luna',
  },
})

describe('getSquadWorkItems', () => {
  it('devuelve las subtareas primero y luego las tareas', () => {
    const items = [
      task('1', 'Proyecto A', '🚧 Sprint', { subitems: [sub('1a', 'Sub A1', '🚧 Sprint')] }),
      task('2', 'Proyecto B', '👀 Review', { subitems: [sub('2a', 'Sub B1', '⚙️ Modificación')] }),
    ]
    const out = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(out.map((w) => w.kind)).toEqual(['sub', 'sub', 'task', 'task'])
    expect(out.map((w) => w.name)).toEqual(['Sub A1', 'Sub B1', 'Proyecto A', 'Proyecto B'])
  })

  // El caso que antes se perdía: la lista solo miraba tareas, así que el trabajo
  // real en curso de una subtarea era invisible.
  it('incluye una subtarea activa aunque su tarea padre no lo esté', () => {
    const items = [task('1', 'Proyecto A', '⏳Backlog', { subitems: [sub('1a', 'Sub activa', '🚧 Sprint')] })]
    const out = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'sub', name: 'Sub activa', parentName: 'Proyecto A' })
  })

  it('excluye subtareas no activas', () => {
    const items = [task('1', 'Proyecto A', '🚧 Sprint', {
      subitems: [sub('1a', 'Hecha', '✅ Done'), sub('1b', 'Backlog', '⏳Backlog'), sub('1c', 'Viva', '👀 Review')],
    })]
    const out = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(out.filter((w) => w.kind === 'sub').map((w) => w.name)).toEqual(['Viva'])
  })

  it('las subtareas heredan el squad del padre y respetan el filtro', () => {
    const items = [
      task('1', 'Ajeno', '🚧 Sprint', { squad: 'Portafolio y Ecosistema', subitems: [sub('1a', 'Sub ajena', '🚧 Sprint')] }),
      task('2', 'Propio', '🚧 Sprint', { subitems: [sub('2a', 'Sub propia', '🚧 Sprint')] }),
    ]
    const out = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(out.map((w) => w.name)).toEqual(['Sub propia', 'Propio'])
  })

  it('la tarea trae el avance de TODAS sus subtareas, no solo las activas', () => {
    const items = [task('1', 'Proyecto A', '🚧 Sprint', {
      subitems: [sub('1a', 's1', '✅ Done'), sub('1b', 's2', '✅ Done'), sub('1c', 's3', '🚧 Sprint')],
    })]
    const t = getSquadWorkItems(items, 'RevOps & Analytics').find((w) => w.kind === 'task')
    expect(t.subsDone).toBe(2)
    expect(t.subsTotal).toBe(3)
  })

  it('normaliza persona y timeline de cada nivel desde su propia columna', () => {
    const items = [task('1', 'Proyecto A', '🚧 Sprint', {
      timeline: '2026-07-01 - 2026-07-31', person: 'César Mejía',
      subitems: [sub('1a', 'Sub', '🚧 Sprint', { timeline: '2026-07-05 - 2026-07-10', person: 'Diego Luna' })],
    })]
    const [s, t] = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(s).toMatchObject({ person: 'Diego Luna', timeline: '2026-07-05 - 2026-07-10' })
    expect(t).toMatchObject({ person: 'César Mejía', timeline: '2026-07-01 - 2026-07-31' })
  })

  it('ids únicos entre niveles, para no colisionar como key de React', () => {
    const items = [task('7', 'Tarea', '🚧 Sprint', { subitems: [sub('7', 'Sub', '🚧 Sprint')] })]
    const out = getSquadWorkItems(items, 'RevOps & Analytics')
    expect(new Set(out.map((w) => w.id)).size).toBe(2)
  })

  it('tolera items sin subitems y listas vacías', () => {
    expect(getSquadWorkItems([], 'RevOps & Analytics')).toEqual([])
    expect(getSquadWorkItems(null, 'RevOps & Analytics')).toEqual([])
    const items = [{ id: '1', name: 'Suelto', column_values: { color_mkz0s203: 'RevOps & Analytics', color_mkz09na: '🚧 Sprint' } }]
    expect(getSquadWorkItems(items, 'RevOps & Analytics')).toHaveLength(1)
  })
})

describe('isOverdueWork', () => {
  it('funciona sobre subtareas, que isOverdue() no podía leer', () => {
    expect(isOverdueWork({ phase: '🚧 Sprint', timeline: '2020-01-01 - 2020-01-15' })).toBe(true)
    expect(isOverdueWork({ phase: '✅ Done', timeline: '2020-01-01 - 2020-01-15' })).toBe(false)
    expect(isOverdueWork({ phase: '🚫 Detenido', timeline: '2020-01-01 - 2020-01-15' })).toBe(false)
    expect(isOverdueWork({ phase: '🚧 Sprint', timeline: null })).toBe(false)
  })
})
