'use client'
// lib/storage.js — Upstash Redis via /api/storage
import { TODAY_STR } from './constants'
import { addDays } from './utils'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

const authHeadersGet = () => ({
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

export async function storeGet(key) {
  try {
    const r = await fetch(`/api/storage?action=get&key=${encodeURIComponent(key)}`, { headers: authHeadersGet() })
    const d = await r.json()
    if (!d.value) return null
    return typeof d.value === 'string' ? JSON.parse(d.value) : d.value
  } catch { return null }
}
export async function storeSet(key, val) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'set', key, value: JSON.stringify(val) }),
    })
  } catch {}
}
export async function storeDel(key) {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'delete', key }),
    })
  } catch {}
}
// storeWeeklies — resumen ligero de todas las weeklies en UNA sola request.
// Devuelve [{ key, startedAt, elapsed, status, minutaText, focosCount, ... }].
// Pensado para poder evaluar isWeeklyEnCurso() sin traerse los registros completos.
export async function storeWeeklies() {
  try {
    const r = await fetch('/api/storage?action=weeklies', { headers: authHeadersGet() })
    const d = await r.json()
    return Array.isArray(d.weeklies) ? d.weeklies : []
  } catch { return [] }
}

export async function storeList(prefix) {
  try {
    const r = await fetch(`/api/storage?action=list&prefix=${encodeURIComponent(prefix)}`, { headers: authHeadersGet() })
    const d = await r.json()
    if (d.keys?.length > 0) return d.keys
  } catch {}
  // Fallback: scan last 8 Mondays — usar addDays() para respetar timezone local (P2.2)
  const candidates = Array.from({ length: 8 }, (_, i) => {
    const dateStr = addDays(TODAY_STR, -i * 7)
    return `weekly:${dateStr}`
  })
  const results = await Promise.all(candidates.map(async (k) => {
    const v = await storeGet(k); return v ? k : null
  }))
  return results.filter(Boolean)
}
