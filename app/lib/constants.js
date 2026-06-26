'use client'
// lib/constants.js — config del equipo, board y agenda
// Solo contiene DATOS y CONSTANTES. Funciones utilitarias viven en utils.js.

// BOARD_ID: lee de env var NEXT_PUBLIC_MONDAY_BOARD_ID si existe, con fallback al valor por defecto.
// En Vercel, configurar NEXT_PUBLIC_MONDAY_BOARD_ID = 18044324200 (debe coincidir con MONDAY_BOARD_ID).
export const BOARD_ID = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_MONDAY_BOARD_ID
  ? Number(process.env.NEXT_PUBLIC_MONDAY_BOARD_ID)
  : 18044324200;
export const GROUP_DELIVERY = "group_mm15cfz2"; // único grupo de trabajo
export const GROUP_ACUERDOS = "group_mm1mhsd1"; // para crear compromisos de weekly
// SLACK_GENERAL_CHANNEL removido — se usa process.env.SLACK_CHANNEL en /api/slack (server-side only)
export const COL_IDS = ["person","color_mkz0s203","color_mkz09na","timerange_mkzcqv0j","date_mm1b10rx","date_mkzchmsq","color_mkzjvp66","timerange_mkzx7r55"];
// Fecha en timezone México — consistente entre servidor (UTC) y cliente (CDMX)
// Evita hydration mismatch React #418/#423/#425 entre 00:00 UTC y 06:00 CDMX
function _getTodayMexStr() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date()); // "2026-04-30" — no split/trim needed
}
export const TODAY_STR = _getTodayMexStr();
export const TODAY = new Date(TODAY_STR + "T12:00:00");
export const STORE_KEY = `weekly:${TODAY_STR}`;
export const CACHE_KEY = "monday-cache-v3"; // v3: pagination con filtro de grupo correcto

export const SQUADS = [
  { id: "inbound",     name: "Inbound Studio",          color: "#FF375F", lead: "Jean Pierre" },
  { id: "performance", name: "Performance y Conversión", color: "#30D158", lead: "Iris" },
  { id: "revops",      name: "RevOps & Analytics",       color: "#0A84FF", lead: "César" },
  { id: "portafolio",  name: "Portafolio y Ecosistema",  color: "#FF2D97", lead: "David" },
  { id: "outbound",    name: "Outbound y Pipeline",      color: "#FFD60A", lead: "Ileana" },
  { id: "politico",    name: "Político-Electoral",        color: "#64D2FF", lead: "Angel Toledano", defaultPresenter: "Angel Toledano" },
  { id: "pr",          name: "PR Ceci",                  color: "#BF5AF2", lead: "Efraín Maciel",  defaultPresenter: "Efraín Maciel" },
];

export const SQUAD_ALIASES = {
  "REVOPS Y ANALITYCS": "RevOps & Analytics",
  "Portafolio y ecosistema": "Portafolio y Ecosistema",
  "PR & Brand": "Portafolio y Ecosistema",
  "RevOps": "RevOps & Analytics",
  "Mkt Digital": "Performance y Conversión",
  "Squad 1": "Inbound Studio",
  "Squad 2": "Portafolio y Ecosistema",
  "Squad 3": "Performance y Conversión",
  "Mkt Corp": "Mkt Corp",
  "Seleccionar": "Sin asignar",
};

export const PHASES = {
  "⏳Backlog": "#475569", "🚧 Sprint": "#F59E0B", "👀 Review": "#06B6D4",
  "⚙️ Modificación": "#A855F7", "✅ Done": "#22C55E", "🚫 Detenido": "#EF4444",
};

