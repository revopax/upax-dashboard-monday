import { NextResponse } from 'next/server'
import { upstashGet, upstashSet } from '../../../lib/upstash-server'

// Cron dominical: guarda automáticamente los datos GDD de la semana actual en Upstash
// Schedule: todos los domingos a las 18:00 UTC (12:00 PM CDMX)
// Protegido con CRON_SECRET (Vercel inyecta el header Authorization automáticamente)

const GDD_HISTORY_KEY = 'gdd_history'
const AUDIT_LOG_KEY   = 'audit_log'

export async function GET(request) {
  // Verificar autorización
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Obtener datos GDD actuales
    const internalAuth = process.env.API_SECRET ? { 'Authorization': `Bearer ${process.env.API_SECRET}` } : {}
    const gddRes = await fetch(new URL('/api/gdd-metrics', request.url).toString(), {
      cache: 'no-store',
      headers: internalAuth,
    })
    if (!gddRes.ok) throw new Error(`GDD API error: ${gddRes.status}`)
    const gddData = await gddRes.json()

    if (!gddData?.fechas?.semana_desde) {
      return NextResponse.json({ ok: false, reason: 'no_gdd_data' })
    }

    const semana_desde = gddData.fechas.semana_desde

    // 2. Verificar si ya existe esa semana en el historial
    const history = (await upstashGet(GDD_HISTORY_KEY)) || []
    const existing = history.find((h) => h.semana_desde === semana_desde)

    // Si existe, comparar datos — actualizar solo si hay diferencia >2% en alguna metrica
    if (existing) {
      const metrics = ['leads', 'mqls', 'sqls', 'opps']
      const hasSigDiff = metrics.some((m) => {
        const oldVal = existing[m] || 0
        const newVal = gddData.semana?.[m] || 0
        if (oldVal === 0 && newVal === 0) return false
        if (oldVal === 0) return true // de 0 a algo = diferencia significativa
        return Math.abs((newVal - oldVal) / oldVal) > 0.02
      })

      if (!hasSigDiff) {
        return NextResponse.json({ ok: true, saved: false, reason: 'no_significant_changes', week: semana_desde })
      }
    }

    // 3. Fetch HubSpot breakdown para incluir en la entrada
    const semana_hasta = gddData.fechas.semana_hasta || semana_desde
    let por_origen = []
    let breakdown_macro = { inbound: 0, outbound: 0, unknown: 0 }
    try {
      const mqlRes = await fetch(
        new URL(`/api/mql-breakdown?semana_desde=${semana_desde}&semana_hasta=${semana_hasta}`, request.url).toString(),
        { cache: 'no-store', headers: internalAuth }
      )
      if (mqlRes.ok) {
        const mqlData = await mqlRes.json()
        por_origen = (mqlData.por_origen || []).map(o => ({ origen: o.origen, count: o.count, pct: o.pct }))
        breakdown_macro = mqlData.breakdown_macro || breakdown_macro
      }
    } catch (e) {
      console.error('Cron HubSpot fetch error:', e.message)
    }

    // 4. Construir entrada unificada y guardar
    const entry = {
      id:            semana_desde,
      semana_desde,
      semana_hasta,
      leads:         gddData.semana?.leads     || 0,
      mqls:          gddData.semana?.mqls      || 0,
      sqls:          gddData.semana?.sqls      || 0,
      opps:          gddData.semana?.opps      || 0,
      leads_mkt:     gddData.semana?.leads_mkt || 0,
      leads_com:     gddData.semana?.leads_com || 0,
      mqls_mkt:      gddData.semana?.mqls_mkt  || 0,
      mqls_com:      gddData.semana?.mqls_com  || 0,
      sqls_mkt:      gddData.semana?.sqls_mkt  || 0,
      sqls_com:      gddData.semana?.sqls_com  || 0,
      opps_mkt:      gddData.semana?.opps_mkt  || 0,
      opps_com:      gddData.semana?.opps_com  || 0,
      pipeline_total: gddData.semana?.pipeline_total || 0,
      pipeline_mkt:   gddData.semana?.pipeline_mkt  || 0,
      pipeline_com:   gddData.semana?.pipeline_com   || 0,
      por_origen,
      breakdown_macro,
      guardado_en:   new Date().toISOString(),
    }

    const updatedHistory = [entry, ...history.filter((h) => h.semana_desde !== semana_desde)].sort((a, b) => b.id.localeCompare(a.id))
    await upstashSet(GDD_HISTORY_KEY, updatedHistory, 60 * 60 * 24 * 365)

    // 5. Audit log
    const auditLog = (await upstashGet(AUDIT_LOG_KEY)) || []
    const auditEntry = {
      id:           Date.now().toString() + Math.random().toString(36).slice(2, 6),
      ts:           new Date().toISOString(),
      tipo:         'gdd_auto_save',
      descripcion:  `Auto-${existing ? 'actualización' : 'guardado'} dominical GDD: semana ${semana_desde}`,
      datos:        { semana_desde, leads: entry.leads, mqls: entry.mqls, sqls: entry.sqls, opps: entry.opps },
      origen:       'cron',
    }
    const updatedLog = [auditEntry, ...auditLog].slice(0, 500)
    await upstashSet(AUDIT_LOG_KEY, updatedLog, 60 * 60 * 24 * 365)

    return NextResponse.json({ ok: true, saved: true, week: semana_desde, entry })

  } catch (error) {
    console.error('Cron GDD save error:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
