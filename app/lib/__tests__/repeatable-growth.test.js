import { describe, it, expect } from 'vitest'

// Replica de la logica de crecimiento de RepeatableItems (components/ui.jsx).
// Se prueba aparte porque el componente es JSX y el proyecto no tiene entorno DOM
// en vitest; lo que importa validar aqui es la regla, que es la parte con condicion.
const isBlank = (it) => !it.text?.trim()

const withTrailingBlank = (arr) => {
  if (!arr.length) return [{ text: '' }]
  return arr[arr.length - 1].text?.trim() ? [...arr, { text: '' }] : arr
}

// Escribir en un campo: mantiene siempre un vacio al final.
const type = (list, i, text) =>
  withTrailingBlank(list.map((it, idx) => (idx === i ? { ...it, text } : it)))

// Hacer clic en un campo: agrega otro solo si ese era el unico vacio.
const click = (list, i) => {
  if (!isBlank(list[i])) return list
  if (list.filter(isBlank).length > 1) return list
  return [...list, { text: '' }]
}

const blanks = (list) => list.filter(isBlank).length

describe('RepeatableItems — crecimiento de la lista', () => {
  it('clic en el unico vacio agrega otro', () => {
    const out = click([{ text: '' }], 0)
    expect(out).toHaveLength(2)
    expect(blanks(out)).toBe(2)
  })

  // El caso que pidio el usuario: con dos vacios, hacer clic no agrega nada.
  it('con dos vacios, clic en cualquiera NO agrega', () => {
    const list = [{ text: '' }, { text: '' }]
    expect(click(list, 0)).toHaveLength(2)
    expect(click(list, 1)).toHaveLength(2)
  })

  it('no crece de forma infinita al hacer clic repetido', () => {
    let list = [{ text: '' }]
    for (let i = 0; i < 20; i++) list = click(list, list.length - 1)
    expect(list).toHaveLength(2) // el primer clic agrego uno; los otros 19 no
  })

  it('tras llenar uno, el clic en el vacio vuelve a agregar', () => {
    let list = [{ text: '' }, { text: '' }]
    list = type(list, 0, 'foco A')          // queda [A, vacio]
    expect(blanks(list)).toBe(1)
    list = click(list, 1)                    // ahora si agrega
    expect(list).toHaveLength(3)
    expect(blanks(list)).toBe(2)
  })

  it('escribir en el ultimo campo deja siempre uno vacio donde seguir', () => {
    let list = [{ text: '' }]
    list = type(list, 0, 'foco A')
    expect(list).toHaveLength(2)
    expect(isBlank(list[1])).toBe(true)
    list = type(list, 1, 'foco B')
    expect(list).toHaveLength(3)
    expect(blanks(list)).toBe(1)
  })

  it('clic en un campo con texto no agrega nada', () => {
    const list = [{ text: 'foco A' }, { text: '' }]
    expect(click(list, 0)).toHaveLength(2)
  })

  it('el owner por item sobrevive a que la lista crezca', () => {
    let list = [{ text: '' }]
    list = type(list, 0, 'foco A')
    list = list.map((it, i) => (i === 0 ? { ...it, quien: 'Fernando Borges' } : it))
    list = click(list, 1)
    expect(list[0]).toEqual({ text: 'foco A', quien: 'Fernando Borges' })
  })
})
