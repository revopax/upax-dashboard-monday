import { describe, it, expect } from 'vitest'
import { squadOfTask, squadOfSubtask, normalizePersonName } from '../utils'
import { PERSONAS } from '../constants'

const task = (person, squadLabel = 'Portafolio y ecosistema') => ({
  column_values: { person, color_mkz0s203: squadLabel },
})
const sub = (person) => ({ column_values: { person } })

describe('normalizePersonName — variantes de escritura', () => {
  // Bug real: Monday trae "Adrian Gonzalez" y PERSONAS dice "Adrián González".
  // La comparación exigía que todas las partes estuvieran contenidas, y "adrian"
  // nunca contiene "adrián". Eran 10 items sin squad.
  it('cruza nombres sin acentos', () => {
    expect(normalizePersonName('Adrian Gonzalez')).toBe('Adrián González')
    expect(normalizePersonName('Cesar Mejia Medina')).toBe('César Mejía')
    expect(normalizePersonName('Efrain Maciel')).toBe('Efraín Maciel')
  })

  // La cuenta de Monday de Efraín se llama "Alejandro Maciel".
  it('resuelve alias de cuenta', () => {
    expect(normalizePersonName('Alejandro Maciel')).toBe('Efraín Maciel')
  })

  it('deja pasar lo desconocido sin inventar', () => {
    expect(normalizePersonName('Persona Inexistente')).toBe('Persona Inexistente')
  })
})

describe('squadOfTask — atribución para conteos', () => {
  it('usa el squad del responsable, no la etiqueta', () => {
    expect(squadOfTask(task('César Mejía'))).toBe('RevOps & Analytics')
  })

  // En conteos NO puede contar doble: las barras de Panorama son una partición y
  // deben sumar el total del board.
  it('con responsables de squads distintos cae a la etiqueta', () => {
    expect(squadOfTask(task('Iris Múgica, César Mejía', 'Web & Contenidos'))).toBe('Web y contenidos')
  })

  it('con varios responsables del MISMO squad usa ese squad', () => {
    expect(squadOfTask(task('César Mejía, Diego Luna', 'Mkt Político'))).toBe('RevOps & Analytics')
  })

  // Franco es squad "CMO", que es un rol y no un squad de la weekly. Sin filtrar,
  // sus items se atribuían a "CMO" y desaparecían de Panorama, que itera SQUADS.
  it('ignora squads que no son de la weekly (CMO/PMO) y cae a la etiqueta', () => {
    expect(squadOfTask(task('Franco Cruzat', 'Web & Contenidos'))).toBe('Web y contenidos')
  })

  it('sin responsable reconocible cae a la etiqueta, ya normalizada', () => {
    expect(squadOfTask(task(null, 'RevOps y Analytics'))).toBe('RevOps & Analytics')
    expect(squadOfTask(task('Externo X', 'Web & Contenidos'))).toBe('Web y contenidos')
    expect(squadOfTask(task(null, 'Mkt Político'))).toBe('Político-Electoral')
  })
})

describe('squadOfSubtask — hereda de la tarea cuando es ambiguo', () => {
  const padre = task('César Mejía', 'Portafolio y ecosistema')

  it('un solo squad entre sus responsables manda', () => {
    expect(squadOfSubtask(sub('Diana Cruz'), padre)).toBe('Web y contenidos')
  })

  // La regla que pidió el usuario: subtarea multi-squad hereda de la tarea padre.
  it('multi-squad hereda el squad de la tarea padre', () => {
    expect(squadOfSubtask(sub('Iris Múgica, Diana Cruz'), padre)).toBe('Web y contenidos') // ambas de Web
    expect(squadOfSubtask(sub('Iris Múgica, César Mejía'), padre)).toBe('RevOps & Analytics') // ambiguo → padre
  })

  it('sin responsable hereda de la tarea padre', () => {
    expect(squadOfSubtask(sub(null), padre)).toBe('RevOps & Analytics')
  })

  it('si el padre tampoco resuelve, termina en la etiqueta del padre', () => {
    const huerfano = task('Externo X', 'Outbound y Pipeline')
    expect(squadOfSubtask(sub('Otro Externo'), huerfano)).toBe('Outbound y Pipeline')
  })
})

describe('personas inactivas', () => {
  // Salieron del área o son externos: atribuyen su trabajo pero no deben ofrecerse
  // en los selectores (PersonSelect filtra por !inactive).
  it('atribuyen squad aunque estén inactivas', () => {
    expect(squadOfTask(task('Jean Pierre Barroilhet Salibe'))).toBe('Performance y Conversión')
    expect(squadOfTask(task('Andrea Jurado Escudero'))).toBe('Performance y Conversión')
    expect(squadOfTask(task('Aliosha Albor'))).toBe('Outbound y Pipeline')
    expect(squadOfTask(task('Cyndi Lilibeth Pérez Ramírez'))).toBe('Portafolio y Ecosistema')
  })

  it('están marcadas como inactive en PERSONAS', () => {
    const inactivas = PERSONAS.filter((p) => p.inactive).map((p) => p.name)
    expect(inactivas).toContain('Jean Pierre Barroilhet')
    expect(inactivas).toContain('Andrea Jurado')
    expect(inactivas).toContain('Aliosha Albor')
    expect(inactivas).toContain('Cyndi Lilibeth Pérez Ramírez')
  })

  it('ningún miembro activo quedó marcado inactive por error', () => {
    const activos = PERSONAS.filter((p) => !p.inactive).map((p) => p.name)
    expect(activos).toContain('Fernando Borges')
    expect(activos).toContain('Iris Múgica')
    expect(activos).toContain('Efraín Maciel')
  })
})
