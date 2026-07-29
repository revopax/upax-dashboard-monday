import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { posicionar, MARGEN } from '../../hooks/useAnchoredPanel'

// Ventana de referencia: 1200x800.
const VISTA = { vw: 1200, vh: 800 }
const rect = (top, left, w = 100, h = 26) => ({ top, left, bottom: top + h, right: left + w })
const panel = (width, height) => ({ width, height })

const dentro = (pos, p) =>
  pos.left >= MARGEN &&
  pos.left + p.width <= VISTA.vw - MARGEN &&
  pos.top >= MARGEN &&
  pos.top + Math.min(p.height, pos.maxHeight) <= VISTA.vh - MARGEN

describe('posicionar — el panel nunca se sale de la ventana', () => {
  it('cabe abajo: se abre abajo, pegado al control', () => {
    const p = panel(236, 290)
    const pos = posicionar({ ancla: rect(100, 300), panel: p, vista: VISTA })
    expect(pos.top).toBe(100 + 26 + 6)
    expect(pos.left).toBe(300)
    expect(dentro(pos, p)).toBe(true)
  })

  it('no cabe abajo pero sí arriba: se voltea', () => {
    const p = panel(236, 290)
    const pos = posicionar({ ancla: rect(700, 300), panel: p, vista: VISTA })
    expect(pos.top).toBeLessThan(700)          // quedó por encima del control
    expect(dentro(pos, p)).toBe(true)
  })

  // Voltear hacia el lado más apretado no arregla nada: con el control arriba de
  // todo, aunque abajo no sobre, abajo sigue siendo el mejor lado.
  it('control pegado al techo: se queda abajo aunque quede justo', () => {
    const p = panel(236, 700)
    const pos = posicionar({ ancla: rect(10, 300), panel: p, vista: VISTA })
    expect(pos.top).toBeGreaterThan(10)
    expect(dentro(pos, p)).toBe(true)
  })

  it('control pegado al borde derecho: el panel se mete para adentro', () => {
    const p = panel(236, 200)
    const pos = posicionar({ ancla: rect(100, 1150), panel: p, vista: VISTA })
    expect(pos.left).toBe(VISTA.vw - 236 - MARGEN)
    expect(dentro(pos, p)).toBe(true)
  })

  it('control pegado al borde izquierdo con alineación end: no se sale por la izquierda', () => {
    const p = panel(260, 200)
    const pos = posicionar({ ancla: rect(100, 4, 60), panel: p, vista: VISTA, align: 'end' })
    expect(pos.left).toBe(MARGEN)
    expect(dentro(pos, p)).toBe(true)
  })

  it('alineación end ancla por la derecha del control', () => {
    const p = panel(200, 120)
    const pos = posicionar({ ancla: rect(100, 800, 100), panel: p, vista: VISTA, align: 'end' })
    expect(pos.left).toBe(900 - 200)
  })

  it('panel más alto que la ventana: se recorta con maxHeight en vez de desbordarse', () => {
    const p = panel(236, 2000)
    const pos = posicionar({ ancla: rect(400, 300), panel: p, vista: VISTA })
    expect(pos.maxHeight).toBeLessThan(2000)
    expect(dentro(pos, p)).toBe(true)
  })

  it('ventana diminuta: sigue dando una posición usable, nunca negativa', () => {
    const p = panel(236, 290)
    const pos = posicionar({ ancla: rect(50, 20), panel: p, vista: { vw: 320, vh: 200 } })
    expect(pos.top).toBeGreaterThanOrEqual(MARGEN)
    expect(pos.left).toBeGreaterThanOrEqual(MARGEN)
    expect(pos.maxHeight).toBeGreaterThanOrEqual(120)
  })

  // Barrido: cualquier posición del control, en cualquier esquina, con paneles de
  // varios tamaños. Ninguna combinación debe dejar el panel fuera.
  it('barrido de esquinas y tamaños: siempre dentro', () => {
    const tamaños = [panel(150, 80), panel(236, 290), panel(300, 600)]
    for (const p of tamaños) {
      for (const top of [0, 5, 200, 400, 770, 795]) {
        for (const left of [0, 5, 600, 1100, 1195]) {
          for (const align of ['start', 'end']) {
            const pos = posicionar({ ancla: rect(top, left), panel: p, vista: VISTA, align })
            expect({ align, top, left, ancho: p.width, alto: p.height, ...pos, ok: dentro(pos, p) })
              .toMatchObject({ ok: true })
          }
        }
      }
    }
  })
})

// Si aparece otro popover que se posicione por su cuenta, vuelve el problema de
// paneles cortados o fuera de pantalla. Los tres pasan por el mismo hook.
describe('todos los paneles flotantes usan el mismo posicionamiento', () => {
  const leer = (f) => fs.readFileSync(path.join(process.cwd(), 'app/components', f), 'utf8')

  for (const f of ['DateField.jsx', 'OwnersHoverCard.jsx', 'ui.jsx']) {
    it(`${f} usa useAnchoredPanel y va por portal`, () => {
      const src = leer(f)
      expect(src).toContain('useAnchoredPanel')
      expect(src).toContain('createPortal')
      expect(src).toContain('document.body')
    })
  }

  it('ninguno se posiciona a mano con innerWidth/innerHeight', () => {
    for (const f of ['DateField.jsx', 'OwnersHoverCard.jsx', 'ui.jsx']) {
      expect(leer(f)).not.toMatch(/window\.inner(Width|Height)/)
    }
  })
})
