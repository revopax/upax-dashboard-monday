'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PERSONAS } from '../lib/constants'
import { C, F, R } from '../lib/tokens'
import { shortName } from '../lib/utils'
import { useAnchoredPanel, panelStyle } from '../hooks/useAnchoredPanel'

// OwnersHoverCard — responsables de una fila, con card propio en vez del tooltip
// nativo del navegador.
//
// El `title=""` tardaba ~1s en aparecer: es un retardo fijo del navegador, no se
// puede configurar. Con varios owners era justo cuando más se necesitaba leerlo, así
// que la lista se sentía trabada. Este card abre en el mismo frame del hover.
//
// Va por PORTAL a document.body a propósito, por dos razones:
//   1. La lista de items vive en un contenedor con overflow-y, que recortaría un
//      popover posicionado adentro.
//   2. En modo presentador `.fade` lleva un transform: scale(), y un elemento
//      position:fixed adentro se posicionaría contra ESE elemento y no contra la
//      ventana. Fuera del árbol, las coordenadas de getBoundingClientRect valen.

// Squad de cada responsable, para poder marcar a los que son de otro equipo: es la
// razón de que la fila diga "Varios owners" en vez de un nombre suelto.
const squadOf = (name) => PERSONAS.find((p) => p.name === name)?.squad || null

function Spinner({ size = 10 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block", width: size, height: size, borderRadius: "50%",
        border: `1.5px solid ${C.bg4}`, borderTopColor: C.blue,
        animation: "spin .6s linear infinite", flexShrink: 0,
      }}
    />
  )
}

export function OwnersHoverCard({ owners = [], mine = [], person, squadName, loading = false }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  const panelRef = useRef(null)
  // `end` alinea el card por la derecha del texto: la columna de responsables va
  // pegada al margen derecho de la fila. El hook lo mete a la ventana si aun así
  // no cabe.
  const pos = useAnchoredPanel({ open: abierto, anchorRef: ref, panelRef, align: "end" })

  const names = owners.length ? owners : []
  const multi = names.length > 1
  // Con un solo responsable el nombre ya se lee en la fila; el card sobra.
  const interactive = multi || loading

  const open = useCallback(() => setAbierto(true), [])
  const close = useCallback(() => setAbierto(false), [])

  // El card queda anclado a coordenadas de ventana, así que al hacer scroll en la
  // lista se despegaría de su fila: mouseleave no dispara hasta que el mouse se
  // mueve. En captura, para enterarse también del scroll del contenedor interno.
  useEffect(() => {
    if (!abierto) return
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [abierto, close])

  const label = multi ? "Varios owners" : (shortName(mine?.[0] || names[0] || person) || "—")

  return (
    <>
      <span
        ref={ref}
        // title vacío a propósito: sin él, el navegador sube al div de la fila y
        // saca su tooltip nativo ("Click para agregar a focos") encima del card.
        title=""
        tabIndex={interactive ? 0 : undefined}
        onMouseEnter={interactive ? open : undefined}
        onMouseLeave={interactive ? close : undefined}
        onFocus={interactive ? open : undefined}
        onBlur={interactive ? close : undefined}
        style={{
          color: C.tx3, fontSize: 10, flexShrink: 0, whiteSpace: "nowrap",
          fontStyle: multi ? "italic" : "normal",
          cursor: interactive ? "help" : "inherit",
          textDecoration: multi ? "underline dotted" : "none",
          textUnderlineOffset: 2,
        }}
      >
        {label}
      </span>

      {abierto && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          role="tooltip"
          style={panelStyle(pos, {
            zIndex: 200,
            maxHeight: pos?.maxHeight, overflowY: "auto",
            background: C.bg2, border: `1px solid ${C.border}`, borderRadius: R.sm,
            boxShadow: C.shadowLg, padding: "8px 10px",
            minWidth: 150, maxWidth: 260,
            pointerEvents: "none", animation: "fadeIn .12s ease both",
          })}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: 1, marginBottom: names.length ? 5 : 0 }}>
            Responsables{names.length > 1 ? ` · ${names.length}` : ""}
          </div>

          {names.length === 0 ? (
            loading
              ? <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.tx3 }}><Spinner /> Cargando…</div>
              : <div style={{ fontSize: 11, color: C.tx3 }}>{person || "Sin responsable"}</div>
          ) : (
            names.map((n) => {
              const sq = squadOf(n)
              const fuera = squadName && sq && sq !== squadName
              return (
                <div key={n} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 11, color: C.tx2, padding: "1px 0" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: fuera ? C.bg4 : C.blue, flexShrink: 0, transform: "translateY(-2px)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{n}</span>
                  {/* El squad solo se anota cuando NO es el de la pestaña: ahí es
                      donde el nombre suelto confundía. */}
                  {fuera && <span style={{ fontSize: 9, color: C.tx3, fontFamily: F.mono, whiteSpace: "nowrap" }}>{sq}</span>}
                </div>
              )
            })
          )}

          {loading && names.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: C.tx3, marginTop: 5, paddingTop: 5, borderTop: `1px solid ${C.bg3}` }}>
              <Spinner size={8} /> Actualizando…
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
