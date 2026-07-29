import { describe, it, expect } from 'vitest'
import { weeklyStarted, weeklyClosed, isWeeklyEnCurso, migrateWeekly, formatLongDate, weeklyHasContent } from '../utils'

describe('weeklyHasContent', () => {
  // Regresión: abrir la app escribía un weekly:<hoy> vacío en Upstash, que luego
  // salía listado como una minuta "HOY" inexistente. 36 de 64 registros del store
  // eran basura por esto. Este predicado es el guard del autosave.
  it('es false para una weekly recién creada', () => {
    expect(weeklyHasContent({ date: '2026-07-29', focos: {}, presenters: {}, compromisos: [] })).toBe(false)
    expect(weeklyHasContent({})).toBe(false)
    expect(weeklyHasContent(null)).toBe(false)
  })

  it('no cuenta focos vacíos ni compromisos en blanco', () => {
    expect(weeklyHasContent({ focos: { inbound: [{ focos: '  ' }] }, compromisos: [{ que: '' }] })).toBe(false)
  })

  it('es true en cuanto hay algo capturado', () => {
    expect(weeklyHasContent({ focos: { inbound: [{ focos: 'lanzamiento' }] } })).toBe(true)
    expect(weeklyHasContent({ compromisos: [{ que: 'mandar brief' }] })).toBe(true)
    expect(weeklyHasContent({ presenters: { revops: 'César Mejía' } })).toBe(true)
    expect(weeklyHasContent({ minutaText: 'WEEKLY MKT CORP...' })).toBe(true)
  })

  it('ignora presenters de squads disueltos', () => {
    expect(weeklyHasContent({ presenters: { pr: 'Efraín Maciel' } })).toBe(false)
  })

  it('tener contenido no implica estar iniciada', () => {
    const w = { focos: { inbound: [{ focos: 'algo' }] } }
    expect(weeklyHasContent(w)).toBe(true)
    expect(weeklyStarted(w)).toBe(false)
  })
})

describe('weeklyStarted', () => {
  it('es false para una weekly recien creada', () => {
    expect(weeklyStarted({ date: '2026-07-28', focos: {}, presenters: {} })).toBe(false)
  })

  // Regresion: el efecto que hidrata el presentador por defecto escribia
  // presenters.politico sin que el usuario tocara nada. Con la heuristica vieja
  // ("tiene contenido") eso hacia aparecer la barra del timer sola, como si la
  // weekly ya hubiera empezado.
  it('es false si lo unico que hay es el presentador por defecto', () => {
    expect(weeklyStarted({ presenters: { politico: 'Angel Toledano' }, focos: {} })).toBe(false)
  })

  it('es false aunque haya focos capturados, si nadie apreto iniciar', () => {
    expect(weeklyStarted({ focos: { inbound: [{ focos: 'algo', ts: 1 }] } })).toBe(false)
  })

  it('es true con startedAt', () => {
    expect(weeklyStarted({ startedAt: '2026-07-28T15:00:00.000Z' })).toBe(true)
  })

  it('es true si el cronometro llego a correr', () => {
    expect(weeklyStarted({ elapsed: 42 })).toBe(true)
  })
})

describe('weeklyClosed', () => {
  // Regresion: quedaron registros con status "finished" que nunca se iniciaron.
  // Restaurarlos como cerrados mostraba WEEKLY TERMINADA en un dia limpio.
  it('ignora status finished si la weekly nunca se inicio ni tiene minuta', () => {
    expect(weeklyClosed({ status: 'finished', presenters: { politico: 'Angel Toledano' } })).toBe(false)
  })

  it('es true si se inicio y se cerro', () => {
    expect(weeklyClosed({ status: 'finished', startedAt: '2026-07-27T20:00:00.000Z' })).toBe(true)
  })

  it('trata como cerradas las viejas sin status pero con minuta guardada', () => {
    expect(weeklyClosed({ minutaText: 'WEEKLY MKT CORP...' })).toBe(true)
  })

  it('es false para una draft iniciada', () => {
    expect(weeklyClosed({ status: 'draft', startedAt: '2026-07-27T20:00:00.000Z' })).toBe(false)
  })
})

describe('isWeeklyEnCurso', () => {
  it('solo cuenta las iniciadas y no cerradas', () => {
    expect(isWeeklyEnCurso({ startedAt: 'x' })).toBe(true)
    expect(isWeeklyEnCurso({ startedAt: 'x', status: 'finished' })).toBe(false)
    expect(isWeeklyEnCurso({ presenters: { politico: 'Angel Toledano' } })).toBe(false)
    expect(isWeeklyEnCurso(null)).toBe(false)
  })
})

describe('migrateWeekly', () => {
  // Reorg jul-2026: el squad "pr" se disolvio y sus focos van a "inbound".
  it('fusiona focos.pr dentro de inbound ordenando por ts', () => {
    const w = {
      focos: {
        inbound: [{ focos: 'a', ts: 10 }, { focos: 'c', ts: 30 }],
        pr: [{ focos: 'b', ts: 20 }],
      },
    }
    const out = migrateWeekly(w)
    expect(out.focos.pr).toBeUndefined()
    expect(out.focos.inbound.map((f) => f.focos)).toEqual(['a', 'b', 'c'])
  })

  it('funciona si inbound no existia', () => {
    const out = migrateWeekly({ focos: { pr: [{ focos: 'solo', ts: 1 }] } })
    expect(out.focos.inbound).toHaveLength(1)
    expect(out.focos.pr).toBeUndefined()
  })

  it('quita un focos.pr vacio sin tocar inbound', () => {
    const out = migrateWeekly({ focos: { pr: [], inbound: [{ focos: 'x', ts: 1 }] } })
    expect(out.focos.pr).toBeUndefined()
    expect(out.focos.inbound).toHaveLength(1)
  })

  it('es idempotente y tolera null', () => {
    const w = { focos: { inbound: [{ focos: 'x', ts: 1 }] } }
    expect(migrateWeekly(migrateWeekly(w))).toEqual(w)
    expect(migrateWeekly(null)).toBeNull()
  })
})

describe('formatLongDate', () => {
  // Regresion: new Date("2026-07-27") parsea como medianoche UTC y al formatear
  // en un timezone negativo retrocedia un dia ("domingo, 26 de julio").
  it('no retrocede un dia', () => {
    expect(formatLongDate('2026-07-27')).toContain('27')
    expect(formatLongDate('2026-07-27')).toContain('julio')
  })

  it('respeta el cambio de anio', () => {
    const s = formatLongDate('2026-01-01')
    expect(s).toContain('1')
    expect(s).toContain('enero')
    expect(s).toContain('2026')
  })

  it('acepta timestamps completos y valores invalidos', () => {
    expect(formatLongDate('2026-07-27T23:30:00.000Z')).toContain('27')
    expect(formatLongDate('')).toBe('Fecha no disponible')
    expect(formatLongDate('no-es-fecha')).toBe('Fecha no disponible')
  })
})
