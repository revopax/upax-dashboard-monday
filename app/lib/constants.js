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

// SQUADS — reorg jul-2026.
// OJO con los `id`: son claves de datos persistidos (wd.focos[id], wd.presenters[id],
// blockTimes[id], minutas historicas en Upstash), asi que NO se renombran aunque el
// `name` haya cambiado. Por eso hoy:
//   id "inbound"     → "Performance y Conversión"  (el ex-Inbound Studio, ahora Fernando)
//   id "performance" → "Web y contenidos"          (el ex-Performance de Iris)
// El squad "pr" (PR Ceci) se disolvio: Efrain paso a Performance y Conversión.
export const SQUADS = [
  { id: "inbound",     name: "Performance y Conversión", color: "#FF375F", lead: "Fernando Borges" },
  { id: "performance", name: "Web y contenidos",         color: "#30D158", lead: "Iris" },
  { id: "revops",      name: "RevOps & Analytics",       color: "#0A84FF", lead: "César" },
  { id: "portafolio",  name: "Portafolio y Ecosistema",  color: "#FF2D97", lead: "David" },
  { id: "outbound",    name: "Outbound y Pipeline",      color: "#FFD60A", lead: "Ileana" },
  { id: "politico",    name: "Político-Electoral",       color: "#64D2FF", lead: "Angel Toledano", defaultPresenter: "Angel Toledano" },
];

export const SQUAD_ALIASES = {
  "REVOPS Y ANALITYCS": "RevOps & Analytics",
  "Portafolio y ecosistema": "Portafolio y Ecosistema",
  "PR & Brand": "Portafolio y Ecosistema",
  "RevOps": "RevOps & Analytics",
  "Squad 2": "Portafolio y Ecosistema",
  "Seleccionar": "Sin asignar",

  // Etiquetas que el board usa hoy y que no coincidían exactamente con el nombre
  // canónico. Sin estas tres, 77 items no resolvían a ningún squad.
  "RevOps y Analytics": "RevOps & Analytics",  // el board usa "y", el canónico "&"
  "Web & Contenidos": "Web y contenidos",      // el board usa "&", el canónico "y"
  "Mkt Político": "Político-Electoral",

  // ── Reorg jul-2026: nombres viejos que ya no son canonicos ──────────────────
  "Inbound Studio": "Performance y Conversión", // ex-Inbound Studio → hoy de Fernando
  "Squad 1": "Performance y Conversión",
  "Mkt Digital": "Web y contenidos",            // ex-Performance de Iris
  "Squad 3": "Web y contenidos",
  "PR Ceci": "Performance y Conversión",         // squad disuelto → Efrain se fue aqui
  //
  // ⚠️ ACCION REQUERIDA EN EL BOARD DE MONDAY (columna color_mkz0s203)
  // La etiqueta "Performance y Conversión" del board todavia significa el squad de
  // Iris, que ahora se llama "Web y contenidos". Esto NO se puede resolver con un
  // alias: "Performance y Conversión" es tambien el nombre NUEVO del ex-Inbound, y
  // aliasarlo romperia ese squad (normalizeSquad dejaria de ser idempotente).
  // Hay que renombrar las dos etiquetas en Monday, en este orden:
  //     "Performance y Conversión" → "Web y contenidos"
  //     "Inbound Studio"           → "Performance y Conversión"
  // Monday propaga el rename a los items existentes, asi que el historico queda bien.
  // Mientras no se haga, los items de Iris caen en el squad de Fernando.
};

export const PHASES = {
  "⏳Backlog": "#475569", "🚧 Sprint": "#F59E0B", "👀 Review": "#06B6D4",
  "⚙️ Modificación": "#A855F7", "✅ Done": "#22C55E", "🚫 Detenido": "#EF4444",
};

// AGENDA — reorg jul-2026: se elimino el bloque "PR Ceci" (squad disuelto) y se
// cerro el hueco, asi que la weekly pasa de 60 a 55 min. Los `start` son solo
// display; el timer navega por indice (ver hooks/useWeeklyTimer.js).
export const AGENDA = [
  { id: "apertura",    label: "Apertura CMO",             fixed: "Franco", start: 0,  dur: 5,  color: "#8E8E93", tab: "home" },
  { id: "panorama",   label: "Panorama Semanal",          fixed: "Franco", start: 5,  dur: 10, color: "#818CF8", tab: "panorama" },
  { id: "inbound",    label: "Performance y Conversión",  squad: true,     start: 15, dur: 5,  color: "#FF375F", tab: "focos", sq: "inbound" },
  { id: "performance",label: "Web y contenidos",          squad: true,     start: 20, dur: 5,  color: "#30D158", tab: "focos", sq: "performance" },
  { id: "revops",     label: "RevOps",                    squad: true,     start: 25, dur: 5,  color: "#0A84FF", tab: "focos", sq: "revops" },
  { id: "portafolio", label: "Portafolio",                squad: true,     start: 30, dur: 5,  color: "#FF2D97", tab: "focos", sq: "portafolio" },
  { id: "outbound",   label: "Outbound",                  squad: true,     start: 35, dur: 5,  color: "#FFD60A", tab: "focos", sq: "outbound" },
  { id: "politico",   label: "Político-Electoral",        squad: true,     start: 40, dur: 5,  color: "#64D2FF", tab: "focos", sq: "politico" },
  { id: "cierre",     label: "Compromisos y Cierre",      fixed: "Franco", start: 45, dur: 10, color: "#8E8E93", tab: "compromisos" },
];

