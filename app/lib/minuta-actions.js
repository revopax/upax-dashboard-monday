'use client'
/**
 * minuta-actions.js — Logica de negocio extraida de MinutaDetailView.jsx
 * Contiene: generacion de HTML para PDF y envio a Slack.
 * El componente MinutaDetailView solo contiene UI.
 */
import { SQUADS } from './constants'
import { shortName, normalizeFocos } from './utils'
import { authHeaders } from './api'

/**
 * generatePdfHtml — Genera HTML de la minuta para exportacion PDF
 * @param {string} dateStr - Fecha de la weekly (YYYY-MM-DD)
 * @param {object} wd - Weekly data (focos, compromisos, presenters)
 * @param {object} gddData - Datos de Generacion de Demanda
 * @returns {string} HTML completo listo para Cmd+P > Guardar como PDF
 */
export function generatePdfHtml(dateStr, wd, gddData) {
  const gdd = gddData || {}
  const s = gdd.semana || {}, a = gdd.anterior || {}, mes = gdd.mes || {}, y = gdd.ytd || {}, f = gdd.fechas || {}
  const pTotal = s.pipeline_total || ((s.pipeline_mkt||0)+(s.pipeline_com||0))
  const fmtN = (v) => (v||0).toLocaleString("es-MX")
  const fmtM = (v) => v >= 1000000 ? "$"+(v/1000000).toFixed(1)+"M" : v >= 1000 ? "$"+(v/1000).toFixed(0)+"K" : "$"+(v||0)
  const pct = (cur, prev) => { if (!prev) return ""; const p = Math.round(((cur-prev)/prev)*100); return `<span style="color:${p>=0?"#16a34a":"#dc2626"};font-weight:700">${p>=0?"▲":"▼"}${Math.abs(p)}%</span>` }
  const dateLabel = new Date(dateStr).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  let focosHtml = ""
  if (wd) {
    SQUADS.forEach(sq => {
      const raw = wd.focos?.[sq.id]
      const arr = normalizeFocos(raw)
      const filled = arr.filter(f2 => f2.focos?.trim()||f2.blocker?.trim()||f2.necesito?.trim())
      if (!filled.length) return
      const presenter = wd.presenters?.[sq.id] || sq.lead
      focosHtml += `<div style="margin-bottom:16px;padding:12px 16px;border-radius:8px;border-left:4px solid ${sq.color};background:#fafafa">
        <div style="font-weight:700;color:${sq.color};font-size:13px;margin-bottom:8px">${sq.name} <span style="font-weight:400;color:#666">· ${presenter}</span></div>`
      filled.forEach(f2 => {
        if (f2.focos?.trim()) focosHtml += `<div style="font-size:12px;color:#333;margin-bottom:4px">🎯 ${f2.focos.trim().replace(/</g,"&lt;")}</div>`
        if (f2.blocker?.trim()) focosHtml += `<div style="font-size:12px;color:#dc2626;margin-bottom:4px">🚫 <strong>Blocker:</strong> ${f2.blocker.trim().replace(/</g,"&lt;")}</div>`
        if (f2.necesito?.trim()) focosHtml += `<div style="font-size:12px;color:#d97706;margin-bottom:4px">🤝 <strong>Necesito:</strong> ${f2.necesito.trim().replace(/</g,"&lt;")}</div>`
      })
      focosHtml += `</div>`
    })
  }

  let compsHtml = ""
  const comps = (wd?.compromisos||[]).filter(c => c.que?.trim())
  if (comps.length) {
    compsHtml = comps.map((c) => {
      const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha"
      return `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #eee;font-size:12px">
        <span style="color:${c.status==="done"?"#16a34a":"#999"}">${c.status==="done"?"✅":"⬜"}</span>
        <span style="flex:1;${c.status==="done"?"text-decoration:line-through;color:#999":""}">${(c.que||"").replace(/</g,"&lt;")}</span>
        <span style="color:#666">${shortName(c.quien)||""}</span>
        <span style="color:#999">${fecha}</span>
      </div>`
    }).join("")
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Minuta Weekly ${dateStr}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1a1a1a; background: #fff; padding: 32px 40px; max-width: 760px; margin: 0 auto; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; color: #333; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #eee; }
  .meta { font-size: 12px; color: #666; margin-bottom: 24px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: #e5e5e5; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .kpi { background: #fff; padding: 14px; }
  .kpi-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .kpi-val { font-family: "Courier New", monospace; font-size: 26px; font-weight: 800; line-height: 1; }
  .kpi-sub { font-size: 10px; color: #888; margin-top: 4px; }
  .kpi-mes { font-size: 10px; color: #444; margin-top: 4px; border-top: 1px solid #f0f0f0; padding-top: 4px; }
  .pipeline { background: #f8f8f8; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #444; display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  @media print {
    body { padding: 20px; }
    @page { margin: 1.5cm; size: A4; }
    h2 { break-after: avoid; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print" style="background:#1d1d1f;color:#fff;padding:12px 20px;margin:-32px -40px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px">
    <span style="font-size:13px">📄 Para guardar como PDF: <strong>Ctrl+P</strong> (Windows) · <strong>⌘+P</strong> (Mac) → Guardar como PDF</span>
    <button onclick="window.close()" style="background:transparent;border:1px solid #555;color:#ccc;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px">✕ Cerrar</button>
  </div>

  <h1>⚡ Minuta Weekly · Mkt Corp</h1>
  <div class="meta">📅 ${dateLabel} · Grupo UPAX</div>

  <h2>📊 Generacion de Demanda${f.semana_desde ? ` · ${f.semana_desde}${f.semana_hasta?" al "+f.semana_hasta:""}` : ""}</h2>
  <div class="kpi-grid">
    ${[
      {l:"Leads",cur:s.leads||0,prev:a.leads||0,mes:mes.leads||0,c:"#0a84ff"},
      {l:"MQLs",cur:s.mqls||0,prev:a.mqls||0,mes:mes.mqls||0,c:"#af52de"},
      {l:"SQLs",cur:s.sqls||0,prev:a.sqls||0,mes:mes.sqls||0,c:"#34c759"},
      {l:"Opps",cur:s.opps||0,prev:a.opps||0,mes:mes.opps||0,c:"#ff9f0a"},
    ].map(m => `<div class="kpi">
      <div class="kpi-label">${m.l}</div>
      <div class="kpi-val" style="color:${m.c}">${fmtN(m.cur)}</div>
      <div class="kpi-sub">${pct(m.cur,m.prev)} vs sem. ant.</div>
      ${m.mes ? `<div class="kpi-mes">${fmtN(m.mes)} acum. mes</div>` : ""}
    </div>`).join("")}
  </div>
  ${pTotal > 0 ? `<div class="pipeline">🏦 Pipeline: <strong>${fmtM(pTotal)}</strong> · Mkt ${fmtM(s.pipeline_mkt||0)} · Com ${fmtM(s.pipeline_com||0)}</div>` : ""}

  ${focosHtml ? `<h2>🎯 Focos por Squad</h2>${focosHtml}` : ""}

  ${compsHtml ? `<h2>📝 Compromisos</h2>${compsHtml}` : ""}

  <div style="margin-top:28px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px;font-family:monospace">
    Weekly Mkt Corp Upax · generado ${new Date().toLocaleString("es-MX")}
  </div>
</body>
</html>`
}

/**
 * downloadPdfHtml — Descarga el HTML como archivo para imprimir como PDF
 */
export function downloadPdfHtml(dateStr, wd, gddData) {
  const html = generatePdfHtml(dateStr, wd, gddData)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const dlUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = dlUrl
  anchor.download = "minuta-weekly.html"
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(dlUrl)
}

/**
 * sendMinutaToSlack — Envia texto de minuta a Slack via API route
 * @returns {boolean} true si se envio correctamente
 */
export async function sendMinutaToSlack(text) {
  try {
    const res = await fetch("/api/slack", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    })
    const d = await res.json()
    return d.success === true
  } catch {
    return false
  }
}
