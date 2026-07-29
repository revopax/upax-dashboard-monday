// lib/supabase-server.js — acceso a la tabla `mbr` de Supabase vía PostgREST.
//
// SOLO SERVER-SIDE. Usa la key `service_role`, que salta RLS: si acabara en el
// bundle del navegador cualquiera podría leer y escribir la tabla. No importar
// desde componentes cliente.
//
// Se habla PostgREST con fetch directo, sin @supabase/supabase-js: el proyecto ya
// hace lo mismo con Monday, Slack y Upstash, y las consultas aquí son simples.
//
// La tabla `mbr` la reconstruye sync.py cada 2h desde HubSpot. Una fila es un
// negocio, un contacto o una reunión; lo dice la columna `tipo`, así que
// prácticamente toda consulta filtra por ella.

const baseUrl = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const apiKey  = () => process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function supabaseConfigured() {
  return !!(baseUrl() && apiKey())
}

const authHeaders = (extra) => ({
  apikey: apiKey(),
  Authorization: `Bearer ${apiKey()}`,
  ...extra,
})

const TIMEOUT_MS = 12000
const PAGE_SIZE  = 1000
// Tope de seguridad. Si se alcanza se LANZA, nunca se devuelve un resultado
// parcial: un número truncado en silencio es exactamente el bug que esta
// migración vino a eliminar (HubSpot cortaba en 2000 y lo reportaba como total).
const MAX_PAGES  = 200

async function request(path, headers) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`)
    }
    return res
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Supabase timeout (${TIMEOUT_MS / 1000}s)`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// sbCount — cuántas filas cumplen el filtro, SIN traerlas.
// PostgREST devuelve el total en el header Content-Range ("0-0/1491"), así que
// esto no pagina ni tiene tope: cuenta la base y manda un número.
export async function sbCount(table, query) {
  const res = await request(`${table}?select=id&${query}`, authHeaders({
    Prefer: 'count=exact',
    Range: '0-0',
  }))
  const contentRange = res.headers.get('content-range') || ''
  const total = contentRange.split('/')[1]
  if (!total || total === '*') {
    throw new Error(`Supabase no devolvió count (Content-Range: "${contentRange}")`)
  }
  return Number(total)
}

// sbRows — todas las filas que cumplen el filtro, paginando hasta agotarlas.
// Solo para conjuntos acotados (sumar montos de negocios, agrupar MQLs de una
// semana). Para contar, usar sbCount, que no transfiere filas.
//
// El `order=id.asc` es obligatorio, no cosmético: Postgres no garantiza un orden
// estable sin ORDER BY, así que sin él dos páginas consecutivas pueden repetir o
// saltarse filas y la suma saldría mal.
export async function sbRows(table, query, select) {
  const out = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE
    const res = await request(`${table}?select=${select}&${query}&order=id.asc`, authHeaders({
      Range: `${from}-${from + PAGE_SIZE - 1}`,
    }))
    const batch = await res.json()
    if (!Array.isArray(batch)) throw new Error('Supabase devolvió una respuesta inesperada')
    out.push(...batch)
    if (batch.length < PAGE_SIZE) return out
  }
  throw new Error(`Supabase: la consulta supera ${MAX_PAGES * PAGE_SIZE} filas; se aborta en vez de truncar`)
}

// sbSyncedAt — timestamp de la última corrida de sync.py. Igual en todas las
// filas, así que basta la más reciente. Sirve para avisar si el dato está viejo:
// el sync trata Supabase como best-effort y si falla continúa sin avisar.
export async function sbSyncedAt() {
  const res = await request('mbr?select=synced_at&order=synced_at.desc', authHeaders({ Range: '0-0' }))
  const rows = await res.json()
  return rows?.[0]?.synced_at || null
}

// Umbral de frescura: el sync corre cada 2h, así que a las 3h algo falló.
export const STALE_HOURS = 3

export function freshness(syncedAt) {
  if (!syncedAt) return { synced_at: null, stale: false, age_hours: null }
  const ageMs = Date.now() - new Date(syncedAt).getTime()
  const ageHours = ageMs / 3600000
  return {
    synced_at: syncedAt,
    age_hours: Math.round(ageHours * 10) / 10,
    stale: ageHours > STALE_HOURS,
  }
}
