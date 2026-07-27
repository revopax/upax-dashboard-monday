'use client'
import React, { useState, useEffect, useCallback } from 'react'
// components/WeekliesEnCurso.jsx — panel de weeklies empezadas y no cerradas.
//
// Existe porque el estado del cronometro solia vivir solo en memoria: al recargar
// desaparecia la barra del timer y con ella el boton de finalizar, dejando weeklies
// abiertas para siempre. Este panel las lista (incluidas las de dias anteriores) y
// permite cerrarlas.
import { STORE_KEY, SQUADS } from '../lib/constants'
import { formatLongDate, isWeeklyEnCurso, normalizeFocos } from '../lib/utils'
import { storeGet, storeSet, storeList } from '../lib/storage'
import { generateMinuta } from '../lib/minuta'
import { C, R, F } from '../lib/tokens'

// Las claves `weekly:<fecha>:before_reset` son backups del boton de reset, no weeklies.
const isWeeklyKey = (k) => /^weekly:\d{4}-\d{2}-\d{2}$/.test(k)

function resumen(w) {
  const focos = Object.values(w.focos || {}).reduce(
    (n, entry) => n + normalizeFocos(entry).filter((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim()).length,
    0
  )
  const comps = (w.compromisos || []).filter((c) => c.que?.trim()).length
  const el = w.elapsed || 0
  const parts = []
  if (focos) parts.push(`${focos} foco${focos !== 1 ? 's' : ''}`)
  if (comps) parts.push(`${comps} compromiso${comps !== 1 ? 's' : ''}`)
  if (el) parts.push(`${Math.floor(el / 60)}:${String(el % 60).padStart(2, '0')} min`)
  const sqs = SQUADS.filter((s) => normalizeFocos(w.focos?.[s.id]).some((f) => f.focos?.trim())).length
  if (sqs) parts.push(`${sqs} squad${sqs !== 1 ? 's' : ''}`)
  return parts.length ? parts.join(' · ') : 'sin capturas'
}

const WeekliesEnCurso = React.memo(function WeekliesEnCurso({ onClose, onOpenMinuta, onFinalizeToday }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    const keys = (await storeList('weekly:')).filter(isWeeklyKey)
    const uniq = [...new Set([STORE_KEY, ...keys])].sort().reverse()
    const loaded = await Promise.all(uniq.map(async (k) => ({ key: k, data: await storeGet(k) })))
    setRows(loaded.filter((r) => isWeeklyEnCurso(r.data)))
  }, [])

  useEffect(() => { load() }, [load])

  // Cierra una weekly guardada generandole su minuta a partir de SUS PROPIOS
  // snapshots (gdd_snapshot / analysis_snapshot), no de los datos de hoy.
  async function finalizar(key, data) {
    setBusy(key)
    try {
      if (key === STORE_KEY) {
        onFinalizeToday()
        onClose()
        return
      }
      const text = data.minutaText || generateMinuta(
        data, data.analysis_snapshot || null, data.gdd_snapshot || null, null, data.blockTimes || {}, []
      )
      await storeSet(key, { ...data, minutaText: text, status: 'finished', finishedAt: new Date().toISOString() })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.bg2, border: `1px solid ${C.bg4}`, borderRadius: R.default, width: '100%', maxWidth: 620, boxShadow: '0 12px 48px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.bg4}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Weeklies en curso</div>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Empezadas y sin cerrar. Finalizar genera su minuta.</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: C.bg3, color: C.tx2, border: 'none', borderRadius: R.sm, padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: 14 }}>
          {rows === null ? (
            <div style={{ textAlign: 'center', padding: 28, color: C.tx3, fontSize: 12 }}>Buscando...</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 28, color: C.tx3, fontSize: 12 }}>
              No hay weeklies en curso. Todas estan cerradas.
            </div>
          ) : rows.map(({ key, data }) => {
            const isToday = key === STORE_KEY
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8, borderRadius: R.sm, background: C.bg, border: `1px solid ${isToday ? C.blue : C.bg4}` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.yellow, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {formatLongDate(key.replace('weekly:', ''))}
                    {isToday && <span style={{ fontSize: 9, background: C.blue, color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>HOY</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.tx3, marginTop: 2, fontFamily: F.mono }}>{resumen(data)}</div>
                </div>
                <button onClick={() => onOpenMinuta(key, data)} style={{ background: C.bg3, color: C.tx2, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Ver</button>
                <button onClick={() => finalizar(key, data)} disabled={busy === key} style={{ background: busy === key ? C.bg4 : C.green, color: '#fff', border: 'none', borderRadius: R.sm, padding: '4px 12px', fontSize: 11, fontWeight: 700, cursor: busy === key ? 'default' : 'pointer', flexShrink: 0 }}>
                  {busy === key ? '...' : 'Finalizar'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export { WeekliesEnCurso }
