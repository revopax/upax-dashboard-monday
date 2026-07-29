import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'
import { supabaseConfigured, sbRows, sbSyncedAt, freshness } from '../../lib/supabase-server'

export const dynamic = 'force-dynamic'

// Reemplaza a /api/hubspot-mqls. Desglose de MQLs por canal y por macro
// Inbound/Outbound, desde la tabla `mbr` de Supabase.
//
// Un MQL es un contacto con conversion = 'Marketing' y fecha_calificacion dentro
// de la ventana. Igual que antes, NO se filtra por etapa del ciclo de vida: un
// contacto que calificó en el periodo cuenta aunque después haya avanzado.

// Etiqueta cuando el contacto no trae fuente_conversion. Hoy viene al 100% en los
// MQLs, así que esto es una red de seguridad, no el caso normal.
const SIN_FUENTE = 'Por atribuir'

function aggregate(rows) {
  const counts = {}
  const macro = { inbound: 0, outbound: 0, unknown: 0 }

  for (const r of rows) {
    // MACRO: fuente_mql. La columna es nueva; mientras sync.py no la llene todo
    // cae en `unknown` y la barra Inbound/Outbound simplemente no se dibuja.
    const m = String(r.fuente_mql ?? '').toLowerCase().trim()
    if (m === 'inbound') macro.inbound++
    else if (m === 'outbound') macro.outbound++
    else macro.unknown++

    // GRANULAR: fuente_conversion
    const raw = String(r.fuente_conversion ?? '').trim()
    const label = raw && raw !== 'N/A' ? raw : SIN_FUENTE
    counts[label] = (counts[label] || 0) + 1
  }

  const total = rows.length
  const por_origen = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([origen, count]) => ({
      origen,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

  return {
    total,
    por_origen,
    breakdown_macro: macro,
    // Todo lo consultado ya es Marketing, así que el split viene resuelto.
    mkt_count: total,
    com_count: 0,
    fuente_campo: 'fuente_conversion',
  }
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const semana_desde = searchParams.get('semana_desde')
  const semana_hasta = searchParams.get('semana_hasta')
  const noCache = searchParams.get('nocache') === '1'

  if (!semana_desde || !semana_hasta) {
    return NextResponse.json(
      { error: 'Params semana_desde y semana_hasta son requeridos (YYYY-MM-DD)' },
      { status: 400 }
    )
  }
  // Se interpolan en la query de PostgREST: se validan antes de tocar la red.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana_desde) || !/^\d{4}-\d{2}-\d{2}$/.test(semana_hasta)) {
    return NextResponse.json({ error: 'Formato de fecha inválido, se espera YYYY-MM-DD' }, { status: 400 })
  }

  if (!supabaseConfigured()) {
    return NextResponse.json({
      error: true, message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados',
      por_origen: [], total: 0, semana_desde, semana_hasta,
    }, { status: 503 })
  }

  const cacheKey = `mql-breakdown-${semana_desde}-${semana_hasta}`
  if (!noCache) {
    const cached = await upstashGet(cacheKey)
    if (cached) return NextResponse.json({ ...cached, cached: true })
  }

  try {
    // Los MQLs de una semana son decenas: traerlos y agrupar en memoria es
    // trivial. sbRows pagina hasta agotar y lanza antes que truncar.
    const query = [
      'tipo=eq.contacto',
      'conversion=eq.Marketing',
      `fecha_calificacion=gte.${semana_desde}`,
      `fecha_calificacion=lte.${semana_hasta}`,
    ].join('&')

    const rows = await sbRows('mbr', query, 'id,fuente_conversion,fuente_mql')

    let fresh = { synced_at: null, stale: false, age_hours: null }
    try {
      fresh = freshness(await sbSyncedAt())
    } catch (e) {
      console.error('MQL synced_at error:', e.message)
    }

    const result = {
      ...aggregate(rows),
      ...fresh,
      semana_desde,
      semana_hasta,
      lastUpdate: new Date().toISOString(),
    }

    await upstashSet(cacheKey, result, 1800)

    return NextResponse.json(result)
  } catch (error) {
    console.error('MQL breakdown error:', error.message)
    return NextResponse.json({
      error: true,
      message: error.message,
      por_origen: [],
      total: 0,
      semana_desde,
      semana_hasta,
    }, { status: 503 })
  }
}
