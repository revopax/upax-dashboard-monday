'use client'
import React, { useState, useEffect } from 'react'
// components/TabHome.jsx — Tab Home + CargaRow + OverdueSection
import { PERSONAS, SQUADS, TODAY } from '../lib/constants'
import { WEEK, PREV_WEEK, parseTL, daysDiff, shortName, normalizeSquad, isActive, getPersonDetail } from '../lib/utils'
import { Chip, Card, PersonDetailView } from './ui'

export function OverdueSection({ overdue }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? overdue : overdue.slice(0, 5);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: 1 }}>Vencidos · {overdue.length}</div>
        {overdue.length > 5 && (
          <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 10, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            {showAll ? "Ver menos ↑" : `+${overdue.length - 5} más ↓`}
          </button>
        )}
      </div>
      {visible.map((it) => {
        const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
        const d = tl.end ? daysDiff(TODAY, tl.end) : 0;
        const sq = SQUADS.find(s => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
        return (
          <div key={it.id} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 0", fontSize: 11 }}>
            <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, minWidth: 30 }}>-{d}d</span>
            {sq && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sq.color, flexShrink: 0 }} />}
            <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
            <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
          </div>
        );
      })}
    </div>
  );
}

// CargaRow — fuera de TabHome para evitar re-creación en cada render (P3.8)
export const CargaRow = React.memo(function CargaRow({ person, d, rank, maxVal, onClick, isExpanded, items }) {
  const pct = maxVal > 0 ? d.total / maxVal : 0;
  const barColor = d.total > 20 ? "var(--red)" : d.total > 10 ? "var(--yellow)" : "var(--green)";
  const sq = PERSONAS.find((p) => p.name === person);
  const squadData = SQUADS.find((s) => s.name === sq?.squad);
  const squadColor = squadData?.color || "var(--tx3)";
  const projects = d.projects || 0;
  const tasks = d.tasks || 0;
  const squadShort = squadData?.name?.split(" ")[0] || "";
  return (
    <div onClick={onClick} style={{ cursor: "pointer", borderBottom: "1px solid var(--bg3)", transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)", minWidth: 16, textAlign: "right", flexShrink: 0 }}>{rank}</span>
        <span title={squadData?.name} style={{ width: 8, height: 8, borderRadius: "50%", background: squadColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName(person)}</span>
        <span className="mobile-hide" style={{ fontSize: 10, color: squadColor, fontWeight: 600, background: squadColor + "15", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{squadShort}</span>
        {d.stopped > 0 && <span style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, flexShrink: 0 }}>{d.stopped}🚫</span>}
        <div title={`${d.total} de ${maxVal} (máximo del equipo)`} style={{ width: 60, height: 4, background: "var(--bg4)", borderRadius: 3, overflow: "hidden", flexShrink: 0, cursor: "help" }}>
          <div style={{ width: Math.min(pct * 100, 100) + "%", height: "100%", background: barColor, borderRadius: 3, transition: "width .4s ease" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 60 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 800, color: barColor, lineHeight: 1 }}>{d.total}</span>
          {(projects > 0 || tasks > 0) && (
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {projects > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--blue)", background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>{projects}P</span>}
              {tasks > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--purple)", background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>{tasks}T</span>}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--tx3)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>▾</span>
      </div>
      {isExpanded && <PersonDetailView detail={getPersonDetail(person, items)} />}
    </div>
  );
});

// MqlChannelList — subcomponente con "ver más" para la lista de canales MQL
function MqlChannelList({ channels, maxCount, showMax, needsMore, compact }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? channels : channels.slice(0, showMax);
  const channelColors = ["var(--blue)", "var(--purple)", "var(--green)", "var(--yellow)", "var(--red)", "#FF6B6B", "#4ECDC4", "#45B7D1"];
  const padding = compact ? "3px 0" : "5px 0";
  const fontSize = compact ? 11 : 12;
  const barHeight = compact ? 10 : 14;
  return (
    <div>
      {visible.map((ch, i) => (
        <div key={ch.origen} style={{ display: "flex", alignItems: "center", gap: 8, padding, borderBottom: i < visible.length - 1 ? "1px solid var(--bg3)" : "none" }}>
          <span style={{ fontSize, color: "var(--tx2)", flex: "0 0 100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.origen}</span>
          <div style={{ flex: 1, height: barHeight, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: Math.max((ch.count / maxCount) * 100, 4) + "%", height: "100%", background: channelColors[i % channelColors.length], borderRadius: 4, transition: "width .4s ease" }} />
          </div>
          <span style={{ fontFamily: "var(--mono)", fontSize: fontSize + 1, fontWeight: 700, color: "var(--tx)", minWidth: 28, textAlign: "right" }}>{ch.count}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--tx3)", minWidth: 32, textAlign: "right" }}>{ch.pct}%</span>
        </div>
      ))}
      {needsMore && (
        <button onClick={() => setShowAll(!showAll)} style={{ fontSize: 10, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginTop: 6, padding: 0 }}>
          {showAll ? "Ver menos ↑" : `+${channels.length - showMax} más ↓`}
        </button>
      )}
    </div>
  );
}

// Helper: format date string to short Spanish
const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? s : d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

const TabHome = React.memo(function TabHome({ analysis: an, items, elapsed, onStart, onViewAlerts, gddData: propGddData, mqlBreakdown, mqlBreakdownPrev, gddTargets, gddHistory, setGddHistory, gddLoading }) {
  const [alertGroupsExpanded, setAlertGroupsExpanded] = useState({});
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [cargaSquad, setCargaSquad] = useState("all");
  const [showAllCarga, setShowAllCarga] = useState(false);
  const [mqlWeekIdx, setMqlWeekIdx] = useState(-1); // -1 = semana actual
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedWeek, setExpandedWeek] = useState(null);
  // On Mondays (weekly meeting day), default to showing last week's data
  const [gddWeekView, setGddWeekView] = useState("current");
  useEffect(() => { if (new Date().getDay() === 1) setGddWeekView("prev"); }, []);

  const gddData = propGddData;

  if (!an) return null;
  const activeCount = (an.byPhase["🚧 Sprint"] || 0) + (an.byPhase["👀 Review"] || 0) + (an.byPhase["⚙️ Modificación"] || 0);
  const activeWeek = (an.byPhaseWeek["🚧 Sprint"] || 0) + (an.byPhaseWeek["👀 Review"] || 0) + (an.byPhaseWeek["⚙️ Modificación"] || 0);
  const TEAM_NAMES = new Set(PERSONAS.map((p) => p.name));
  const sortedPeople = Object.entries(an.byPersonWeek).filter(([name]) => TEAM_NAMES.has(name) && !PERSONAS.find((p) => p.name === name)?.sdr).sort((a, b) => b[1].total - a[1].total);
  const stoppedSquads = SQUADS.filter((sq) => an.bySquad[sq.name]?.phases["🚫 Detenido"] > 0);
  const overdueCritical = (an.overdue || []).filter((it) => { const tl = parseTL(it.column_values?.timerange_mkzcqv0j); return tl.end && daysDiff(TODAY, tl.end) > 7; }).length;

  // Derive MQL data based on selected week + gddWeekView sync
  const mqlData = (() => {
    if (mqlWeekIdx === -1) {
      // Sync with GdD week toggle: prev week uses mqlBreakdownPrev
      return gddWeekView === "prev" ? (mqlBreakdownPrev || mqlBreakdown) : mqlBreakdown;
    }
    const entry = gddHistory?.[mqlWeekIdx];
    if (!entry || !entry.por_origen || entry.por_origen.length === 0) return null;
    return {
      total: entry.por_origen.reduce((sum, o) => sum + o.count, 0),
      por_origen: entry.por_origen,
      breakdown_macro: entry.breakdown_macro || { inbound: 0, outbound: 0, unknown: 0 },
    };
  })();

  // Weeks with por_origen data for the selector
  const weeksWithBreakdown = (gddHistory || [])
    .map((w, i) => ({ ...w, _idx: i }))
    .filter(w => Array.isArray(w.por_origen) && w.por_origen.length > 0);

  return (
    <div className="fade">

      {/* Semaphore */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 12, borderRadius: "var(--r)", background: (an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.08)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.08)" : "rgba(52,199,89,.08)", border: `1px solid ${(an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.2)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.2)" : "rgba(52,199,89,.2)"}` }}>
        <span style={{ fontSize: 24 }}>{(an.semaphore || "yellow") === "red" ? "🔴" : (an.semaphore || "yellow") === "yellow" ? "🟡" : "🟢"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: (an.semaphore || "yellow") === "red" ? "var(--red)" : (an.semaphore || "yellow") === "yellow" ? "var(--yellow)" : "var(--green)" }}>
            {(an.semaphore || "yellow") === "red" ? "Temas urgentes que revisar" : (an.semaphore || "yellow") === "yellow" ? "Atención en algunos puntos" : "En control"}
          </div>
          <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 2 }}>{activeWeek} en sprint esta semana · {(an.velocity || {}).done || 0} completados sem. anterior · {(an.velocity || {}).overdue || 0} vencidos</div>
        </div>
      </div>

      {/* Alertas compactas */}
      {(() => {
        const alertGroups = [
          { items: [...(an.overdue || [])].sort((a, b) => (parseTL(a.column_values?.timerange_mkzcqv0j).end || TODAY) - (parseTL(b.column_values?.timerange_mkzcqv0j).end || TODAY)), icon: "🔴", label: "Vencidos", color: "var(--red)", extra: (it) => { const d = parseTL(it.column_values?.timerange_mkzcqv0j).end ? daysDiff(TODAY, parseTL(it.column_values?.timerange_mkzcqv0j).end) : 0; return <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, fontSize: 10, minWidth: 28 }}>-{d}d</span>; } },
          { items: an.stoppedWeek || [], icon: "🚫", label: "Detenidos", color: "var(--red)" },
          { items: an.noCrono || [], icon: "📅", label: "Sin Fecha", color: "var(--yellow)" },
          { items: an.backlogWithDates || [], icon: "⚠️", label: "Backlog c/fecha", color: "var(--yellow)" },
        ].filter((g) => g.items.length > 0);
        if (alertGroups.length === 0) return <Card style={{ textAlign: "center", padding: 24, marginBottom: 12 }}><div style={{ fontSize: 28, marginBottom: 4 }}>✅</div><div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600 }}>Sin alertas críticas</div></Card>;
        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>⚡ Alertas Ejecutivas</span>
              <button onClick={onViewAlerts} style={{ background: "var(--bg3)", color: "var(--blue)", border: "none", borderRadius: "var(--r-sm)", padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Ver las {alertGroups.reduce((s, g) => s + g.items.length, 0)} alertas →</button>
            </div>
            {alertGroups.map((g, gi) => (
              <div key={gi} style={{ marginBottom: gi < alertGroups.length - 1 ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12 }}>{g.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: g.color }}>{g.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 700, color: g.color }}>{g.items.length}</span>
                </div>
                {(alertGroupsExpanded[(["overdue","stopped","noCrono","backlog","noResp"][gi] || gi)] ? g.items : g.items.slice(0, 4)).map((it) => {
                  const sq = SQUADS.find((s) => s.name === normalizeSquad(it.column_values?.color_mkz0s203));
                  // For overdue items, color dot by severity (days overdue) instead of squad
                  const overdueEnd = parseTL(it.column_values?.timerange_mkzcqv0j).end;
                  const overdueDays = overdueEnd ? daysDiff(TODAY, overdueEnd) : 0;
                  const dotBg = g.label === "Vencidos"
                    ? (overdueDays >= 14 ? "var(--red)" : overdueDays >= 7 ? "var(--orange)" : overdueDays >= 3 ? "var(--yellow)" : "var(--tx3)")
                    : (sq?.color || "var(--tx3)");
                  return (
                    <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "3px 0 3px 20px", fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotBg, flexShrink: 0 }} />
                      {g.extra && g.extra(it)}
                      <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                      <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
                    </div>
                  );
                })}
                {g.items.length > 4 && <div style={{ fontSize: 10, color: "var(--tx3)", paddingLeft: 20, marginTop: 2 }}>+{g.items.length - 4} más</div>}
              </div>
            ))}
          </Card>
        );
      })()}

      {/* GdD boxes — KPIs de generación de demanda */}
      {(() => {
        if (gddLoading && !gddData) {
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>📊 Generación de Demanda</div>
              <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "12px 14px", height: 100, animation: "pulse 1.5s ease-in-out infinite", opacity: 0.5 }} />
                ))}
              </div>
            </div>
          );
        }
        const raw = gddData || { semana: {}, anterior: {}, ytd: {} };
        // When viewing prev week, swap semana/anterior so the KPIs show last week
        const showingPrev = gddWeekView === "prev";
        const d = showingPrev
          ? { ...raw, semana: raw.anterior, anterior: raw.semana }
          : raw;
        const metrics = ["leads", "mqls", "sqls", "opps"];
        const labels = { leads: "Leads", mqls: "MQLs", sqls: "SQLs", opps: "Opps" };
        const colors = { leads: "var(--blue)", mqls: "var(--purple)", sqls: "var(--green)", opps: "var(--yellow)" };
        const icons = { leads: "👤", mqls: "⭐", sqls: "🎯", opps: "💼" };
        const pctChange = (cur, prev) => (!prev || prev === 0) ? null : Math.round(((cur - prev) / prev) * 100);

        // Source badge
        const sourceBadge = (() => {
          const src = gddData?.source;
          if (src === "hubspot_live") return <span style={{ background: "rgba(52,199,89,.12)", border: "1px solid #34C759", color: "#34C759", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", marginLeft: 6 }}>● LIVE</span>;
          if (src === "hubspot_partial") return <span style={{ background: "rgba(255,159,10,.12)", border: "1px solid var(--yellow)", color: "var(--yellow)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", marginLeft: 6 }}>PARCIAL</span>;

          if (gddLoading && !src) return null;
          if (src === "empty" || !src) return <span style={{ fontSize: 9, color: "var(--red)", marginLeft: 6 }}>sin datos</span>;
          return null;
        })();

        // Week date label — show correct range based on toggle
        const weekLabel = (() => {
          if (!gddData?.fechas?.semana_desde) return null;
          if (showingPrev) {
            // Calculate prev week dates from semana_desde
            const desde = new Date(gddData.fechas.semana_desde + "T12:00:00");
            const prevDesde = new Date(desde); prevDesde.setDate(desde.getDate() - 7);
            const prevHasta = new Date(desde); prevHasta.setDate(desde.getDate() - 1);
            return `${fmtDate(prevDesde.toISOString().slice(0,10))} – ${fmtDate(prevHasta.toISOString().slice(0,10))}`;
          }
          return `${fmtDate(gddData.fechas.semana_desde)}${gddData.fechas.semana_hasta ? " – " + fmtDate(gddData.fechas.semana_hasta) : ""}`;
        })();

        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📊 Generación de Demanda{sourceBadge}
                {weekLabel && <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--tx3)", fontSize: 11 }}>{weekLabel}</span>}
              </span>
              <div style={{ display: "flex", gap: 0, border: "1px solid var(--bg4)", borderRadius: 6, overflow: "hidden" }}>
                <button onClick={() => setGddWeekView("prev")} style={{ fontSize: 10, padding: "3px 8px", background: showingPrev ? "var(--blue)" : "var(--bg2)", color: showingPrev ? "#fff" : "var(--tx3)", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Sem. anterior</button>
                <button onClick={() => setGddWeekView("current")} style={{ fontSize: 10, padding: "3px 8px", background: !showingPrev ? "var(--blue)" : "var(--bg2)", color: !showingPrev ? "#fff" : "var(--tx3)", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Esta semana</button>
              </div>
            </div>
            <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 4 }}>
              {metrics.map((m) => {
                const rawCur = d.semana?.[m];
                const isNoData = rawCur === null || rawCur === undefined;
                const cur = rawCur || 0;
                const prev = d.anterior?.[m] || 0;
                const pct = pctChange(cur, prev);
                const col = colors[m];
                const mesVal = (gddData?.mes || {})[m] || 0;
                return (
                  <div key={m} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "12px 14px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: isNoData ? "var(--bg4)" : (pct !== null && pct < 0) ? "var(--red)" : (pct !== null && pct >= 0) ? "var(--green)" : col }} />
                    <div style={{ position: "absolute", top: 8, right: 10, fontSize: 18, opacity: 0.06 }}>{icons[m]}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{labels[m]}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 32, fontWeight: 800, color: isNoData ? "var(--tx3)" : "var(--tx)", opacity: isNoData ? 0.4 : 1, lineHeight: 1, letterSpacing: "-0.04em" }}>{cur.toLocaleString()}</div>
                    {d.semana?.[`${m}_mkt`] != null && d.semana?.[`${m}_com`] != null && (
                      <div style={{ fontSize: 10, marginTop: 3, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
                        <span style={{ color: "var(--blue)" }}>Mkt:{d.semana[`${m}_mkt`]}</span>{" | "}
                        <span style={{ color: "var(--purple)" }}>Com:{d.semana[`${m}_com`]}</span>
                      </div>
                    )}
                    {isNoData && <div style={{ fontSize: 9, color: "var(--tx3)", marginTop: 2, fontStyle: "italic" }}>sin datos</div>}
                    {pct !== null && !showingPrev && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? "var(--green)" : "var(--red)" }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%</span>
                        <span style={{ fontSize: 10, color: "var(--tx3)" }}>vs sem. ant.</span>
                      </div>
                    )}
                    {mesVal > 0 && (
                      <div style={{ marginTop: 5, paddingTop: 4, borderTop: "1px solid var(--bg4)", fontSize: 10, color: "var(--tx3)" }}>
                        <span style={{ color: "var(--tx2)", fontWeight: 700, fontFamily: "var(--mono)" }}>{mesVal.toLocaleString()}</span> acum. mes
                      </div>
                    )}
                    {(() => {
                      const target = gddTargets?.targets?.[m] || 0;
                      if (target <= 0) return null;
                      const pctTarget = Math.min((mesVal / target) * 100, 100);
                      const targetColor = pctTarget >= 90 ? "var(--green)" : pctTarget >= 60 ? "var(--yellow)" : "var(--red)";
                      return (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ height: 2, background: "var(--bg4)", borderRadius: 1, overflow: "hidden" }}>
                            <div style={{ width: pctTarget + "%", height: "100%", background: targetColor, borderRadius: 1, transition: "width .4s ease" }} />
                          </div>
                          <div style={{ fontSize: 9, color: "var(--tx3)", marginTop: 2, fontFamily: "var(--mono)" }}>
                            {mesVal}/{target} meta mes
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            {(() => {
              const pt = d.semana?.pipeline_total || 0;
              const pm = d.semana?.pipeline_mkt || 0;
              const pc = d.semana?.pipeline_com || 0;
              if (pt <= 0) return null;
              const fmtM = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", marginTop: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>🏦</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx2)" }}>Pipeline</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: "var(--tx)" }}>{fmtM(pt)}</span>
                  <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "var(--mono)" }}>
                    <span style={{ color: "var(--blue)" }}>Mkt {fmtM(pm)}</span>{" | "}
                    <span style={{ color: "var(--purple)" }}>Com {fmtM(pc)}</span>
                  </span>
                </div>
              );
            })()}
            {(() => {
              const ytd = gddData?.ytd || {};
              const sem = d.semana || {};
              const rates = [
                { label: "Lead→MQL", from: sem.leads ?? ytd.leads, to: sem.mqls ?? ytd.mqls },
                { label: "MQL→SQL", from: sem.mqls ?? ytd.mqls, to: sem.sqls ?? ytd.sqls },
                { label: "SQL→OPP", from: sem.sqls ?? ytd.sqls, to: sem.opps ?? ytd.opps },
              ].map(r => ({ ...r, pct: r.from > 0 ? ((r.to / r.from) * 100).toFixed(1) : null, warn: r.from > 0 && r.to > r.from }));
              if (rates.every(r => r.pct === null)) return null;
              return (
                <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "8px 0 4px", fontSize: 11, fontFamily: "var(--mono)", color: "var(--tx3)" }}>
                  {rates.filter(r => r.pct !== null).map(r => (
                    <span key={r.label}>{r.label}: <span style={{ fontWeight: 700, color: r.warn ? "var(--yellow)" : "var(--tx2)" }}>{r.pct}%{r.warn ? " ⚠" : ""}</span></span>
                  ))}
                </div>
              );
            })()}
            {gddData?.lastUpdate && <div style={{ fontSize: 10, color: "var(--tx3)", textAlign: "right" }}>Actualizado: {gddData.lastUpdate}</div>}
          </div>
        );
      })()}

      {/* MQLs por Canal — con selector de semana */}
      {(() => {
        if (gddLoading) {
          return (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>📊 MQLs por Canal</div>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ height: 28, background: "var(--bg3)", borderRadius: 6, marginBottom: 6, animation: "pulse 1.5s ease-in-out infinite", opacity: 0.5 }} />
              ))}
            </Card>
          );
        }
        if (!mqlData || !mqlData.por_origen || mqlData.por_origen.length === 0) return null;
        const { total, por_origen, breakdown_macro } = mqlData;
        const inb = breakdown_macro?.inbound || 0;
        const outb = breakdown_macro?.outbound || 0;
        const unk = breakdown_macro?.unknown || 0;
        const macroTotal = inb + outb + unk || 1;
        const maxCount = por_origen[0]?.count || 1;
        const showMax = 8;
        const needsMore = por_origen.length > showMax;

        // Selected week label
        const selectedLabel = mqlWeekIdx === -1
          ? "Semana actual"
          : `${fmtDate(gddHistory[mqlWeekIdx]?.semana_desde)} – ${fmtDate(gddHistory[mqlWeekIdx]?.semana_hasta || gddHistory[mqlWeekIdx]?.semana_desde)}`;

        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                📊 MQLs por Canal
                {mqlWeekIdx === -1 && gddWeekView === "prev" && !mqlBreakdownPrev && mqlBreakdown && (
                  <span style={{ fontSize: 9, color: "var(--yellow)", fontWeight: 600, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>(datos sem. actual)</span>
                )}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Week selector */}
                {weeksWithBreakdown.length > 0 && (
                  <select
                    value={mqlWeekIdx}
                    onChange={e => setMqlWeekIdx(Number(e.target.value))}
                    style={{ fontSize: 10, padding: "3px 6px", borderRadius: 4, border: "1px solid var(--bg4)", background: "var(--bg2)", color: "var(--tx2)", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <option value={-1}>Semana actual</option>
                    {weeksWithBreakdown.map(w => (
                      <option key={w._idx} value={w._idx}>
                        {fmtDate(w.semana_desde)} – {fmtDate(w.semana_hasta || w.semana_desde)}
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 800, color: "var(--purple)" }}>{total}</span>
              </div>
            </div>
            {/* Barra macro Inbound / Outbound */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", height: 22, borderRadius: 6, overflow: "hidden", background: "var(--bg3)" }}>
                {inb > 0 && (
                  <div style={{ width: (inb / macroTotal * 100) + "%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{inb} Inbound</span>
                  </div>
                )}
                {outb > 0 && (
                  <div style={{ width: (outb / macroTotal * 100) + "%", background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{outb} Outbound</span>
                  </div>
                )}
                {unk > 0 && (
                  <div style={{ width: (unk / macroTotal * 100) + "%", background: "var(--tx3)", display: "flex", alignItems: "center", justifyContent: "center", transition: "width .4s ease" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>{unk}</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--tx3)" }}>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--green)", marginRight: 4, verticalAlign: "middle" }} />Inbound {Math.round(inb / macroTotal * 100)}%</span>
                <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--blue)", marginRight: 4, verticalAlign: "middle" }} />Outbound {Math.round(outb / macroTotal * 100)}%</span>
              </div>
            </div>
            {/* Lista de canales */}
            <MqlChannelList channels={por_origen} maxCount={maxCount} showMax={showMax} needsMore={needsMore} />
          </Card>
        );
      })()}

      {/* Tendencia Semanal GDD — agrupado por mes */}
      {(() => {
        if (gddLoading || !gddHistory || gddHistory.length === 0) return null;
        const metrics = ["leads", "mqls", "sqls", "opps"];
        const labels = { leads: "Leads", mqls: "MQLs", sqls: "SQLs", opps: "Opps" };
        const arrow = (cur, prev) => {
          if (prev === undefined || prev === null) return null;
          if (cur > prev) return { symbol: "▲", color: "var(--green)" };
          if (cur < prev) return { symbol: "▼", color: "var(--red)" };
          return { symbol: "–", color: "var(--tx3)" };
        };

        const byMonth = {};
        gddHistory.forEach((w, i) => {
          const key = (w.semana_desde || w.id || "").slice(0, 7);
          if (!key || key.length < 7) return;
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push({ ...w, _globalIdx: i });
        });
        const monthKeys = Object.keys(byMonth).sort().reverse();

        const monthLabelFn = (mKey) => {
          const d = new Date(mKey + "-15T12:00:00");
          const s = d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
          return s.charAt(0).toUpperCase() + s.slice(1);
        };

        const calcTotals = (weeks) => weeks.reduce((acc, w) => ({
          leads: acc.leads + (w.leads || 0),
          mqls: acc.mqls + (w.mqls || 0),
          sqls: acc.sqls + (w.sqls || 0),
          opps: acc.opps + (w.opps || 0),
        }), { leads: 0, mqls: 0, sqls: 0, opps: 0 });

        const globalTotals = calcTotals(gddHistory);

        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              📈 Tendencia Semanal
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--mono)" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 10, color: "var(--tx3)", fontWeight: 700, borderBottom: "1px solid var(--bg4)" }}>Semana</th>
                    {metrics.map(m => (
                      <th key={m} style={{ textAlign: "right", padding: "6px 8px", fontSize: 10, color: "var(--tx3)", fontWeight: 700, borderBottom: "1px solid var(--bg4)" }}>{labels[m]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthKeys.map((mKey, mi) => {
                    const weeks = byMonth[mKey];
                    const isMonthExpanded = mi === 0 || expandedMonth === mKey;
                    const mTotals = calcTotals(weeks);

                    return (
                      <React.Fragment key={mKey}>
                        <tr
                          onClick={() => { setExpandedMonth(isMonthExpanded && mi !== 0 ? null : mKey); setExpandedWeek(null); }}
                          style={{ cursor: "pointer", background: "var(--bg2)" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                          onMouseLeave={e => e.currentTarget.style.background = "var(--bg2)"}
                        >
                          <td style={{ padding: "8px 8px", fontSize: 12, fontWeight: 700, color: "var(--tx)", borderBottom: "1px solid var(--bg4)" }}>
                            <span style={{ fontSize: 9, marginRight: 6, color: "var(--tx3)", display: "inline-block", transform: isMonthExpanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>
                            {monthLabelFn(mKey)}
                            <span style={{ fontSize: 10, fontWeight: 400, color: "var(--tx3)", marginLeft: 6 }}>{weeks.length} sem.</span>
                          </td>
                          {metrics.map(m => (
                            <td key={m} style={{ textAlign: "right", padding: "8px 8px", fontSize: 11, fontWeight: 700, color: isMonthExpanded ? "var(--tx3)" : "var(--tx2)", borderBottom: "1px solid var(--bg4)" }}>
                              {mTotals[m].toLocaleString()}
                            </td>
                          ))}
                        </tr>
                        {isMonthExpanded && weeks.map((w, wi) => {
                          const isFirst = w.semana_desde === gddData?.fechas?.semana_desde;
                          const prev = weeks[wi + 1];
                          const weekKey = w.id || w._globalIdx;
                          const isWeekExpanded = expandedWeek === weekKey;
                          const hasPorOrigen = Array.isArray(w.por_origen) && w.por_origen.length > 0;
                          return (
                            <React.Fragment key={weekKey}>
                              <tr
                                onClick={() => hasPorOrigen && setExpandedWeek(isWeekExpanded ? null : weekKey)}
                                style={{
                                  background: isFirst ? "rgba(0,122,255,.06)" : "transparent",
                                  cursor: hasPorOrigen ? "pointer" : "default",
                                  transition: "background .15s",
                                }}
                                onMouseEnter={e => { if (hasPorOrigen && !isFirst) e.currentTarget.style.background = "var(--bg3)" }}
                                onMouseLeave={e => { if (!isFirst) e.currentTarget.style.background = "transparent" }}
                              >
                                <td style={{ padding: "6px 8px 6px 24px", fontSize: 11, color: isFirst ? "var(--blue)" : "var(--tx2)", fontWeight: isFirst ? 700 : 400, borderBottom: isWeekExpanded ? "none" : "1px solid var(--bg4)", whiteSpace: "nowrap" }}>
                                  {hasPorOrigen && <span style={{ fontSize: 8, marginRight: 4, color: "var(--tx3)", display: "inline-block", transform: isWeekExpanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▶</span>}
                                  {fmtDate(w.semana_desde)}
                                  {isFirst && <span style={{ fontSize: 9, marginLeft: 4, color: "var(--blue)", fontWeight: 700 }}>actual</span>}
                                </td>
                                {metrics.map(m => {
                                  const val = w[m] || 0;
                                  const a = prev ? arrow(val, prev[m] || 0) : null;
                                  return (
                                    <td key={m} style={{ textAlign: "right", padding: "6px 8px", borderBottom: isWeekExpanded ? "none" : "1px solid var(--bg4)", fontWeight: isFirst ? 700 : 400, color: isFirst ? "var(--tx)" : "var(--tx2)" }}>
                                      {val.toLocaleString()}
                                      {a && <span style={{ fontSize: 9, marginLeft: 3, color: a.color, fontWeight: 700 }}>{a.symbol}</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                              {isWeekExpanded && hasPorOrigen && (
                                <tr>
                                  <td colSpan={5} style={{ padding: "0 8px 8px 24px", borderBottom: "1px solid var(--bg4)" }}>
                                    <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 10, color: "var(--tx3)" }}>
                                      {w.breakdown_macro && (
                                        <>
                                          <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: "var(--green)", marginRight: 3, verticalAlign: "middle" }} />Inbound: {w.breakdown_macro.inbound || 0}</span>
                                          <span><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 2, background: "var(--blue)", marginRight: 3, verticalAlign: "middle" }} />Outbound: {w.breakdown_macro.outbound || 0}</span>
                                        </>
                                      )}
                                    </div>
                                    <MqlChannelList
                                      channels={w.por_origen}
                                      maxCount={w.por_origen[0]?.count || 1}
                                      showMax={5}
                                      needsMore={w.por_origen.length > 5}
                                      compact
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  <tr style={{ background: "var(--bg2)", borderTop: "2px solid var(--bg4)" }}>
                    <td style={{ padding: "10px 8px", fontSize: 12, fontWeight: 800, color: "var(--tx)" }}>Total</td>
                    {metrics.map(m => (
                      <td key={m} style={{ textAlign: "right", padding: "10px 8px", fontSize: 13, fontWeight: 800, color: "var(--tx)" }}>
                        {globalTotals[m].toLocaleString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Separador — diferenciado de Panorama */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 4 }}>
        <div style={{ flex: 1, height: 1, background: "var(--bg4)" }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>Estado del sprint</span>
        <button onClick={onViewAlerts} style={{ fontSize: 9, color: "var(--blue)", background: "none", border: "1px solid var(--blue)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>Ver detalle completo →</button>
        <div style={{ flex: 1, height: 1, background: "var(--bg4)" }} />
      </div>

      {/* KPIs operativos con comparativos */}
      {(() => {
        const thisMonthStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
        const doneThisMonth = items.filter(it => {
          const fer = it.column_values?.date_mkzchmsq;
          if (!fer || it.column_values?.color_mkz09na !== "✅ Done") return false;
          const d = new Date(fer);
          return d >= thisMonthStart && d <= TODAY;
        }).length;

        const overdueCount = (an.overdue || []).length;
        const detCount = an.byPhase["🚫 Detenido"] || 0;
        const doneCount = (an.doneLastWeek || []).length;

        const KPIop = (label, val, color, line1, line2, icon) => (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: "var(--r)", padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color }} />
            <div style={{ position: "absolute", top: 8, right: 12, fontSize: 18, opacity: 0.07 }}>{icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--tx3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.05em", marginBottom: 6 }}>{val}</div>
            <div style={{ paddingTop: 6, borderTop: "1px solid var(--bg4)" }}>
              {line1 && <div style={{ fontSize: 11, color: "var(--tx3)", lineHeight: 1.4 }}>{line1}</div>}
              {line2 && <div style={{ fontSize: 11, color: "var(--tx3)", lineHeight: 1.4, marginTop: 2 }}>{line2}</div>}
            </div>
          </div>
        );

        return (
          <div className="kpi-grid-mobile" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
            {KPIop("Esta semana", activeWeek, "var(--blue)", `${activeCount} activos total`, `${activeCount - activeWeek} fuera de semana`, "⚡")}
            {KPIop("Vencidos", overdueCount, overdueCount > 0 ? "var(--red)" : "var(--green)", overdueCount > 0 ? `${overdueCritical} con más de 7 días` : "Al día ✓", `${(an.backlogWithDates||[]).length} en backlog con fecha`, "⏰")}
            {KPIop("Detenidos", detCount, detCount > 0 ? "var(--yellow)" : "var(--green)", detCount > 0 ? `${(an.stoppedWeek||[]).length} con fecha esta semana` : "Sin bloqueos ✓", `${(an.noResp||[]).length} sin responsable`, "🚫")}
            {KPIop("Done sem.", doneCount, doneCount > 0 ? "var(--green)" : "var(--tx3)", `${PREV_WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})} – ${PREV_WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})}`, `${doneThisMonth} este mes · ${an.doneTotal||0} total`, "✅")}
          </div>
        );
      })()}

      {/* Carga — tabla compacta de todo el equipo */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>👥 Carga del Equipo <span style={{ fontSize: 11, fontWeight: 400, color: "var(--tx3)" }}>{WEEK.start.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – {WEEK.end.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: "var(--tx3)" }}>
            <span style={{ color: "var(--blue)", fontWeight: 700, background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 5px" }}>P</span>
            <span style={{ marginRight: 2 }}>= Proyectos</span>
            <span style={{ color: "var(--purple)", fontWeight: 700, background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 5px" }}>T</span>
            <span>= Tareas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Chip label="Todos" active={cargaSquad === "all"} color="var(--tx2)" onClick={() => setCargaSquad("all")} />
            {SQUADS.map((sq) => <Chip key={sq.id} label={sq.name.split(" ")[0]} active={cargaSquad === sq.id} color={sq.color} onClick={() => setCargaSquad(sq.id)} />)}
          </div>
        </div>
        {(() => {
          const squadFilter = cargaSquad === "all" ? null : SQUADS.find((s) => s.id === cargaSquad);
          const filtered = sortedPeople.filter(([name]) => {
            if (!squadFilter) return true;
            const p = PERSONAS.find((x) => x.name === name);
            return p && p.squad === squadFilter.name;
          });
          const maxVal = filtered.length > 0 ? filtered[0][1].total : 1;
          if (!filtered.length) return <div style={{ textAlign: "center", padding: "16px 0", color: "var(--tx3)", fontSize: 12 }}>Sin tareas esta semana</div>;
          const MAX_CARGA = 5;
          const visiblePeople = showAllCarga ? filtered : filtered.slice(0, MAX_CARGA);
          return (
            <div>
              {visiblePeople.map(([p, d], i) => (
                <CargaRow
                  key={p} person={p} d={d} rank={i + 1} maxVal={maxVal}
                  isExpanded={expandedPerson === p}
                  onClick={() => setExpandedPerson(expandedPerson === p ? null : p)}
                  items={items}
                />
              ))}
              {filtered.length > MAX_CARGA && (
                <button onClick={() => setShowAllCarga(!showAllCarga)}
                  style={{ fontSize: 11, color: "var(--blue)", background: "none", border: "none",
                  cursor: "pointer", fontWeight: 600, marginTop: 8, padding: 0, width: "100%", textAlign: "center" }}>
                  {showAllCarga ? "Ver menos ↑" : `Ver los ${filtered.length} →`}
                </button>
              )}
            </div>
          );
        })()}
        {(an.noCrono || []).length > 0 && <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,.06)", fontSize: 10, color: "var(--yellow)" }}>⚠️ {(an.noCrono || []).length} en Sprint sin Fecha</div>}
      </Card>

    </div>
  );
});

export { TabHome }
