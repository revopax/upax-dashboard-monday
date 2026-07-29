'use client'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { TODAY_STR } from '../lib/constants'
import { C, R } from '../lib/tokens'
import { useAnchoredPanel, panelStyle } from '../hooks/useAnchoredPanel'

// DateField — campo de fecha con calendario propio.
//
// Reemplaza a <input type="date">. El calendario nativo de Chrome no se puede
// estilizar (lo dibuja el navegador fuera de la página, ninguna regla CSS lo
// alcanza) y además solo abría desde su ícono: pinchar sobre el "dd/mm/aaaa"
// ponía el cursor a escribir en vez de abrirlo.
//
// El valor sigue siendo "YYYY-MM-DD" y el onChange sigue emitiendo
// { target: { value } }, así que los lugares que lo usan no cambian de contrato.
//
// OJO con las fechas: aquí NUNCA se hace new Date("2026-07-27"). Eso se parsea
// como medianoche UTC y en CDMX (UTC-6) retrocede al día anterior — es el mismo
// bug que ya estaba documentado en utils.js. Todo se arma con componentes
// numéricos locales, que sí son hora local.

// Helpers exportados para poder testear el calendario sin renderizarlo: el
// cruce de mes/año y el arranque en lunes son justo donde se cuelan los errores.
const pad = (n) => String(n).padStart(2, "0")
export const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`   // m es 0-based
export const parseISO = (s) => {
  const [y, m, d] = String(s || "").split("-").map(Number)
  return y && m && d ? { y, m: m - 1, d } : null
}
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()
// Lunes primero: getDay() devuelve 0=domingo, y la semana laboral del equipo
// arranca en lunes.
export const firstWeekday = (y, m) => (new Date(y, m, 1).getDay() + 6) % 7

export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const MESES_3 = MESES.map((m) => m.slice(0, 3).charAt(0).toUpperCase() + m.slice(1, 3))
const DIAS = ["L", "M", "M", "J", "V", "S", "D"]

// Siempre día, mes y año: "02 Jul 2026". Sin el año, una fecha de otro año se
// leía igual que una de este.
export const fmtFecha = (iso) => {
  const p = parseISO(iso)
  if (!p) return null
  return `${pad(p.d)} ${MESES_3[p.m]} ${p.y}`
}

// Comparar strings "YYYY-MM-DD" es comparar fechas: el orden lexicográfico y el
// cronológico coinciden. Hoy NO es pasado, se puede elegir.
export const esPasado = (iso) => iso < TODAY_STR

export function DateField({ value, onChange, label = "Fecha", style = {}, disabled = false }) {
  const [open, setOpen] = useState(false)
  const hoy = useMemo(() => parseISO(TODAY_STR), [])
  const sel = parseISO(value)
  // Mes que se está viendo; arranca en el del valor, o en el actual.
  const [view, setView] = useState(() => ({ y: (sel || hoy).y, m: (sel || hoy).m }))
  // Día con foco de teclado. -1 = ninguno, para no pintar un resaltado que el
  // usuario no pidió al abrir con el mouse.
  const [cursor, setCursor] = useState(-1)
  const ref = useRef(null)
  const panelRef = useRef(null)
  const pos = useAnchoredPanel({ open, anchorRef: ref, panelRef })

  const abrir = useCallback(() => {
    if (disabled) return
    const p = parseISO(value) || hoy
    setView({ y: p.y, m: p.m })
    setCursor(-1)
    setOpen(true)
  }, [disabled, value, hoy])

  const cerrar = useCallback(() => { setOpen(false); setCursor(-1) }, [])

  const elegir = useCallback((d) => {
    const iso = toISO(view.y, view.m, d)
    if (esPasado(iso)) return
    onChange({ target: { value: iso } })
    cerrar()
    ref.current?.focus()
  }, [onChange, view, cerrar])

  // Cierra al hacer clic fuera, con Escape, o si la página se mueve debajo: el
  // panel está anclado a coordenadas de ventana y quedaría flotando suelto.
  useEffect(() => {
    if (!open) return
    const fueraClick = (e) => {
      if (ref.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      cerrar()
    }
    document.addEventListener("mousedown", fueraClick)
    window.addEventListener("scroll", cerrar, true)
    window.addEventListener("resize", cerrar)
    return () => {
      document.removeEventListener("mousedown", fueraClick)
      window.removeEventListener("scroll", cerrar, true)
      window.removeEventListener("resize", cerrar)
    }
  }, [open, cerrar])

  const total = daysInMonth(view.y, view.m)
  // Hacia atrás solo hasta el mes actual: más atrás está todo deshabilitado, así
  // que navegar ahí no lleva a ningún lado.
  const puedeAtras = view.y * 12 + view.m > hoy.y * 12 + hoy.m

  const moverMes = (delta) => {
    if (delta < 0 && !puedeAtras) return
    setView((v) => {
      const m = v.m + delta
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
    setCursor(-1)
  }

  // Las teclas que este control consume NO deben llegar a los atajos globales de
  // la weekly: ese handler solo se salta INPUT/TEXTAREA/SELECT, y esto es un
  // <button>, así que sin el stopPropagation las flechas del calendario también
  // avanzarían el bloque de la agenda con el cronómetro corriendo.
  const TECLAS = ["Escape", "Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]

  const onKeyDown = (e) => {
    if (open && TECLAS.includes(e.key)) e.stopPropagation()
    if (e.key === "Escape") { if (open) { cerrar(); ref.current?.focus() } return }
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); abrir() }
      return
    }

    // Día de partida: el que tenga el foco, si no el elegido cuando está a la
    // vista, si no hoy en el mes actual, si no el 1.
    const base = cursor > 0 ? cursor
      : (sel && sel.y === view.y && sel.m === view.m) ? sel.d
      : (hoy.y === view.y && hoy.m === view.m) ? hoy.d
      : 1

    const mover = (n) => {
      e.preventDefault()
      // Aritmética con Date sobre componentes numéricos: resuelve sola el cruce
      // de mes y de año, incluidos los bisiestos.
      const d0 = new Date(view.y, view.m, base)
      d0.setDate(d0.getDate() + n)
      const y = d0.getFullYear(), m = d0.getMonth(), d = d0.getDate()
      if (esPasado(toISO(y, m, d))) return   // no se entra al pasado
      if (y !== view.y || m !== view.m) setView({ y, m })
      setCursor(d)
    }

    if (e.key === "ArrowRight") mover(1)
    else if (e.key === "ArrowLeft") mover(-1)
    else if (e.key === "ArrowDown") mover(7)
    else if (e.key === "ArrowUp") mover(-7)
    else if (e.key === "Enter") { e.preventDefault(); elegir(base) }
  }

  const celdas = []
  for (let i = 0; i < firstWeekday(view.y, view.m); i++) celdas.push(null)
  for (let d = 1; d <= total; d++) celdas.push(d)

  const texto = fmtFecha(value)

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={value ? `${label}: ${value}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? cerrar() : abrir())}
        onKeyDown={onKeyDown}
        className="ctl-btn"
        // Alto, borde, radio y tipografía salen de .ctl-btn: aquí solo va lo que
        // es propio de este control.
        style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", ...style }}
      >
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: .6 }}>
          <rect x="2" y="3" width="10" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
          <path d="M2 6h10M4.8 1.8v2M9.2 1.8v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span style={{ color: texto ? C.tx : C.tx3 }}>{texto || "dd/mm/aaaa"}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`${label}: elegir fecha`}
          onKeyDown={onKeyDown}
          style={panelStyle(pos, {
            zIndex: 300, width: 236,
            maxHeight: pos?.maxHeight, overflowY: "auto",
            background: C.bg2, border: `1px solid ${C.border}`, borderRadius: R.default,
            boxShadow: C.shadowLg, padding: 10, animation: "fadeIn .12s ease both",
          })}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" className="cal-nav" onClick={() => moverMes(-1)} disabled={!puedeAtras} aria-label="Mes anterior">‹</button>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.tx, textTransform: "capitalize" }}>
              {MESES[view.m]} {view.y}
            </span>
            <button type="button" className="cal-nav" onClick={() => moverMes(1)} aria-label="Mes siguiente">›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
            {DIAS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: C.tx3, letterSpacing: .5, padding: "2px 0" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {celdas.map((d, i) => {
              if (d === null) return <span key={`v${i}`} />
              const iso = toISO(view.y, view.m, d)
              const pasado = esPasado(iso)
              const esHoy = hoy.y === view.y && hoy.m === view.m && hoy.d === d
              const esSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d
              const esCursor = cursor === d
              return (
                <button
                  key={d}
                  type="button"
                  className="cal-day"
                  // Deshabilitado y no solo atenuado: así tampoco se llega por
                  // teclado ni cuenta como objetivo de clic.
                  disabled={pasado}
                  aria-label={`${d} de ${MESES[view.m]} de ${view.y}`}
                  aria-current={esHoy ? "date" : undefined}
                  aria-pressed={esSel}
                  onClick={() => elegir(d)}
                  style={{
                    background: esSel ? C.blue : esCursor && !pasado ? C.bg3 : "transparent",
                    color: esSel ? "#fff" : pasado ? C.bg4 : esHoy ? C.blue : C.tx,
                    fontWeight: esSel || esHoy ? 700 : 400,
                    boxShadow: esHoy && !esSel ? `inset 0 0 0 1px ${C.blue}` : "none",
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.bg3}` }}>
            <button type="button" className="cal-action" onClick={() => { onChange({ target: { value: TODAY_STR } }); cerrar() }}>Hoy</button>
            {value && <button type="button" className="cal-action" onClick={() => { onChange({ target: { value: "" } }); cerrar() }} style={{ color: C.tx3 }}>Limpiar</button>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
