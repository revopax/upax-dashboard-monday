import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DateField, toISO, parseISO, daysInMonth, firstWeekday, fmtCorto } from '../../components/DateField'

const render = (props) => renderToStaticMarkup(React.createElement(DateField, props))

describe('DateField — fechas sin corrimiento de zona horaria', () => {
  // El bug clásico de este repo: new Date("2026-07-27") se parsea como medianoche
  // UTC y al leerlo en CDMX (UTC-6) cae en el día anterior. Por eso el componente
  // arma todo con componentes numéricos y nunca parsea el string como Date.
  it('parseISO no corre el día', () => {
    expect(parseISO('2026-07-27')).toEqual({ y: 2026, m: 6, d: 27 })
    expect(parseISO('2026-01-01')).toEqual({ y: 2026, m: 0, d: 1 })
  })

  it('ida y vuelta ISO → partes → ISO conserva la fecha', () => {
    for (const iso of ['2026-01-01', '2026-07-27', '2026-12-31', '2026-02-29']) {
      const p = parseISO(iso)
      expect(toISO(p.y, p.m, p.d)).toBe(iso)
    }
  })

  it('toISO rellena mes y día a dos dígitos', () => {
    expect(toISO(2026, 0, 5)).toBe('2026-01-05')
    expect(toISO(2026, 11, 31)).toBe('2026-12-31')
  })

  it('parseISO devuelve null con valor vacío o basura', () => {
    for (const v of ['', null, undefined, 'no-es-fecha']) expect(parseISO(v)).toBeNull()
  })
})

describe('DateField — rejilla del mes', () => {
  it('cuenta bien los días, incluido febrero bisiesto', () => {
    expect(daysInMonth(2026, 0)).toBe(31)   // enero
    expect(daysInMonth(2026, 1)).toBe(28)   // febrero 2026
    expect(daysInMonth(2024, 1)).toBe(29)   // febrero bisiesto
    expect(daysInMonth(2026, 3)).toBe(30)   // abril
    expect(daysInMonth(2026, 11)).toBe(31)  // diciembre
  })

  // La semana arranca en lunes, no en domingo: es la semana de trabajo del equipo.
  it('el primer día cae en la columna correcta con lunes primero', () => {
    // 1-jul-2026 es miércoles → 2 huecos antes (L, M)
    expect(firstWeekday(2026, 6)).toBe(2)
    // 1-feb-2026 es domingo → última columna, 6 huecos
    expect(firstWeekday(2026, 1)).toBe(6)
    // 1-jun-2026 es lunes → sin huecos
    expect(firstWeekday(2026, 5)).toBe(0)
  })
})

describe('DateField — etiqueta del control', () => {
  it('muestra la fecha en corto cuando hay valor', () => {
    expect(fmtCorto('2026-07-27')).toBe('27 jul')
    expect(fmtCorto('2026-01-03')).toBe('3 ene')
    expect(fmtCorto('2026-12-25')).toBe('25 dic')
  })

  it('sin valor no inventa nada', () => {
    expect(fmtCorto('')).toBeNull()
  })

  it('renderiza el placeholder cuando está vacío', () => {
    const html = render({ value: '', onChange: () => {} })
    expect(html).toContain('dd/mm/aaaa')
  })

  it('renderiza la fecha elegida y la expone completa en el aria-label', () => {
    const html = render({ value: '2026-07-27', onChange: () => {}, label: 'Fecha del compromiso' })
    expect(html).toContain('27 jul')
    expect(html).toContain('Fecha del compromiso: 2026-07-27')
  })

  // El calendario abre con clic en cualquier parte del control, no solo en un
  // ícono: es un botón entero, no un input con un indicador aparte.
  it('el control es un botón con panel, cerrado de entrada', () => {
    const html = render({ value: '', onChange: () => {} })
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('<button')
  })
})

// Los atajos globales de la weekly (useWeeklyTimer/Dashboard) escuchan en window
// y solo se saltan INPUT/TEXTAREA/SELECT. Tanto DateField como PersonSelect se
// disparan desde un <button>, así que si no cortan la propagación, navegar por
// el calendario o por la lista avanza el bloque de la agenda con el cronómetro
// corriendo. Este test vigila las dos puntas del contrato.
describe('las teclas de los paneles no se filtran a los atajos de la agenda', () => {
  const fs = require('fs')
  const path = require('path')
  const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

  it('los atajos globales siguen sin cubrir a los <button>', () => {
    for (const f of ['app/hooks/useWeeklyTimer.js', 'app/Dashboard.jsx']) {
      const src = leer(f)
      expect(src).toContain('e.target.tagName === "INPUT"')
      expect(src).not.toContain('tagName === "BUTTON"')
    }
  })

  it('DateField corta la propagación de las teclas que consume', () => {
    const src = leer('app/components/DateField.jsx')
    expect(src).toContain('if (open && TECLAS.includes(e.key)) e.stopPropagation()')
    expect(src).toMatch(/TECLAS = \[[^\]]*"ArrowRight"/)
  })

  it('PersonSelect también', () => {
    const src = leer('app/components/ui.jsx')
    const handler = src.slice(src.indexOf('const handleKeyDown'), src.indexOf('let optIdx'))
    for (const tecla of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) {
      expect(handler).toContain(tecla)
    }
    // Una por rama: ArrowDown, ArrowUp, Enter y Escape.
    expect(handler.match(/stopPropagation/g)).toHaveLength(4)
  })
})