export const AGENDA = [
  { id: "apertura",    label: "Apertura CMO",         fixed: "Franco",          start: 0,  dur: 5,  color: "#8E8E93", tab: "home" },
  { id: "panorama",   label: "Panorama Semanal",      fixed: "Víctor",          start: 5,  dur: 10, color: "#818CF8", tab: "panorama" },
  { id: "inbound",    label: "Inbound Studio",        squad: true,              start: 15, dur: 5,  color: "#FF375F", tab: "focos", sq: "inbound" },
  { id: "performance",label: "Performance",           squad: true,              start: 20, dur: 5,  color: "#30D158", tab: "focos", sq: "performance" },
  { id: "revops",     label: "RevOps",                squad: true,              start: 25, dur: 5,  color: "#0A84FF", tab: "focos", sq: "revops" },
  { id: "portafolio", label: "Portafolio",            squad: true,              start: 30, dur: 5,  color: "#FF2D97", tab: "focos", sq: "portafolio" },
  { id: "outbound",   label: "Outbound",              squad: true,              start: 35, dur: 5,  color: "#FFD60A", tab: "focos", sq: "outbound" },
  { id: "politico",   label: "Político-Electoral",    squad: true,              start: 40, dur: 5,  color: "#64D2FF", tab: "focos", sq: "politico" },
  { id: "pr",         label: "PR Ceci",               squad: true,              start: 45, dur: 5,  color: "#BF5AF2", tab: "focos", sq: "pr" },
  { id: "cierre",     label: "Compromisos y Cierre",  fixed: "Víctor + Franco", start: 50, dur: 10, color: "#8E8E93", tab: "compromisos" },
];

// PERSONAS — lista completa del equipo de Mkt Corporativo.
// MANTENIMIENTO: cuando alguien entra o sale del equipo, actualizar AMBOS:
//   1. Este array (agregar/quitar la persona con su squad)
//   2. app/lib/server-constants.js > MONDAY_USERS (agregar/quitar el Monday user ID)
// Los SDRs (sdr: true) no aparecen en la carga semanal pero si en la lista general.
// Las estrellas (star: true) son lideres de squad o roles clave.
export const PERSONAS = [
  { name: "Franco Cruzat",           squad: "CMO",                    star: true },
  { name: "Víctor Tzili",            squad: "PMO",                    star: true },
  { name: "Jean Pierre Barroilhet",  squad: "Inbound Studio",         star: true },
  { name: "Paul Zárate",             squad: "Inbound Studio" },
  { name: "Andrea Jurado",           squad: "Inbound Studio" },
  { name: "Arath Escamilla",         squad: "Inbound Studio" },
  { name: "Andry Carvajal",          squad: "Inbound Studio" },
  { name: "Efraín Maciel",            squad: "PR Ceci",                star: true },
  { name: "Iris Múgica",             squad: "Performance y Conversión", star: true },
  { name: "Fernando Borges",         squad: "Performance y Conversión" },
  { name: "Marco Antonio Juárez",    squad: "Performance y Conversión" },
  { name: "Diana Cruz",              squad: "Performance y Conversión" },
  { name: "Santiago Arango",         squad: "Performance y Conversión" },
  { name: "César Mejía",             squad: "RevOps & Analytics",     star: true },
  { name: "Adrián González",         squad: "RevOps & Analytics" },
  { name: "Diego Luna",              squad: "RevOps & Analytics" },
  { name: "David Porchini",          squad: "Portafolio y Ecosistema", star: true },
  { name: "Carolina Rojas",          squad: "Portafolio y Ecosistema" },
  { name: "Sergio Franco",           squad: "Portafolio y Ecosistema" },
  { name: "Tairi Medina",            squad: "Portafolio y Ecosistema" },
  { name: "Ileana Cruz",             squad: "Outbound y Pipeline",    star: true },
  { name: "Jennifer",                squad: "Outbound y Pipeline",    sdr: true },
  { name: "Edna",                    squad: "Outbound y Pipeline",    sdr: true },
  { name: "Neyby",                   squad: "Outbound y Pipeline",    sdr: true },
  { name: "Leodegario",              squad: "Outbound y Pipeline",    sdr: true },
  { name: "Aliosha",                 squad: "Outbound y Pipeline",    sdr: true },
  { name: "Elizabeth Gómez",         squad: "Outbound y Pipeline",    sdr: true },
  { name: "Angel Toledano",          squad: "Político-Electoral",     star: true },
];

// MONDAY_USERS movido a lib/server-constants.js — IDs no deben estar en el bundle del frontend
// La API route /api/monday-write ahora resuelve personName → personId server-side

// normalizeSquad: única función que vive aquí porque depende directamente de SQUAD_ALIASES
export function normalizeSquad(raw) { return SQUAD_ALIASES[raw] || raw; }

export const emptyWeekly = () => ({ date: TODAY_STR, presenters: {}, focos: {}, compromisos: [], synced: [] });
