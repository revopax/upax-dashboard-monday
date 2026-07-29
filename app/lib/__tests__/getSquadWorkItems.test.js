import { describe, it, expect } from 'vitest'
import { getSquadWorkItems, isOverdueWork } from '../utils'

// Columnas reales de Monday: la tarea y la subtarea NO comparten las suyas.
//
// `person` usa `in` y no `??` a propósito: con ?? un `person: null` explícito
// caería al default y el test de "sin responsable" pasaría por la razón
// equivocada, que es justo lo que pasó al escribirlos.
const opt = (opts, key, fallback) => (key in opts ? opts[key] : fallback)

const task = (id, name, phase, opts = {}) => ({
  id, name,
  column_values: {
    color_mkz0s203: opt(opts, 'squad', 'RevOps & Analytics'),
    color_mkz09na: phase,
    timerange_mkzcqv0j: opt(opts, 'timeline', null),
    person: opt(opts, 'person', 'César Mejía'),
  },
  subitems: opts.subitems ?? [],
})

const sub = (id, name, phase, opts = {}) => ({
  id, name,
  column_values: {
    color_mkzjvp66: phase,
    timerange_mkzx7r55: opt(opts, 'timeline', null),
    person: opt(opts, 'person', 'Diego Luna'),
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

  // El criterio es el RESPONSABLE, no la etiqueta de squad del board: renombrar la
  // etiqueta en Monday rompe el histórico, así que no se puede depender de ella.
  it('manda el owner sobre la etiqueta de squad del item', () => {
    const items = [
      // Etiquetado Portafolio pero lo lleva César, que es de RevOps.
      task('1', 'Mal etiquetado', '🚧 Sprint', { squad: 'Portafolio y Ecosistema', person: 'César Mejía' }),
    ]
    expect(getSquadWorkItems(items, 'RevOps & Analytics').map((w) => w.name)).toEqual(['Mal etiquetado'])
    expect(getSquadWorkItems(items, 'Portafolio y Ecosistema')).toEqual([])
  })

  // El caso que motivó el cambio: un proyecto que toca a varios squads reparte
  // cada subtarea al equipo de quien la lleva.
  it('reparte las subtareas de un proyecto multi-squad por responsable', () => {
    const items = [task('1', 'Proyecto cross', '⏳Backlog', {
      person: 'César Mejía',
      subitems: [
        sub('1a', 'Parte RevOps', '🚧 Sprint', { person: 'Diego Luna' }),
        sub('1b', 'Parte Portafolio', '🚧 Sprint', { person: 'Tairi Medina' }),
        sub('1c', 'Parte Web', '🚧 Sprint', { person: 'Diana Cruz' }),
      ],
    })]
    expect(getSquadWorkItems(items, 'RevOps & Analytics').map((w) => w.name)).toEqual(['Parte RevOps'])
    expect(getSquadWorkItems(items, 'Portafolio y Ecosistema').map((w) => w.name)).toEqual(['Parte Portafolio'])
    expect(getSquadWorkItems(items, 'Web y contenidos').map((w) => w.name)).toEqual(['Parte Web'])
  })

  it('un item con varios responsables aparece en el squad de cada uno', () => {
    const items = [task('1', 'Compartido', '🚧 Sprint', { person: 'César Mejía, Tairi Medina' })]
    expect(getSquadWorkItems(items, 'RevOps & Analytics')).toHaveLength(1)
    expect(getSquadWorkItems(items, 'Portafolio y Ecosistema')).toHaveLength(1)
  })

  // Caso real: una subtarea de 'Iris Múgica, César Mejía Medina' salía en RevOps
  // mostrando "Iris Múgica," — el primer nombre del texto, que es de otro squad.
  // Parecía que el filtro estaba mal cuando en realidad era la etiqueta mostrada.
  it('expone el responsable DE ESTE squad, no el primero del texto', () => {
    const items = [task('1', 'Compartido', '🚧 Sprint', { person: 'Iris Múgica, César Mejía Medina' })]

    const revops = getSquadWorkItems(items, 'RevOps & Analytics')[0]
    expect(revops.owners).toEqual(['César Mejía'])
    expect(revops.allOwners).toEqual(['César Mejía', 'Iris Múgica'])

    const web = getSquadWorkItems(items, 'Web y contenidos')[0]
    expect(web.owners).toEqual(['Iris Múgica'])
    expect(web.allOwners).toEqual(['Iris Múgica', 'César Mejía'])
  })

  it('con un solo responsable no reporta otros', () => {
    const items = [task('1', 'Propio', '🚧 Sprint', { person: 'César Mejía' })]
    const w = getSquadWorkItems(items, 'RevOps & Analytics')[0]
    expect(w.owners).toEqual(['César Mejía'])
    expect(w.allOwners).toEqual(['César Mejía'])
  })

  it('los nombres desconocidos no cuentan como otros responsables', () => {
    const items = [task('1', 'Mixto', '🚧 Sprint', { person: 'César Mejía, Alguien Externo' })]
    const w = getSquadWorkItems(items, 'RevOps & Analytics')[0]
    expect(w.owners).toEqual(['César Mejía'])
    expect(w.allOwners).toEqual(['César Mejía'])
  })

  it('tolera variantes de escritura del nombre en Monday', () => {
    const items = [task('1', 'Con acento raro', '🚧 Sprint', { person: 'Cesar Mejia' })]
    expect(getSquadWorkItems(items, 'RevOps & Analytics')).toHaveLength(1)
  })

  // Sin owner reconocible no se puede deducir el squad, y hacer desaparecer el
  // trabajo sería peor que usar la etiqueta.
  it('sin responsable reconocible cae a la etiqueta del item', () => {
    const sinDuenio = [task('1', 'Huérfano', '🚧 Sprint', { person: null })]
    expect(getSquadWorkItems(sinDuenio, 'RevOps & Analytics')).toHaveLength(1)

    const externo = [task('2', 'De un externo', '🚧 Sprint', { person: 'Alguien Externo', squad: 'Outbound y Pipeline' })]
    expect(getSquadWorkItems(externo, 'Outbound y Pipeline')).toHaveLength(1)
    expect(getSquadWorkItems(externo, 'RevOps & Analytics')).toEqual([])
  })

  it('una subtarea sin responsable cae a la etiqueta de su tarea padre', () => {
    const items = [task('1', 'Padre', '⏳Backlog', {
      squad: 'Outbound y Pipeline',
      subitems: [sub('1a', 'Sub sin dueño', '🚧 Sprint', { person: null })],
    })]
    expect(getSquadWorkItems(items, 'Outbound y Pipeline').map((w) => w.name)).toEqual(['Sub sin dueño'])
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
