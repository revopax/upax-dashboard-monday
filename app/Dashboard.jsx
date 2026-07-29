'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  TODAY_STR, STORE_KEY, CACHE_KEY,
  SQUADS, AGENDA, PERSONAS, WEEKLY_TOTAL_MIN,
  emptyWeekly,
} from "./lib/constants";
import {
  normalizeSquad, normalizePersonName, isTeamMember,
  parseTL, addDays, getMondayStr, isOverdue, isActive,
  WEEK, PREV_WEEK,
  overlapsThisWeek, copyToClipboard, weeklyClosed, weeklyHasContent, isWeeklyEnCurso, migrateWeekly,
  squadOfTask, squadOfSubtask, WORK_COLS,
} from "./lib/utils";
import { storeGet, storeSet, storeDel, storeWeeklies } from "./lib/storage";
import { fetchAllItems, sendToSlack, authHeaders } from "./lib/api";
import { generateMinuta } from "./lib/minuta";
import { CSS } from "./lib/css";
import { useGDDData } from "./hooks/useGDDData";
import { C, R, F } from "./lib/tokens";
import { Card, CopyModal } from "./components/ui";
import { TimerZone } from "./components/TimerZone";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Code-split: each tab loads on demand
const TabSkeleton = () => <div style={{ textAlign: "center", padding: 40, color: C.tx3, fontSize: 12 }}>Cargando...</div>;
const TabHome = dynamic(() => import("./components/TabHome").then(m => ({ default: m.TabHome })), { loading: TabSkeleton, ssr: false });
const TabAgenda = dynamic(() => import("./components/TabAgenda").then(m => ({ default: m.TabAgenda })), { loading: TabSkeleton, ssr: false });
const TabPanorama = dynamic(() => import("./components/TabPanorama").then(m => ({ default: m.TabPanorama })), { loading: TabSkeleton, ssr: false });
const TabFocos = dynamic(() => import("./components/TabFocos").then(m => ({ default: m.TabFocos })), { loading: TabSkeleton, ssr: false });
const TabCompromisos = dynamic(() => import("./components/TabCompromisos").then(m => ({ default: m.TabCompromisos })), { loading: TabSkeleton, ssr: false });
const TabMinutasInline = dynamic(() => import("./components/TabMinutas").then(m => ({ default: m.TabMinutasInline })), { loading: TabSkeleton, ssr: false });
const AuditLogPanel = dynamic(() => import("./components/AuditLogPanel").then(m => ({ default: m.AuditLogPanel })), { ssr: false });
const PhaseModal = dynamic(() => import("./components/PhaseModal").then(m => ({ default: m.PhaseModal })), { ssr: false });
const MinutaLightbox = dynamic(() => import("./components/MinutaLightbox").then(m => ({ default: m.MinutaLightbox })), { ssr: false });
const WeekliesEnCurso = dynamic(() => import("./components/WeekliesEnCurso").then(m => ({ default: m.WeekliesEnCurso })), { ssr: false });

