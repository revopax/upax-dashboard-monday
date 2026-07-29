import { describe, it, expect } from 'vitest'
import { PHASE_SEGS, totalSegs, doneOf } from '../../components/TabPanorama'
import { DONE_PHASES, isDonePhase, isOverdue, isOverdueWork, getSquadWorkItems } from '../utils'

// Recuento de fases tal como lo arma Dashboard.jsx en analysis.bySquad[x].phases /
// .subPhases: un objeto { fase: cantidad }.
const phases = (o) => o

describe('contadores de Panorama', () => {
  // El bug de origen: el encabezado sumaba solo Sprint/Review/Mod mientras la barra
  // incluía además Detenido y Backlog, así que decía "19 tareas" arriba de una barra
  // rotulada 18 · 15 · 21.
  it('el total del encabezado es exactamente lo que suma la barra', () => {
    const p = phases({
      '🚧 Sprint': 18, '👀 Review': 1, '⚙️ Modificación': 0,
      '🚫 Detenido': 15, '⏳Backlog': 21, '✅ Done': 176,
    })
    expect(totalSegs(PHASE_SEGS(p))).toBe(55)
  })

  it('lo terminado queda fuera de la barra y se reporta aparte', () => {
    const p = phases({ '🚧 Sprint': 39, '✅ Done': 534, '✅ Materiales listos': 20 })
    expect(totalSegs(PHASE_SEGS(p))).toBe(39)
    expect(doneOf(p)).toBe(554)
  })

  // Político-Electoral: 6 subtareas, las 6 en Done. La fila se condicionaba a
  // subTotal > 0, que las contaba, pero Bar devuelve null sin segmentos: quedaba la
  // etiqueta SUBTAREAS sin barra al lado.
  it('un squad con todo terminado no deja filas con etiqueta y sin barra', () => {
    expect(totalSegs(PHASE_SEGS({ '✅ Done': 6 }))).toBe(0)
  })

  it('no pierde ninguna fase entre la barra y lo terminado', () => {
    const p = phases({
      '🚧 Sprint': 142, '👀 Review': 18, '⚙️ Modificación': 10,
      '🚫 Detenido': 79, '⏳Backlog': 303,
      '✅ Done': 1382, '✅ Materiales listos': 33,
    })
    const total = Object.values(p).reduce((s, v) => s + v, 0)
    expect(totalSegs(PHASE_SEGS(p)) + doneOf(p)).toBe(total)
  })
})

describe('"✅ Materiales listos" cuenta como terminada', () => {
  it('isDonePhase la reconoce igual que Done', () => {
    expect(DONE_PHASES).toContain('✅ Materiales listos')
    expect(isDonePhase('✅ Materiales listos')).toBe(true)
    expect(isDonePhase('🚧 Sprint')).toBe(false)
  })

  // Antes la única excepción era el literal "✅ Done", así que una subtarea ya
  // cerrada con timeline pasado salía marcada como vencida.
  it('una subtarea cerrada con timeline pasado no está vencida', () => {
    expect(isOverdueWork({ phase: '✅ Materiales listos', timeline: '2026-02-25 - 2026-02-26' })).toBe(false)
    expect(isOverdueWork({ phase: '🚧 Sprint', timeline: '2026-02-25 - 2026-02-26' })).toBe(true)
  })

  it('tampoco a nivel de tarea', () => {
    const it_ = { column_values: { color_mkz09na: '✅ Materiales listos', timerange_mkzcqv0j: '2026-02-25 - 2026-02-26' } }
    expect(isOverdue(it_)).toBe(false)
  })

  it('suma en subsDone del progreso de la tarea', () => {
    const items = [{
      id: '1', name: 'Proyecto A',
      column_values: { color_mkz0s203: 'RevOps & Analytics', color_mkz09na: '🚧 Sprint', person: 'César Mejía' },
      subitems: [
        { id: 'a', name: 'S1', column_values: { color_mkzjvp66: '✅ Done', person: 'César Mejía' } },
        { id: 'b', name: 'S2', column_values: { color_mkzjvp66: '✅ Materiales listos', person: 'César Mejía' } },
        { id: 'c', name: 'S3', column_values: { color_mkzjvp66: '🚧 Sprint', person: 'César Mejía' } },
      ],
    }]
    const task = getSquadWorkItems(items, 'RevOps & Analytics').find((w) => w.kind === 'task')
    expect(task.subsTotal).toBe(3)
    expect(task.subsDone).toBe(2)
  })
})
