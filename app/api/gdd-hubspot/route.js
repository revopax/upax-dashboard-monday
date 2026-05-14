import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'
import { upstashGet, upstashSet } from '../../lib/upstash-server'
import { hubspotSearchSplit, getMexicoNow, getDateRanges, METRIC_DEFS } from './helpers'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  const hsToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN
  if (!hsToken) {
    return NextResponse.json({ error: 'HUBSPOT_PRIVATE_APP_TOKEN no configurado', source: 'error' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const noCache = searchParams.get('nocache') === '1'

  const ranges = getDateRanges()

  // Check cache
  const cacheKey = `gdd-hubspot-v2-${ranges.formatted.semana_desde}`
  if (!noCache) {
    const cached = await upstashGet(cacheKey)
    if (cached) {
      return NextResponse.json({ ...cached, cached: true })
    }
  }

  const periods = {
    semana:   { desde: ranges.semana.desde,   hasta: ranges.semana.hasta },
    anterior: { desde: ranges.anterior.desde, hasta: ranges.anterior.hasta },
    mes:      { desde: ranges.mes.desde,      hasta: ranges.mes.hasta },
    ytd:      { desde: ranges.ytd.desde,      hasta: ranges.ytd.hasta },
  }

  const metrics = ['leads', 'mqls', 'sqls', 'opps']
  const periodNames = ['semana', 'anterior', 'mes', 'ytd']

  try {
    const counts = { semana: {}, anterior: {}, mes: {}, ytd: {} }
    const errors = []

    // Run metrics in pairs to stay within Vercel 60s limit
    const metricPairs = [['leads', 'sqls'], ['mqls', 'opps']]

    for (let pi = 0; pi < metricPairs.length; pi++) {
      if (pi > 0) await new Promise(r => setTimeout(r, 300))
      const pair = metricPairs[pi]

      const allPromises = pair.flatMap(metric => {
        const def = METRIC_DEFS[metric]
        return periodNames.map(period => {
          const { desde, hasta } = periods[period]
          const dateFilters = [
            { propertyName: def.dateField, operator: 'GTE', value: String(desde.getTime()) },
            { propertyName: def.dateField, operator: 'LTE', value: String(hasta.getTime()) },
          ]
          return {
            metric,
            period,
            promise: hubspotSearchSplit(
              hsToken,
              def.objectType,
              [...def.baseFilters, ...dateFilters],
              def.splitProp,
              [],
              def.sumField || null,
            ),
          }
        })
      })

      const batchResults = await Promise.allSettled(allPromises.map(b => b.promise))

      batchResults.forEach((r, i) => {
        const { metric, period } = allPromises[i]
        if (r.status === 'fulfilled') {
          const v = r.value
          counts[period][metric] = v.total
          counts[period][`${metric}_mkt`] = v.mkt
          counts[period][`${metric}_com`] = v.com
          if (v.amount_total !== undefined) {
            counts[period].pipeline_total = v.amount_total
            counts[period].pipeline_mkt = v.amount_mkt
            counts[period].pipeline_com = v.amount_com
          }
        } else {
          counts[period][metric] = 0
          counts[period][`${metric}_mkt`] = 0
          counts[period][`${metric}_com`] = 0
          errors.push(`${metric}/${period}: ${r.reason?.message || r.reason}`)
        }
      })
    }

    errors.forEach(e => console.error('GDD query error:', e))

    const hasAnyData = Object.values(counts.semana).some(v => v > 0)
    const allFailed = !hasAnyData && errors.length > 0
    if (allFailed) {
      return NextResponse.json({
        error: 'All HubSpot queries failed',
        errors,
        source: 'error',
      }, { status: 503 })
    }

    const result = {
      semana:   counts.semana,
      anterior: counts.anterior,
      mes:      counts.mes,
      ytd:      counts.ytd,
      fechas:   ranges.formatted,
      source:   errors.length > 0 ? 'hubspot_partial' : 'hubspot_live',
      errors:   errors.length > 0 ? errors : undefined,
      _debug:   { mxNow: getMexicoNow().toISOString(), ranges: ranges.formatted, errCount: errors.length },
      lastUpdate: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    if (!allFailed) {
      const ttl = errors.length > 0 ? 300 : 900
      await upstashSet(cacheKey, result, ttl)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('GDD HubSpot error:', error.message)
    return NextResponse.json({
      error: error.message,
      source: 'error',
    }, { status: 503 })
  }
}
