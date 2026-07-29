import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OwnersHoverCard } from '../../components/OwnersHoverCard'

// Solo el estado cerrado: el card abierto vive en un portal a document.body, que en
// render de servidor no se emite. Lo que se verifica aquí es la etiqueta de la fila,
// que es la que decide si el card llega a poder abrirse.
const render = (props) => renderToStaticMarkup(React.createElement(OwnersHoverCard, props))

describe('OwnersHoverCard', () => {
  it('con varios responsables muestra "Varios owners" y queda enfocable', () => {
    const html = render({ owners: ['Iris Múgica', 'César Mejía'], mine: ['César Mejía'], squadName: 'RevOps & Analytics' })
    expect(html).toContain('Varios owners')
    expect(html).toContain('tabindex="0"')
  })

  it('con un solo responsable muestra su nombre y no abre card', () => {
    const html = render({ owners: ['César Mejía'], mine: ['César Mejía'], squadName: 'RevOps & Analytics' })
    expect(html).toContain('César Mejía')
    expect(html).not.toContain('Varios owners')
    expect(html).not.toContain('tabindex')
  })

  // Prefiere al responsable de ESTE squad: mostrar el primero del texto crudo de
  // Monday hacía parecer que la lista estaba mal filtrada.
  it('con un owner propio y otro ajeno prioriza el propio en la etiqueta', () => {
    const html = render({ owners: ['Iris Múgica', 'César Mejía'], mine: ['César Mejía'], squadName: 'RevOps & Analytics' })
    expect(html).toContain('Varios owners')
  })

  it('sin responsables cae al texto crudo de Monday', () => {
    const html = render({ owners: [], mine: [], person: 'Alguien Externo', squadName: 'RevOps & Analytics' })
    expect(html).toContain('Alguien Externo')
  })

  // El title vacío evita que el navegador suba al div de la fila y saque su tooltip
  // nativo ("Click para agregar a focos") justo encima del card.
  it('lleva title vacío para no heredar el tooltip nativo de la fila', () => {
    expect(render({ owners: ['A', 'B'] })).toContain('title=""')
  })

  it('durante un sync sin datos aún, la etiqueta sigue siendo enfocable para abrir el estado de carga', () => {
    const html = render({ owners: [], mine: [], person: null, loading: true })
    expect(html).toContain('tabindex="0"')
  })
})
