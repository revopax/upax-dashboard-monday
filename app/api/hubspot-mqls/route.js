import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'

export const dynamic = 'force-dynamic'

// Etiquetas legibles para hs_analytics_source
const SOURCE_LABELS = {
  PAID_SEARCH: 'Paid Search',
  PAID_SOCIAL: 'Paid Social',
  ORGANIC_SEARCH: 'Organic Search',
  SOCIAL_MEDIA: 'Redes Organicas',
  OFFLINE: 'Offline / SDR',
  DIRECT_TRAFFIC: 'Direct Traffic',
  REFERRALS: 'Referral',
  EMAIL_MARKETING: 'Email Marketing',
  OTHER_CAMPAIGNS: 'Otras Campanas',
  AI_REFERRALS: 'AI / ChatGPT',
}

// --- HubSpot search with pagination ---
async function hubspotSearchAll(token, filters, properties) {
  const results = []
  let after = undefined
  const MAX_PAGES = 20 // safety limit: 20 * 100 = 2000 contacts max

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = {
      filterGroups: [{ filters }],
      properties,
      sorts: [{ propertyName: 'fecha_mql', direction: 'DESCENDING' }],
      limit: 100,
    }
    if (after) body.after = after

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    let res
    try {
      res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timer)
      if (fetchErr.name === 'AbortError') throw new Error('HubSpot timeout (8s)')
      throw fetchErr
    }
    clearTimeout(timer)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HubSpot ${res.status}: ${text.slice(0, 300)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))

    if (data.paging?.next?.after) {
      after = data.paging.next.after
    } else {
      break
    }
  }

  return results
}

// --- Aggregation logic ---
function aggregateByOrigin(contacts) {
  const counts = {}
  const macroInbound = { inbound: 0, outbound: 0, unknown: 0 }
  let mktCount = 0, comCount = 0

  for (const c of contacts) {
    const props = c.properties || {}

    // MACRO: fuente_mql binario
    const macro = (props.fuente_mql || '').toLowerCase()
    if (macro === 'inbound') macroInbound.inbound++
    else if (macro === 'outbound') macroInbound.outbound++
    else macroInbound.unknown++

    // Mkt/Com split via conversion property (normalized)
    const convStr = String(props.conversion ?? '').toLowerCase().trim()
    if (convStr === 'true' || convStr === '1' || convStr === 'yes') mktCount++
    else if (convStr === 'false' || convStr === '0' || convStr === 'no') comCount++

    // GRANULAR: fuente_conversion primero, fallback a hs_analytics_source
    let label
    const fc = props.fuente_conversion
    if (fc && fc.trim() !== '' && fc !== 'N/A') {
      label = fc.trim()
    } else {
      const raw = props.hs_analytics_source || 'UNKNOWN'
      label = SOURCE_LABELS[raw] || raw
    }
    counts[label] = (counts[label] || 0) + 1
  }

  const total = contacts.length
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
    breakdown_macro: macroInbound,
    mkt_count: mktCount,
    com_count: comCount,
    fuente_campo: 'fuente_conversion',
  }
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  const { searchParams } = new URL(request.url)
  const semana_desde = searchParams.get('semana_desde')
  const semana_hasta = searchParams.get('semana_hasta')
  const noCache = searchParams.get('nocache') === '1'

  // Validate required params
  if (!semana_desde || !semana_hasta) {
    return NextResponse.json(
      { error: 'Params semana_desde y semana_hasta son requeridos (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  // No token → error, no mock data
  if (!token) {
    return NextResponse.json({ error: true, message: 'HUBSPOT_PRIVATE_APP_TOKEN no configurado', por_origen: [], total: 0, semana_desde, semana_hasta }, { status: 503 })
  }

  // Check Upstash cache first (salvo nocache=1, p.ej. desde el backfill)
  const cacheKey = `hubspot-mqls-${semana_desde}-${semana_hasta}`
  if (!noCache) {
    const cached = await upstashGet(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  // Fetch from HubSpot. fecha_mql es una propiedad tipo `date` (solo fecha),
  // que HubSpot almacena a medianoche UTC. Por eso la ventana se ancla a UTC
  // (no a CDMX): anclarla a CDMX empujaría los MQLs del primer día de la semana
  // al periodo anterior. Debe coincidir con buildDateFilters(dateOnly=true).
  const desdeMs = new Date(semana_desde + 'T00:00:00.000Z').getTime()
  const hastaMs = new Date(semana_hasta + 'T23:59:59.999Z').getTime()

  try {
    const contacts = await hubspotSearchAll(
      token,
      [
        // Solo MKT (conversion=true). NO se filtra lifecyclestage: un contacto con
        // fecha_mql en el periodo cuenta aunque ya haya avanzado a SQL/oportunidad.
        { propertyName: 'conversion', operator: 'EQ', value: 'true' },
        { propertyName: 'fecha_mql', operator: 'GTE', value: String(desdeMs) },
        { propertyName: 'fecha_mql', operator: 'LTE', value: String(hastaMs) },
        { propertyName: 'udn', operator: 'HAS_PROPERTY' },
        { propertyName: 'udn', operator: 'NEQ', value: 'Interno' },
        { propertyName: 'udn', operator: 'NEQ', value: 'CF' },
      ],
      ['fecha_mql', 'hs_analytics_source', 'fuente_mql', 'fuente_conversion', 'hubspot_owner_id', 'conversion']
    )

    const result = {
      ...aggregateByOrigin(contacts),
      semana_desde,
      semana_hasta,
      lastUpdate: new Date().toISOString(),
    }

    // Cache 30 min
    await upstashSet(cacheKey, result, 1800)

    return NextResponse.json(result)
  } catch (error) {
    console.error('HubSpot MQLs error:', error.message)
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
