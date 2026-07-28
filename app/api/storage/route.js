import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

// Key validation — only allow known patterns
const VALID_KEY_RE = /^(weekly:\d{4}-\d{2}-\d{2}(:.+)?|monday-cache-v\d+|audit_log|gdd_history)$/;
function isValidKey(key) {
  return typeof key === 'string' && VALID_KEY_RE.test(key);
}

// Upstash REST API — usa las variables que Vercel inyecta automáticamente
// al conectar Upstash desde el Marketplace:
// KV_REST_API_URL + KV_REST_API_TOKEN
async function upstash(command, ...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null // sin config → fallback a memoria

  const encoded = args.map(a => encodeURIComponent(String(a)))
  const res = await fetch(`${url}/${[command, ...encoded].join('/')}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upstash ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.result ?? null
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const key = searchParams.get('key')
  const prefix = searchParams.get('prefix')

  try {
    if (action === 'get' && key) {
      if (!isValidKey(key)) return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
      const result = await upstash('GET', key)
      if (result === null) {
        // Sin KV configurado — devolver null (el frontend tiene fallback a GDD_EMPTY)
        return NextResponse.json({ value: null })
      }
      // Upstash devuelve strings — parsear JSON si es posible
      let val = result
      if (typeof val === 'string') {
        try { val = JSON.parse(val) } catch {}
      }
      return NextResponse.json({ value: val })
    }

    if (action === 'list' && prefix !== null) {
      if (typeof prefix !== 'string' || !/^(weekly:|monday-cache|audit_log|gdd_history)/.test(prefix)) {
        return NextResponse.json({ error: 'Invalid prefix' }, { status: 400 })
      }
      // Usar SCAN en lugar de KEYS — KEYS es O(n) bloqueante en Redis (P4.4)
      const allKeys = []
      let cursor = '0'
      do {
        const result = await upstash('SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', '100')
        if (result === null) break // sin KV configurado
        cursor = String(result[0])
        if (Array.isArray(result[1])) allKeys.push(...result[1])
      } while (cursor !== '0')
      return NextResponse.json({ keys: allKeys })
    }

    // action=weeklies — resumen ligero de TODAS las weeklies en una sola llamada.
    //
    // Existe para no tener que hacer un GET por clave (~65 requests) solo para saber
    // si hay weeklies en curso. Devuelve una proyeccion: los registros completos
    // pesan ~80KB cada uno (gdd_snapshot + analysis_snapshot + minutaText), asi que
    // mandarlos todos serian varios MB. El predicado de "en curso" se aplica en el
    // cliente (lib/utils.js) para no duplicar la regla aqui.
    if (action === 'weeklies') {
      const allKeys = []
      let cursor = '0'
      do {
        const result = await upstash('SCAN', cursor, 'MATCH', 'weekly:*', 'COUNT', '100')
        if (result === null) break
        cursor = String(result[0])
        if (Array.isArray(result[1])) allKeys.push(...result[1])
      } while (cursor !== '0')

      // Solo weeklies reales: descarta los backups `weekly:<fecha>:before_reset`.
      const keys = allKeys.filter(k => /^weekly:\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse()
      if (keys.length === 0) return NextResponse.json({ weeklies: [] })

      const values = await upstash('MGET', ...keys)
      const weeklies = keys.map((k, i) => {
        let w = values?.[i]
        if (typeof w === 'string') { try { w = JSON.parse(w) } catch { w = null } }
        if (!w) return null
        const focos = w.focos || {}
        const focosCount = Object.values(focos).reduce((n, e) => n + (Array.isArray(e) ? e.length : e ? 1 : 0), 0)
        return {
          key: k,
          startedAt: w.startedAt || null,
          elapsed: w.elapsed || 0,
          status: w.status || null,
          // Boolean en vez del texto: weeklyClosed() solo lo evalua como truthy.
          minutaText: !!w.minutaText,
          focosCount,
          squadsCount: Object.keys(focos).length,
          compromisosCount: (w.compromisos || []).filter(c => c?.que?.trim()).length,
        }
      }).filter(Boolean)

      return NextResponse.json({ weeklies })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Storage GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const { action, key, value } = await request.json()

    if (action === 'set' && key) {
      if (!isValidKey(key)) return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      // Validar tamaño antes de enviar a Upstash (límite ~10MB, safety 5MB)
      if (serialized.length > 5_000_000) {
        console.warn(`Storage: key ${key} excede 5MB (${serialized.length} bytes), omitiendo`)
        return NextResponse.json({ success: false, error: 'value_too_large' })
      }
      // TTL: 365 días — minutas persisten 1 año
      const result = await upstash('SET', key, serialized, 'EX', String(60 * 60 * 24 * 365))
      if (result === null) {
        console.error('Storage: KV_REST_API_URL no configurado. Configura Upstash en Vercel.')
        return NextResponse.json({ success: false, error: 'storage_not_configured' }, { status: 503 })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'delete' && key) {
      if (!isValidKey(key)) return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
      const result = await upstash('DEL', key)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Storage POST error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
