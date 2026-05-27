import { NextResponse } from 'next/server'
import { upstashGet, upstashSet } from '../../lib/upstash-server'
import { computeMetricsForWindow } from '../gdd-hubspot/helpers'

export const dynamic = 'force-dynamic'

const GDD_HISTORY_KEY = 'gdd_history'

// Recalcula el historial semanal con la definición SOLO-MKT actual:
// - leads/mqls/sqls/opps + pipeline se recomputan desde HubSpot por semana
//   (via computeMetricsForWindow, que aplica los filtros MKT de METRIC_DEFS).
// - por_origen / breakdown_macro se refrescan desde /api/hubspot-mqls (también MKT).
// Protegido con CRON_SECRET o API_SECRET.
export async function GET(request) {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const apiSecret  = process.env.API_SECRET
  const validTokens = [cronSecret, apiSecret].filter(Boolean).map(s => `Bearer ${s}`)
  if (!validTokens.length || !validTokens.includes(auth)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hsToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!hsToken) {
    return NextResponse.json({ error: 'HUBSPOT_PRIVATE_APP_TOKEN no configurado' }, { status: 503 })
  }

  const internalAuth = apiSecret ? { 'Authorization': `Bearer ${apiSecret}` } : {}

  try {
    const history = (await upstashGet(GDD_HISTORY_KEY)) || []
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ ok: false, reason: 'empty_history' })
    }

    let updated = 0
    const errors = []
    const enriched = []

    for (const entry of history) {
      const sd = entry.semana_desde || entry.id
      const sh = entry.semana_hasta || sd

      // 1. Recompute core MKT metrics for the week (el anclaje horario por tipo
      //    de campo lo resuelve buildDateFilters dentro del helper).
      let metrics = {}
      try {
        metrics = await computeMetricsForWindow(hsToken, sd, sh)
      } catch (e) {
        errors.push(`metrics ${sd}: ${e.message}`)
      }

      // 2. Refresh por_origen / breakdown_macro (también MKT)
      let por_origen = Array.isArray(entry.por_origen) ? entry.por_origen : []
      let breakdown_macro = entry.breakdown_macro || { inbound: 0, outbound: 0, unknown: 0 }
      try {
        const mqlRes = await fetch(
          // nocache=1 → recalcular fresco; evita guardar por_origen stale del caché.
          new URL(`/api/hubspot-mqls?semana_desde=${sd}&semana_hasta=${sh}&nocache=1`, request.url).toString(),
          { cache: 'no-store', headers: internalAuth }
        )
        if (mqlRes.ok) {
          const mqlData = await mqlRes.json()
          if (!mqlData.error) {
            por_origen = (mqlData.por_origen || []).map(o => ({ origen: o.origen, count: o.count, pct: o.pct }))
            breakdown_macro = mqlData.breakdown_macro || breakdown_macro
          }
        }
      } catch (e) {
        errors.push(`por_origen ${sd}: ${e.message}`)
      }

      enriched.push({
        ...entry,
        ...metrics,
        por_origen,
        breakdown_macro,
        guardado_en: new Date().toISOString(),
        mkt_only: true,
      })
      updated++

      // Rate limit entre semanas para no saturar la API de HubSpot
      await new Promise(r => setTimeout(r, 600))
    }

    const sorted = enriched.sort((a, b) => (b.id || b.semana_desde).localeCompare(a.id || a.semana_desde))
    await upstashSet(GDD_HISTORY_KEY, sorted, 60 * 60 * 24 * 365)

    return NextResponse.json({
      ok: true,
      updated,
      total: enriched.length,
      errors: errors.length ? errors : undefined,
    })

  } catch (error) {
    console.error('Backfill error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
