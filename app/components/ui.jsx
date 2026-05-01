'use client'
import React, { useState, useEffect, useRef } from 'react'
// components/ui.jsx — componentes UI compartidos
import { PERSONAS } from '../lib/constants'
import { PHASE_SHORT } from '../lib/utils'

export function Bar({ segs, h = 20 }) {
  const t = segs.reduce((s, x) => s + x.v, 0); if (!t) return null;
  return (
    <div style={{ display: "flex", borderRadius: h / 2, overflow: "hidden", height: h, background: "var(--bg4)" }}>
      {segs.filter((x) => x.v > 0).map((x, i) => (
        <div key={i} title={`${x.l}: ${x.v}`} style={{ width: `${(x.v / t) * 100}%`, background: x.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)", color: "#fff", minWidth: 16, transition: "width .4s ease" }}>
          {x.v > 2 ? x.v : ""}
        </div>
      ))}
    </div>
  );
}

export function Card({ children, style = {} }) {
  return <div style={{ background: "var(--bg2)", borderRadius: "var(--r)", boxShadow: "var(--shadow)", padding: "18px 20px", ...style }}>{children}</div>;
}

export function Chip({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{ background: active ? color : "var(--bg2)", color: active ? "#fff" : "var(--tx2)", border: active ? "none" : "1px solid var(--bg4)", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--sans)", transition: "all .2s", boxShadow: active ? `0 2px 8px ${color}40` : "var(--shadow)" }}>
      {label}
    </button>
  );
}

export function Alerta({ icon, text, color = "var(--yellow)" }) {
  return (
    <div style={{ background: "var(--bg2)", borderRadius: "var(--r-sm)", borderLeft: `4px solid ${color}`, boxShadow: "var(--shadow)", padding: "12px 16px", fontSize: 13, color: "var(--tx2)", marginBottom: 8, fontWeight: 500 }}>
      <span style={{ color }}>{icon}</span> {text}
    </div>
  );
}

export function PersonSelect({ value, onChange, style = {} }) {
  const groups = [...new Set(PERSONAS.map((p) => p.squad))];
  return (
    <select value={value || ""} onChange={onChange} style={{ background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontFamily: "var(--sans)", color: value ? "var(--tx)" : "var(--tx3)", outline: "none", cursor: "pointer", ...style }}>
      <option value="">Seleccionar...</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {PERSONAS.filter((p) => p.squad === g).map((p) => <option key={p.name} value={p.name}>{p.name}{p.star ? " ★" : ""}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function CopyModal({ text, onClose }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg2)", borderRadius: "var(--r-lg)", boxShadow: "0 24px 48px rgba(0,0,0,.15)", padding: 28, width: "90%", maxWidth: 620 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Copiar minuta</span>
          <button onClick={onClose} style={{ background: "var(--bg3)", border: "none", width: 30, height: 30, borderRadius: 15, fontSize: 14, cursor: "pointer", color: "var(--tx3)" }}>✕</button>
        </div>
        <textarea ref={ref} readOnly value={text} style={{ width: "100%", height: 320, background: "var(--bg3)", color: "var(--tx)", border: "none", borderRadius: "var(--r)", padding: 16, fontSize: 12, fontFamily: "var(--mono)", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
        <button onClick={async () => {
          if (!ref.current) return;
          const text = ref.current.value;
          if (navigator.clipboard?.writeText) {
            try { await navigator.clipboard.writeText(text); return; } catch {}
          }
          ref.current.select();
          try { document.execCommand("copy"); } catch {}
        }} style={{ marginTop: 12, background: "var(--blue)", color: "#fff", border: "none", borderRadius: "var(--r-sm)", padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Copiar al portapapeles
        </button>
      </div>
    </div>
  );
}

export function PersonDetailView({ detail }) {
  const [showAllWeek, setShowAllWeek] = useState(false);
  if (!detail) return null;
  const MAX = 8;
  const weekVisible = showAllWeek ? detail.weekTasks : detail.weekTasks.slice(0, MAX);
  const sortTasks = (tasks) => [...tasks].sort((a, b) => {
    const alertA = (a.phase === "⏳Backlog" || a.phase === "🚫 Detenido") ? 0 : 1;
    const alertB = (b.phase === "⏳Backlog" || b.phase === "🚫 Detenido") ? 0 : 1;
    return alertA - alertB;
  });
  return (
    <div style={{ padding: "4px 8px 8px 24px", fontSize: 12, maxHeight: 340, overflowY: "auto" }}>
      {detail.weekTasks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 700, color: "var(--blue)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, display: "flex", gap: 6, alignItems: "center" }}>
            Esta semana <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{detail.weekTasks.length}</span>
          </div>
          {sortTasks(weekVisible).map((task, i) => {
            const ph = PHASE_SHORT[task.phase] || { label: "SPR", color: "#F59E0B" };
            const isAlert = task.phase === "⏳Backlog" || task.phase === "🚫 Detenido";
            return (
              <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", padding: "3px 6px", borderRadius: 6, background: isAlert ? "rgba(239,68,68,.06)" : "rgba(0,122,255,.04)", borderLeft: `3px solid ${isAlert ? "var(--red)" : "var(--blue)"}`, marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, color: "#fff", background: ph.color, borderRadius: 3, padding: "1px 4px", flexShrink: 0, minWidth: 24, textAlign: "center" }}>{ph.label}</span>
                <span style={{ fontWeight: 500, color: isAlert ? "var(--red)" : "var(--tx)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{task.name}</span>
              </div>
            );
          })}
          {detail.weekTasks.length > MAX && !showAllWeek && <div onClick={() => setShowAllWeek(true)} style={{ fontSize: 10, color: "var(--blue)", cursor: "pointer", padding: "3px 6px", fontWeight: 600 }}>+{detail.weekTasks.length - MAX} más →</div>}
        </div>
      )}
      {detail.otherTasks.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, color: "var(--tx3)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
            Otras activas <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{detail.otherTasks.length}</span>
          </div>
          {detail.otherTasks.slice(0, 5).map((task, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--tx3)", padding: "2px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.6 }}>{task.name}</div>
          ))}
          {detail.otherTasks.length > 5 && <div style={{ fontSize: 10, color: "var(--tx3)", paddingLeft: 6 }}>+{detail.otherTasks.length - 5} más</div>}
        </div>
      )}
      {detail.weekTasks.length === 0 && detail.otherTasks.length === 0 && <div style={{ fontSize: 11, color: "var(--tx3)", padding: 4 }}>Sin tareas activas</div>}
    </div>
  );
}

export function NumInput({ initial, onCommit, style }) {
  const [val, setVal] = useState(initial != null ? String(initial) : "");
  useEffect(() => { setVal(initial != null ? String(initial) : ""); }, [initial]);
  return (
    <input type="number" value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val === "" ? 0 : parseFloat(val))}
      style={{ width: 70, background: "var(--bg2)", border: "1px solid var(--bg4)", borderRadius: 6, padding: "6px 8px", fontSize: 14, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--tx)", outline: "none", textAlign: "center", ...(style || {}) }}
    />
  );
}

// Stable component — outside TabFocos so React doesn't recreate it on every render
export function SquadInputSection({ label, icon, field, placeholder, rows, draft, updateDraft, showMeta }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tx2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <textarea
        value={draft[field] || ""}
        onChange={(e) => updateDraft(field, e.target.value)}
        placeholder={placeholder}
        rows={rows || 2}
        style={{ width: "100%", background: "var(--bg)", border: "1.5px solid var(--bg4)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "var(--sans)", color: "var(--tx)", outline: "none", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--blue)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--bg4)"; }}
      />
      {showMeta && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <PersonSelect value={draft[field + "_quien"] || ""} onChange={(e) => updateDraft(field + "_quien", e.target.value)} style={{ fontSize: 11, padding: "3px 6px" }} />
          <input type="date" value={draft[field + "_cuando"] || ""} onChange={(e) => updateDraft(field + "_cuando", e.target.value)} style={{ background: "var(--bg)", border: "1px solid var(--bg4)", borderRadius: 6, padding: "3px 6px", fontSize: 10, color: "var(--tx)", outline: "none" }} />
        </div>
      )}
    </div>
  );
}
