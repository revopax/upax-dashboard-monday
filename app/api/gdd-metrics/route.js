import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'
import { supabaseConfigured, sbSyncedAt, freshness } from '../../lib/supabase-server'
import { getMexicoNow, getDateRanges, computeMetricsForWindow } from './helpers'

export const dynamic = 'force-dynamic'

// Reemplaza a /api/gdd-hubspot. Misma forma de respuesta; la fuente ahora es la
// tabla `mbr` de Supabase en vez de la API de HubSpot.
//
// Ya no hace falta partir las métricas en pares con pausas entre medio: aquello
// existía porque cada métrica paginaba HubSpot de 100 en 100 y las 16 combinaciones
// (4 métricas × 4 periodos) no cabían en los 60s de Vercel. Ahora son conteos que
// resuelve la base, así que van todas en paralelo.
export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados', source: 'error' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const noCache = searchParams.get('nocache') === '1'

  const ranges = getDateRanges()

  const cacheKey = `gdd-metrics-v1-${ranges.formatted.semana_desde}`
  if (!noCache) {
    const cached = await upstashGet(cacheKey)
    if (cached) return NextResponse.json({ ...cached, cached: true })
  }

  const periodNames = ['semana', 'anterior', 'mes', 'ytd']

  try {
    const settled = await Promise.all(
      periodNames.map((p) => computeMetricsForWindow(ranges[p].desde, ranges[p].hasta))
    )

    const counts = {}
    const errors = []
    periodNames.forEach((period, i) => {
      counts[period] = settled[i].metrics
      settled[i].errors.forEach((e) => errors.push(`${period}/${e}`))
    })

    errors.forEach((e) => console.error('GDD query error:', e))

    const hasAnyData = Object.values(counts.semana).some((v) => v > 0)
    if (!hasAnyData && errors.length > 0) {
      return NextResponse.json({ error: 'Todas las consultas a Supabase fallaron', errors, source: 'error' }, { status: 503 })
    }

    // Frescura: sync.py trata Supabase como best-effort, así que si falla la tabla
    // se queda vieja sin avisar. synced_at lo delata.
    let fresh = { synced_at: null, stale: false, age_hours: null }
    try {
      fresh = freshness(await sbSyncedAt())
    } catch (e) {
      console.error('GDD synced_at error:', e.message)
    }

    const result = {
      semana:   counts.semana,
      anterior: counts.anterior,
      mes:      counts.mes,
      ytd:      counts.ytd,
      fechas:   ranges.formatted,
      source:   errors.length > 0 ? 'supabase_partial' : 'supabase',
      errors:   errors.length > 0 ? errors : undefined,
      ...fresh,
      _debug:   { mxNow: getMexicoNow().toISOString(), ranges: ranges.formatted, errCount: errors.length },
      lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    await upstashSet(cacheKey, result, errors.length > 0 ? 300 : 900)

    return NextResponse.json(result)
  } catch (error) {
    console.error('GDD metrics error:', error.message)
    return NextResponse.json({ error: error.message, source: 'error' }, { status: 503 })
  }
}
