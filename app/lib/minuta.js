'use client'
// lib/minuta.js — generador de texto plano de la minuta
import { TODAY_STR, SQUADS, PERSONAS } from './constants'
import { WEEK, shortName, normalizeSquad, getSprintRoadmap } from './utils'

export function generateMinuta(wd, analysis, gddData, mqlBreakdown, blockTimes, items) {
  const an = analysis, comps = wd?.compromisos || [];
  const dateStr = new Date(TODAY_STR).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const LINE = "─".repeat(48);
  const arrow = (cur, prev) => { if (!prev) return ""; const p = Math.abs(Math.round(((cur-prev)/prev)*100)); return cur >= prev ? `▲${p}%` : `▼${p}%`; };
  const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v||0}`;
  let t = "";

  t += `WEEKLY MKT CORP · ${dateStr.toUpperCase()}\n${LINE}\n\n`;

  // 1. GENERACION DE DEMANDA — dual: anterior + actual
  {
    const gdd = gddData || { semana: {}, anterior: {}, ytd: {}, fechas: {} };
    const s = gdd.semana || {}, a = gdd.anterior || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
    const hasData = s.leads || s.mqls || s.sqls || s.opps || a.leads || a.mqls || a.sqls || a.opps;

    t += `1. GENERACION DE DEMANDA`;
    t += `\n`;

    if (hasData) {
      const fmt4 = (label, val, mktVal, comVal) => {
        let line = `   · ${label.padEnd(8)} ${String(val.toLocaleString()).padStart(6)}`;
        if (mktVal != null && comVal != null) line += `  (Mkt: ${mktVal} | Com: ${comVal})`;
        return line + '\n';
      };

      const fmt4Delta = (label, cur, prev, mktVal, comVal) => {
        const pct = arrow(cur, prev);
        let line = `   · ${label.padEnd(8)} ${String(cur.toLocaleString()).padStart(6)}${pct ? "  "+pct : ""}`;
        if (mktVal != null && comVal != null) line += `  (Mkt: ${mktVal} | Com: ${comVal})`;
        return line + '\n';
      };

      // Calculate prev week date range for label
      const prevDesde = f.semana_desde ? (() => {
        const d = new Date(f.semana_desde + 'T12:00:00');
        d.setDate(d.getDate() - 7);
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      })() : '';
      const prevHasta = f.semana_desde ? (() => {
        const d = new Date(f.semana_desde + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
      })() : '';
      const curDesde = f.semana_desde ? new Date(f.semana_desde + 'T12:00:00').toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : '';
      const curHasta = f.semana_hasta ? new Date(f.semana_hasta + 'T12:00:00').toLocaleDateString("es-MX", { day: "numeric", month: "short" }) : '';

      // Semana anterior (datos cerrados)
      if (a.leads || a.mqls || a.sqls || a.opps) {
        t += `   Semana anterior${prevDesde ? ` (${prevDesde} – ${prevHasta})` : ''}\n`;
        t += fmt4("Leads", a.leads||0, a.leads_mkt, a.leads_com);
        t += fmt4("MQLs",  a.mqls||0,  a.mqls_mkt,  a.mqls_com);
        t += fmt4("SQLs",  a.sqls||0,  a.sqls_mkt,  a.sqls_com);
        t += fmt4("Opps",  a.opps||0,  a.opps_mkt,  a.opps_com);
        const aPipeline = a.pipeline_total || ((a.pipeline_mkt||0) + (a.pipeline_com||0));
        if (aPipeline > 0) t += `   · Pipeline  ${fmtM(aPipeline)}  (Mkt ${fmtM(a.pipeline_mkt||0)} | Com ${fmtM(a.pipeline_com||0)})\n`;
        t += `\n`;
      }

      // Semana actual (con deltas vs anterior)
      t += `   Semana actual${curDesde ? ` (${curDesde} – ${curHasta})` : ''}\n`;
      t += fmt4Delta("Leads", s.leads||0, a.leads||0, s.leads_mkt, s.leads_com);
      t += fmt4Delta("MQLs",  s.mqls||0,  a.mqls||0,  s.mqls_mkt,  s.mqls_com);
      t += fmt4Delta("SQLs",  s.sqls||0,  a.sqls||0,  s.sqls_mkt,  s.sqls_com);
      t += fmt4Delta("Opps",  s.opps||0,  a.opps||0,  s.opps_mkt,  s.opps_com);
      const pTotal = s.pipeline_total || ((s.pipeline_mkt||0) + (s.pipeline_com||0));
      if (pTotal > 0) t += `   · Pipeline  ${fmtM(pTotal)}  (Mkt ${fmtM(s.pipeline_mkt||0)} | Com ${fmtM(s.pipeline_com||0)})\n`;

      if (y.leads) t += `   · YTD: Leads ${y.leads.toLocaleString()} · MQLs ${y.mqls||0} · SQLs ${y.sqls||0} · Opps ${y.opps||0}\n`;
    } else {
      t += `   (sin datos — editar en Home > GdD)\n`;
    }

    // MQLs por canal (semana anterior, datos cerrados)
    if (mqlBreakdown && mqlBreakdown.por_origen && mqlBreakdown.por_origen.length > 0) {
      t += `\n   MQLs por canal (sem anterior · datos cerrados)\n`;
      mqlBreakdown.por_origen.forEach(ch => {
        t += `   · ${ch.origen.padEnd(20)} ${String(ch.count).padStart(3)}   ${String(ch.pct).padStart(2)}%\n`;
      });
    }

    t += `\n`;
  }

  // 2. PANORAMA OPERATIVO
  if (an) {
    const spr = an.byPhase["🚧 Sprint"]||0, rev = an.byPhase["👀 Review"]||0;
    const mod = an.byPhase["⚙️ Modificación"]||0, det = an.byPhase["🚫 Detenido"]||0;
    const ven = (an.overdue||[]).length, done = (an.doneLastWeek||[]).length;
    t += `2. PANORAMA OPERATIVO\n`;
    const actSem = (an.byPhaseWeek?.["🚧 Sprint"]||0)+(an.byPhaseWeek?.["👀 Review"]||0)+(an.byPhaseWeek?.["⚙️ Modificación"]||0);
    t += `   Esta semana: ${actSem}  |  Total activos: ${spr+rev+mod}  |  Detenidos: ${det}  |  Vencidos: ${ven}  |  Done sem.: ${done}\n`;
    SQUADS.forEach(sq => {
      const d = an.bySquad[sq.name]; if (!d) return;
      const act = (d.phases["🚧 Sprint"]||0)+(d.phases["👀 Review"]||0)+(d.phases["⚙️ Modificación"]||0);
      const det2 = d.phases["🚫 Detenido"]||0;
      const ven2 = (an.overdue||[]).filter(it => normalizeSquad(it.column_values?.color_mkz0s203) === sq.name).length;
      if (act > 0 || det2 > 0 || ven2 > 0) {
        t += `   · ${sq.name}: ${act} activos`;
        if (det2) t += `, ${det2} detenido${det2>1?"s":""}`;
        if (ven2) t += `, ${ven2} vencido${ven2>1?"s":""}`;
        t += `\n`;
      }
    });
    t += `\n`;
  }

  // 3. FOCOS POR SQUAD
  const hasEntries = SQUADS.some(sq => {
    const raw = wd?.focos?.[sq.id];
    const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
    return arr.some(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
  });

  if (hasEntries) {
    t += `3. FOCOS POR SQUAD\n`;
    SQUADS.forEach(sq => {
      const raw = wd?.focos?.[sq.id];
      const arr = Array.isArray(raw) ? raw : (raw?.focos||raw?.blocker||raw?.necesito ? [raw] : []);
      const filled = arr.filter(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
      if (!filled.length) return;
      const presenter = wd?.presenters?.[sq.id] || sq.lead;
      t += `\n   ${sq.name.toUpperCase()} (${presenter})\n`;
      filled.forEach(f => {
        if (f.focos?.trim()) {
          const parts = f.focos.split(/\d+\)/).map(s => s.trim()).filter(Boolean);
          if (parts.length > 1) parts.forEach(l => { t += `   · ${l}\n`; });
          else t += `   · ${f.focos.trim()}\n`;
        }
        if (f.blocker?.trim()) {
          t += `   ⚠ BLOCKER: ${f.blocker.trim()}`;
          if (f.blocker_quien) t += ` → ${shortName(f.blocker_quien)}`;
          if (f.blocker_cuando) t += ` (${new Date(f.blocker_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
        if (f.necesito?.trim()) {
          t += `   ✋ NECESITO: ${f.necesito.trim()}`;
          if (f.necesito_quien) t += ` → ${shortName(f.necesito_quien)}`;
          if (f.necesito_cuando) t += ` (${new Date(f.necesito_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})})`;
          t += `\n`;
        }
      });
    });
    t += `\n`;
  }

  // 4. COMPROMISOS
  const openComps = comps.filter(c => c.que?.trim());
  if (openComps.length) {
    t += `4. COMPROMISOS\n`;
    openComps.forEach(c => {
      const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
      const status = c.status === "done" ? "✓" : "○";
      t += `   ${status} ${c.que.trim()} · ${shortName(c.quien)||"sin asignar"} · ${fecha}\n`;
    });
    t += `\n`;
  }

  // 5. CARGA SEMANAL
  if (an) {
    const all = Object.entries(an.byPersonWeek)
      .filter(([name]) => PERSONAS.some(p => p.name === name && !p.sdr))
      .sort((a, b) => b[1].total - a[1].total);
    if (all.length) {
      const maxVal = all[0][1].total || 1;
      t += `5. CARGA SEMANAL (${WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})})\n`;
      const half = Math.ceil(all.length / 2);
      const col1 = all.slice(0, half);
      const col2 = all.slice(half);
      const maxLen = col1.length;
      for (let i = 0; i < maxLen; i++) {
        const [p1, d1] = col1[i] || ["", { total: 0, stopped: 0 }];
        const bar1 = p1 ? "█".repeat(Math.min(Math.round((d1.total/maxVal)*8), 8)) + (d1.total > 10 ? "▸" : " ") : "";
        const flag1 = d1.stopped > 0 ? "🚫" : "  ";
        const left = p1 ? `   ${String(i+1).padStart(2)}. ${shortName(p1).padEnd(14)} ${bar1.padEnd(10)} ${String(d1.total).padStart(2)} ${flag1}` : "";
        const [p2, d2] = col2[i] || ["", { total: 0, stopped: 0 }];
        const bar2 = p2 ? "█".repeat(Math.min(Math.round((d2.total/maxVal)*8), 8)) + (d2.total > 10 ? "▸" : " ") : "";
        const flag2 = d2 ? (d2.stopped > 0 ? "🚫" : "  ") : "";
        const right = p2 ? `  ${String(i+half+1).padStart(2)}. ${shortName(p2).padEnd(14)} ${bar2.padEnd(10)} ${String(d2.total).padStart(2)} ${flag2}` : "";
        t += `${left}${right}\n`;
      }
      t += `\n`;
    }
  }

  // 6. ROADMAP
  const roadmapItems = getSprintRoadmap(items || []);
  if (roadmapItems.length > 0) {
    const monthName = new Date(TODAY_STR + 'T12:00:00').toLocaleDateString("es-MX", { month: "long" }).toUpperCase();
    t += `6. ROADMAP ${monthName}\n`;

    const PHASE_LABELS = { '🚧 Sprint': 'Sprint', '👀 Review': 'Review', '⚙️ Modificación': 'Modificacion' };
    let currentSquad = '';
    roadmapItems.forEach(it => {
      const cv = it.column_values || {};
      const sqName = normalizeSquad(cv.color_mkz0s203 || '');
      if (sqName !== currentSquad) {
        currentSquad = sqName;
        t += `   ${sqName}\n`;
      }
      const deadline = cv.date_mm1b10rx || '';
      const deadlineLabel = deadline ? new Date(deadline + 'T12:00:00').toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : '—';
      const phase = PHASE_LABELS[cv.color_mkz09na] || cv.color_mkz09na || '';
      t += `   ${deadlineLabel} · ${it.name} — ${shortName(cv.person)} · ${phase}\n`;
    });
    t += `\n`;
  }

  t += `${LINE}\nWeekly Mkt Corp · ${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}\n`;
  return t;
}
