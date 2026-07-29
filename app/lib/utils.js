'use client'
// lib/utils.js — funciones puras de fecha, analisis y helpers
// Fuente canonica para TODAS las funciones utilitarias. constants.js solo tiene datos.
import { TODAY_STR, TODAY, PERSONAS, SQUAD_ALIASES, SQUADS, normalizeSquad as _normalizeSquad } from './constants'

// Re-export normalizeSquad de constants.js (vive ahi porque depende de SQUAD_ALIASES)
export { normalizeSquad } from './constants'
const normalizeSquad = _normalizeSquad

export const PERSON_NAMES = PERSONAS.map((p) => p.name);

// Cache module-level para normalizePersonName — evita ~25k comparaciones de string por analisis.
// NOTA TECNICA: Este cache crece indefinidamente durante la vida del modulo (una sesion de browser).
// En la practica el universo de nombres es ~30 personas, asi que el cache se estabiliza rapido.
// Si el equipo creciera a >500 personas, considerar un LRU cache o un WeakMap.
const _nameNormCache = new Map();
export function normalizePersonName(mondayName) {
  if (!mondayName) return mondayName;
  if (_nameNormCache.has(mondayName)) return _nameNormCache.get(mondayName);
  if (PERSON_NAMES.includes(mondayName)) {
    _nameNormCache.set(mondayName, mondayName);
    return mondayName;
  }
  const lower = mondayName.toLowerCase();
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.every(p => lower.includes(p))) { _nameNormCache.set(mondayName, pn); return pn; }
  }
  for (const pn of PERSON_NAMES) {
    const parts = pn.toLowerCase().split(" ");
    if (parts.length >= 2 && lower.includes(parts[0]) && parts.slice(1).some(p => lower.includes(p))) { _nameNormCache.set(mondayName, pn); return pn; }
  }
  for (const pn of PERSON_NAMES) {
    const firstName = pn.toLowerCase().split(" ")[0];
    if (firstName.length > 4 && lower.startsWith(firstName)) {
      _nameNormCache.set(mondayName, pn);
      return pn;
    }
  }
  _nameNormCache.set(mondayName, mondayName);
  return mondayName;
}
export function isTeamMember(name) { return PERSON_NAMES.includes(normalizePersonName(name)); }

export function parseTL(t) {
  if (!t || typeof t !== "string") return { start: null, end: null };
  const p = t.split(" - ");
  const s = p[0] ? new Date(p[0]) : null;
  const e = p[1] ? new Date(p[1]) : null;
  return { start: s && !isNaN(s.getTime()) ? s : null, end: e && !isNaN(e.getTime()) ? e : null };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}

export function getMondayStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const daysToMon = day === 0 ? 6 : day - 1;
  return addDays(dateStr, -daysToMon);
}

export function daysDiff(a, b) { return Math.round((a - b) / 86400000); }

export function isOverdue(it) {
  const ph = it.column_values?.color_mkz09na;
  if (ph === "✅ Done" || ph === "🚫 Detenido") return false;
  const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
  return tl.end ? tl.end < TODAY : false;
}

