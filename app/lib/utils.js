'use client'
// lib/utils.js — funciones puras de fecha, analisis y helpers
// Fuente canonica para TODAS las funciones utilitarias. constants.js solo tiene datos.
import { TODAY_STR, TODAY, PERSONAS, SQUAD_ALIASES, SQUADS, normalizeSquad as _normalizeSquad } from './constants'

// Re-export normalizeSquad de constants.js (vive ahi porque depende de SQUAD_ALIASES)
export { normalizeSquad } from './constants'
const normalizeSquad = _normalizeSquad

export const PERSON_NAMES = PERSONAS.map((p) => p.name);

// Cache module-level para normalizePersonName — evita ~25k comparaciones de string por analisis
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
  const now = new Date(TODAY_STR);
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
  const now = new Date(TODAY_STR);
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
