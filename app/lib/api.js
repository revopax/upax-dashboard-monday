'use client'
// lib/api.js — data layer hacia Next.js API routes
// MONDAY_USERS se resuelve server-side en /api/monday-write

export const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

const authHeadersGet = () => ({
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

export async function fetchAllItems() {
  try {
    const res = await fetch('/api/monday', { cache: 'no-store', headers: authHeadersGet() })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.items || []
  } catch (e) {
    if (process.env.NODE_ENV === 'development') console.error('fetchAllItems error:', e)
    return []
  }
}

export async function createMondayItem(name, dateStr, personName) {
  try {
    const res = await fetch('/api/monday-write', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, dateStr, personName }),
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}

export async function sendToSlack(text) {
  try {
    const res = await fetch('/api/slack', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    return data.success === true
  } catch { return false }
}