/* ═══════════════════════════════════════════════════════════════
   MAIN APP — Orquestador principal
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [items, setItems] = useState([]);
  const [itemsFingerprint, setItemsFingerprint] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [loadingMsg, setLoadingMsg] = useState("Iniciando...");
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("home");
  const [wd, setWd] = useState(emptyWeekly());
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [minutaDraft, setMinutaDraft] = useState("");
  const [minutaSaved, setMinutaSaved] = useState(false);
  const [slackStatus, setSlackStatus] = useState(null);
  const [activeSquad, setActiveSquad] = useState(SQUADS[0].id);
  const [currentBlockIdx, setCurrentBlockIdx] = useState(0);
  const [blockTimes, setBlockTimes] = useState({});
  const blockStartRef = useRef(null);
  const [presenterMode, setPresenterMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [minutaLightbox, setMinutaLightbox] = useState(null);
  const [enCursoOpen, setEnCursoOpen] = useState(false);
  // Cuántas weeklies (de cualquier fecha) están iniciadas y sin cerrar. Decide si el
  // botón "En curso" se muestra: si no hay ninguna, no tiene sentido ofrecerlo.
  const [enCursoCount, setEnCursoCount] = useState(0);
  const [copyModal, setCopyModal] = useState(null);
  const [phaseModal, setPhaseModal] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const intRef = useRef(null), startRef = useRef(null), elRef = useRef(0);

  // Hook unificado para datos GDD (Sheets + HubSpot + historial)
  const { gddData: hookGddData, mqlBreakdown, mqlBreakdownPrev, targets: gddTargets, history: gddHistory, setHistory: setGddHistory, loading: gddLoading, refetch: refetchGdd } = useGDDData();
  // appGddData: alias directo de hookGddData (eliminado estado espejo innecesario)
  const appGddData = hookGddData;

  // ── Sesion de la weekly ─────────────────────────────────────────────────────
  // El progreso del cronometro se persiste junto con wd. Se lee de refs (no del
  // state) para poder incluirlo en cualquier guardado sin re-crear el debounce en
  // cada tick del segundero.
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);
  const startedAtRef = useRef(null);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { finishedRef.current = finished; }, [finished]);

  // El estado cerrado/abierto lo manda SOLO finishedRef, que restoreSession fija al
  // cargar (incluyendo las weeklies viejas sin `status` pero con minuta guardada).
  // No se infiere del registro guardado en cada escritura: eso hacia imposible
  // reabrir una weekly cerrada, porque cualquier guardado la volvia a marcar finished.
  // El autosave no corre antes de restoreSession (ver loadedRef), asi que no hay
  // ventana en la que finishedRef este desactualizado.
  const withSession = useCallback((base) => ({
    ...base,
    status: finishedRef.current ? "finished" : "draft",
    elapsed: elapsedRef.current,
    blockTimes: blockTimesRef.current || {},
    currentBlockIdx: currentBlockIdxRef.current || 0,
    startedAt: startedAtRef.current || base?.startedAt || null,
    finishedAt: finishedRef.current ? (base?.finishedAt || new Date().toISOString()) : null,
  }), []);

  const saveFn = useCallback(async (d) => { await storeSet(STORE_KEY, withSession(d)); }, [withSession]);

  // reopenWeekly — vuelve a abrir la weekly cerrada de hoy sin perder nada
  // (focos, compromisos y la minuta ya escrita se conservan). Necesario porque el
  // estado `finished` ahora se persiste: sin esto, una vez cerrada quedaba el panel
  // de WEEKLY TERMINADA para siempre y no habia forma de retomar la sesion.
  // Para empezar de cero (borrando capturas) esta "Reset sesion" en el footer.
  const reopenWeekly = useCallback(async () => {
    finishedRef.current = false;
    minutaGeneratedRef.current = false;
    setFinished(false);
    setMinutaSaved(false);
    setSlackStatus(null);
    const next = { ...(wdRef.current || {}), status: "draft", finishedAt: null };
    setWd(next);
    await storeSet(STORE_KEY, withSession(next));
  }, [withSession]);

  // refreshEnCurso — recuenta las weeklies iniciadas y sin cerrar. Una sola request
  // (storeWeeklies devuelve una proyeccion ligera de todas), no un GET por clave.
  // La de hoy se evalua con el estado en memoria, que puede ir por delante del store.
  const refreshEnCurso = useCallback(async () => {
    const list = await storeWeeklies();
    const otras = list.filter((w) => w.key !== STORE_KEY && isWeeklyEnCurso(w)).length;
    setEnCursoCount(otras + (enCursoRef.current ? 1 : 0));
  }, []);

  // restoreSession — reconstruye el estado del cronometro (y el panel de minuta si
  // ya estaba cerrada) desde la weekly guardada.
  const restoreSession = useCallback((w) => {
    const el = w.elapsed || 0;
    setElapsed(el); elRef.current = el;
    setBlockTimes(w.blockTimes || {});
    setCurrentBlockIdx(w.currentBlockIdx || 0);
    startedAtRef.current = w.startedAt || null;
    // Solo se restaura como cerrada si de verdad llego a existir: una weekly que
    // nunca se inicio y no tiene minuta no puede estar "terminada" — quedaban asi
    // registros fantasma que mostraban el panel de WEEKLY TERMINADA en un dia limpio.
    if (weeklyClosed(w)) {
      finishedRef.current = true;
      setFinished(true);
      if (w.minutaText) {
        // Evita que el efecto de generacion sobreescriba la minuta ya editada.
        minutaGeneratedRef.current = true;
        setMinutaDraft(w.minutaText);
        setMinutaSaved(true);
      }
    }
  }, []);

  // Auto-save debounce 3s.
  //
  // loadedRef es un guard contra perdida de datos: `wd` arranca como emptyWeekly(),
  // asi que si la lectura de Upstash tarda mas de 3s este autosave escribia la
  // weekly VACIA encima de la guardada y se perdian los focos del dia. No se guarda
  // nada hasta que la carga inicial haya puesto el wd real.
  //
  // Deps a proposito SIN `elapsed`: si el segundero entrara aqui el debounce se
  // reiniciaria cada segundo y nunca llegaria a guardar. El elapsed se persiste por
  // el interval de 60s de abajo y en pause/finish, y se lee via elapsedRef.
  const autoSaveRef = useRef(null);
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current) return;
    if (!wd || !wd.date) return;
    // No crear un registro solo por abrir la app. Antes, entrar al dashboard
    // bastaba para escribir un `weekly:<hoy>` vacio en Upstash, que despues salia
    // listado como una minuta "HOY" inexistente. Se guarda cuando hay algo que
    // guardar: contenido capturado, cronometro corriendo o weekly cerrada.
    const worthSaving = finishedRef.current || !!startedAtRef.current
      || elapsedRef.current > 0 || weeklyHasContent(wd);
    if (!worthSaving) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      storeSet(STORE_KEY, withSession({ ...wd, gdd_snapshot: appGddData })).catch(() => {});
    }, 3000);
    return () => clearTimeout(autoSaveRef.current);
  }, [wd, finished, withSession]);

  const block = AGENDA[currentBlockIdx] || AGENDA[AGENDA.length - 1];
  // enCurso — la weekly de hoy se INICIO (boton ▶) y no se ha cerrado.
  // Se mira startedAt/elapsed, nunca el contenido capturado: ver weeklyStarted().
  const enCurso = !finished && (running || elapsed > 0 || !!startedAtRef.current);
  const enCursoRef = useRef(false);
  useEffect(() => { enCursoRef.current = enCurso; }, [enCurso]);
  // Recontar cuando la weekly de hoy se inicia o se cierra, para que el boton
  // aparezca/desaparezca al momento. En el mount lo dispara la carga inicial.
  useEffect(() => {
    if (!loadedRef.current) return;
    refreshEnCurso();
  }, [enCurso, refreshEnCurso]);

  const advanceBlock = useCallback((direction) => {
    setCurrentBlockIdx((prev) => {
      const next = direction === "next" ? Math.min(prev + 1, AGENDA.length - 1) : Math.max(prev - 1, 0);
      if (next === prev) return prev;
      if (blockStartRef.current) {
        const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
        setBlockTimes((bt) => ({ ...bt, [AGENDA[prev].id]: (bt[AGENDA[prev].id] || 0) + spent }));
      }
      blockStartRef.current = Date.now();
      const nextBlock = AGENDA[next];
      // Si estas parado en la Agenda, avanzar de bloque NO te saca de ahi: ningun
      // bloque tiene tab "agenda", asi que cambiar de tab la hacia inalcanzable en
      // cuanto usabas ⏮/⏭. Desde cualquier otra pestaña se sigue el flujo normal.
      setTab((t) => (t === "agenda" ? t : nextBlock.tab));
      if (nextBlock.sq && nextBlock.sq !== "cross") setActiveSquad(nextBlock.sq);
      return next;
    });
  }, []);

  const currentBlockIdxRef = useRef(currentBlockIdx);
  useEffect(() => { currentBlockIdxRef.current = currentBlockIdx; }, [currentBlockIdx]);

  // jumpToBlock(idx, { keepTab }) — avanza al bloque idx.
  // keepTab evita el cambio de pestaña: la Agenda lo usa para su boton "Siguiente",
  // porque ningun bloque tiene tab "agenda" y saltar te expulsaba de la pantalla
  // justo cuando estabas asignando presentadores.
  const jumpToBlock = useCallback((idx, opts) => {
    if (idx < 0 || idx >= AGENDA.length) return;
    if (blockStartRef.current) {
      const prevIdx = currentBlockIdxRef.current;
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [AGENDA[prevIdx].id]: (bt[AGENDA[prevIdx].id] || 0) + spent }));
    }
    blockStartRef.current = Date.now();
    setCurrentBlockIdx(idx);
    const b = AGENDA[idx];
    if (!opts?.keepTab) setTab(b.tab);
    // El squad activo se sincroniza igual, para que al pasar a Focos ya este puesto.
    if (b.sq && b.sq !== "cross") setActiveSquad(b.sq);
  }, []);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    elRef.current = elapsed;
    if (!blockStartRef.current) blockStartRef.current = Date.now();
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
      // Persistir ya: startedAt es lo unico que marca la weekly como iniciada, y es
      // un ref, asi que no dispara el autosave por si solo.
      storeSet(STORE_KEY, withSession(wdRef.current || {})).catch(() => {});
    }
    setRunning(true);
    if (elapsed === 0) { setTab("panorama"); setCurrentBlockIdx(1); }
  }, [elapsed, withSession]);

  const pauseTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }));
      blockStartRef.current = null;
    }
    // Guardado inmediato: el debounce de 3s no cubre el caso de cerrar la pestaña
    // justo despues de pausar, y ahi se perdia el progreso del cronometro.
    storeSet(STORE_KEY, withSession(wdRef.current || wd)).catch(() => {});
  }, [block, withSession, wd]);

  const finishTimer = useCallback(() => {
    setRunning(false);
    clearInterval(intRef.current);
    if (blockStartRef.current) {
      const spent = Math.round((Date.now() - blockStartRef.current) / 1000);
      setBlockTimes((bt) => ({ ...bt, [block.id]: (bt[block.id] || 0) + spent }));
      blockStartRef.current = null;
    }
    finishedRef.current = true; // antes del storeSet del efecto de minuta
    setFinished(true);
    setMinutaSaved(false);
  }, [block]);

  const wdRef = useRef(null);
  const analysisRef = useRef(null);
  const blockTimesRef = useRef(null);
  const minutaGeneratedRef = useRef(false);

  useEffect(() => {
    if (finished && !minutaGeneratedRef.current) {
      minutaGeneratedRef.current = true;
      const draft = generateMinuta(wdRef.current, analysisRef.current, appGddData, mqlBreakdown, blockTimesRef.current, items);
      setMinutaDraft(draft);
      if (!wdRef.current?.minutaText) {
        storeSet(STORE_KEY, withSession({ ...wdRef.current, minutaText: draft, gdd_snapshot: appGddData, analysis_snapshot: analysisRef.current }));
      }
    }
  }, [finished, appGddData]);

  // Auto-guardado de la minuta: 2s despues de la ultima tecla. Sustituye la
  // necesidad de apretar GUARDAR; el boton sigue ahi para guardar al instante.
  const [minutaSaving, setMinutaSaving] = useState(false);
  const minutaSaveRef = useRef(null);
  useEffect(() => {
    if (!finished || !minutaDraft || minutaSaved) return;
    setMinutaSaving(true);
    clearTimeout(minutaSaveRef.current);
    minutaSaveRef.current = setTimeout(async () => {
      await storeSet(STORE_KEY, withSession({
        ...wdRef.current, minutaText: minutaDraft,
        gdd_snapshot: appGddData, analysis_snapshot: analysisRef.current,
      }));
      setMinutaSaving(false);
      setMinutaSaved(true);
    }, 2000);
    return () => clearTimeout(minutaSaveRef.current);
  }, [minutaDraft, finished, minutaSaved, appGddData, withSession]);

  useEffect(() => {
    if (running) {
      if (!blockStartRef.current) blockStartRef.current = Date.now();
      intRef.current = setInterval(() => {
        const newElapsed = elRef.current + Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(newElapsed);
      }, 1000);
    }
    return () => clearInterval(intRef.current);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const as = setInterval(() => storeSet(STORE_KEY, withSession(wd)), 60000);
    return () => clearInterval(as);
  }, [running, wd, withSession]);

  useEffect(() => {
    if (!running) return;
    const handleKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "ArrowRight") { e.preventDefault(); advanceBlock("next"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); advanceBlock("prev"); }
      else if (e.key === " ") { e.preventDefault(); pauseTimer(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [running, advanceBlock, pauseTimer]);

  const eMin = elapsed / 60;

  const handleCopy = useCallback((text) => {
    const result = copyToClipboard(text);
    // copyToClipboard now returns a promise
    if (result && typeof result.then === 'function') {
      result.then(ok => { if (!ok) setCopyModal(text); });
    } else if (!result) {
      setCopyModal(text);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const fresh = await fetchAllItems();
      if (fresh.length > 0) {
        setItems(fresh);
        const fp = fresh.length * 1000 + parseInt(fresh[0]?.id || 0) + parseInt(fresh[fresh.length-1]?.id || 0);
        setItemsFingerprint(fp);
        await storeSet(CACHE_KEY, { items: fresh, ts: new Date().toISOString(), doneCount: fresh._doneCount || 0 });
        setLastUpdate(new Date().toISOString());
      }
    } catch (e) {
      setErr('Error al sincronizar: ' + (e?.message || 'desconocido'));
    }
    setRefreshing(false);
  }, []);

  // Load — cache first, then Monday
  useEffect(() => {
    (async () => {
      let hasCached = false;
      try {
        setLoadingMsg("Buscando cache...");
        const [cached, rawStored] = await Promise.all([storeGet(CACHE_KEY), storeGet(STORE_KEY)]);
        // migrateWeekly normaliza shapes viejos al leer (ver utils.js).
        const stored = rawStored ? migrateWeekly(rawStored) : null;
        setWd(stored || emptyWeekly());
        // Rehidratar la sesion: sin esto el cronometro volvia a 0 y la barra del
        // timer (con el boton de finalizar) no se renderizaba, dejando la weekly
        // en curso imposible de cerrar.
        if (stored) restoreSession(stored);
        loadedRef.current = true; // habilita el autosave (ver comentario en su effect)
        refreshEnCurso();
        if (cached?.items?.length > 0) {
          setItems(cached.items);
          const fp0 = cached.items.length * 1000 + parseInt(cached.items[0]?.id || 0) + parseInt(cached.items[cached.items.length-1]?.id || 0);
          setItemsFingerprint(fp0);
          setLastUpdate(cached.ts);
          setLoading(false);
          hasCached = true;
          if (Date.now() - new Date(cached.ts).getTime() > 30 * 60 * 1000) refresh();
        }
      } catch { setWd(emptyWeekly()); loadedRef.current = true; }

      if (hasCached) return;

      const loadingTimer = setInterval(() => setLoadingElapsed(e => e + 1), 1000);

      const safetyTimer = setTimeout(() => {
        clearInterval(loadingTimer);
        setErr("Tiempo de espera agotado -- Monday no respondio. Trabaja en modo sin conexion o presiona Sync.");
        setLoading(false);
      }, 65000);

      try {
        setLoadingMsg("Conectando con Monday.com...");
        const all = await fetchAllItems();
        clearTimeout(safetyTimer);
        if (all.length > 0) {
          setItems(all);
          const fp1 = all.length * 1000 + parseInt(all[0]?.id || 0) + parseInt(all[all.length-1]?.id || 0);
          setItemsFingerprint(fp1);
          await storeSet(CACHE_KEY, { items: all, ts: new Date().toISOString(), doneCount: all._doneCount || 0 });
          setLastUpdate(new Date().toISOString());
        } else {
          setErr((all._error || "Sin datos") + " -- Trabaja en modo sin conexion.");
        }
      } catch (e) {
        clearTimeout(safetyTimer);
        setErr("Error al conectar: " + (e?.message || "desconocido"));
      }
      clearInterval(loadingTimer);
      setLoading(false);
    })();
  }, []);

  const analysis = useMemo(() => {
    if (!items.length) return null;
    const byPhase = {}, byPhaseWeek = {}, bySquad = {}, bySquadWeek = {}, byPerson = {}, byPersonWeek = {}, overdue = [], noResp = [], noCrono = [], stoppedWeek = [], backlogWithDates = [], doneLastWeek = [], doneThisWeek = [], overdueThisWeekArr = [], overdueLastWeekArr = [], stoppedLastWeekArr = [];
    const _tlCache = new Map();
    const parseTLCached = (t) => {
      if (!t) return { start: null, end: null };
      if (_tlCache.has(t)) return _tlCache.get(t);
      const result = parseTL(t);
      _tlCache.set(t, result);
      return result;
    };

    const WEEK_START_STR = getMondayStr(TODAY_STR);
    const WEEK_END_STR = addDays(WEEK_START_STR, 4);

    items.forEach((it) => {
      const cv = it.column_values || {}, ph = cv.color_mkz09na || "?", pr = cv.person;
      // El squad se atribuye por RESPONSABLE, no por la etiqueta del board: esa
      // no se puede renombrar sin romper el histórico. squadOfTask cae a la
      // etiqueta cuando los responsables no son concluyentes.
      const sq = squadOfTask(it);
      const timeline = cv.timerange_mkzcqv0j, isThisWeek = overlapsThisWeek(timeline);
      if (timeline) parseTLCached(timeline);

      byPhase[ph] = (byPhase[ph] || 0) + 1;
      if (isThisWeek) byPhaseWeek[ph] = (byPhaseWeek[ph] || 0) + 1;
      if (!bySquad[sq]) bySquad[sq] = { total: 0, phases: {}, subPhases: {}, subTotal: 0 };
      bySquad[sq].total++; bySquad[sq].phases[ph] = (bySquad[sq].phases[ph] || 0) + 1;
      if (isThisWeek && isActive(ph)) {
        if (!bySquadWeek[sq]) bySquadWeek[sq] = { total: 0, phases: {} };
        bySquadWeek[sq].total++; bySquadWeek[sq].phases[ph] = (bySquadWeek[sq].phases[ph] || 0) + 1;
      }

      // Subtareas por squad, contadas aparte de las tareas: son otro nivel de
      // trabajo y mezclarlas en la misma barra cambiaría el significado de los
      // números que ya se venían leyendo. Cada subtarea se atribuye por su propio
      // responsable, y si es ambiguo hereda el squad de su tarea (squadOfSubtask).
      (it.subitems || []).forEach((sub) => {
        const sph = sub.column_values?.[WORK_COLS.sub.phase] || "?";
        const ssq = squadOfSubtask(sub, it);
        if (!bySquad[ssq]) bySquad[ssq] = { total: 0, phases: {}, subPhases: {}, subTotal: 0 };
        bySquad[ssq].subTotal++;
        bySquad[ssq].subPhases[sph] = (bySquad[ssq].subPhases[sph] || 0) + 1;
      });

      if (isActive(ph) && pr) pr.split(", ").forEach((p) => { if (!byPerson[p]) byPerson[p] = { items: 0, subitems: 0, total: 0 }; byPerson[p].items++; byPerson[p].total++; });

      if (isActive(ph)) {
        const deadlineItem = it.column_values?.date_mm1b10rx;
        const projectThisWeek = deadlineItem ? (deadlineItem >= WEEK_START_STR && deadlineItem <= WEEK_END_STR) : false;

        if (projectThisWeek && pr) {
          pr.split(", ").forEach((p) => {
            const n = normalizePersonName(p);
            if (!isTeamMember(n)) return;
            if (!byPersonWeek[n]) byPersonWeek[n] = { projects: 0, tasks: 0, stopped: 0, total: 0 };
            byPersonWeek[n].projects++;
            byPersonWeek[n].total++;
          });
        }

        (it.subitems || []).forEach((sub) => {
          const sp = sub.column_values?.person;
          const subPhase = sub.column_values?.color_mkzjvp66;
          const subDeadline = sub.column_values?.date_mm1hnswx;
          if (!sp) return;
          if (!["🚧 Sprint", "👀 Review", "⚙️ Modificación"].includes(subPhase)) return;
          if (!subDeadline || subDeadline < WEEK_START_STR || subDeadline > WEEK_END_STR) return;
          sp.split(", ").forEach((p) => {
            const n = normalizePersonName(p);
            if (!isTeamMember(n)) return;
            if (!byPersonWeek[n]) byPersonWeek[n] = { projects: 0, tasks: 0, stopped: 0, total: 0 };
            byPersonWeek[n].tasks++;
            byPersonWeek[n].total++;
          });
        });
      }

      if (ph === "🚫 Detenido") {
        if (isThisWeek) stoppedWeek.push(it);
        const tlDet = parseTLCached(timeline);
        if (tlDet.start && tlDet.end && tlDet.start <= PREV_WEEK.end && tlDet.end >= PREV_WEEK.start) stoppedLastWeekArr.push(it);
      }
      if (ph === "⏳Backlog" && timeline) backlogWithDates.push(it);

      if (ph === "✅ Done") {
        const fer = cv.date_mkzchmsq;
        if (fer) {
          const deliveryDate = new Date(fer);
          if (deliveryDate >= PREV_WEEK.start && deliveryDate <= PREV_WEEK.end) doneLastWeek.push(it);
          if (deliveryDate >= WEEK.start && deliveryDate <= WEEK.end) doneThisWeek.push(it);
        }
      }

      if (isOverdue(it)) {
        overdue.push(it);
        const tlEnd = parseTLCached(timeline).end;
        if (tlEnd) {
          if (tlEnd >= PREV_WEEK.start && tlEnd <= PREV_WEEK.end) overdueLastWeekArr.push(it);
          else if (tlEnd >= WEEK.start && tlEnd <= WEEK.end) overdueThisWeekArr.push(it);
        }
      }
      if (!pr && ph !== "✅ Done") noResp.push(it);
      if (ph === "🚧 Sprint" && !timeline) noCrono.push(it);
    });

    const activeThisWeek = items.filter((it) => isActive(it.column_values?.color_mkz09na) && overlapsThisWeek(it.column_values?.timerange_mkzcqv0j)).length;
    const velocity = { active: activeThisWeek, done: doneLastWeek.length, overdue: overdue.length };
    const semaphore = overdue.length > 10 || stoppedWeek.length > 5 ? "red" : overdue.length > 4 || stoppedWeek.length > 2 || noCrono.length > 5 ? "yellow" : "green";
    const doneTotal = byPhase["✅ Done"] || 0;

    PERSONAS.filter((p) => !p.sdr).forEach((p) => { if (!byPersonWeek[p.name]) byPersonWeek[p.name] = { items: 0, stopped: 0, total: 0 }; });

    return { byPhase, byPhaseWeek, bySquad, bySquadWeek, byPerson, byPersonWeek, overdue, noResp, noCrono, stoppedWeek, backlogWithDates, doneLastWeek, doneThisWeek, overdueThisWeek: overdueThisWeekArr, overdueLastWeek: overdueLastWeekArr, stoppedLastWeek: stoppedLastWeekArr, velocity, semaphore, doneTotal };
  }, [items, itemsFingerprint]);

  // Sync refs AFTER analysis is defined (avoid TDZ)
  useEffect(() => { wdRef.current = wd; }, [wd]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);
  useEffect(() => { blockTimesRef.current = blockTimes; }, [blockTimes]);

  // ── Audit Log helper ──────────────────────────────────────────
  const AUDIT_LOG_KEY = "audit_log";
  const logAudit = useCallback(async (tipo, descripcion, datos = {}, origen = "usuario") => {
    try {
      const current = await storeGet(AUDIT_LOG_KEY);
      const log = Array.isArray(current) ? current : [];
      const entry = { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), tipo, descripcion, datos, origen };
      await storeSet(AUDIT_LOG_KEY, [entry, ...log].slice(0, 500));
    } catch (e) { if (process.env.NODE_ENV !== 'production') console.warn("Audit log failed:", e?.message); }
  }, []);

  // ── Loading screen ──────────────────────────────────────────
  if (loading) return (
    <div style={{ fontFamily: F.sans, background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.tx3 }}>
      <style>{CSS}</style>
      <div style={{ fontSize: 32, marginBottom: 16, animation: "pulse 1.5s ease infinite" }}>⚡</div>
      <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.2em", textTransform: "uppercase" }}>{loadingMsg}</div>
      {loadingElapsed >= 15 && (
        <div style={{ fontSize: 11, color: C.yellow, marginTop: 12, textAlign: "center", maxWidth: 280 }}>Monday está lento. Puedes esperar o trabajar offline.</div>
      )}
      {loadingElapsed >= 5 && loadingElapsed < 15 && (
        <div style={{ fontSize: 11, color: C.tx3, marginTop: 12 }}>Esto está tardando más de lo normal...</div>
      )}
    </div>
  );

  const emptyAnalysis = { byPhase: {}, byPhaseWeek: {}, bySquad: {}, bySquadWeek: {}, byPerson: {}, byPersonWeek: {}, overdue: [], noResp: [], noCrono: [], stoppedWeek: [], backlogWithDates: [], doneLastWeek: [], doneThisWeek: [], overdueThisWeek: [], overdueLastWeek: [], stoppedLastWeek: [], velocity: { active: 0, done: 0, overdue: 0 }, semaphore: "yellow", doneTotal: 0 };
  const an = analysis || emptyAnalysis;

  const tabs = [
    { id: "home",        icon: "🏠", label: "Home",         color: C.blue },
    { id: "agenda",      icon: "⏱",  label: "Agenda",       color: C.purple },
    { id: "panorama",    icon: "📊", label: "Panorama",     color: C.cyan },
    { id: "focos",       icon: "🎯", label: "Focos",        color: C.yellow },
    { id: "compromisos", icon: "📝", label: "Compromisos",  color: C.green },
    { id: "minutas",     icon: "📋", label: "Minutas",      color: C.purple },
  ];

  return (
    <div suppressHydrationWarning className={presenterMode ? "presenter-mode" : ""} style={{ fontFamily: F.sans, background: C.bg, minHeight: "100vh", color: C.tx }}>
      <style>{CSS}</style>
      <a href="#main-content" className="sr-only" style={{ position: "absolute", top: -40, left: 0, background: C.blue, color: "#fff", padding: "8px 16px", zIndex: 9999, borderRadius: "0 0 8px 0", fontWeight: 600, fontSize: 13, textDecoration: "none" }} onFocus={e => e.currentTarget.style.top = "0"} onBlur={e => e.currentTarget.style.top = "-40px"}>Saltar al contenido</a>

      {/* La barra del timer (con el ⏹ de finalizar) aparece solo si la weekly se
          inicio explicitamente. Sobrevive a un reload porque startedAt/elapsed se
          persisten; lo que NO hace es deducirla de que haya datos capturados. */}
      {enCurso && (
        <TimerZone
          elapsed={elapsed} running={running}
          onStart={() => { startRef.current = Date.now(); elRef.current = elapsed; if (!blockStartRef.current) blockStartRef.current = Date.now(); setRunning(true); }}
          onPause={pauseTimer}
          onNext={() => advanceBlock("next")}
          onPrev={() => advanceBlock("prev")}
          onFinish={finishTimer}
          block={block} wd={wd} blockTimes={blockTimes} currentIdx={currentBlockIdx}
        />
      )}

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 20px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: "clamp(18px, 4.5vw, 22px)", fontWeight: 700, margin: 0, letterSpacing: "-0.04em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              ⚡ Weekly <span style={{ color: C.tx3, fontWeight: 500 }}>Mkt Corp</span>
            </h1>
            <div style={{ fontSize: 11, color: C.tx3, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: F.mono, fontSize: 10 }}>{items.length} items</span>
              {lastUpdate && <span style={{ fontSize: 11, color: C.tx3 }}>· sync {new Date(lastUpdate).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</span>}
              {err && <span style={{ fontSize: 10, color: C.yellow }}>· {err}</span>}
              <button onClick={refresh} disabled={refreshing} style={{ background: C.bg2, color: refreshing ? C.yellow : C.tx3, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: refreshing ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
                <span>{refreshing ? "Sincronizando..." : "Sync"}</span>
              </button>
              <button onClick={async () => {
                setErr("Verificando conexion...");
                try {
                  const resp = await fetch("/api/monday", { cache: "no-store", headers: authHeaders() });
                  const data = await resp.json();
                  setErr(resp.ok ? `Monday OK -- ${data.total || 0} items` : `Error: ${data.error || resp.status}`);
                } catch(e) { setErr("Error: " + e.message); }
              }} title="Verificar conexion con Monday.com" style={{ background: C.bg2, color: C.tx3, border: `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }}>🔍</button>
              <button onClick={() => {
                if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); setPresenterMode(true); }
                else { document.exitFullscreen().catch(() => {}); setPresenterMode(false); }
              }} style={{ background: presenterMode ? C.tx : C.bg2, color: presenterMode ? "#fff" : C.tx3, border: presenterMode ? "none" : `1px solid ${C.bg4}`, borderRadius: R.sm, padding: "3px 10px", fontSize: 10, fontWeight: 500, cursor: "pointer" }} title="Pantalla completa">{presenterMode ? "📺 ON" : "📺"}</button>
              {/* Solo si hay al menos una weekly iniciada y sin cerrar. */}
              {enCursoCount > 0 && (
                <button onClick={() => setEnCursoOpen(true)} title="Ver weeklies empezadas y sin cerrar" style={{ background: "rgba(255,214,10,.12)", color: C.yellow, border: "1px solid rgba(255,214,10,.35)", borderRadius: R.sm, padding: "3px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>⏳</span><span>En curso</span>
                  <span style={{ fontFamily: F.mono, background: C.yellow, color: "#fff", borderRadius: 8, padding: "0 5px", fontSize: 9 }}>{enCursoCount}</span>
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[
              { l: "BKL", tooltip: "Backlog", v: an.byPhase["⏳Backlog"] || 0, c: C.tx3, bg: "transparent", border: C.bg4, ph: "⏳Backlog", its: items.filter(it => it.column_values?.color_mkz09na === "⏳Backlog") },
              { l: "SPR", tooltip: "Sprint", v: an.byPhase["🚧 Sprint"] || 0, c: C.yellow, bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.25)", ph: "🚧 Sprint", its: items.filter(it => it.column_values?.color_mkz09na === "🚧 Sprint") },
              { l: "REV", tooltip: "Review", v: an.byPhase["👀 Review"] || 0, c: C.cyan, bg: "rgba(90,200,250,.06)", border: "rgba(90,200,250,.25)", ph: "👀 Review", its: items.filter(it => it.column_values?.color_mkz09na === "👀 Review") },
              { l: "DET", tooltip: "Detenidos", v: an.byPhase["🚫 Detenido"] || 0, c: C.orange, bg: "rgba(255,149,0,.08)", border: "rgba(255,149,0,.3)", ph: "🚫 Detenido", its: items.filter(it => it.column_values?.color_mkz09na === "🚫 Detenido") },
              { l: "VEN", tooltip: "Vencidos", v: (an.overdue || []).length, c: C.red, bg: "rgba(255,59,48,.08)", border: "rgba(255,59,48,.3)", ph: "⏰ Vencidos", its: an.overdue || [] },
            ].map((s) => (
              <div key={s.l} onClick={() => setPhaseModal({ phase: s.ph, items: s.its })} title={s.tooltip} style={{ background: s.bg || C.bg, border: `1px solid ${s.border || C.bg4}`, borderRadius: R.sm, padding: "5px 8px", textAlign: "center", minWidth: 40, cursor: "pointer", transition: "all .15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.bg3}
                onMouseLeave={e => e.currentTarget.style.background = s.bg || C.bg}>
                <div style={{ fontFamily: F.mono, fontSize: 16, fontWeight: 700, color: s.c, letterSpacing: "-0.04em" }}>{s.v}</div>
                <div style={{ fontSize: 8, color: C.tx3, fontWeight: 600, letterSpacing: "0.1em" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Finished panel */}
        {finished && (
          <Card style={{ marginBottom: 16, borderLeft: `3px solid ${C.green}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: F.mono }}>WEEKLY TERMINADA</div>
                <div style={{ fontSize: 12, color: C.tx3, fontFamily: F.mono, marginTop: 2 }}>
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} min ·{" "}
                  <span style={{ color: minutaSaved ? C.green : minutaSaving ? C.yellow : C.tx3 }}>
                    {minutaSaved ? "Guardada" : minutaSaving ? "Guardando..." : "Sin guardar"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={reopenWeekly} title="Retomar la weekly sin perder focos, compromisos ni la minuta" style={{ background: C.bg2, color: C.yellow, border: `1px solid rgba(255,214,10,.35)`, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F.mono, textTransform: "uppercase" }}>↺ REABRIR</button>
                {!minutaSaved && <button onClick={async () => { await storeSet(STORE_KEY, withSession({ ...wd, minutaText: minutaDraft, gdd_snapshot: appGddData, analysis_snapshot: an })); setMinutaSaved(true); }} style={{ background: C.bg2, color: C.tx2, border: `1px solid ${C.bg4}`, padding: "8px 18px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F.mono, textTransform: "uppercase" }}>GUARDAR</button>}
                <button onClick={async () => { await storeSet(STORE_KEY, withSession({ ...wd, minutaText: minutaDraft, gdd_snapshot: appGddData, analysis_snapshot: an })); setMinutaSaved(true); handleCopy(minutaDraft); }} style={{ background: C.tx, color: C.bg, border: "none", padding: "8px 24px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F.mono, textTransform: "uppercase" }}>{minutaSaved ? "COPIAR A SLACK" : "GUARDAR + COPIAR"}</button>
                <button onClick={async () => { await storeSet(STORE_KEY, withSession({ ...wd, minutaText: minutaDraft, gdd_snapshot: appGddData, analysis_snapshot: an })); setMinutaSaved(true); setSlackStatus("sending"); const ok = await sendToSlack(minutaDraft); setSlackStatus(ok ? "ok" : "error"); if (!ok) handleCopy(minutaDraft); setTimeout(() => setSlackStatus(null), 4000); }} style={{ background: "linear-gradient(135deg,#4A154B,#611f69)", color: "#fff", border: "none", padding: "8px 20px", borderRadius: R.sm, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: F.mono, textTransform: "uppercase" }}>ENVIAR A SLACK</button>
              </div>
            </div>
            <textarea value={minutaDraft} onChange={(e) => { setMinutaDraft(e.target.value); setMinutaSaved(false); }} style={{ width: "100%", minHeight: 280, background: C.bg2, color: C.tx, border: `1px solid ${C.bg4}`, padding: 16, fontSize: 12, fontFamily: F.mono, resize: "vertical", outline: "none", lineHeight: 1.7 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setMinutaDraft(generateMinuta(wd, an, appGddData, mqlBreakdown, blockTimes, items))} style={{ background: "transparent", color: C.tx3, border: `1px solid ${C.bg4}`, padding: "4px 12px", fontSize: 10, cursor: "pointer", fontFamily: F.mono }}>Regenerar</button>
              <span style={{ fontSize: 10, color: C.tx3, fontFamily: F.mono }}>{minutaDraft.length} chars</span>
              {slackStatus && (
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: F.mono, color: slackStatus === "ok" ? C.green : slackStatus === "error" ? C.red : C.yellow }}>
                  {slackStatus === "sending" ? "Enviando a Slack..." : slackStatus === "ok" ? "Enviado a #general" : "Sin token Slack -- copiado al portapapeles"}
                </span>
              )}
            </div>
          </Card>
        )}

        {eMin >= WEEKLY_TOTAL_MIN && !finished && (
          <div style={{ background: "rgba(255,69,58,.06)", border: "0.3px solid rgba(255,69,58,.2)", borderLeft: `2px solid ${C.red}`, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: C.red, fontWeight: 600 }}>Overtime</span>
            <span style={{ color: C.tx3 }}>→ ⏹ para cerrar</span>
          </div>
        )}

        {/* Tabs sticky */}
        <div role="tablist" className="sticky-nav" style={{ display: "flex", gap: 0, marginBottom: 0, overflowX: "auto", WebkitOverflowScrolling: "touch" }} onKeyDown={(e) => {
          if (e.target.role !== "tab") return;
          const ids = tabs.map(t => t.id);
          const idx = ids.indexOf(tab);
          if (e.key === "ArrowRight") { e.preventDefault(); setTab(ids[(idx + 1) % ids.length]); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setTab(ids[(idx - 1 + ids.length) % ids.length]); }
          else if (e.key === "Home") { e.preventDefault(); setTab(ids[0]); }
          else if (e.key === "End") { e.preventDefault(); setTab(ids[ids.length - 1]); }
        }}>
          {tabs.map((t) => {
            const isAct = tab === t.id, isLive = running && block.tab === t.id;
            return (
              <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={isAct} tabIndex={isAct ? 0 : -1} aria-controls="main-content" onClick={() => setTab(t.id)} aria-label={t.label} style={{ background: "transparent", color: isAct ? C.tx : C.tx3, border: "none", borderBottom: isAct ? `2px solid ${t.color}` : "2px solid transparent", padding: "8px 12px", fontSize: 12, fontWeight: isAct ? 700 : 400, cursor: "pointer", fontFamily: F.sans, marginBottom: -1, letterSpacing: "-0.01em", transition: "all .2s", flexShrink: 0, whiteSpace: "nowrap" }}>
                {isLive && <span aria-hidden="true" style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: block.color, animation: "liveDot 1s ease infinite", marginRight: 5, verticalAlign: "middle" }} />}
                <span aria-hidden="true">{t.icon}</span> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ height: 20 }} />
        <div role="tabpanel" id="main-content" aria-labelledby={`tab-${tab}`}>
        {tab === "home"        && <ErrorBoundary name="Home"><TabHome analysis={an} items={items} elapsed={elapsed} onStart={startTimer} gddData={appGddData} mqlBreakdown={mqlBreakdown} mqlBreakdownPrev={mqlBreakdownPrev} gddTargets={gddTargets} gddHistory={gddHistory} setGddHistory={setGddHistory} gddLoading={gddLoading} /></ErrorBoundary>}
        {tab === "agenda"      && <ErrorBoundary name="Agenda"><TabAgenda wd={wd} setWd={setWd} save={saveFn} currentIdx={currentBlockIdx} blockTimes={blockTimes} onJumpToBlock={jumpToBlock} /></ErrorBoundary>}
        {tab === "panorama"    && <ErrorBoundary name="Panorama"><TabPanorama analysis={an} items={items} onDrillDown={setPhaseModal} /></ErrorBoundary>}
        {tab === "focos"       && <ErrorBoundary name="Focos"><TabFocos items={items} wd={wd} setWd={setWd} save={saveFn} activeSquad={activeSquad} setActiveSquad={setActiveSquad} refreshing={refreshing} /></ErrorBoundary>}
        {tab === "compromisos" && <ErrorBoundary name="Compromisos"><TabCompromisos wd={wd} setWd={setWd} save={saveFn} analysis={an} onCopy={handleCopy} gddData={appGddData} /></ErrorBoundary>}
        {tab === "minutas"     && <ErrorBoundary name="Minutas"><TabMinutasInline wd={wd} analysis={an} gddData={appGddData} blockTimes={blockTimes} onOpenMinuta={(key, data, editMode) => setMinutaLightbox({ key, data, editMode })} /></ErrorBoundary>}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, padding: "12px 0", borderTop: `1px solid ${C.bg4}` }}>
          {confirmReset ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.tx }}>Resetear sesion de hoy?</div>
                <div style={{ fontSize: 11, color: C.tx3, marginTop: 2 }}>Borra focos, compromisos y presentadores. Las minutas historicas NO se eliminan.</div>
              </div>
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(wd, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `backup-weekly-${TODAY_STR}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }} style={{ background: C.bg3, color: C.tx2, border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>Descargar backup</button>
              <button onClick={async () => {
                await logAudit("session_reset", "Reset de sesion: " + TODAY_STR, { date: TODAY_STR, focos_areas: Object.keys(wd.focos || {}), compromisos_count: (wd.compromisos || []).length });
                await storeSet(STORE_KEY + ":before_reset", wd);
                await storeDel(STORE_KEY);
                setWd(emptyWeekly()); setFinished(false); setMinutaDraft(""); setMinutaSaved(false);
                setElapsed(0); elRef.current = 0; setCurrentBlockIdx(0); setBlockTimes({});
                blockStartRef.current = null; setSlackStatus(null); setConfirmReset(false);
                // Las refs de sesion tambien: si no, el siguiente autosave volvia a
                // escribir la weekly como finished/con startedAt viejo.
                finishedRef.current = false; startedAtRef.current = null;
                elapsedRef.current = 0; minutaGeneratedRef.current = false;
              }} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Si, resetear</button>
              <button onClick={() => setConfirmReset(false)} style={{ background: C.bg3, color: C.tx2, border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
            </div>
          ) : (
            <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.tx2, opacity: 0.5, fontFamily: F.mono }}>v9.0 · mkt corp upax</span>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <button onClick={() => setAuditOpen(!auditOpen)} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.7"} style={{ background:"transparent", color:C.tx3, border:"1px solid rgba(0,0,0,.1)", borderRadius:R.sm, padding:"3px 10px", fontSize:10, cursor:"pointer", opacity:0.7 }}>Audit</button>
                <button onClick={() => setConfirmReset(true)} onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.7"} title="Limpiar focos, compromisos y presentadores de la sesion actual" style={{ background: "transparent", color: C.red, border: "1px solid rgba(255,59,48,.2)", borderRadius: R.sm, padding: "3px 10px", fontSize: 10, cursor: "pointer", opacity: 0.7 }}>Reset sesion</button>
              </div>
            </div>
            {auditOpen && <AuditLogPanel />}
            </>
          )}
        </div>
      </div>

      {copyModal && <CopyModal text={copyModal} onClose={() => setCopyModal(null)} />}

      <PhaseModal phaseModal={phaseModal} onClose={() => setPhaseModal(null)} />

      {enCursoOpen && (
        <WeekliesEnCurso
          onClose={() => setEnCursoOpen(false)}
          onOpenMinuta={(key, data) => { setEnCursoOpen(false); document.body.style.overflow = "hidden"; setMinutaLightbox({ key, data, editMode: false }); }}
          onFinalizeToday={finishTimer}
          onChanged={refreshEnCurso}
        />
      )}

      <MinutaLightbox
        minutaLightbox={minutaLightbox}
        wd={wd} analysis={an} gddData={appGddData} blockTimes={blockTimes}
        onClose={() => { setMinutaLightbox(null); document.body.style.overflow = ""; }}
      />
    </div>
  );
}

