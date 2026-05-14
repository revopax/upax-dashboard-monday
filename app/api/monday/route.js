import { NextResponse } from 'next/server'
import { validateAuth } from '../_auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MONDAY_API_URL = 'https://api.monday.com/v2'
const BOARD_ID = process.env.MONDAY_BOARD_ID || '18044324200'
const GROUP_DELIVERY = 'group_mm15cfz2'
const COL_IDS = ['person','color_mkz0s203','color_mkz09na','timerange_mkzcqv0j','date_mm1b10rx','date_mkzchmsq','color_mkzjvp66','timerange_mkzx7r55']

async function mondayQuery(apiKey, query, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10')
      if (timeoutMs > 5000) {
        // Un solo retry automático con el Retry-After del servidor (P4.5)
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 30) * 1000))
        return mondayQuery(apiKey, query, Math.floor(timeoutMs / 2)) // reducir timeout en retry
      }
      throw new Error(`Rate limit Monday — espera ${retryAfter}s`)
    }
    if (!res.ok) throw new Error(`Monday HTTP ${res.status}`)
    const data = await res.json()
    if (data.errors) throw new Error(data.errors[0]?.message || 'Monday GraphQL error')
    return data
  } catch (e) {
    clearTimeout(timer)
    if (e.name === 'AbortError') throw new Error(`Monday timeout (${timeoutMs/1000}s)`)
    throw e
  }
}

export async function GET(request) {
  const authErr = validateAuth(request)
  if (authErr) return authErr

  try {
    const apiKey = process.env.MONDAY_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'MONDAY_API_KEY no configurada' }, { status: 500 })

    const colIds = JSON.stringify(COL_IDS)

    // Primera página — también trae grupos y columnas del board
    const firstQuery = `
      query {
        boards(ids: [${BOARD_ID}]) {
          groups { id title color }
          items_page(limit: 100, query_params: {
            rules: [{ column_id: "group", compare_value: ["${GROUP_DELIVERY}"] }]
          }) {
            cursor
            items {
              id name
              group { id title }
              column_values(ids: ${colIds}) { id text value column { id title type } }
              subitems {
                id name
                column_values(ids: ["person","color_mkzjvp66","timerange_mkzx7r55","date_mm1hnswx"]) {
                  id text value column { id type }
                }
              }
            }
          }
        }
      }
    `

    const firstData = await mondayQuery(apiKey, firstQuery)
    const board = firstData.data?.boards?.[0]
    if (!board) throw new Error('Board no encontrado')

    let allItems = [...(board.items_page?.items || [])]
    let cursor = board.items_page?.cursor
    let page = 0

    // Paginar
    while (cursor && page < 15) {
      // Páginas siguientes: solo cursor, SIN query_params
      // Monday rechaza con 500 si se mandan ambos simultáneamente
      const nextQuery = `
        query {
          boards(ids: [${BOARD_ID}]) {
            items_page(limit: 100, cursor: "${cursor}") {
              cursor
              items {
                id name
                group { id title }
                column_values(ids: ${colIds}) { id text value column { id title type } }
                subitems {
                  id name
                  column_values(ids: ["person","color_mkzjvp66","timerange_mkzx7r55","date_mm1hnswx"]) {
                    id text value column { id type }
                  }
                }
              }
            }
          }
        }
      `
      const nextData = await mondayQuery(apiKey, nextQuery)
      const page_data = nextData.data?.boards?.[0]?.items_page
      if (!page_data?.items?.length) break
      allItems.push(...page_data.items)
      cursor = page_data.cursor
      page++
    }

    // Normalizar column_values a objeto plano keyed por column ID
    // para que el frontend pueda acceder como item.column_values.color_mkz09na
    const normalized = allItems.map(item => {
      const cv = {}
      ;(item.column_values || []).forEach(col => {
        let val = col.text || null
        if (!val && col.value) {
          try {
            const p = JSON.parse(col.value)
            val = p?.label?.text || p?.text || p?.name || null
            // Para columna person: extraer nombres
            // people columns: col.text ya tiene el valor correcto
          } catch {}
        }
        cv[col.id] = val
      })
      // Normalizar subitems igualmente
      const subitems = (item.subitems || []).map(sub => {
        const scv = {}
        ;(sub.column_values || []).forEach(col => {
        let sval = col.text || null
        if (!sval && col.value) {
          try {
            const p = JSON.parse(col.value)
            sval = p?.label?.text || p?.text || p?.name || null
            // people columns: col.text ya tiene el valor correcto
          } catch {}
        }
        scv[col.id] = sval
      })
        return { ...sub, column_values: scv }
      })
      return { ...item, column_values: cv, subitems }
    })

    const MAX_PAGES = 15
    return NextResponse.json({
      items: normalized,
      groups: board.groups || [],
      total: normalized.length,
      truncated: page >= MAX_PAGES && cursor != null,
      ts: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('Monday API error:', error)
    return NextResponse.json({ error: error.message || 'Error al cargar datos' }, { status: 500 })
  }
}
