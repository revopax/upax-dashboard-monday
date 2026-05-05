'use client'
import React, { useState } from 'react'
import { SQUADS, STORE_KEY, PERSONAS, TODAY } from '../lib/constants'
import { WEEK, shortName, parseTL, daysDiff, normalizeSquad, copyToClipboard, normalizeFocos } from '../lib/utils'
import { storeSet } from '../lib/storage'
import { authHeaders } from '../lib/api'
import { generateMinuta } from '../lib/minuta'
import { C, R, F } from '../lib/tokens'

function parseWhoWhen(text) {
  const idx = text.indexOf("→");
  if (idx === -1) return [{ t: text, bold: false }];
  const before = text.slice(0, idx + 1);
  const after = text.slice(idx + 1).trim();
  const parenStart = after.lastIndexOf("(");
  const parenEnd = after.lastIndexOf(")");
  if (parenStart > -1 && parenEnd > parenStart) {
    const who = after.slice(0, parenStart).trim();
    const when = after.slice(parenStart + 1, parenEnd);
    return [
      { t: before + " ", bold: false },
      { t: who, bold: true },
      { t: " (", bold: false },
      { t: when, bold: true, accent: true },
      { t: ")", bold: false },
    ];
  }
  return [{ t: text, bold: false }];
}

function BoldText({ parts, accentColor }) {
  return (
    <span>
      {parts.map((p, i) => (
        p.bold
          ? <strong key={i} style={{ color: p.accent ? accentColor : "inherit" }}>{p.t}</strong>
          : <span key={i}>{p.t}</span>
      ))}
    </span>
  );
}