export function isActive(ph) { return ["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(ph); }

export function getWeekBounds() {
  const now = new Date(TODAY_STR + 'T12:00:00');
  const day = now.getDay();
  const mon = new Date(now);
  if (day === 0) mon.setDate(now.getDate() - 6);
  else mon.setDate(now.getDate() - (day - 1));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return { start: mon, end: fri };
}
export const WEEK = getWeekBounds();

export function getPrevWeekBounds() {
  const now = new Date(TODAY_STR + 'T12:00:00');
  const day = now.getDay();
  const lastMon = new Date(now);
  lastMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const prevStart = new Date(lastMon);
  prevStart.setDate(lastMon.getDate() - 7);
  const prevEnd = new Date(lastMon);
  prevEnd.setDate(lastMon.getDate() - 1);
  return { start: prevStart, end: prevEnd };
}
export const PREV_WEEK = getPrevWeekBounds();

export function overlapsThisWeek(timelineStr) {
  if (!timelineStr) return false;
  const tl = parseTL(timelineStr);
  if (!tl.start || !tl.end) return false;
  return tl.start <= WEEK.end && tl.end >= WEEK.start;
}

export function pctColor(pct) { return pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--yellow)" : "var(--red)"; }
export function shortName(n) { return (n || "—").split(" ").slice(0, 2).join(" "); }

// formatLongDate — "2026-07-27" → "lunes, 27 de julio de 2026".
//
// SIEMPRE ancla la hora a T12:00:00 (mediodia local). Motivo: `new Date("2026-07-27")`
// se parsea como medianoche UTC, y al formatear en CDMX (UTC-6) retrocede 6h y cae
// en el dia anterior ("domingo, 26 de julio"). Ese era el bug de las fechas de las
// minutas. Mediodia deja 12h de margen a cada lado, asi que ningun offset lo mueve.
export function formatLongDate(dateStr) {
  if (!dateStr) return "Fecha no disponible";
  const d = new Date(String(dateStr).slice(0, 10) + "T12:00:00");
  if (isNaN(d.getTime())) return "Fecha no disponible";
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// formatMonthYear — "2026-07" (o "2026-07-27") → "julio de 2026". Mismo anclaje.
export function formatMonthYear(ymStr) {
  if (!ymStr) return "";
  const d = new Date(String(ymStr).slice(0, 7) + "-01T12:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

// weeklyHasContent — ¿hay algo capturado que valga la pena persistir?
//
// OJO: esto NO decide si la weekly esta iniciada — para eso esta weeklyStarted().
// Su unico uso es evitar que abrir la app escriba en Upstash un registro vacio.
// Contar `presenters` aqui es seguro porque ya no se hidrata ningun presentador
// por defecto de forma automatica; solo se guarda lo que alguien elige a mano.
export function weeklyHasContent(w) {
  if (!w) return false;
  if (w.minutaText?.trim()) return true;
  if ((w.compromisos || []).some((c) => c.que?.trim())) return true;
  if (SQUADS.some((s) => w.presenters?.[s.id]?.trim())) return true;
  return SQUADS.some((s) =>
    normalizeFocos(w.focos?.[s.id]).some((f) => f.focos?.trim() || f.blocker?.trim() || f.necesito?.trim())
  );
}

// weeklyStarted — una weekly SOLO se considera iniciada si alguien apreto el boton
// de arrancar (deja `startedAt`) o si el cronometro llego a correr.
//
// A proposito NO se infiere de que haya contenido capturado: el efecto que hidrata
// el presentador por defecto (Angel en Político-Electoral) escribe en `presenters`
// sin intervencion del usuario, y con la heuristica de contenido eso hacia aparecer
// la barra del timer sola, como si la weekly ya hubiera empezado.
export function weeklyStarted(w) {
  if (!w) return false;
  return !!w.startedAt || (w.elapsed || 0) > 0;
}

// weeklyClosed — cerrada explicitamente, o de las viejas (sin `status`) que ya
// tienen su minuta guardada.
export function weeklyClosed(w) {
  if (!w) return false;
  if (w.status === "finished") return weeklyStarted(w) || !!w.minutaText;
  return !w.status && !!w.minutaText;
}

// isWeeklyEnCurso — weekly iniciada pero no cerrada.
export function isWeeklyEnCurso(w) {
  return weeklyStarted(w) && !weeklyClosed(w);
}

// migrateWeekly — normaliza weeklies guardadas con el shape viejo. Se aplica al
// LEER (no con un script de una vez) porque una pestaña abierta con estado viejo en
// memoria puede sobrescribir una migracion hecha directo en el store.
//
// Reorg jul-2026: el squad "pr" (PR Ceci) se disolvio y Efrain paso a Performance y
// Conversión (id "inbound"), asi que sus focos se fusionan ahi. Sin esto quedaban
// guardados pero invisibles, porque las vistas iteran SQUADS.
export function migrateWeekly(w) {
  if (!w || !w.focos?.pr) return w;
  const pr = normalizeFocos(w.focos.pr);
  if (!pr.length) {
    const { pr: _drop, ...focos } = w.focos;
    return { ...w, focos };
  }
  const { pr: _drop, ...rest } = w.focos;
  const merged = [...normalizeFocos(rest.inbound), ...pr].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return { ...w, focos: { ...rest, inbound: merged } };
}

// presenterFor — presentador efectivo de un bloque de squad: lo que se eligio en
// la weekly, o el defaultPresenter del squad si nadie lo ha tocado (ej. Angel en
// Político-Electoral, que debe verse siempre preseleccionado).
// Se resuelve en cada lectura, no solo al hidratar, para que no dependa de que
// wd ya haya cargado desde Upstash cuando se monta la agenda.
export function presenterFor(presenters, squadId) {
  const chosen = presenters?.[squadId];
  if (chosen?.trim()) return chosen;
  return SQUADS.find((s) => s.id === squadId)?.defaultPresenter || "";
}

export function getPersonDetail(name, items) {
  const weekTasks = [], otherTasks = [];
  const nameWords = name.toLowerCase().split(" ");
  const matchesPerson = (personStr) => {
    if (!personStr) return false;
    const lower = personStr.toLowerCase();
    return nameWords.every((w) => lower.includes(w));
  };
  items.forEach((it) => {
    const cv = it.column_values || {}, ph = cv.color_mkz09na;
    if (!isActive(ph) && ph !== "🚫 Detenido") return;
    const parentTimeline = cv.timerange_mkzcqv0j;
    const parentThisWeek = overlapsThisWeek(parentTimeline);
    (it.subitems || []).forEach((sub) => {
      const subPhase = sub.column_values?.color_mkzjvp66;
      if (!matchesPerson(sub.column_values?.person) || subPhase === "✅ Done") return;
      const subTimeline = sub.column_values?.timerange_mkzx7r55;
      const subThisWeek = subTimeline ? overlapsThisWeek(subTimeline) : false;
      const task = { name: sub.name, parentName: it.name, phase: subPhase || "🚧 Sprint" };
      if (subThisWeek) weekTasks.push(task);
      else otherTasks.push(task);
    });
    if ((it.subitems || []).length === 0 && matchesPerson(cv.person)) {
      const task = { name: it.name, parentName: null, phase: ph };
      if (parentThisWeek) weekTasks.push(task);
      else otherTasks.push(task);
    }
  });
  return { weekTasks, otherTasks, weekCount: weekTasks.length, totalCount: weekTasks.length + otherTasks.length };
}

export const PHASE_SHORT = {
  "⏳Backlog": { label: "BKL", color: "#8E8E93" },
  "🚧 Sprint": { label: "SPR", color: "#F59E0B" },
  "👀 Review": { label: "REV", color: "#06B6D4" },
  "⚙️ Modificación": { label: "MOD", color: "#A855F7" },
  "🚫 Detenido": { label: "DET", color: "#EF4444" },
};

export function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  // Fallback para contextos sin permisos o browsers legacy
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
  document.body.appendChild(ta); ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
  return ok;
}

// Normalize focos data: handles both legacy v7.x (single object) and v9.x (array) schema
export function normalizeFocos(focosEntry) {
  if (Array.isArray(focosEntry)) return focosEntry;
  if (focosEntry?.focos || focosEntry?.blocker || focosEntry?.necesito) return [focosEntry];
  return [];
}

// Shared roadmap filter: active phases with deadline in current month, grouped by squad
export function getSprintRoadmap(items) {
  const now = new Date(TODAY_STR + 'T12:00:00')
  const year = now.getFullYear()
  const month = now.getMonth()
  const ACTIVE_PHASES = ['🚧 Sprint', '👀 Review', '⚙️ Modificación']

  const filtered = items.filter(it => {
    const cv = it.column_values || {}
    const phase = cv.color_mkz09na
    const deadline = cv.date_mm1b10rx
    if (!ACTIVE_PHASES.includes(phase) || !deadline) return false
    const [dy, dm] = deadline.split('-').map(Number)
    return dy === year && dm === month + 1
  })

  return sortBySquadThenDeadline(filtered)
}

// Roadmap filter for an arbitrary date range: active phases with deadline
// (date_mm1b10rx) inside [startDate, endDate], grouped/sorted by squad.
// Used by the Gantt when the user picks a cadence/range; getSprintRoadmap
// stays as the fixed current-month variant for the weekly minute.
export function getRoadmapInRange(items, startDate, endDate) {
  const ACTIVE_PHASES = ['🚧 Sprint', '👀 Review', '⚙️ Modificación']
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()

  const filtered = items.filter(it => {
    const cv = it.column_values || {}
    const deadline = cv.date_mm1b10rx
    if (!ACTIVE_PHASES.includes(cv.color_mkz09na) || !deadline) return false
    const [dy, dm, dd] = deadline.split('-').map(Number)
    const dlMs = new Date(dy, dm - 1, dd, 12, 0, 0).getTime()
    return dlMs >= startMs && dlMs <= endMs
  })

  return sortBySquadThenDeadline(filtered)
}

function sortBySquadThenDeadline(filtered) {
  const SQUAD_ORDER = SQUADS.map(s => s.name)
  filtered.sort((a, b) => {
    const sqA = SQUAD_ORDER.indexOf(normalizeSquad(a.column_values?.color_mkz0s203 || ''))
    const sqB = SQUAD_ORDER.indexOf(normalizeSquad(b.column_values?.color_mkz0s203 || ''))
    const orderA = sqA >= 0 ? sqA : 999
    const orderB = sqB >= 0 ? sqB : 999
    if (orderA !== orderB) return orderA - orderB
    return (a.column_values?.date_mm1b10rx || '').localeCompare(b.column_values?.date_mm1b10rx || '')
  })
  return filtered
}
