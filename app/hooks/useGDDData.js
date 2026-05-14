'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { storeGet, storeSet } from '../lib/storage'

const GDD_HISTORY_KEY = 'gdd_history'

const authHeadersGet = () => ({
  ...(process.env.NEXT_PUBLIC_API_SECRET ? { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_SECRET}` } : {}),
})

// Helper: fetch con timeout
async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, cache: 'no-store' })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// Calculate current ISO week dates (Monday-Sunday) in Mexico City timezone
function getCurrentWeekDates() {
  const now = new Date()
  const mxStr = now.toLocaleString('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const mxNow = new Date(mxStr.replace(',', ''))
  const dayOfWeek = mxNow.getDay() || 7
  const monday = new Date(mxNow)
  monday.setDate(mxNow.getDate() - (dayOfWeek - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return { semana_desde: fmt(monday), semana_hasta: fmt(sunday) }
}

function getPrevWeekDates(semanaDesde) {
  const desde = new Date(semanaDesde + 'T12:00:00')
  const prevDesde = new Date(desde)
  prevDesde.setDate(desde.getDate() - 7)
  const prevHasta = new Date(desde)
  prevHasta.setDate(desde.getDate() - 1)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { semana_desde: fmt(prevDesde), semana_hasta: fmt(prevHasta) }
}

const GDD_EMPTY = {
  semana: { leads: 0, mqls: 0, sqls: 0, opps: 0, leads_mkt: 0, leads_com: 0, mqls_mkt: 0, mqls_com: 0, sqls_mkt: 0, sqls_com: 0, opps_mkt: 0, opps_com: 0, pipeline_total: 0, pipeline_mkt: 0, pipeline_com: 0 },
  anterior: { leads: 0, mqls: 0, sqls: 0, opps: 0, leads_mkt: 0, leads_com: 0, mqls_mkt: 0, mqls_com: 0, sqls_mkt: 0, sqls_com: 0, opps_mkt: 0, opps_com: 0, pipeline_total: 0, pipeline_mkt: 0, pipeline_com: 0 },
  mes: { leads: 0, mqls: 0, sqls: 0, opps: 0, leads_mkt: 0, leads_com: 0, mqls_mkt: 0, mqls_com: 0, sqls_mkt: 0, sqls_com: 0, opps_mkt: 0, opps_com: 0, pipeline_total: 0, pipeline_mkt: 0, pipeline_com: 0 },
  ytd: { leads: 0, mqls: 0, sqls: 0, opps: 0, leads_mkt: 0, leads_com: 0, mqls_mkt: 0, mqls_com: 0, sqls_mkt: 0, sqls_com: 0, opps_mkt: 0, opps_com: 0, pipeline_total: 0, pipeline_mkt: 0, pipeline_com: 0 },
  fechas: {},
  source: 'empty',
}

/**
 * useGDDData — Hook unificado para datos de Generacion de Demanda
 *
 * Fuentes autoritativas:
 * - HubSpot (via /api/gdd-hubspot): Leads, MQLs, SQLs, OPPs con split mkt/com
 * - HubSpot (via /api/hubspot-mqls): Desglose de MQLs por origen/canal
 * - Upstash (via /api/storage): Historial semanal
 *
 * SIDE-EFFECT IMPORTANTE: Este hook AUTO-GUARDA en gdd_history (Upstash) cuando:
 * 1. HubSpot retorna datos validos (source !== 'empty')
 * 2. Los datos de la semana actual o anterior cambiaron >5% respecto al historial
 * Esto asegura que el historial se mantenga actualizado sin intervencion manual.
 * El guardado ocurre una sola vez por mount (controlado por fetchedRef).
 */
export function useGDDData() {
  const [gddData, setGddData] = useState(null)
  const [mqlBreakdown, setMqlBreakdown] = useState(null)
  const [mqlBreakdownPrev, setMqlBreakdownPrev] = useState(null)
  const [targets, setTargets] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch HubSpot — fuente autoritativa para Leads, MQLs, SQLs, OPPs
      let hubspotData = null
      try {
        const res = await fetchWithTimeout('/api/gdd-hubspot', { headers: authHeadersGet() }, 15000)
        if (res.ok) {
          const data = await res.json()
          if (!data.error) hubspotData = data
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.warn('GdD HubSpot fetch error:', err.message)
      }

      const finalData = hubspotData || GDD_EMPTY
      setGddData(finalData)

      // 2. Fetch HubSpot MQLs por origen — current + prev week
      const weekDates = finalData.fechas?.semana_desde
        ? { semana_desde: finalData.fechas.semana_desde, semana_hasta: finalData.fechas.semana_hasta }
        : getCurrentWeekDates()

      const prevDates = getPrevWeekDates(weekDates.semana_desde)

      // Fetch current and prev week MQL breakdowns in parallel
      const [mqlCurrent, mqlPrev] = await Promise.allSettled([
        fetchWithTimeout(
          `/api/hubspot-mqls?semana_desde=${encodeURIComponent(weekDates.semana_desde)}&semana_hasta=${encodeURIComponent(weekDates.semana_hasta)}`,
          { headers: authHeadersGet() }, 10000
        ).then(r => r.ok ? r.json() : null).then(d => d && !d.error ? d : null),
        fetchWithTimeout(
          `/api/hubspot-mqls?semana_desde=${encodeURIComponent(prevDates.semana_desde)}&semana_hasta=${encodeURIComponent(prevDates.semana_hasta)}`,
          { headers: authHeadersGet() }, 10000
        ).then(r => r.ok ? r.json() : null).then(d => d && !d.error ? d : null),
      ])

      if (mqlCurrent.status === 'fulfilled' && mqlCurrent.value) {
        setMqlBreakdown(mqlCurrent.value)
      }
      if (mqlPrev.status === 'fulfilled' && mqlPrev.value) {
        setMqlBreakdownPrev(mqlPrev.value)
      }

      // 3. Fetch historial + targets in parallel
      const [histResult, targetsResult] = await Promise.allSettled([
        storeGet(GDD_HISTORY_KEY),
        fetchWithTimeout('/api/gdd-targets', { headers: authHeadersGet() }, 10000)
          .then(r => r.ok ? r.json() : null)
          .then(d => d && !d.error ? d : null),
      ])

      const currentHistory = histResult.status === 'fulfilled' && Array.isArray(histResult.value) ? histResult.value : []

      // Auto-save current + previous week to history if HubSpot returned data
      if (hubspotData && hubspotData.fechas?.semana_desde && hubspotData.source !== 'empty') {
        const prevWeek = getPrevWeekDates(hubspotData.fechas.semana_desde)
        const weeksToSave = [
          { wsd: hubspotData.fechas.semana_desde, wsh: hubspotData.fechas.semana_hasta, sem: hubspotData.semana },
          { wsd: prevWeek.semana_desde, wsh: prevWeek.semana_hasta, sem: hubspotData.anterior },
        ]
        let historyChanged = false

        for (const { wsd, wsh, sem } of weeksToSave) {
          if (!wsd || !sem) continue
          const hasData = (sem.leads || 0) + (sem.mqls || 0) + (sem.sqls || 0) + (sem.opps || 0) > 0
          if (!hasData) continue

          const makeFields = () => ({
            leads: sem.leads || 0, mqls: sem.mqls || 0, sqls: sem.sqls || 0, opps: sem.opps || 0,
            leads_mkt: sem.leads_mkt || 0, leads_com: sem.leads_com || 0,
            mqls_mkt: sem.mqls_mkt || 0, mqls_com: sem.mqls_com || 0,
            sqls_mkt: sem.sqls_mkt || 0, sqls_com: sem.sqls_com || 0,
            opps_mkt: sem.opps_mkt || 0, opps_com: sem.opps_com || 0,
            pipeline_total: sem.pipeline_total || 0, pipeline_mkt: sem.pipeline_mkt || 0, pipeline_com: sem.pipeline_com || 0,
            guardado_en: new Date().toISOString(), auto: true,
          })

          const existing = currentHistory.find(h => h.semana_desde === wsd || h.id === wsd)
          if (!existing) {
            currentHistory.push({ id: wsd, semana_desde: wsd, semana_hasta: wsh || wsd, ...makeFields() })
            historyChanged = true
          } else {
            const changed = ['leads', 'mqls', 'sqls', 'opps'].some(m => {
              const ov = existing[m] || 0, nv = sem[m] || 0
              if (ov === 0 && nv === 0) return false
              if (ov === 0) return true
              return Math.abs((nv - ov) / ov) > 0.05
            })
            if (changed) {
              Object.assign(existing, makeFields())
              historyChanged = true
            }
          }
        }

        if (historyChanged) {
          currentHistory.sort((a, b) => (b.id || b.semana_desde).localeCompare(a.id || a.semana_desde))
          try { await storeSet(GDD_HISTORY_KEY, currentHistory) } catch {}
        }
      }

      setHistory(currentHistory)
      if (targetsResult.status === 'fulfilled' && targetsResult.value) {
        setTargets(targetsResult.value)
      }

    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('useGDDData error:', err.message)
      setError(err.message)
      setGddData(GDD_EMPTY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchAll()
  }, [fetchAll])

  return {
    gddData,
    mqlBreakdown,
    mqlBreakdownPrev,
    targets,
    history,
    setHistory,
    loading,
    error,
    refetch: fetchAll,
  }
}