// Duracion total de la weekly en minutos, DERIVADA de AGENDA (no hardcodear:
// al quitar el bloque de PR Ceci paso de 60 a 55 y el timer se desincronizaba).
export const WEEKLY_TOTAL_MIN = AGENDA.reduce((sum, b) => sum + b.dur, 0);

// PERSONAS — lista completa del equipo de Mkt Corporativo.
// MANTENIMIENTO: cuando alguien entra o sale del equipo, actualizar AMBOS:
//   1. Este array (agregar/quitar la persona con su squad)
//   2. app/lib/server-constants.js > MONDAY_USERS (agregar/quitar el Monday user ID)
// Los SDRs (sdr: true) no aparecen en la carga semanal pero si en la lista general.
// Las estrellas (star: true) son lideres de squad o roles clave.
// Reorg jul-2026 — salieron del area: Jean Pierre Barroilhet, Víctor Tzili,
// Andrea Jurado y Aliosha. No deben volver a aparecer en desplegables ni etiquetas.
export const PERSONAS = [
  { name: "Franco Cruzat",           squad: "CMO",                      star: true },
  { name: "Fernando Borges",         squad: "Performance y Conversión", star: true },
  { name: "Paul Zárate",             squad: "Performance y Conversión" },
  { name: "Andry Carvajal",          squad: "Performance y Conversión" },
  { name: "Efraín Maciel",           squad: "Performance y Conversión" },
  { name: "Iris Múgica",             squad: "Web y contenidos",         star: true },
  { name: "Marco Antonio Juárez",    squad: "Web y contenidos" },
  { name: "Diana Cruz",              squad: "Web y contenidos" },
  { name: "Santiago Arango",         squad: "Web y contenidos" },
  { name: "César Mejía",             squad: "RevOps & Analytics",       star: true },
  { name: "Adrián González",         squad: "RevOps & Analytics" },
  { name: "Diego Luna",              squad: "RevOps & Analytics" },
  { name: "David Porchini",          squad: "Portafolio y Ecosistema",  star: true },
  { name: "Carolina Rojas",          squad: "Portafolio y Ecosistema" },
  { name: "Sergio Franco",           squad: "Portafolio y Ecosistema" },
  { name: "Tairi Medina",            squad: "Portafolio y Ecosistema" },
  { name: "Arath Escamilla",         squad: "Portafolio y Ecosistema" },
  { name: "Ileana Cruz",             squad: "Outbound y Pipeline",      star: true },
  { name: "Jennifer",                squad: "Outbound y Pipeline",      sdr: true },
  { name: "Edna",                    squad: "Outbound y Pipeline",      sdr: true },
  { name: "Neyby",                   squad: "Outbound y Pipeline",      sdr: true },
  { name: "Leodegario",              squad: "Outbound y Pipeline",      sdr: true },
  { name: "Elizabeth Gómez",         squad: "Outbound y Pipeline",      sdr: true },
  { name: "Angel Toledano",          squad: "Político-Electoral",       star: true },

  // INACTIVOS — no aparecen en desplegables (PersonSelect los filtra), pero siguen
  // atribuyendo su trabajo al squad correcto en Panorama y en la minuta.
  //
  // Existen porque salieron del área con trabajo todavía activo en Monday, y sin
  // ellos esos items caerían al respaldo por etiqueta. Los gerentes los reasignan
  // a mano; cuando ya no tengan items, se pueden borrar de aquí.
  { name: "Jean Pierre Barroilhet",  squad: "Performance y Conversión", inactive: true },
  { name: "Andrea Jurado",           squad: "Performance y Conversión", inactive: true },
  { name: "Aliosha Albor",           squad: "Outbound y Pipeline",      inactive: true },
  // Cyndi trabaja con Portafolio pero no es del equipo de Mkt Corp: se marca
  // inactive para atribuir sus items sin ofrecerla en los selectores.
  { name: "Cyndi Lilibeth Pérez Ramírez", squad: "Portafolio y Ecosistema", inactive: true },
];

// PERSON_ALIASES — nombres distintos en Monday que son la MISMA persona.
// "Alejandro Maciel" es la cuenta de Monday de Efraín Maciel.
export const PERSON_ALIASES = {
  "Alejandro Maciel": "Efraín Maciel",
};

// MONDAY_USERS movido a lib/server-constants.js — IDs no deben estar en el bundle del frontend
// La API route /api/monday-write ahora resuelve personName → personId server-side

// normalizeSquad: única función que vive aquí porque depende directamente de SQUAD_ALIASES
export function normalizeSquad(raw) { return SQUAD_ALIASES[raw] || raw; }

// emptyWeekly — shape inicial de una weekly.
// Los campos de sesion (status/elapsed/blockTimes/currentBlockIdx) se persisten para
// que la weekly sobreviva un reload: antes vivian solo en estado de React, asi que al
// recargar desaparecia la barra del timer y con ella el boton de finalizar, dejando
// weeklies imposibles de cerrar.
export const emptyWeekly = () => ({
  date: TODAY_STR, presenters: {}, focos: {}, compromisos: [], synced: [],
  status: "draft", elapsed: 0, blockTimes: {}, currentBlockIdx: 0,
  startedAt: null, finishedAt: null,
});
