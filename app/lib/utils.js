'use client'
// lib/utils.js — funciones puras de fecha, analisis y helpers
// Fuente canonica para TODAS las funciones utilitarias. constants.js solo tiene datos.
import { TODAY_STR, TODAY, PERSONAS, PERSON_ALIASES, SQUAD_ALIASES, SQUADS, normalizeSquad as _normalizeSquad } from './constants'

// Re-export normalizeSquad de constants.js (vive ahi porque depende de SQUAD_ALIASES)
export { normalizeSquad } from './constants'
const normalizeSquad = _normalizeSquad

export const PERSON_NAMES = PERSONAS.map((p) => p.name);

// Cache module-level para normalizePersonName — evita ~25k comparaciones de string por analisis.
// NOTA TECNICA: Este cache crece indefinidamente durante la vida del modulo (una sesion de browser).
// En la practica el universo de nombres es ~30 personas, asi que el cache se estabiliza rapido.
// Si el equipo creciera a >500 personas, considerar un LRU cache o un WeakMap.
const _nameNormCache = new Map();

// Sin acentos y en minúsculas. Es lo que hacía falta: Monday trae "Adrian Gonzalez"
// y PERSONAS dice "Adrián González"; como la comparación exigía que TODAS las partes
// estuvieran contenidas, "adrian" nunca contenía "adrián" y 10 items quedaban sin
// squad. Comparar sin diacríticos resuelve ese caso y los que vengan.
const _fold = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normalizePersonName(mondayName) {
  if (!mondayName) return mondayName;
  if (_nameNormCache.has(mondayName)) return _nameNormCache.get(mondayName);
  const hit = (v) => { _nameNormCache.set(mondayName, v); return v; };

  // Alias explícitos: cuentas de Monday con otro nombre (ver PERSON_ALIASES).
  if (PERSON_ALIASES[mondayName]) return hit(PERSON_ALIASES[mondayName]);
  if (PERSON_NAMES.includes(mondayName)) return hit(mondayName);

  const lower = _fold(mondayName);
  for (const [alias, real] of Object.entries(PERSON_ALIASES)) {
    if (_fold(alias) === lower) return hit(real);
  }
  for (const pn of PERSON_NAMES) {
    const parts = _fold(pn).split(" ");
    if (parts.every(p => lower.includes(p))) return hit(pn);
  }
  for (const pn of PERSON_NAMES) {
    const parts = _fold(pn).split(" ");
    if (parts.length >= 2 && lower.includes(parts[0]) && parts.slice(1).some(p => lower.includes(p))) return hit(pn);
  }
  for (const pn of PERSON_NAMES) {
    const firstName = _fold(pn).split(" ")[0];
    if (firstName.length > 4 && lower.startsWith(firstName)) return hit(pn);
  }
  return hit(mondayName);
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

// DONE_PHASES — fases que significan trabajo TERMINADO.
//
// "✅ Materiales listos" solo existe en la columna de fase de SUBTAREA y cierra
// igual que Done. Como no estaba contemplada, esas 33 subtareas no aparecían en
// ninguna vista (ni activas ni cerradas) y encima podían salir como vencidas,
// porque la única excepción era el literal "✅ Done".
export const DONE_PHASES = ["✅ Done", "✅ Materiales listos"];
export function isDonePhase(ph) { return DONE_PHASES.includes(ph); }

export function isOverdue(it) {
  const ph = it.column_values?.color_mkz09na;
  if (isDonePhase(ph) || ph === "🚫 Detenido") return false;
  const tl = parseTL(it.column_values?.timerange_mkzcqv0j);
  return tl.end ? tl.end < TODAY : false;
}

export function isActive(ph) { return ["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(ph); }

// Columnas de Monday por nivel. Las subtareas NO comparten columnas con su tarea
// padre: tienen su propia fase y su propio timeline, con otros ids.
export const WORK_COLS = {
  task: { phase: "color_mkz09na",  timeline: "timerange_mkzcqv0j" },
  sub:  { phase: "color_mkzjvp66", timeline: "timerange_mkzx7r55" },
};

// isOverdueWork — vencido, sobre un item ya normalizado por getSquadWorkItems.
// Equivale a isOverdue() pero sirve para los dos niveles; isOverdue() lee directo
// las columnas de tarea y por eso no aplica a subtareas.
export function isOverdueWork(w) {
  if (isDonePhase(w.phase) || w.phase === "🚫 Detenido") return false;
  const tl = parseTL(w.timeline);
  return tl.end ? tl.end < TODAY : false;
}

// splitOwners — separa los responsables de un item entre los de ESTE squad y los
// del resto. La columna `person` de Monday puede traer varias personas separadas
// por coma; se parte y se normaliza cada nombre (normalizePersonName tolera
// variantes de acentuación y nombres parciales).
//
// `recognized` cuenta solo a los que existen en PERSONAS: un nombre desconocido no
// debe impedir el respaldo a la etiqueta de squad del item.
//
// Existe además para la UI: mostrar el primer nombre del texto a secas hacía
// parecer que la lista estaba mal filtrada (una subtarea de "Iris, César" salía en
// RevOps mostrando a Iris, que es de otro squad).
export function splitOwners(personText, squadName) {
  const mine = [], others = [];
  for (const raw of String(personText || '').split(/[,;]/)) {
    const name = raw.trim();
    if (!name) continue;
    const persona = PERSONAS.find((p) => p.name === normalizePersonName(name));
    if (!persona) continue;
    (persona.squad === squadName ? mine : others).push(persona.name);
  }
  return { mine, others, recognized: mine.length + others.length };
}

// belongsToSquad — ¿este trabajo es de este squad?
//
// Manda el RESPONSABLE, no la etiqueta de squad del board. Dos razones:
//   1. Renombrar la etiqueta en Monday rompe el histórico, así que el dashboard
//      no puede depender de cómo esté escrita.
//   2. Un proyecto multi-squad reparte cada subtarea al equipo de quien la lleva,
//      en vez de mandar el proyecto entero a un solo squad.
// Si el item tiene varios responsables, aparece en el squad de cada uno.
//
// Sin responsable reconocible se cae a la etiqueta del item, para no hacer
// desaparecer trabajo sin asignar. Las subtareas usan la etiqueta de su tarea
// padre, porque en Monday no tienen columna de squad propia.
function ownershipFor(personText, fallbackLabel, squadName) {
  const { mine, others, recognized } = splitOwners(personText, squadName);
  const belongs = recognized ? mine.length > 0 : normalizeSquad(fallbackLabel) === squadName;
  // `owners` = los de este squad; `allOwners` = todos los reconocidos, para poder
  // mostrar "Varios owners" con la lista completa en el tooltip.
  return { belongs, owners: mine, allOwners: [...mine, ...others] };
}

// primarySquadOf — UN solo squad para un texto de responsables. Devuelve null si
// ninguno es reconocible, o si hay responsables de squads distintos (ambiguo).
//
// Solo cuentan squads que existen en SQUADS: hay personas con squad "CMO" o "PMO",
// que son roles y no squads de la weekly. Sin este filtro sus items se atribuían a
// "CMO" y desaparecían de Panorama, que solo itera SQUADS.
const SQUAD_NAMES = new Set(SQUADS.map((s) => s.name));
function primarySquadOf(personText) {
  const squads = new Set();
  for (const raw of String(personText || '').split(/[,;]/)) {
    const name = raw.trim();
    if (!name) continue;
    const persona = PERSONAS.find((p) => p.name === normalizePersonName(name));
    if (persona && SQUAD_NAMES.has(persona.squad)) squads.add(persona.squad);
  }
  return squads.size === 1 ? [...squads][0] : null;
}

// squadOfTask / squadOfSubtask — a qué squad se ATRIBUYE un trabajo, para conteos.
//
// Distinto de getSquadWorkItems, que es para listas: ahí un item con dueños de
// varios squads aparece en todos. Aquí no puede, porque las barras de Panorama son
// una partición y deben sumar el total; si un item contara dos veces, la suma por
// squad dejaría de cuadrar con el total del board.
//
// Cadena de resolución de una TAREA:
//   responsables de un mismo squad → ese squad
//   ambiguo o sin reconocer        → etiqueta de squad del board
export function squadOfTask(item) {
  const cv = item?.column_values || {};
  return primarySquadOf(cv.person) || normalizeSquad(cv.color_mkz0s203 || "?");
}

// Cadena de resolución de una SUBTAREA:
//   un solo squad entre sus responsables → ese squad
//   varios squads (multi-squad)          → el squad de la TAREA PADRE
//   sin responsables reconocibles        → el squad de la tarea padre
// La subtarea no tiene etiqueta propia en Monday, así que el último respaldo es
// siempre el de su tarea, que ya resuelve por squadOfTask.
export function squadOfSubtask(sub, parentItem) {
  return primarySquadOf(sub?.column_values?.person) || squadOfTask(parentItem);
}

// getSquadWorkItems — trabajo activo de un squad: subtareas primero, luego tareas.
//
// Cada nivel se evalúa por su PROPIA fase y su PROPIO responsable: una subtarea en
// Sprint aparece aunque su tarea padre siga en Backlog, y va al squad de quien la
// lleva aunque el proyecto esté etiquetado con otro.
export function getSquadWorkItems(items, squadName) {
  const subs = [], tasks = [];

  for (const it of items || []) {
    const cv = it.column_values || {};
    const label = cv.color_mkz0s203;

    for (const s of it.subitems || []) {
      const scv = s.column_values || {};
      const phase = scv[WORK_COLS.sub.phase];
      if (!isActive(phase)) continue;
      const own = ownershipFor(scv.person, label, squadName);
      if (!own.belongs) continue;
      subs.push({
        id: `sub-${s.id}`, name: s.name, kind: "sub", phase,
        timeline: scv[WORK_COLS.sub.timeline] || null,
        // `person` es el texto crudo de Monday; `owners` son los de ESTE squad,
        // que es lo que debe verse en la fila.
        person: scv.person || null,
        owners: own.owners, allOwners: own.allOwners,
        parentName: it.name,
      });
    }

    const phase = cv[WORK_COLS.task.phase];
    if (!isActive(phase)) continue;
    const own = ownershipFor(cv.person, label, squadName);
    if (!own.belongs) continue;
    const allSubs = it.subitems || [];
    tasks.push({
      id: `task-${it.id}`, name: it.name, kind: "task", phase,
      timeline: cv[WORK_COLS.task.timeline] || null,
      person: cv.person || null,
      owners: own.owners, allOwners: own.allOwners,
      subsTotal: allSubs.length,
      subsDone: allSubs.filter((s) => isDonePhase(s.column_values?.[WORK_COLS.sub.phase])).length,
    });
  }

  return [...subs, ...tasks];
}

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
      if (!matchesPerson(sub.column_values?.person) || isDonePhase(subPhase)) return;
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
