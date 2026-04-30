'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
// components/TabFocos.jsx
import { SQUADS, PHASES, TODAY } from '../lib/constants'
import { parseTL, daysDiff, shortName, normalizeSquad, isActive, isOverdue, overlapsThisWeek, normalizeFocos } from '../lib/utils'
import { Chip, Card, SquadInputSection } from './ui'

const TabFocos = React.memo(function TabFocos({ items, wd, setWd, save, activeSquad, setActiveSquad }) {
  const focos = wd.focos || {};
  const isCross = activeSquad === "cross";
  const sq = isCross ? null : SQUADS.find((s) => s.id === activeSquad);

  const allBlockers = [], allNecesitos = [];
  SQUADS.forEach((s) => {
    const arr = normalizeFocos(focos[s.id]);
    arr.forEach((f) => {
      if (f.blocker?.trim()) allBlockers.push({ text: f.blocker, quien: f.blocker_quien, cuando: f.blocker_cuando, sq: s });
      if (f.necesito?.trim()) allNecesitos.push({ text: f.necesito, quien: f.necesito_quien, cuando: f.necesito_cuando, sq: s });
    });
  });
  const crossCount = allBlockers.length + allNecesitos.length;

  const sqItems = sq ? items.filter((i) => normalizeSquad(i.column_values?.color_mkz0s203) === sq.name && isActive(i.column_values?.color_mkz09na)) : [];
  const entries = normalizeFocos(focos[activeSquad]);
  const [showForm, setShowForm] = useState(!entries.length); // mostrar form si no hay entries

  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);
  const [editIdx, setEditIdx] = useState(null);

  useEffect(() => { setDraft({}); setSaved(false); setEditIdx(null); }, [activeSquad]);

  const updateDraft = useCallback((field, val) => setDraft((prev) => ({ ...prev, [field]: val })), []);
  const hasDraft = !!(draft.focos?.trim() || draft.blocker?.trim() || draft.necesito?.trim());

  const saveDraft = () => {
    if (!hasDraft) return;
    let newEntries;
    if (editIdx !== null) { newEntries = [...entries]; newEntries[editIdx] = { ...draft, ts: Date.now() }; setEditIdx(null); }
    else newEntries = [...entries, { ...draft, ts: Date.now() }];
    const n = { ...wd, focos: { ...wd.focos, [activeSquad]: newEntries } };
    setWd(n); save(n); setDraft({}); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const deleteEntry = (idx) => { const n = { ...wd, focos: { ...wd.focos, [activeSquad]: entries.filter((_, i) => i !== idx) } }; setWd(n); save(n); };
  const editEntry = (idx) => { setDraft(entries[idx]); setEditIdx(idx); };

  const draftRef = useRef(updateDraft);
  draftRef.current = updateDraft;
  // Eliminado anti-patrón: useMemo con JSON.stringify como dep
  // JSON.stringify en cada render es más costoso que sin memo
  const stableDraft = draft;

  return (
    <div className="fade">
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {SQUADS.map((s) => {
          const arr = normalizeFocos(focos[s.id]);
          const hasFoco = arr.some((f) => f.focos?.trim()), hasBlocker = arr.some((f) => f.blocker?.trim());
          return (
            <div key={s.id} style={{ position: "relative" }}>
              <Chip label={s.name} active={activeSquad === s.id} color={s.color} onClick={() => setActiveSquad(s.id)} />
              {hasFoco && <span style={{ position: "absolute", top: -4, right: hasBlocker ? 14 : -4, width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />}
              {hasBlocker && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }} />}
            </div>
          );
        })}
        <div style={{ position: "relative" }}>
          <Chip label="Cross-Squad" active={isCross} color="var(--purple)" onClick={() => setActiveSquad("cross")} />
          {crossCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "var(--red)", color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>{crossCount}</span>}
        </div>
      </div>

      {isCross ? (
        <Card style={{ borderTop: "3px solid var(--purple)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Cross-Squad — Resumen</div>
          {(() => {
            const hasAny = SQUADS.some((s) => { const arr = normalizeFocos(focos[s.id]); return arr.some((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim()); });
            if (!hasAny) return <div style={{ textAlign: "center", padding: "16px 0", color: "var(--tx3)", fontSize: 12 }}>Aún no hay registros. Se llenan desde cada squad.</div>;
            return SQUADS.map((s) => {
              const arr = normalizeFocos(focos[s.id]);
              const filled = arr.filter((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim());
              if (!filled.length) return null;
              return (
                <div key={s.id} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, borderLeft: `3px solid ${s.color}`, background: "var(--bg)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.name}</div>
                  {filled.map((f, fi) => (
                    <div key={fi} style={{ marginBottom: fi < filled.length - 1 ? 6 : 0 }}>
                      {f.focos?.trim() && <div style={{ fontSize: 12, color: "var(--tx)", marginBottom: 1 }}>🎯 {f.focos}</div>}
                      {f.blocker?.trim() && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 1 }}>🚫 {f.blocker}{f.blocker_quien ? ` → ${shortName(f.blocker_quien)}` : ""}{f.blocker_cuando ? ` · ${new Date(f.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                      {f.necesito?.trim() && <div style={{ fontSize: 12, color: "var(--yellow)", marginBottom: 1 }}>🤝 {f.necesito}{f.necesito_quien ? ` → ${shortName(f.necesito_quien)}` : ""}{f.necesito_cuando ? ` · ${new Date(f.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </Card>
      ) : (
        <>
          <Card style={{ borderTop: `3px solid ${sq?.color}`, padding: "16px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div><span style={{ fontSize: 15, fontWeight: 700 }}>{sq?.name}</span><span style={{ fontSize: 12, color: "var(--tx3)", marginLeft: 8 }}>{sq?.lead}</span></div>
              <span style={{ fontSize: 11, color: "var(--tx3)" }}>{entries.length} registro{entries.length !== 1 ? "s" : ""}</span>
            </div>
            {entries.map((entry, idx) => (
              <div key={idx} style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--bg4)" }}>
                {entry.focos?.trim() && <div style={{ fontSize: 13, color: "var(--tx)", marginBottom: 2 }}>🎯 {entry.focos}</div>}
                {entry.blocker?.trim() && <div style={{ fontSize: 13, color: "var(--red)", marginBottom: 2 }}>🚫 {entry.blocker}{entry.blocker_quien ? ` → ${shortName(entry.blocker_quien)}` : ""}{entry.blocker_cuando ? ` · ${new Date(entry.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                {entry.necesito?.trim() && <div style={{ fontSize: 13, color: "var(--yellow)", marginBottom: 2 }}>🤝 {entry.necesito}{entry.necesito_quien ? ` → ${shortName(entry.necesito_quien)}` : ""}{entry.necesito_cuando ? ` · ${new Date(entry.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span onClick={() => editEntry(idx)} style={{ fontSize: 10, color: "var(--blue)", cursor: "pointer" }}>Editar</span>
                  <span onClick={() => deleteEntry(idx)} style={{ fontSize: 10, color: "var(--tx3)", cursor: "pointer" }}>Borrar</span>
                </div>
              </div>
            ))}
            <div style={{ padding: entries.length > 0 ? "10px 0 0" : 0, borderTop: entries.length > 0 ? "1px dashed var(--bg4)" : "none" }}>
              <SquadInputSection label="Focos" icon="🎯" field="focos" placeholder="Top 3: campaña X, proyecto Y, entregable Z..." rows={3} draft={draft} updateDraft={updateDraft} />
              <SquadInputSection label="Blocker" icon="🚫" field="blocker" placeholder="¿Algo detenido?" rows={1} draft={draft} updateDraft={updateDraft} showMeta />
              <SquadInputSection label="Necesito" icon="🤝" field="necesito" placeholder="¿Qué necesitas de otro squad?" rows={1} draft={draft} updateDraft={updateDraft} showMeta />
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                {saved && <span style={{ fontSize: 11, color: "var(--green)", fontWeight: 600 }}>✓ Guardado</span>}
                {editIdx !== null && <span onClick={() => { setDraft({}); setEditIdx(null); }} style={{ fontSize: 11, color: "var(--tx3)", cursor: "pointer" }}>Cancelar</span>}
                <button onClick={saveDraft} disabled={!hasDraft} style={{ background: hasDraft ? "var(--tx)" : "var(--bg4)", color: hasDraft ? "var(--bg)" : "var(--tx3)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: hasDraft ? "pointer" : "default" }}>
                  {editIdx !== null ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </div>
          </Card>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Items activos · {sqItems.length}</div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {sqItems.map((it) => {
              const tl = parseTL(it.column_values?.timerange_mkzcqv0j), od = isOverdue(it), tw = overlapsThisWeek(it.column_values?.timerange_mkzcqv0j);
              const subs = it.subitems || [], subsDone = subs.filter((s) => s.column_values?.color_mkzjvp66 === "✅ Done").length;
              return (
                <div key={it.id} style={{ display: "flex", gap: 5, alignItems: "center", padding: "5px 8px", borderBottom: "1px solid var(--bg3)", fontSize: 12, background: od ? "rgba(255,59,48,.06)" : tw ? "rgba(0,122,255,.04)" : "transparent", borderLeft: tw ? "3px solid var(--blue)" : od ? "3px solid var(--red)" : "3px solid transparent" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PHASES[it.column_values?.color_mkz09na] || "#555", flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "var(--tx2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                  {subs.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}><div style={{ width: 32, height: 4, borderRadius: 2, background: "var(--bg4)", overflow: "hidden" }}><div style={{ width: `${(subsDone / subs.length) * 100}%`, height: "100%", background: subsDone === subs.length ? "var(--green)" : "var(--blue)", borderRadius: 2 }} /></div><span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--tx3)" }}>{subsDone}/{subs.length}</span></div>}
                  {od && <span style={{ fontFamily: "var(--mono)", color: "var(--red)", fontWeight: 700, fontSize: 10 }}>-{tl.end ? daysDiff(TODAY, tl.end) : "?"}d</span>}
                  <span style={{ color: "var(--tx3)", fontSize: 10 }}>{shortName(it.column_values?.person)}</span>
                  {tl.end && <span style={{ fontFamily: "var(--mono)", color: od ? "var(--red)" : "var(--tx3)", fontWeight: od ? 700 : 400, fontSize: 10 }}>{tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SECTION 14: TAB COMPROMISOS
   ═══════════════════════════════════════════════════════════════ */

export { TabFocos }
