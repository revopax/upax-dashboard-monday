'use client'
import React, { useState } from 'react'
// components/TabHome.jsx — Tab Home compositor (sub-componentes en home/)
import { PERSONAS, SQUADS } from '../lib/constants'
import { WEEK, shortName, isActive, getPersonDetail } from '../lib/utils'
import { C, F } from '../lib/tokens'
import { Chip, Card, PersonDetailView, Accordion } from './ui'
import { RoadmapTimeline } from './RoadmapTimeline'
import { GddKpiSection } from './home/GddKpiSection'
import { MqlChannelSection, GddTrendSection } from './home/GddTrendSection'
import { SprintStatusSection } from './home/SprintStatusSection'

// CargaRow — fuera de TabHome para evitar re-creacion en cada render (P3.8)
export const CargaRow = React.memo(function CargaRow({ person, d, rank, maxVal, onClick, isExpanded, items }) {
  const pct = maxVal > 0 ? d.total / maxVal : 0;
  const barColor = d.total > 20 ? C.red : d.total > 10 ? C.yellow : C.green;
  const sq = PERSONAS.find((p) => p.name === person);
  const squadData = SQUADS.find((s) => s.name === sq?.squad);
  const squadColor = squadData?.color || C.tx3;
  const projects = d.projects || 0;
  const tasks = d.tasks || 0;
  const squadShort = squadData?.name?.split(" ")[0] || "";
  return (
    <div onClick={onClick} style={{ cursor: "pointer", borderBottom: "1px solid var(--bg3)", transition: "background .1s" }}
      onMouseEnter={e => e.currentTarget.style.background = C.bg3}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.tx3, minWidth: 16, textAlign: "right", flexShrink: 0 }}>{rank}</span>
        <span title={squadData?.name} style={{ width: 8, height: 8, borderRadius: "50%", background: squadColor, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortName(person)}</span>
        <span className="mobile-hide" style={{ fontSize: 10, color: squadColor, fontWeight: 600, background: squadColor + "15", borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{squadShort}</span>
        {d.stopped > 0 && <span style={{ fontSize: 10, color: C.red, fontWeight: 700, flexShrink: 0 }}>{d.stopped}🚫</span>}
        <div title={`${d.total} de ${maxVal} (maximo del equipo)`} style={{ width: 60, height: 4, background: C.bg4, borderRadius: 3, overflow: "hidden", flexShrink: 0, cursor: "help" }}>
          <div style={{ width: Math.min(pct * 100, 100) + "%", height: "100%", background: barColor, borderRadius: 3, transition: "width .4s ease" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, minWidth: 60 }}>
          <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 800, color: barColor, lineHeight: 1 }}>{d.total}</span>
          {(projects > 0 || tasks > 0) && (
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              {projects > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.blue, background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>{projects}P</span>}
              {tasks > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: C.purple, background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap" }}>{tasks}T</span>}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: C.tx3, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>▾</span>
      </div>
      {isExpanded && <PersonDetailView detail={getPersonDetail(person, items)} />}
    </div>
  );
});

const TabHome = React.memo(function TabHome({ analysis: an, items, elapsed, onStart, gddData, mqlBreakdown, mqlBreakdownPrev, gddTargets, gddHistory, setGddHistory, gddLoading }) {
  const [expandedPerson, setExpandedPerson] = useState(null);
  const [cargaSquad, setCargaSquad] = useState("all");
  const [showAllCarga, setShowAllCarga] = useState(false);

  if (!an) return null;
  const activeWeek = (an.byPhaseWeek["🚧 Sprint"] || 0) + (an.byPhaseWeek["👀 Review"] || 0) + (an.byPhaseWeek["⚙️ Modificación"] || 0);
  const TEAM_NAMES = new Set(PERSONAS.map((p) => p.name));
  const sortedPeople = Object.entries(an.byPersonWeek).filter(([name]) => TEAM_NAMES.has(name) && !PERSONAS.find((p) => p.name === name)?.sdr).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="fade">

      {/* Semaphore */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", marginBottom: 12, borderRadius: "var(--r)", background: (an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.08)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.08)" : "rgba(52,199,89,.08)", border: `1px solid ${(an.semaphore || "yellow") === "red" ? "rgba(255,59,48,.2)" : (an.semaphore || "yellow") === "yellow" ? "rgba(255,159,10,.2)" : "rgba(52,199,89,.2)"}` }}>
        <span style={{ fontSize: 24 }}>{(an.semaphore || "yellow") === "red" ? "🔴" : (an.semaphore || "yellow") === "yellow" ? "🟡" : "🟢"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: (an.semaphore || "yellow") === "red" ? C.red : (an.semaphore || "yellow") === "yellow" ? C.yellow : C.green }}>
            {(an.semaphore || "yellow") === "red" ? "Temas urgentes que revisar" : (an.semaphore || "yellow") === "yellow" ? "Atencion en algunos puntos" : "En control"}
          </div>
          <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>{activeWeek} en sprint esta semana · {(an.velocity || {}).done || 0} completados sem. anterior · {(an.velocity || {}).overdue || 0} vencidos</div>
        </div>
      </div>

      {/* Zona 1 — Control de Weekly */}
      {elapsed === 0 && (
        <Card style={{ marginBottom: 12, textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 11, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            {WEEK.start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })} · ~60 min
          </div>
          <button
            onClick={onStart}
            style={{ background: C.tx, color: C.bg, border: "none", borderRadius: "var(--r)", padding: "14px 36px", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: "-0.02em" }}
          >
            Iniciar Weekly
          </button>
        </Card>
      )}
      {elapsed > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: "var(--r)", background: "rgba(52,199,89,.06)", border: "1px solid rgba(52,199,89,.2)", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <span style={{ fontFamily: F.mono, fontWeight: 700, color: C.green }}>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
          <span style={{ color: C.tx3 }}>Weekly en curso</span>
        </div>
      )}

      {/* GdD KPIs — sub-componente extraido */}
      <GddKpiSection gddData={gddData} gddTargets={gddTargets} gddLoading={gddLoading} />

      {/* MQLs por Canal — sub-componente extraido */}
      <MqlChannelSection mqlBreakdown={mqlBreakdown} mqlBreakdownPrev={mqlBreakdownPrev} gddHistory={gddHistory} gddLoading={gddLoading} gddWeekView="current" />

      {/* Tendencia Semanal — sub-componente extraido */}
      <GddTrendSection gddData={gddData} gddHistory={gddHistory} gddLoading={gddLoading} />

      {/* Estado Sprint — sub-componente extraido */}
      <SprintStatusSection analysis={an} items={items} />

      {/* Carga — tabla compacta de todo el equipo */}
      <Accordion title="👥 Carga del Equipo" count={sortedPeople.length} defaultOpen={false}>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>👥 Carga del Equipo <span style={{ fontSize: 11, fontWeight: 400, color: C.tx3 }}>{WEEK.start.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – {WEEK.end.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 10, color: C.tx3 }}>
            <span style={{ color: C.blue, fontWeight: 700, background: "rgba(0,122,255,.1)", borderRadius: 3, padding: "1px 5px" }}>P</span>
            <span style={{ marginRight: 2 }}>= Proyectos</span>
            <span style={{ color: C.purple, fontWeight: 700, background: "rgba(175,82,222,.1)", borderRadius: 3, padding: "1px 5px" }}>T</span>
            <span>= Tareas</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Chip label="Todos" active={cargaSquad === "all"} color={C.tx2} onClick={() => setCargaSquad("all")} />
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
          if (!filtered.length) return <div style={{ textAlign: "center", padding: "16px 0", color: C.tx3, fontSize: 12 }}>Sin tareas esta semana</div>;
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
                  style={{ fontSize: 11, color: C.blue, background: "none", border: "none",
                  cursor: "pointer", fontWeight: 600, marginTop: 8, padding: 0, width: "100%", textAlign: "center" }}>
                  {showAllCarga ? "Ver menos ↑" : `Ver los ${filtered.length} →`}
                </button>
              )}
            </div>
          );
        })()}
        {(an.noCrono || []).length > 0 && <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 6, background: "rgba(245,158,11,.06)", fontSize: 10, color: C.yellow }}>⚠️ {(an.noCrono || []).length} en Sprint sin Fecha</div>}
      </Card>
      </Accordion>

      {/* Zona 3 — Roadmap Timeline */}
      <RoadmapTimeline items={items} />

    </div>
  );
});

export { TabHome }
