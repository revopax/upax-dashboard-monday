'use client'
import React from 'react'
// components/TimerZone.jsx — barra de timer sticky
import { AGENDA } from '../lib/constants'

const TimerZone = React.memo(function TimerZone({ elapsed, running, onStart, onPause, onNext, onPrev, onFinish, block, wd, blockTimes, currentIdx }) {
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;
  const eMin = elapsed / 60, overtime = eMin >= 60;
  const rem = Math.max(0, block.dur - (eMin - block.start));
  const urgent = rem <= 1 && running;
  const pr = wd.presenters || {};
  const prevB = currentIdx > 0 ? AGENDA[currentIdx - 1] : null;
  const nextB = currentIdx < AGENDA.length - 1 ? AGENDA[currentIdx + 1] : null;

  const btn = (label, onClick, bg = "var(--bg2)", fg = "var(--tx3)", disabled = false, title = "") => (
    <button onClick={onClick} disabled={disabled} title={title} style={{ background: bg, color: fg, border: bg === "var(--bg2)" ? "1px solid var(--bg4)" : "none", borderRadius: "var(--r-sm)", padding: "5px 10px", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: "var(--sans)", lineHeight: 1, opacity: disabled ? 0.25 : 1, transition: "all .2s" }}>
      {label}
    </button>
  );

  return (
    <div style={{ background: "var(--bg2)", borderBottom: "1px solid var(--bg4)", boxShadow: "0 2px 12px rgba(0,0,0,.06)", padding: "12px 20px", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: 920, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 28, fontWeight: 700, color: overtime ? "var(--red)" : "var(--tx)", letterSpacing: "-0.05em", lineHeight: 1 }}>
          {String(mm).padStart(2, "0")}<span style={{ animation: running ? "pulse 1s ease infinite" : "none", color: overtime ? "var(--red)" : "var(--tx3)" }}>:</span>{String(ss).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          {btn("⏮", onPrev, undefined, undefined, !prevB, prevB ? `← ${prevB.label}` : "")}
          {running ? btn("⏸", onPause, "var(--yellow)", "#fff") : btn("▶", onStart, "var(--green)", "#fff")}
          {btn("⏭", onNext, undefined, undefined, !nextB, nextB ? `${nextB.label} →` : "")}
          {btn("⏹", onFinish, "var(--red)", "#fff")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, background: urgent ? "rgba(255,69,58,.1)" : "var(--bg)", border: `0.3px solid ${urgent ? "rgba(255,69,58,.3)" : "var(--border)"}`, borderRadius: "var(--r-sm)", padding: "7px 14px", minWidth: 180, animation: urgent ? "pulse 1s ease infinite" : "none" }}>
          {running && <div style={{ width: 6, height: 6, borderRadius: "50%", background: urgent ? "var(--red)" : block.color, animation: "liveDot 1.2s ease infinite", flexShrink: 0 }} />}
          <span style={{ fontSize: 13, fontWeight: 700, color: urgent ? "var(--red)" : block.color }}>{block.label}</span>
          <span style={{ fontSize: 11, color: urgent ? "var(--red)" : "var(--tx3)" }}>{block.squad ? (pr[block.id] || "Sin asignar") : block.fixed}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: urgent ? "var(--red)" : "var(--tx2)" }}>{Math.ceil(rem)}m</span>
        </div>
        <div style={{ display: "flex", borderRadius: "var(--r-sm)", overflow: "hidden", height: 6, width: 140, flexShrink: 0 }}>
          {AGENDA.map((b, i) => (
            <div key={b.id} title={`${b.label}${blockTimes?.[b.id] ? ": " + Math.floor(blockTimes[b.id] / 60) + ":" + String(blockTimes[b.id] % 60).padStart(2, "0") : ""}`} style={{ width: `${(b.dur / 60) * 100}%`, background: i === currentIdx ? b.color : i < currentIdx ? `${b.color}60` : `${b.color}15`, transition: "all .3s", borderRight: i < AGENDA.length - 1 ? "1px solid var(--bg)" : "none" }} />
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 920, margin: "6px auto 0", height: 2, borderRadius: "var(--r-sm)", background: "var(--bg4)" }}>
        <div style={{ height: "100%", borderRadius: "var(--r-sm)", background: overtime ? "var(--red)" : block.color, width: `${Math.min(100, (eMin / 60) * 100)}%`, transition: "width 1s linear" }} />
      </div>
    </div>
  );
});
/* ═══════════════════════════════════════════════════════════════
   SECTION 9: TAB HOME
   ═══════════════════════════════════════════════════════════════ */

export { TimerZone }