// Renderer visual estructurado — usa datos directos, no texto plano
function renderMinutaVisual(text, wd2, an, gdd2) {
  const an2 = an;

  const SectionWrap = ({ num, title, sub, color, children }) => (
    <div style={{ marginBottom: 20, borderRadius: R.default, overflow: "hidden", border: `1px solid ${C.bg4}` }}>
      <div style={{ background: color + "15", borderLeft: "4px solid " + color, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 800, color, background: color + "22", borderRadius: 5, padding: "2px 7px", flexShrink: 0 }}>{num}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.tx }}>{title}</span>
        {sub && <span style={{ fontSize: 11, color: C.tx3, marginLeft: 6 }}>{sub}</span>}
      </div>
      <div style={{ background: C.bg2 }}>{children}</div>
    </div>
  );

  const AlertRow = ({ label, items, color, renderItem }) => items.length === 0 ? null : (
    <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.bg4}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        {label} <span style={{ fontFamily: F.mono, fontSize: 12 }}>({items.length})</span>
      </div>
      {items.slice(0, 4).map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 11, borderBottom: i < Math.min(items.length, 4) - 1 ? `1px solid ${C.bg3}` : "none" }}>
          {renderItem(it)}
        </div>
      ))}
      {items.length > 4 && <div style={{ fontSize: 10, color: C.tx3, marginTop: 3 }}>+{items.length - 4} más</div>}
    </div>
  );

  const gdd = gdd2 || { semana: {}, anterior: {}, ytd: {}, fechas: {} };
  const s = gdd.semana || {}, a = gdd.anterior || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
  const pctChg = (cur, prev) => (!prev) ? null : Math.round(((cur-prev)/prev)*100);
  const fmtM = (v) => v >= 1000000 ? "$"+(v/1000000).toFixed(1)+"M" : v >= 1000 ? "$"+(v/1000).toFixed(0)+"K" : "$"+(v||0);

  const dateLabel = text ? text.split("\n")[0].replace("WEEKLY MKT CORP · ", "") : "";
  const header = (
    <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: `2px solid ${C.bg4}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 28 }}>⚡</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.15em" }}>Weekly Mkt Corp · Upax</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.tx, letterSpacing: "-0.03em", lineHeight: 1.1 }}>MINUTA SEMANAL</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: C.tx2, fontWeight: 500 }}>{dateLabel}</div>
    </div>
  );

  const mes = gdd.mes || {};
  const gddMetrics = [
    { label: "Leads", cur: s.leads||0, prev: a.leads||0, mes: mes.leads||0, ytd: y.leads||0, color: C.blue },
    { label: "MQLs",  cur: s.mqls||0,  prev: a.mqls||0,  mes: mes.mqls||0,  ytd: y.mqls||0,  color: C.purple },
    { label: "SQLs",  cur: s.sqls||0,  prev: a.sqls||0,  mes: mes.sqls||0,  ytd: y.sqls||0,  color: C.green },
    { label: "Opps",  cur: s.opps||0,  prev: a.opps||0,  mes: mes.opps||0,  ytd: y.opps||0,  color: C.yellow },
  ];
  const pTotal = s.pipeline_total || ((s.pipeline_mkt||0)+(s.pipeline_com||0));
  const fmtDateDMY = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + (dateStr.includes("-") ? "T12:00:00" : ", 2026"));
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, " - ");
  };
  const gddSub = f.semana_desde ? `${fmtDateDMY(f.semana_desde)}${f.semana_hasta ? " al " + fmtDateDMY(f.semana_hasta) : ""}` : "";
  const sec1 = (
    <SectionWrap num="1" title="GENERACIÓN DE DEMANDA" sub={gddSub} color={C.blue}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: C.bg4 }}>
        {gddMetrics.map((m, i) => {
          const pct = pctChg(m.cur, m.prev);
          return (
            <div key={i} style={{ padding: "14px 16px", background: C.bg2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 800, color: m.color, lineHeight: 1, letterSpacing: "-0.04em" }}>{m.cur.toLocaleString()}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                {pct !== null && <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? C.green : C.red }}>{pct >= 0 ? "▲" : "▼"}{Math.abs(pct)}%</span>}
                <span style={{ fontSize: 10, color: C.tx3 }}>vs sem. ant.</span>
              </div>
              {m.mes > 0 && <div style={{ marginTop: 5, fontSize: 10, color: C.tx3, borderTop: `1px solid ${C.bg4}`, paddingTop: 4 }}>
                <span style={{ color: C.tx2, fontWeight: 600 }}>{m.mes.toLocaleString()}</span> <span>acum. mes</span>
              </div>}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.bg4}`, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {pTotal > 0 && <>
          <div style={{ fontSize: 12, color: C.tx3 }}>Pipeline <span style={{ fontWeight: 700, color: C.tx, fontFamily: F.mono }}>{fmtM(pTotal)}</span></div>
          <div style={{ fontSize: 12, color: C.tx3 }}>Mkt <span style={{ fontWeight: 600 }}>{fmtM(s.pipeline_mkt||0)}</span></div>
          <div style={{ fontSize: 12, color: C.tx3 }}>Com <span style={{ fontWeight: 600 }}>{fmtM(s.pipeline_com||0)}</span></div>
        </>}
        {f.lastUpdate && <div style={{ fontSize: 10, color: C.tx3, marginLeft: "auto" }}>Actualizado: {f.lastUpdate}</div>}
      </div>
    </SectionWrap>
  );

  const sec2 = an2 ? (() => {
    const spr = an2.byPhaseWeek?.["🚧 Sprint"]||0, rev = an2.byPhaseWeek?.["👀 Review"]||0;
    const mod = an2.byPhaseWeek?.["⚙️ Modificación"]||0, det = an2.byPhase["🚫 Detenido"]||0;
    const ven = (an2.overdue||[]).length, done = (an2.doneLastWeek||[]).length;
    const noCronoItems = an2.noCrono||[];
    const noRespItems = an2.noResp||[];
    const stoppedItems = an2.stoppedWeek||[];

    const alerts = [
      { val: ven,       label: "Vencidos",  color: ven>0?C.red:C.green,    icon: "⏰", sub: ven>0?"requieren acción":"Al día" },
      { val: det,       label: "Detenidos", color: det>0?C.yellow:C.green,  icon: "🚫", sub: det>0?"bloqueados":"Sin bloqueos" },
      { val: spr+rev+mod, label: "Activos", color: C.blue,                         icon: "⚡", sub: (rev+mod)+" en revisión" },
      { val: done,      label: "Done sem.", color: done>0?C.green:C.tx3,    icon: "✅", sub: (an2.doneTotal||0)+" total" },
    ];

    const sqShort = (it) => {
      const raw = it.column_values?.color_mkz0s203 || "";
      const sqName = normalizeSquad(raw);
      const sq = SQUADS.find(s => s.name === sqName);
      if (sq) return sq.name.split(" ")[0];
      const resp = it.column_values?.person || "";
      if (resp) {
        const persona = PERSONAS.find(p => resp.includes(p.name));
        if (persona) {
          const sqP = SQUADS.find(s => s.name === persona.squad);
          if (sqP) return sqP.name.split(" ")[0];
        }
      }
      const prefix = (it.name || "").split("|")[0].trim().toUpperCase();
      const prefixMap = { "CF":"Inbound","PE":"Portafolio","NC":"Portafolio","UPAX":"Performance","MU":"Performance","HF":"Portafolio","MX":"Portafolio","ZS":"RevOps","UX":"RevOps" };
      if (prefixMap[prefix]) return prefixMap[prefix];
      return "—";
    };

    return (
      <SectionWrap num="2" title="PANORAMA OPERATIVO" color={C.purple}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, background: C.bg4, overflow: "hidden" }}>
          {alerts.map((al, i) => (
            <div key={i} style={{ padding: "14px 16px", background: C.bg2, textAlign: "center", borderRight: i < 3 ? `1px solid ${C.bg4}` : "none" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{al.icon}</div>
              <div style={{ fontFamily: F.mono, fontSize: 26, fontWeight: 800, color: al.color, lineHeight: 1 }}>{al.val}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.tx, marginTop: 5 }}>{al.label}</div>
              <div style={{ fontSize: 10, color: C.tx3, marginTop: 2 }}>{al.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.bg4}`, padding: "4px 0" }}>
          {SQUADS.map((sq, si) => {
            const d = an2.bySquad[sq.name]; if (!d) return null;
            const dw = an2.bySquadWeek?.[sq.name];
            const act  = dw ? (dw.phases["🚧 Sprint"]||0)+(dw.phases["👀 Review"]||0)+(dw.phases["⚙️ Modificación"]||0) : 0;
            const det2 = d.phases["🚫 Detenido"]||0;
            const ven2 = (an2.overdue||[]).filter(it => normalizeSquad(it.column_values?.color_mkz0s203)===sq.name).length;
            const personasSemana = PERSONAS.filter(p => p.squad === sq.name && !p.sdr).map(p => {
              const ppw = an2.byPersonWeek[p.name];
              if (!ppw || ppw.total === 0) return null;
              const pVen = (an2.overdue||[]).some(it => (it.column_values?.person||"").includes(p.name));
              const pDet = ppw.stopped > 0;
              const badge = pVen ? " 🔴" : pDet ? " 🟡" : "";
              return { name: shortName(p.name), badge, total: ppw.total, pVen, pDet };
            }).filter(Boolean);
            return (
              <div key={sq.id} style={{ padding:"6px 16px", borderBottom: si<SQUADS.length-1?`1px solid ${C.bg3}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:110 }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:sq.color, flexShrink:0 }} />
                    <span style={{ fontWeight:700, color:sq.color, fontSize:12 }}>{sq.name.split(" ")[0]}</span>
                  </div>
                  <span style={{ fontSize:11, color:C.tx2, minWidth:72 }}>{act} esta semana</span>
                  {ven2>0 && <span style={{ fontSize:11, color:C.red, fontWeight:700 }}>{ven2} ⏰</span>}
                  {det2>0 && <span style={{ fontSize:11, color:C.yellow, fontWeight:700 }}>{det2} 🚫</span>}
                </div>
                {personasSemana.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingLeft:16, marginTop:3 }}>
                    {personasSemana.map(p => (
                      <span key={p.name} style={{ fontSize:10, color: p.pVen?C.red:p.pDet?C.yellow:C.tx3, background:C.bg3, borderRadius:4, padding:"1px 6px", whiteSpace:"nowrap" }}>
                        {p.name}{p.badge} <span style={{ fontFamily:F.mono, fontSize:9 }}>{p.total}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AlertRow label="⏰ Top vencidos" items={an2.overdue||[]} color={C.red} renderItem={it => {
          const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
          const d = tl.end ? daysDiff(TODAY, tl.end) : 0;
          return <>
            <span style={{ fontFamily:F.mono, color:C.red, fontWeight:700, minWidth:32, fontSize:10 }}>-{d}d</span>
            <span style={{ fontSize:9, fontWeight:700, color:C.tx3, minWidth:52 }}>{sqShort(it)}</span>
            <span style={{ flex:1, color:C.tx2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
            <span style={{ color:C.tx3, fontSize:10 }}>{shortName(it.column_values?.person)}</span>
          </>;
        }} />

        <AlertRow label="🚫 Detenidos esta semana" items={stoppedItems} color={C.yellow} renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:C.tx3, minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:C.tx2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:C.tx3, fontSize:10 }}>{shortName(it.column_values?.person)}</span>
        </>} />

        <AlertRow label="📅 Sprint sin fecha" items={noCronoItems} color={C.yellow} renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:C.tx3, minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:C.tx2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:C.tx3, fontSize:10 }}>{shortName(it.column_values?.person)}</span>
        </>} />

        <AlertRow label="👤 Sin responsable" items={noRespItems} color={C.red} renderItem={it => <>
          <span style={{ fontSize:9, fontWeight:700, color:C.tx3, minWidth:52 }}>{sqShort(it)}</span>
          <span style={{ flex:1, color:C.tx2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{it.name}</span>
          <span style={{ color:C.red, fontSize:10 }}>sin asignar</span>
        </>} />

      </SectionWrap>
    );
  })() : null;

  const sec3 = (() => {
    const focos = wd2?.focos || {};
    const squadsWithData = SQUADS.filter(sq => {
      const raw = focos[sq.id];
      const arr = normalizeFocos(raw);
      return arr.some(f => f.focos?.trim()||f.blocker?.trim()||f.necesito?.trim());
    });
    if (!squadsWithData.length) return null;
    return (
      <SectionWrap num="3" title="FOCOS POR SQUAD" color={C.green}>
        <div style={{ padding: "8px 0" }}>
          {squadsWithData.map((sq, si) => {
            const raw = focos[sq.id];
            const arr = normalizeFocos(raw);
            const presenter = wd2?.presenters?.[sq.id] || sq.lead;
            return (
              <div key={sq.id} style={{ borderBottom: si < squadsWithData.length-1 ? `2px solid ${C.bg3}` : "none", paddingBottom: 12, marginBottom: si < squadsWithData.length-1 ? 4 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px 8px", background: sq.color+"0A" }}>
                  <div style={{ width:4, height:32, borderRadius:2, background:sq.color, flexShrink:0 }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:sq.color }}>{sq.name}</div>
                    <div style={{ fontSize:11, color:C.tx3 }}>{presenter}</div>
                  </div>
                </div>
                <div style={{ padding:"6px 16px 0" }}>
                  {arr.filter(f=>f.focos?.trim()).map((f,i) => {
                    const parts = f.focos.split(/\d+\)/).map(s=>s.trim()).filter(Boolean);
                    return (parts.length>1?parts:[f.focos.trim()]).map((p,j) => (
                      <div key={i+"-"+j} style={{ display:"flex", gap:8, padding:"4px 0", borderBottom:`1px solid ${C.bg3}`, alignItems:"flex-start" }}>
                        <span style={{ color:sq.color, fontWeight:700, flexShrink:0, marginTop:1 }}>·</span>
                        <span style={{ fontSize:13, color:C.tx2, lineHeight:1.5 }}>{p}</span>
                      </div>
                    ));
                  })}
                  {arr.filter(f=>f.blocker?.trim()).map((f,i) => {
                    const who = f.blocker_quien ? " → "+shortName(f.blocker_quien) : "";
                    const when = f.blocker_cuando ? " ("+new Date(f.blocker_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")" : "";
                    return (
                      <div key={"b"+i} style={{ display:"flex", gap:8, padding:"5px 10px", margin:"4px 0", background:"rgba(255,59,48,.07)", borderRadius:6, borderLeft:`3px solid ${C.red}`, alignItems:"flex-start" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:C.red, flexShrink:0 }}>⚠ BLOCKER</span>
                        <span style={{ fontSize:12, color:C.tx2, flex:1 }}>{f.blocker.trim()}<strong>{who}</strong>{when && <strong style={{color:C.red}}>{when}</strong>}</span>
                      </div>
                    );
                  })}
                  {arr.filter(f=>f.necesito?.trim()).map((f,i) => {
                    const who = f.necesito_quien ? " → "+shortName(f.necesito_quien) : "";
                    const when = f.necesito_cuando ? " ("+new Date(f.necesito_cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")" : "";
                    return (
                      <div key={"n"+i} style={{ display:"flex", gap:8, padding:"5px 10px", margin:"4px 0", background:"rgba(255,159,10,.07)", borderRadius:6, borderLeft:`3px solid ${C.yellow}`, alignItems:"flex-start" }}>
                        <span style={{ fontSize:11, fontWeight:700, color:C.yellow, flexShrink:0 }}>✋ NECESITO</span>
                        <span style={{ fontSize:12, color:C.tx2, flex:1 }}>{f.necesito.trim()}<strong>{who}</strong>{when && <strong style={{color:C.yellow}}>{when}</strong>}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SectionWrap>
    );
  })();

  const comps2 = (wd2?.compromisos||[]).filter(c=>c.que?.trim());
  const sec4 = comps2.length ? (
    <SectionWrap num="4" title="COMPROMISOS" color={C.yellow}>
      <div style={{ padding: "8px 16px" }}>
        {comps2.map((c,i) => {
          const done = c.status === "done";
          const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
          return (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom: i<comps2.length-1?`1px solid ${C.bg3}`:"none", opacity: done?0.55:1 }}>
              <span style={{ color: done?C.green:C.blue, fontSize:16, flexShrink:0, lineHeight:1.3, marginTop:1 }}>{done?"✓":"○"}</span>
              <span style={{ flex:1, fontSize:13, color: done?C.tx3:C.tx, lineHeight:1.5, textDecoration: done?"line-through":"none" }}>{c.que.trim()}</span>
              <div style={{ flexShrink:0, textAlign:"right" }}>
                <div style={{ fontSize:11, fontWeight:600, color:C.tx2 }}>{shortName(c.quien)||"—"}</div>
                <div style={{ fontSize:10, color:C.tx3 }}>{fecha}</div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionWrap>
  ) : null;

  const sec5 = an2 ? (() => {
    const pw = an2.byPersonWeek || {};
    const all = PERSONAS
      .filter(p => !p.sdr)
      .map(p => ({
        name: p.name,
        squad: p.squad,
        d: pw[p.name] || { items: 0, stopped: 0, total: 0 },
      }))
      .sort((a, b) => b.d.total - a.d.total);
    const maxVal = Math.max(...all.map(p => p.d.total), 1);
    const half = Math.ceil(all.length / 2);
    const col1 = all.slice(0, half), col2 = all.slice(half);
    const CRow = ({ person, squad, d, rank }) => {
      const pct = maxVal > 0 ? d.total / maxVal : 0;
      const barColor = d.total > 10 ? C.red : d.total > 6 ? C.yellow : d.total > 0 ? C.green : C.bg4;
      const sqColor = SQUADS.find(s => s.name === squad)?.color || C.bg4;
      return (
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 0", borderBottom:`1px solid ${C.bg3}`, opacity: d.total===0 ? 0.45 : 1 }}>
          <span style={{ fontFamily:F.mono, fontSize:9, color:C.tx3, minWidth:14, textAlign:"right" }}>{rank}</span>
          <span style={{ width:5, height:5, borderRadius:"50%", background:sqColor, flexShrink:0 }} />
          <span style={{ fontSize:11, fontWeight: d.total>0 ? 600 : 400, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:d.total>10?C.red:C.tx }}>{shortName(person)}</span>
          {d.stopped>0 && <span style={{ fontSize:9, color:C.red, fontWeight:700 }}>🚫</span>}
          <div style={{ width:44, height:4, background:C.bg4, borderRadius:2, overflow:"hidden", flexShrink:0 }}>
            <div style={{ width:(pct*100)+"%", height:"100%", background:barColor, borderRadius:2 }} />
          </div>
          <span style={{ fontFamily:F.mono, fontSize:11, fontWeight:700, color: d.total>0 ? barColor : C.tx3, minWidth:20, textAlign:"right" }}>{d.total}</span>
        </div>
      );
    };
    return (
      <SectionWrap num="5" title="CARGA SEMANAL" sub={"("+WEEK.start.toLocaleDateString("es-MX",{day:"numeric",month:"short"})+" – "+WEEK.end.toLocaleDateString("es-MX",{day:"numeric",month:"short"})+")"} color={C.cyan}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px", padding:"10px 16px" }}>
          <div>{col1.map((p,i)=><CRow key={p.name} person={p.name} squad={p.squad} d={p.d} rank={i+1} />)}</div>
          <div>{col2.map((p,i)=><CRow key={p.name} person={p.name} squad={p.squad} d={p.d} rank={half+i+1} />)}</div>
        </div>
      </SectionWrap>
    );
  })() : null;

  return [header, sec1, sec2, sec3, sec4, sec5].filter(Boolean);
}


function PdfButton({ text, dateStr, wd, analysis, gddData }) {
  function handlePdf() {
    const gdd = gddData || {};
    const s = gdd.semana || {}, a = gdd.anterior || {}, mes = gdd.mes || {}, y = gdd.ytd || {}, f = gdd.fechas || {};
    const pTotal = s.pipeline_total || ((s.pipeline_mkt||0)+(s.pipeline_com||0));
    const fmtN = (v) => (v||0).toLocaleString("es-MX");
    const fmtM = (v) => v >= 1000000 ? "$"+(v/1000000).toFixed(1)+"M" : v >= 1000 ? "$"+(v/1000).toFixed(0)+"K" : "$"+(v||0);
    const pct = (cur, prev) => { if (!prev) return ""; const p = Math.round(((cur-prev)/prev)*100); return `<span style="color:${p>=0?"#16a34a":"#dc2626"};font-weight:700">${p>=0?"▲":"▼"}${Math.abs(p)}%</span>`; };
    const dateLabel = new Date(dateStr).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    let focosHtml = "";
    if (wd) {
      SQUADS.forEach(sq => {
        const raw = wd.focos?.[sq.id];
        const arr = normalizeFocos(raw);
        const filled = arr.filter(f2 => f2.focos?.trim()||f2.blocker?.trim()||f2.necesito?.trim());
        if (!filled.length) return;
        const presenter = wd.presenters?.[sq.id] || sq.lead;
        focosHtml += `<div style="margin-bottom:16px;padding:12px 16px;border-radius:8px;border-left:4px solid ${sq.color};background:#fafafa">
          <div style="font-weight:700;color:${sq.color};font-size:13px;margin-bottom:8px">${sq.name} <span style="font-weight:400;color:#666">· ${presenter}</span></div>`;
        filled.forEach(f2 => {
          if (f2.focos?.trim()) focosHtml += `<div style="font-size:12px;color:#333;margin-bottom:4px">🎯 ${f2.focos.trim().replace(/</g,"&lt;")}</div>`;
          if (f2.blocker?.trim()) focosHtml += `<div style="font-size:12px;color:#dc2626;margin-bottom:4px">🚫 <strong>Blocker:</strong> ${f2.blocker.trim().replace(/</g,"&lt;")}</div>`;
          if (f2.necesito?.trim()) focosHtml += `<div style="font-size:12px;color:#d97706;margin-bottom:4px">🤝 <strong>Necesito:</strong> ${f2.necesito.trim().replace(/</g,"&lt;")}</div>`;
        });
        focosHtml += `</div>`;
      });
    }

    let compsHtml = "";
    const comps = (wd?.compromisos||[]).filter(c => c.que?.trim());
    if (comps.length) {
      compsHtml = comps.map((c,i) => {
        const fecha = c.cuando ? new Date(c.cuando+"T12:00:00").toLocaleDateString("es-MX",{day:"numeric",month:"short"}) : "sin fecha";
        return `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #eee;font-size:12px">
          <span style="color:${c.status==="done"?"#16a34a":"#999"}">${c.status==="done"?"✅":"⬜"}</span>
          <span style="flex:1;${c.status==="done"?"text-decoration:line-through;color:#999":""}">${(c.que||"").replace(/</g,"&lt;")}</span>
          <span style="color:#666">${shortName(c.quien)||""}</span>
          <span style="color:#999">${fecha}</span>
        </div>`;
      }).join("");
    }

    const html = `<!DOCTYPE html>
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

  <h2>📊 Generación de Demanda${f.semana_desde ? ` · ${f.semana_desde}${f.semana_hasta?" al "+f.semana_hasta:""}` : ""}</h2>
  <div class="kpi-grid">
    ${[
      {l:"Leads",cur:s.leads||0,prev:a.leads||0,mes:mes.leads||0,ytd:y.leads||0,c:"#0a84ff"},
      {l:"MQLs",cur:s.mqls||0,prev:a.mqls||0,mes:mes.mqls||0,ytd:y.mqls||0,c:"#af52de"},
      {l:"SQLs",cur:s.sqls||0,prev:a.sqls||0,mes:mes.sqls||0,ytd:y.sqls||0,c:"#34c759"},
      {l:"Opps",cur:s.opps||0,prev:a.opps||0,mes:mes.opps||0,ytd:y.opps||0,c:"#ff9f0a"},
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
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const dlUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = dlUrl;
    anchor.download = "minuta-weekly.html";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(dlUrl);
  }

  return (
    <button onClick={handlePdf} style={{ background: C.tx, color: C.bg, border: "none", borderRadius: R.sm, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      📄 PDF
    </button>
  );
}

function SlackButton({ text }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false);

  async function handleSend() {
    setSending(true); setErr(false);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (d.success) { setSent(true); setTimeout(() => setSent(false), 3000); }
      else { setErr(true); setTimeout(() => setErr(false), 3000); copyToClipboard(text); }
    } catch { setErr(true); setTimeout(() => setErr(false), 3000); copyToClipboard(text); }
    setSending(false);
  }

  return (
    <button onClick={handleSend} disabled={sending} style={{
      background: sent ? C.green : err ? C.red : "linear-gradient(135deg,#4A154B,#611f69)",
      color: "#fff", border: "none", borderRadius: R.sm, padding: "6px 14px",
      fontSize: 12, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1,
    }}>
      {sent ? "✓ Enviado" : err ? "⚠️ Copiado" : sending ? "⏳" : "📨 Slack"}
    </button>
  );
}

function MinutaDetailView({ weekKey, data, todayWd, todayAnalysis, gddData, blockTimes, initialEditMode = false, onBack, onClose }) {
  const isToday = weekKey === STORE_KEY;
  const visualWd = isToday ? todayWd : (data || {});
  const visualAn = isToday ? todayAnalysis : (data?.analysis_snapshot || todayAnalysis);
  const visualGdd = isToday ? gddData : (data?.gdd_snapshot || gddData);
  const rawText = isToday
    ? generateMinuta(todayWd, todayAnalysis, gddData, blockTimes)
    : (data?.minutaText || generateMinuta(data, null, data?.gdd_snapshot || gddData, blockTimes));
  const [editMode, setEditMode] = useState(initialEditMode);
  const [editText, setEditText] = useState(rawText);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const displayText = editMode ? editText : rawText;
  const dateStr = weekKey.replace("weekly:", "");
  const dateFmt = new Date(dateStr).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function handleSave() {
    await storeSet(weekKey, { ...(data || {}), minutaText: editText });
    setSaved(true); setTimeout(() => setSaved(false), 2000); setEditMode(false);
  }
  function handleCopy() {
    copyToClipboard(displayText); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${C.bg4}`, flexShrink: 0, flexWrap: "wrap", gap: 6, overflowX: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: C.bg3, border: "none", borderRadius: R.sm, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: C.tx3 }}>← Volver</button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📋 Minuta</div>
            <div style={{ fontSize: 11, color: C.tx3 }}>{dateFmt}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {editMode
            ? <button onClick={handleSave} style={{ background: C.green, color: "#fff", border: "none", borderRadius: R.sm, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{saved ? "✓" : "💾"}<span className="mobile-hide">{saved ? " Guardado" : " Guardar"}</span></button>
            : <button onClick={() => { setEditMode(true); setEditText(rawText); }} style={{ background: C.bg3, color: C.tx2, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✏️<span className="mobile-hide"> Editar</span></button>}
          <button onClick={handleCopy} style={{ background: copied ? C.green : C.blue, color: "#fff", border: "none", borderRadius: R.sm, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copied ? "✓" : "📋"}<span className="mobile-hide">{copied ? " Copiado" : " Copiar"}</span></button>
          <SlackButton text={displayText} />
          <PdfButton text={displayText} dateStr={dateStr} wd={visualWd} analysis={visualAn} gddData={visualGdd} />
          <button onClick={onClose} style={{ background: C.bg3, border: "none", width: 32, height: 32, borderRadius: 16, fontSize: 16, cursor: "pointer", color: C.tx3, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {editMode ? (
          <textarea value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, width: "100%", background: C.bg3, color: C.tx, border: "none", padding: "16px 20px", fontSize: 12, fontFamily: F.mono, resize: "none", outline: "none", lineHeight: 1.7 }} />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {renderMinutaVisual(rawText, visualWd, visualAn, visualGdd)}
          </div>
        )}
      </div>
    </>
  );
}

export { MinutaDetailView, PdfButton, SlackButton }
