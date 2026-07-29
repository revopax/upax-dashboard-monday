'use client'
import { useState, useLayoutEffect, useCallback } from 'react'

// useAnchoredPanel — coloca un panel flotante pegado a su control y SIEMPRE
// dentro de la ventana.
//
// Lo usan los tres paneles que se abren sobre la página (calendario de DateField,
// lista de PersonSelect y card de responsables). Antes cada uno estimaba su
// tamaño con números fijos, y cuando la estimación se quedaba corta —un card con
// muchos owners, un control cerca del borde— el panel salía medio fuera de
// pantalla o pegado al filo.
//
// Aquí el panel se MIDE de verdad en vez de estimarse. Por eso hay dos pasadas:
// el panel se monta invisible (`visibility:hidden`, que igual ocupa espacio y por
// lo tanto se puede medir), se lee su tamaño real y recién entonces se posiciona.
// El cálculo va en useLayoutEffect, o sea antes de que el navegador pinte, así
// que no se alcanza a ver en el lugar equivocado.
//
// Devuelve null hasta tener la medida; el panel debe quedar invisible mientras.

export const MARGEN = 8  // aire mínimo contra el borde de la ventana

// posicionar — la matemática, aparte del DOM para poder testearla.
//   ancla  = rect del control  { top, bottom, left, right }
//   panel  = tamaño medido     { width, height }
//   vista  = ventana           { vw, vh }
export function posicionar({ ancla, panel, vista, align = "start", gap = 6 }) {
  const { vw, vh } = vista

  // Abajo por defecto. Se voltea arriba solo si abajo no cabe Y arriba tiene más
  // sitio: voltear hacia el lado más apretado no arregla nada.
  const abajo = vh - ancla.bottom - gap - MARGEN
  const arriba = ancla.top - gap - MARGEN
  const vaAbajo = panel.height <= abajo || abajo >= arriba
  // Si no cabe entero por ningún lado, el panel se recorta y scrollea en vez de
  // desbordarse. El piso de 120px evita dejarlo inservible.
  const maxHeight = Math.max(120, vaAbajo ? abajo : arriba)
  const alto = Math.min(panel.height, maxHeight)

  let top = vaAbajo ? ancla.bottom + gap : ancla.top - gap - alto
  top = Math.min(Math.max(MARGEN, top), Math.max(MARGEN, vh - alto - MARGEN))

  // `start` alinea por la izquierda del control, `end` por la derecha (para
  // controles pegados al margen derecho, como la columna de responsables).
  let left = align === "end" ? ancla.right - panel.width : ancla.left
  left = Math.min(Math.max(MARGEN, left), Math.max(MARGEN, vw - panel.width - MARGEN))

  return { top, left, maxHeight }
}

// matchAnchorWidth — el panel es al menos tan ancho como su control (para que un
// desplegable no quede más angosto que el campo del que cuelga). Se aplica ANTES
// de medir, tocando el DOM directo: si se hiciera con estado, el ancho llegaría
// en un render posterior al del cálculo y la posición quedaría hecha con el ancho
// viejo, que es justo lo que puede empujar el panel fuera de la ventana.
export function useAnchoredPanel({ open, anchorRef, panelRef, align = "start", gap = 6, matchAnchorWidth = false }) {
  const [pos, setPos] = useState(null)

  const calcular = useCallback(() => {
    const ancla = anchorRef.current
    const panel = panelRef.current
    if (!ancla || !panel) return
    const r = ancla.getBoundingClientRect()
    if (matchAnchorWidth) panel.style.minWidth = `${r.width}px`
    const { width, height } = panel.getBoundingClientRect()
    setPos(posicionar({
      ancla: r,
      panel: { width, height },
      vista: { vw: window.innerWidth, vh: window.innerHeight },
      align, gap,
    }))
  }, [anchorRef, panelRef, align, gap, matchAnchorWidth])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    calcular()
  }, [open, calcular])

  return pos
}

// Estilo base del panel. `pos` null = todavía sin medir: se monta invisible para
// poder medirlo, nunca en una posición provisional visible.
export function panelStyle(pos, extra = {}) {
  return {
    position: "fixed",
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    visibility: pos ? "visible" : "hidden",
    ...extra,
  }
}
