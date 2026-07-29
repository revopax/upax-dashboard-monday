'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
// components/TabFocos.jsx
// MONITOREO DE TAMANIO: Este archivo debe mantenerse por debajo de 400 lineas.
// Si crece mas, extraer la seccion Cross-Squad a components/CrossSquadView.jsx.
import { SQUADS, PHASES, TODAY } from '../lib/constants'
import { parseTL, daysDiff, shortName, overlapsThisWeek, normalizeFocos, normalizePersonName, getSquadWorkItems, isOverdueWork } from '../lib/utils'
import { C, TS, R, F } from '../lib/tokens'
import { Chip, Card, RepeatableItems } from './ui'

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

  // Subtareas primero, luego tareas (ver getSquadWorkItems). Memoizado porque el
  // recorrido pasa por todos los items y sus subitems, y este componente se
  // re-renderiza en cada tecla del formulario de focos.
  const allSqItems = useMemo(() => (sq ? getSquadWorkItems(items, sq.name) : []), [items, sq?.name]);

  const [search, setSearch] = useState("");
  // Sin acentos y en minúsculas: buscar "revision" debe encontrar "Revisión".
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sqItems = useMemo(() => {
    const q = norm(search).trim();
    if (!q) return allSqItems;
    return allSqItems.filter((w) =>
      norm(w.name).includes(q) || norm(w.parentName).includes(q) || norm(w.person).includes(q)
    );
  }, [allSqItems, search]);
  const nSubs = sqItems.filter((w) => w.kind === "sub").length;
  const entries = normalizeFocos(focos[activeSquad]);
  const [showForm, setShowForm] = useState(!entries.length); // mostrar form si no hay entries

  const [draft, setDraft] = useState({});
  const [saved, setSaved] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [confirmDelIdx, setConfirmDelIdx] = useState(null);

  useEffect(() => { setDraft({}); setSaved(false); setEditIdx(null); setConfirmDelIdx(null); setShowForm(false); setSearch(""); }, [activeSquad]);

  // Nombres que ya están capturados como foco, para marcar la fila y no duplicar.
  // Cuentan tanto los guardados como los del borrador en curso.
  const yaEnFocos = useMemo(() => {
    const s = new Set();
    entries.forEach((e) => { if (e.focos?.trim()) s.add(e.focos.trim()); });
    (draft.focosList || []).forEach((f) => { if (f.text?.trim()) s.add(f.text.trim()); });
    return s;
  }, [entries, draft.focosList]);

  const agregarAFocos = useCallback((it) => {
    if (yaEnFocos.has(it.name.trim())) return; // ya está, no duplicar
    setDraft((prev) => ({
      ...prev,
      // El owner se precarga con el responsable DE ESTE SQUAD, no con el primero
      // del texto de Monday, que puede ser de otro equipo.
      // El { text: "" } final mantiene la invariante de RepeatableItems.
      focosList: [
        ...(prev.focosList || []).filter((x) => x.text?.trim()),
        { text: it.name, quien: it.owners?.[0] || normalizePersonName(it.person) || "" },
        { text: "" },
      ],
    }));
    setShowForm(true);
  }, [yaEnFocos]);

  const updateDraft = useCallback((field, val) => setDraft((prev) => ({ ...prev, [field]: val })), []);
  const listHas = (l) => Array.isArray(l) && l.some((it) => it.text?.trim());
  const hasDraft = listHas(draft.focosList) || listHas(draft.blockerList) || listHas(draft.necesitoList);

  // Cada foco/blocker/necesito se guarda como su propio entry en el array del
  // squad (shape legacy → compatible con minuta y MinutaDetailView sin migrar).
  const buildEntries = (d) => {
    const out = [];
    const ts = Date.now();
    (d.focosList || []).forEach((it) => { if (it.text?.trim()) out.push({ focos: it.text.trim(), focos_quien: it.quien || "", ts }); });
    (d.blockerList || []).forEach((it) => { if (it.text?.trim()) out.push({ blocker: it.text.trim(), blocker_quien: it.quien || "", blocker_cuando: it.cuando || "", ts }); });
    (d.necesitoList || []).forEach((it) => { if (it.text?.trim()) out.push({ necesito: it.text.trim(), necesito_quien: it.quien || "", necesito_cuando: it.cuando || "", ts }); });
    return out;
  };

  const saveDraft = () => {
    if (!hasDraft) return;
    const built = buildEntries(draft);
    let newEntries;
    if (editIdx !== null) { newEntries = [...entries]; newEntries.splice(editIdx, 1, ...built); setEditIdx(null); }
    else newEntries = [...entries, ...built];
    const n = { ...wd, focos: { ...wd.focos, [activeSquad]: newEntries } };
    setWd(n); save(n); setDraft({}); setShowForm(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const deleteEntry = (idx) => { const n = { ...wd, focos: { ...wd.focos, [activeSquad]: entries.filter((_, i) => i !== idx) } }; setWd(n); save(n); };
  const editEntry = (idx) => {
    const e = entries[idx];
    const d = { focosList: [], blockerList: [], necesitoList: [] };
    if (e.focos?.trim()) d.focosList.push({ text: e.focos, quien: e.focos_quien || "" });
    if (e.blocker?.trim()) d.blockerList.push({ text: e.blocker, quien: e.blocker_quien || "", cuando: e.blocker_cuando || "" });
    if (e.necesito?.trim()) d.necesitoList.push({ text: e.necesito, quien: e.necesito_quien || "", cuando: e.necesito_cuando || "" });
    setDraft(d); setEditIdx(idx); setShowForm(true);
  };

  return (
    <div className="fade">
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {SQUADS.map((s) => {
          const arr = normalizeFocos(focos[s.id]);
          const hasFoco = arr.some((f) => f.focos?.trim()), hasBlocker = arr.some((f) => f.blocker?.trim());
          return (
            <div key={s.id} style={{ position: "relative" }}>
              <Chip label={s.name} active={activeSquad === s.id} color={s.color} onClick={() => setActiveSquad(s.id)} />
              {hasFoco && <span style={{ position: "absolute", top: -4, right: hasBlocker ? 14 : -4, width: 8, height: 8, borderRadius: "50%", background: C.green }} />}
              {hasBlocker && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: C.red }} />}
            </div>
          );
        })}
        <div style={{ position: "relative" }}>
          <Chip label="Cross-Squad" active={isCross} color={C.purple} onClick={() => setActiveSquad("cross")} />
          {crossCount > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: C.red, color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 10, padding: "1px 5px" }}>{crossCount}</span>}
        </div>
      </div>

      {isCross ? (
        <Card style={{ borderTop: "3px solid var(--purple)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Cross-Squad — Blockers y Necesitos</div>
          <div style={{ fontSize: 11, color: C.tx3, marginBottom: 12 }}>Solo lectura. Se llenan desde cada squad.</div>
          {(() => {
            const hasAny = SQUADS.some((s) => {
              const arr = normalizeFocos(focos[s.id]);
              return arr.some((f) => f.blocker?.trim() || f.necesito?.trim());
            });
            if (!hasAny) return <div style={{ textAlign: "center", padding: "16px 0", color: C.tx3, fontSize: 12 }}>Aún no hay blockers ni necesitos. Se llenan desde cada squad.</div>;
            return SQUADS.map((s) => {
              const arr = normalizeFocos(focos[s.id]);
              const filled = arr.filter((f) => f.blocker?.trim() || f.necesito?.trim());
              if (!filled.length) return null;
              return (
                <div key={s.id} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 8, borderLeft: `3px solid ${s.color}`, background: C.bg }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.name}</div>
                  {filled.map((f, fi) => (
                    <div key={fi} style={{ marginBottom: fi < filled.length - 1 ? 6 : 0 }}>
                      {f.blocker?.trim() && <div style={{ fontSize: 12, color: C.red, marginBottom: 1 }}>🚫 {f.blocker}{f.blocker_quien ? ` → ${shortName(f.blocker_quien)}` : ""}{f.blocker_cuando ? ` · ${new Date(f.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                      {f.necesito?.trim() && <div style={{ fontSize: 12, color: C.yellow, marginBottom: 1 }}>🤝 {f.necesito}{f.necesito_quien ? ` → ${shortName(f.necesito_quien)}` : ""}{f.necesito_cuando ? ` · ${new Date(f.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
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
              <div><span style={{ fontSize: 15, fontWeight: 700 }}>{sq?.name}</span><span style={{ fontSize: 12, color: C.tx3, marginLeft: 8 }}>{sq?.lead}</span></div>
              <span style={{ fontSize: 11, color: C.tx3 }}>{entries.length} registro{entries.length !== 1 ? "s" : ""}</span>
            </div>
            {entries.map((entry, idx) => (
              <div key={idx} style={{ padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: C.bg, border: "1px solid var(--bg4)" }}>
                {entry.focos?.trim() && <div style={{ fontSize: 13, color: C.tx, marginBottom: 2 }}>🎯 {entry.focos}{entry.focos_quien ? <span style={{ color: C.tx3 }}> → {shortName(entry.focos_quien)}</span> : ""}</div>}
                {entry.blocker?.trim() && <div style={{ fontSize: 13, color: C.red, marginBottom: 2 }}>🚫 {entry.blocker}{entry.blocker_quien ? ` → ${shortName(entry.blocker_quien)}` : ""}{entry.blocker_cuando ? ` · ${new Date(entry.blocker_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                {entry.necesito?.trim() && <div style={{ fontSize: 13, color: C.yellow, marginBottom: 2 }}>🤝 {entry.necesito}{entry.necesito_quien ? ` → ${shortName(entry.necesito_quien)}` : ""}{entry.necesito_cuando ? ` · ${new Date(entry.necesito_cuando + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}` : ""}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span onClick={() => editEntry(idx)} style={{ fontSize: 10, color: C.blue, cursor: "pointer" }}>Editar</span>
                  {confirmDelIdx === idx
                    ? <><span onClick={() => { deleteEntry(idx); setConfirmDelIdx(null); }} style={{ fontSize: 10, color: C.red, cursor: "pointer", fontWeight: 600 }}>Confirmar</span><span onClick={() => setConfirmDelIdx(null)} style={{ fontSize: 10, color: C.tx3, cursor: "pointer" }}>Cancelar</span></>
                    : <span onClick={() => setConfirmDelIdx(idx)} style={{ fontSize: 10, color: C.tx3, cursor: "pointer" }}>Borrar</span>}
                </div>
              </div>
            ))}
            {entries.length > 0 && !showForm && editIdx === null && (
              <div style={{ padding: "10px 0 0", borderTop: "1px dashed var(--bg4)", textAlign: "center" }}>
                {saved && <span style={{ fontSize: 11, color: C.green, fontWeight: 600, marginRight: 8 }}>✓ Guardado</span>}
                <button onClick={() => setShowForm(true)} style={{ background: C.bg3, color: C.blue, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  + Agregar foco
                </button>
              </div>
            )}
            {(showForm || editIdx !== null || entries.length === 0) && (
              <div style={{ padding: entries.length > 0 ? "10px 0 0" : 0, borderTop: entries.length > 0 ? "1px dashed var(--bg4)" : "none" }}>
                <RepeatableItems icon="🎯" label="Focos" placeholder="Ej: Lanzamiento campaña Verano" items={draft.focosList} onChange={(items) => updateDraft("focosList", items)} withOwner squad={sq?.name} />
                <RepeatableItems icon="🚫" label="Blocker" placeholder="Ej: Espero brief de UDN MS para finalizar landing" items={draft.blockerList} onChange={(items) => updateDraft("blockerList", items)} withMeta />
                <RepeatableItems icon="🤝" label="Necesito" placeholder="Ej: Performance, ajustar trackers de campaña X" items={draft.necesitoList} onChange={(items) => updateDraft("necesitoList", items)} withMeta />
                <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                  {saved && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>✓ Guardado</span>}
                  {editIdx !== null && <span onClick={() => { setDraft({}); setEditIdx(null); }} style={{ fontSize: 11, color: C.tx3, cursor: "pointer" }}>Cancelar</span>}
                  {entries.length > 0 && editIdx === null && <span onClick={() => { setDraft({}); setShowForm(false); }} style={{ fontSize: 11, color: C.tx3, cursor: "pointer" }}>Cancelar</span>}
                  <button onClick={saveDraft} disabled={!hasDraft} style={{ background: hasDraft ? C.tx : C.bg4, color: hasDraft ? C.bg : C.tx3, border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 700, cursor: hasDraft ? "pointer" : "default" }}>
                    {editIdx !== null ? "Actualizar" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.tx3, textTransform: "uppercase", letterSpacing: 1 }}>
              Items activos · {sqItems.length}
              {sqItems.length > 0 && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none", marginLeft: 6 }}>({nSubs} subtareas · {sqItems.length - nSubs} tareas)</span>}
              {search && allSqItems.length !== sqItems.length && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none", marginLeft: 6 }}>de {allSqItems.length}</span>}
            </div>
            <div style={{ position: "relative", marginLeft: "auto" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar item, proyecto o persona..."
                style={{ background: C.bg, border: "1px solid var(--bg4)", borderRadius: 8, padding: "5px 26px 5px 10px", fontSize: 12, fontFamily: F.sans, color: C.tx, outline: "none", width: 220, boxSizing: "border-box" }}
                onFocus={(e) => { e.target.style.borderColor = C.blue; }}
                onBlur={(e) => { e.target.style.borderColor = C.bg4; }}
              />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.tx3, cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}>✕</button>}
            </div>
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {sqItems.map((it, idx) => {
              const isSub = it.kind === "sub";
              const enFocos = yaEnFocos.has(it.name.trim());
              // Encabezado al empezar cada bloque, solo si hay de los dos tipos.
              const showHeader = nSubs > 0 && nSubs < sqItems.length && (idx === 0 || idx === nSubs);
              const tl = parseTL(it.timeline), od = isOverdueWork(it), tw = overlapsThisWeek(it.timeline);
              return (
                <React.Fragment key={it.id}>
                {showHeader && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.tx3, letterSpacing: 1, textTransform: "uppercase", padding: idx === 0 ? "2px 8px 4px" : "10px 8px 4px" }}>
                    {isSub ? "Subtareas" : "Tareas"}
                  </div>
                )}
                <div
                  onClick={() => agregarAFocos(it)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); agregarAFocos(it); } }}
                  title={enFocos ? "Ya está en focos" : "Click para agregar a focos"}
                  style={{ display: "flex", gap: 5, alignItems: "center", padding: "5px 8px", paddingLeft: isSub ? 20 : 8, borderBottom: "1px solid var(--bg3)", fontSize: 12, cursor: enFocos ? "default" : "pointer", opacity: enFocos ? 0.55 : 1, background: enFocos ? "rgba(48,209,88,.06)" : od ? "rgba(255,59,48,.06)" : tw ? "rgba(0,122,255,.04)" : "transparent", borderLeft: enFocos ? "3px solid var(--green)" : tw ? "3px solid var(--blue)" : od ? "3px solid var(--red)" : "3px solid transparent" }}>
                  {/* Subtarea: sangría + glifo. Tarea: el punto de fase de siempre. */}
                  {isSub
                    ? <span style={{ color: C.tx3, fontSize: 10, flexShrink: 0, lineHeight: 1 }} title="Subtarea">↳</span>
                    : <span style={{ width: 6, height: 6, borderRadius: "50%", background: PHASES[it.phase] || "#555", flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <span style={{ color: C.tx2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{it.name}</span>
                    {isSub && <span style={{ color: C.tx3, fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{it.parentName}</span>}
                  </span>
                  {!isSub && it.subsTotal > 0 && <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}><div style={{ width: 32, height: 4, borderRadius: 2, background: C.bg4, overflow: "hidden" }}><div style={{ width: `${(it.subsDone / it.subsTotal) * 100}%`, height: "100%", background: it.subsDone === it.subsTotal ? C.green : C.blue, borderRadius: 2 }} /></div><span style={{ fontFamily: F.mono, fontSize: 9, color: C.tx3 }}>{it.subsDone}/{it.subsTotal}</span></div>}
                  {od && <span style={{ fontFamily: F.mono, color: C.red, fontWeight: 700, fontSize: 10 }}>-{tl.end ? daysDiff(TODAY, tl.end) : "?"}d</span>}
                  {/* Con un solo responsable se muestra su nombre. Con varios se
                      pone "Varios owners" y la lista completa va en el tooltip:
                      pintar el primero del texto de Monday hacía parecer que la
                      lista estaba mal filtrada, porque podía ser de otro squad. */}
                  <span
                    style={{ color: C.tx3, fontSize: 10, flexShrink: 0, whiteSpace: "nowrap", fontStyle: it.allOwners?.length > 1 ? "italic" : "normal", cursor: it.allOwners?.length > 1 ? "help" : "inherit" }}
                    title={it.allOwners?.length > 1 ? it.allOwners.join("\n") : (it.person || "")}
                  >
                    {it.allOwners?.length > 1 ? "Varios owners" : shortName(it.owners?.[0] || it.person)}
                  </span>
                  {tl.end && <span style={{ fontFamily: F.mono, color: od ? C.red : C.tx3, fontWeight: od ? 700 : 400, fontSize: 10 }}>{tl.end.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
                  <span style={{ color: enFocos ? C.green : C.blue, fontSize: 9, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap", minWidth: 52, textAlign: "right" }}>
                    {enFocos ? "✓ En focos" : "→ Foco"}
                  </span>
                </div>
                </React.Fragment>
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
