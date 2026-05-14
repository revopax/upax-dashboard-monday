/**
 * gdd-hubspot/helpers.js — Helpers extraidos de route.js para mantener el
 * archivo principal como orquestador limpio.
 */

const MAX_PAGES = 20

/**
 * hubspotSearchSplit — Busca objetos en HubSpot con paginacion y split mkt/com
 * @returns {{ total, mkt, com, amount_total?, amount_mkt?, amount_com? }}
 */
export async function hubspotSearchSplit(token, objectType, filters, splitProp, properties, sumField) {
  let total = 0, mkt = 0, com = 0
  let amountTotal = 0, amountMkt = 0, amountCom = 0
  let after = undefined

  const propsToFetch = [...new Set([splitProp, ...(sumField ? [sumField] : []), ...properties])]

  for (let page = 0; page < MAX_PAGES; page++) {
    const body = {
      filterGroups: [{ filters }],
      properties: propsToFetch,
      limit: 100,
    }
    if (after) body.after = after

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let res
    try {
      res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timer)
      if (fetchErr.name === 'AbortError') throw new Error(`HS ${objectType} timeout`)
      throw fetchErr
    }
    clearTimeout(timer)

    if (res.status === 429) {
      const retryAfter = Math.min(parseInt(res.headers.get('Retry-After') || '10', 10), 30) * 1000
      await new Promise(r => setTimeout(r, retryAfter))
      page-- // retry same page
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HS ${objectType} ${res.status}: ${text.slice(0, 120)}`)
    }

    const data = await res.json()
    const results = data.results || []

    for (const item of results) {
      total++
      const props = item.properties || {}
      const splitStr = String(props[splitProp] ?? '').toLowerCase().trim()
      const isMkt = splitStr === 'true' || splitStr === '1' || splitStr === 'yes'
      const isCom = splitStr === 'false' || splitStr === '0' || splitStr === 'no'

      if (isMkt) mkt++
      else if (isCom) com++

      if (sumField) {
        const amt = parseFloat(props[sumField]) || 0
        amountTotal += amt
        if (isMkt) amountMkt += amt
        else if (isCom) amountCom += amt
      }
    }

    if (data.paging?.next?.after) {
      after = data.paging.next.after
    } else {
      break
    }

    if (page === MAX_PAGES - 1 && data.paging?.next?.after) {
      console.warn(`HS ${objectType} TRUNCATED at ${MAX_PAGES} pages (${total} records)`)
    }
  }

  const result = { total, mkt, com }
  if (sumField) {
    result.amount_total = amountTotal
    result.amount_mkt = amountMkt
    result.amount_com = amountCom
  }
  return result
}

/**
 * getMexicoNow — Fecha/hora actual en timezone Mexico City (DST-aware)
 */
export function getMexicoNow() {
  const now = new Date()
  const mxStr = now.toLocaleString('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  return new Date(mxStr.replace(',', ''))
}

/**
 * getDateRanges — Calcula rangos de fecha para semana, anterior, mes, ytd
 */
export function getDateRanges() {
  const mxNow = getMexicoNow()
  const year = mxNow.getFullYear()
  const month = mxNow.getMonth()

  const dayOfWeek = mxNow.getDay() || 7
  const monday = new Date(mxNow)
  monday.setDate(mxNow.getDate() - (dayOfWeek - 1))
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(monday)
  prevSunday.setDate(monday.getDate() - 1)
  prevSunday.setHours(23, 59, 59, 999)

  const mesDesde = new Date(year, month, 1)
  const mesHasta = new Date(year, month + 1, 0, 23, 59, 59, 999)

  const ytdDesde = new Date(year, 0, 1)

  const fmtDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    semana:   { desde: monday,     hasta: sunday },
    anterior: { desde: prevMonday, hasta: prevSunday },
    mes:      { desde: mesDesde,   hasta: mesHasta },
    ytd:      { desde: ytdDesde,   hasta: mxNow },
    formatted: {
      semana_desde: fmtDate(monday),
      semana_hasta: fmtDate(sunday),
    },
  }
}

// UDN exclusion filters shared by multiple metrics
export const UDN_FILTERS = [
  { propertyName: 'udn', operator: 'HAS_PROPERTY' },
  { propertyName: 'udn', operator: 'NEQ', value: 'Interno' },
  { propertyName: 'udn', operator: 'NEQ', value: 'CF' },
]

// Metric definitions with split properties
export const METRIC_DEFS = {
  leads: {
    objectType: 'contacts',
    dateField: 'fecha_lead',
    splitProp: 'contacto_marketing',
    baseFilters: [...UDN_FILTERS],
  },
  mqls: {
    objectType: 'contacts',
    dateField: 'fecha_mql',
    splitProp: 'conversion',
    baseFilters: [
      { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
      ...UDN_FILTERS,
    ],
  },
  sqls: {
    objectType: 'meetings',
    dateField: 'hs_timestamp',
    splitProp: 'reunion_generado_por',
    baseFilters: [
      { propertyName: 'hs_activity_type', operator: 'EQ', value: 'Credenciales' },
      { propertyName: 'hs_meeting_outcome', operator: 'EQ', value: 'COMPLETED' },
      { propertyName: 'contactos_asociados', operator: 'EQ', value: '1' },
    ],
  },
  opps: {
    objectType: 'deals',
    dateField: 'createdate',
    splitProp: 'negocio_marketing',
    sumField: 'amount',
    baseFilters: [
      { propertyName: 'tipo_de_venta', operator: 'EQ', value: 'Venta Externa' },
      { propertyName: 'pipeline', operator: 'IN', values: [
        '646364160', '31468827', '79805840', '53534318',
        '53534328', '53652407', '31419220', '646793827',
      ]},
    ],
  },
}
