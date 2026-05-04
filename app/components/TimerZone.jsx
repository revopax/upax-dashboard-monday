'use client'
import React from 'react'
// components/TimerZone.jsx — barra de timer sticky
import { AGENDA } from '../lib/constants'
import { C, R, F } from '../lib/tokens'

const TimerZone = React.memo(function TimerZone({ elapsed, running, onStart, onPause, onNext, onPrev, onFinish, block, wd, blockTimes, currentIdx }) {
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;
  const eMin = elapsed / 60, overtime = eMin >= 60;
  const rem = Math.max(0, block.dur - (eMin - block.start));
  const urgent = rem <= 1 && running;
  const pr = wd.presenters || {};
  const prevB = currentIdx > 0 ? AGENDA[currentIdx - 1] : null;
  const nextB = currentIdx < AGENDA.length - 1 ? AGENDA[currentIdx + 1] : null;

  const btn = (label, onClick, bg = C.bg2, fg = C.tx3, disabled = false, title = "", ariaLabel = "") => (
    <button onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel || title || label} style={{ background: bg, color: fg, border: bg === C.bg2 ? `1px solid ${C.bg4}` : "none", borderRadius: R.sm, padding: "5px 10px", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: F.sans, lineHeight: 1, opacity: disabled ? 0.25 : 1, transition: "all .2s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: C.bg2, borderBottom: `1px solid ${C.bg4}`, boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "12px 20px", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: 920, margin: "0 auto" }}>
        <span aria-label={`${mm} minutos ${ss} segundos`} style={{ fontFamily: F.mono, fontSize: 28, fontWeight: 700, color: overtime ? C.red : C.tx, letterSpacing: "-0.05em", lineHeight: 1 }}>
          {String(mm).padStart(2, "0")}<span aria-hidden="true" style={{ animation: running ? "pulse 1s ease infinite" : "none", color: overtime ? C.red : C.tx3 }}>:</span>{String(ss).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {btn("⏮", onPrev, undefined, undefined, !prevB, prevB ? `← ${prevB.label}` : "", "Bloque anterior")}
          {running ? btn("⏸", onPause, C.yellow, "#fff", false, "", "Pausar timer") : btn("▶", onStart, C.green, "#fff", false, "", "Iniciar timer")}
          {btn("⏭", onNext, undefined, undefined, !nextB, nextB ? `${nextB.label} →` : "", "Siguiente bloque")}
          {btn("⏹", onFinish, C.red, "#fff", false, "", "Finalizar weekly")}
        </div>
        <div aria-live="polite" aria-atomic="true" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: urgent ? "rgba(255,69,58,.1)" : C.bg, border: `0.3px solid ${urgent ? "rgba(255,69,58,.3)" : C.border}`, borderRadius: R.sm, padding: "7px 14px", minWidth: 180, animation: urgent ? "pulse 1s ease infinite" : "none" }}>
          {running && <div aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: urgent ? C.red : block.color, animation: "liveDot 1.2s ease infinite", flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? C.red : block.color }}>{block.label}</span>
          <span style={{ fontSize: 11, color: urgent ? C.red : C.tx3 }}>{block.squad ? (pr[block.id] || "Sin asignar") : block.fixed}</span>
          <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: urgent ? C.red : C.tx2 }}>{Math.ceil(rem)}m</span>
        </div>
        <span className="sr-only" aria-live="assertive">{ss === 0 && running ? `${mm} minutos, bloque ${block.label}` : ""}</span>
        <div style={{ display: "flex", borderRadius: R.sm, overflow: "hidden", height: 6, width: 140, flexShrink: 0 }}>
          {AGENDA.map((b, i) => (
            <div key={b.id} title={`${b.label}${blockTimes?.[b.id] ? ": " + Math.floor(blockTimes[b.id] / 60) + ":" + String(blockTimes[b.id] % 60).padStart(2, "0") : ""}`} style={{ width: `${(b.dur / 60) * 100}%`, background: i === currentIdx ? b.color : i < currentIdx ? `${b.color}60` : `${b.color}15`, transition: "all .3s", borderRight: i < AGENDA.length - 1 ? `1px solid ${C.bg}` : "none" }} />
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 920, margin: "6px auto 0", height: 2, borderRadius: R.sm, background: C.bg4 }}>
        <div style={{ height: "100%", borderRadius: R.sm, background: overtime ? C.red : block.color, width: `${Math.min(100, (eMin / 60) * 100)}%`, transition: "width 1s linear" }} />
      </div>
    </div>
  );
});
/* ═══════════════════════════════════════════════════════════════
   SECTION 9: TAB HOME
   ═══════════════════════════════════════════════════════════════ */

export { TimerZone }
