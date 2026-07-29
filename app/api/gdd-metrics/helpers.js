/**
 * gdd-metrics/helpers.js — métricas de Generación de Demanda desde Supabase.
 *
 * Sustituye a gdd-hubspot/helpers.js. HubSpot se consultaba en vivo paginando de
 * 100 en 100 con un tope de 20 páginas: al pasar de 2000 registros devolvía el
 * parcial COMO SI FUERA EL TOTAL, sin que la UI lo notara (YTD salía topado).
 * Supabase cuenta del lado de la base y devuelve un número, sin paginar.
 *
 * La tabla `mbr` la mantiene sync.py cada 2h. Ya trae aplicados los filtros que
 * antes vivían aquí: solo negocios "Venta Externa", y fuera las UDN `Interno` y
 * `CF`. Por eso METRIC_DEFS es mucho más corto que su versión de HubSpot.
 */
import { sbCount, sbRows } from '../../lib/supabase-server'

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

const fmtDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * getDateRanges — Límites de calendario (CDMX) por periodo, como strings
 * YYYY-MM-DD.
 *
 * Ya no hace falta anclar la ventana a UTC ni a CDMX como con HubSpot: en Supabase
 * las columnas de fecha son tipo `date`, sin hora, así que el rango se compara
 * directo contra el string y no hay corrimientos de zona horaria.
 */
export function getDateRanges() {
  const mxNow = getMexicoNow()
  const year = mxNow.getFullYear()
  const month = mxNow.getMonth()

  const dayOfWeek = mxNow.getDay() || 7
  const monday = new Date(mxNow)
  monday.setDate(mxNow.getDate() - (dayOfWeek - 1))

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(monday)
  prevSunday.setDate(monday.getDate() - 1)

  const mesDesde = new Date(year, month, 1)
  const mesHasta = new Date(year, month + 1, 0)
  const ytdDesde = new Date(year, 0, 1)

  return {
    semana:   { desde: fmtDate(monday),     hasta: fmtDate(sunday) },
    anterior: { desde: fmtDate(prevMonday), hasta: fmtDate(prevSunday) },
    mes:      { desde: fmtDate(mesDesde),   hasta: fmtDate(mesHasta) },
    ytd:      { desde: fmtDate(ytdDesde),   hasta: fmtDate(mxNow) },
    formatted: {
      semana_desde: fmtDate(monday),
      semana_hasta: fmtDate(sunday),
    },
  }
}

/**
 * METRIC_DEFS — cada métrica es un filtro sobre `mbr`. Todas son SOLO-MKT.
 *
 * Equivalencias con las propiedades de HubSpot que se usaban antes:
 *   contacto_marketing   → origen = 'Marketing'      (sync traduce TRUE/FALSE)
 *   conversion           → conversion = 'Marketing'  (idem)
 *   reunion_generado_por → origen = 'Marketing'      (idem)
 *   negocio_marketing    → origen = 'Marketing'      (idem)
 *   fecha_lead           → fecha_apertura      (contacto)
 *   fecha_mql            → fecha_calificacion  (contacto)
 *   hs_timestamp         → fecha_registro      (reunión)
 *   createdate           → fecha_registro      (negocio)
 *   hs_activity_type     → subtipo
 *   hs_meeting_outcome   → estado  ('COMPLETED' → 'Completada')
 *   amount               → monto
 *
 * El filtro de `pipeline` (8 ids) desapareció: sync.py ya excluye las UDN
 * `Interno` y `CF`, y los 9 pipelines restantes cuentan todos.
 */
export const METRIC_DEFS = {
  leads: {
    dateField: 'fecha_apertura',
    filters: ['tipo=eq.contacto', 'origen=eq.Marketing'],
  },
  mqls: {
    dateField: 'fecha_calificacion',
    filters: ['tipo=eq.contacto', 'conversion=eq.Marketing'],
  },
  sqls: {
    dateField: 'fecha_registro',
    filters: ['tipo=eq.reunion', 'origen=eq.Marketing', 'subtipo=eq.Credenciales', 'estado=eq.Completada'],
  },
  opps: {
    dateField: 'fecha_registro',
    filters: ['tipo=eq.negocio', 'origen=eq.Marketing'],
    sumField: 'monto',
  },
}

export const METRICS = ['leads', 'mqls', 'sqls', 'opps']

// buildQuery — filtros de la métrica + ventana de fechas, en sintaxis PostgREST.
export function buildQuery(def, desde, hasta) {
  return [
    ...def.filters,
    `${def.dateField}=gte.${desde}`,
    `${def.dateField}=lte.${hasta}`,
  ].join('&')
}

/**
 * computeMetricsForWindow — las 4 métricas MKT (+ pipeline) para la ventana
 * [desde, hasta] en formato YYYY-MM-DD. Reutilizado por el backfill histórico.
 *
 * Devuelve el mismo shape que la versión de HubSpot para no tocar la UI:
 * como todas las métricas ya filtran a Marketing, `_mkt` es igual al total y
 * `_com` queda en 0.
 */
export async function computeMetricsForWindow(desde, hasta) {
  const out = {}
  const results = await Promise.allSettled(METRICS.map(async (metric) => {
    const def = METRIC_DEFS[metric]
    const query = buildQuery(def, desde, hasta)
    if (def.sumField) {
      // Los negocios son pocos (~1.9k históricos), así que traerlos y sumar es
      // barato y determinista. PostgREST no expone sum() de forma garantizada.
      const rows = await sbRows('mbr', query, `id,${def.sumField}`)
      const amount = rows.reduce((sum, r) => sum + (Number(r[def.sumField]) || 0), 0)
      return { metric, total: rows.length, amount }
    }
    return { metric, total: await sbCount('mbr', query) }
  }))

  const errors = []
  results.forEach((r, i) => {
    const metric = METRICS[i]
    if (r.status === 'fulfilled') {
      out[metric] = r.value.total
      out[`${metric}_mkt`] = r.value.total
      out[`${metric}_com`] = 0
      if (r.value.amount !== undefined) {
        out.pipeline_total = r.value.amount
        out.pipeline_mkt = r.value.amount
        out.pipeline_com = 0
      }
    } else {
      out[metric] = 0
      out[`${metric}_mkt`] = 0
      out[`${metric}_com`] = 0
      errors.push(`${metric}: ${r.reason?.message || r.reason}`)
    }
  })

  return { metrics: out, errors }
}
