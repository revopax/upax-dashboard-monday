# UX Audit Sprint 2 — UPAX Dashboard v9

> Generated: 2026-04-30
> Scope: All components post-Sprint 1 (e2c95bb) and technical audit (6282d5f)
> Method: Full code review of all .jsx files + css.js

---

## Priority Legend

| Priority | Meaning | Effort |
|----------|---------|--------|
| P0 | Broken / data loss risk | < 30 min |
| P1 | Usability blocker | < 1 hr |
| P2 | UX friction / polish | < 2 hr |
| P3 | Nice-to-have | variable |

---

## UX-10: Mobile — Compromisos grid breaks on small screens
**File:** `TabCompromisos.jsx:101`, `css.js:44-46`
**Priority:** P1
**Bug:** The compromisos grid uses 6 columns (`26px 1fr 130px 110px 50px 50px`). The mobile CSS hides columns 4 and 6, but the "Cuando" date input (col 4) disappears — users can't set deadlines on mobile. The "Quien" column (130px) also overflows on 320px screens.
**Fix:** On mobile, stack each compromiso as a card layout instead of a grid row. Replace the grid with a vertical layout at `max-width: 640px`.

## UX-11: No keyboard shortcut to advance agenda blocks
**File:** `Dashboard.jsx` (no keyboard handler)
**Priority:** P2
**Bug:** During a live weekly meeting with timer running, the presenter must click small buttons to advance blocks. Arrow keys or spacebar would be faster.
**Fix:** Add `useEffect` with `keydown` listener: ArrowRight = next block, ArrowLeft = prev block, Space = play/pause. Only active when `running === true`.

## UX-12: Timer bar block indicator has no border-radius
**File:** `TimerZone.jsx:33`
**Priority:** P3
**Bug:** The current-block info bar has no `borderRadius`, making it look inconsistent with the rest of the Apple-style design system.
**Fix:** Add `borderRadius: "var(--r-sm)"` to the block info container.

## UX-13: Focos form always visible — clutters view when entries exist
**File:** `TabFocos.jsx:117-128`
**Priority:** P2
**Bug:** The form (Focos/Blocker/Necesito textareas) is always shown below existing entries. When a squad already has 2-3 entries, the form takes up half the viewport, pushing the "Items activos" list off-screen.
**Fix:** Collapse form behind a "+ Agregar foco" button when `entries.length > 0`. Show form when button clicked or when editing.

## UX-14: PersonSelect dropdown has no search/filter
**File:** `ui.jsx:40-51`
**Priority:** P2
**Bug:** The native `<select>` with optgroups works but is slow to navigate with 15+ people. On mobile, the iOS picker is acceptable, but on desktop it's tedious.
**Fix:** Replace with a searchable combobox or add a text filter. Low priority since native `<select>` is at least accessible.

## UX-15: Minuta lightbox — no Escape key to close
**File:** `MinutaLightbox.jsx:8-9`
**Priority:** P1
**Bug:** The lightbox catches click-outside to close but doesn't handle Escape key. Users instinctively press Escape to close modals.
**Fix:** Add `useEffect` with `keydown` listener for Escape in `MinutaLightbox`. Also add to `PhaseModal` and `CopyModal`.

## UX-16: PhaseModal — no Escape key to close
**File:** `PhaseModal.jsx:9`
**Priority:** P1
**Bug:** Same as UX-15 but for PhaseModal.
**Fix:** Add Escape key handler.

## UX-17: CopyModal — no Escape key to close
**File:** `ui.jsx:58`
**Priority:** P1
**Bug:** Same as UX-15 but for CopyModal.
**Fix:** Add Escape key handler.

## UX-18: Compromisos — no confirmation before deleting
**File:** `TabCompromisos.jsx:105`
**Priority:** P1
**Bug:** The X button on each compromiso row deletes immediately with no confirmation. A misclick destroys data. Contrast with TabMinutas which correctly uses a `confirmDel` state.
**Fix:** Add confirmation pattern matching TabMinutas: click X -> show inline "Eliminar?" confirm -> click confirm to delete.

## UX-19: Focos — delete has no confirmation
**File:** `TabFocos.jsx:113`
**Priority:** P1
**Bug:** Same pattern as UX-18. The "Borrar" link deletes a foco entry immediately.
**Fix:** Add inline confirmation before delete.

## UX-20: TabHome GdD section — 4-column grid breaks on mobile
**File:** `TabHome.jsx` (GdD metrics grid in the IIFE around line 230+)
**Priority:** P1
**Bug:** The GdD metrics grid (`gridTemplateColumns: repeat(4, 1fr)`) doesn't have a mobile override. On 320px screens, each KPI cell is ~70px wide — numbers overflow or get cut. The `kpi-grid-mobile` CSS class exists in `css.js:43` but isn't applied to the TabHome GdD grid.
**Fix:** Add `className="kpi-grid-mobile"` to the grid div, or use `grid-template-columns: repeat(2, 1fr)` at `max-width: 640px`.

## UX-21: No empty state for TabPanorama when items array is empty
**File:** `TabPanorama.jsx:30-31`
**Priority:** P3
**Bug:** If `analysis.bySquad` is empty (no Monday data), the squads section renders nothing — just a blank white page. Unlike TabCompromisos which shows a friendly empty state.
**Fix:** Add empty state card: "Sin datos de Monday. Presiona Sync para conectar."

## UX-22: Audit Log button has 0.5 opacity — looks disabled
**File:** `Dashboard.jsx:540`
**Priority:** P3
**Bug:** The "Audit" and "Reset sesion" buttons in the footer use `opacity: 0.5`, which per WCAG looks disabled. Users may not realize they're clickable.
**Fix:** Use `opacity: 0.7` or change to `color: var(--tx3)` without opacity reduction. Add hover effect to signal interactivity.

## UX-23: Presenter mode scaling is broken
**File:** `css.js:27-30`
**Priority:** P2
**Bug:** The `.presenter-mode .fade *` selector scales ALL descendant elements via `!important`, but inline `style={{ fontSize: X }}` takes precedence over CSS custom properties. The `--font-size` variable is never set on elements, so `calc(var(--font-size, 13px) * var(--ps, 1))` always uses the 13px fallback, ignoring the actual element sizes.
**Fix:** Either set `--font-size` on elements via JS, or use `transform: scale(var(--ps))` on the main content area instead of trying to scale individual fonts.

## UX-24: Tendencia Semanal — expandedWeek state collision
**File:** `TabHome.jsx:119` + Tendencia Semanal section
**Priority:** P2
**Bug:** `expandedWeek` is used for both month expansion (`"month-YYYY-MM"`) and week-level `por_origen` expansion. Clicking a week row sets `expandedWeek` to the week key, which collapses the month. The logic `!isCollapsed && weeks.map(...)` then hides all weeks in the month because `expandedWeek` no longer starts with `"month-"`.
**Fix:** Use separate state for month expansion vs week expansion, or adjust the collapse logic to not treat week-level expansion as month collapse.

## UX-25: MinutaDetailView renders stale analysis for historical minutas
**File:** `MinutaDetailView.jsx:535`
**Priority:** P2
**Bug:** `visualAn = todayAnalysis` always uses today's analysis, even for historical minutas. The visual render (section 2: Panorama Operativo) shows current overdue/stopped/active counts, not the ones from the week the minuta was created.
**Fix:** Save `analysis` snapshot alongside `gdd_snapshot` when generating a minuta. For historical minutas, use the saved snapshot.

## UX-26: PdfButton uses window.open — blocked by popup blockers
**File:** `MinutaDetailView.jsx:489`
**Priority:** P2
**Bug:** `window.open()` is frequently blocked by modern browsers. The fallback is just an `alert()`. Users on Safari with strict popup blocking can never generate PDFs.
**Fix:** Use `Blob` + `URL.createObjectURL` + `<a download>` pattern instead, or render to an iframe within the page.

## UX-27: Compromisos "Sync All" runs sequentially — slow for many items
**File:** `TabCompromisos.jsx:66-73`
**Priority:** P3
**Bug:** `syncAllToMonday` uses a sequential `for` loop with `await` on each item. With 8 compromisos, this takes 8 sequential API calls.
**Fix:** Use `Promise.allSettled` for parallel sync (Monday API supports concurrent calls). Show progress as "3/8 synced" during execution.

## UX-28: Tab navigation not accessible — no aria-role="tablist"
**File:** `Dashboard.jsx:497`
**Priority:** P2
**Bug:** The tab bar is just a `<div>` with buttons. Screen readers can't identify it as a tab list. Individual tabs have `aria-current` but the container lacks `role="tablist"` and tabs lack `role="tab"`.
**Fix:** Add `role="tablist"` to container, `role="tab"` + `aria-selected` to each tab button, and `role="tabpanel"` to content area.

## UX-29: Overdue calculation double-parses timeline strings
**File:** `TabPanorama.jsx:49`
**Priority:** P3
**Bug:** In the squad overdue list, `parseTL()` is called twice for the same item in the same expression: once for the conditional and once for the display. Not a visual bug, but wastes cycles.
**Fix:** Extract `const tl = parseTL(...)` once and reuse.

## UX-30: Loading screen has no timeout feedback
**File:** `Dashboard.jsx:379-385`
**Priority:** P2
**Bug:** The loading screen shows "Conectando con Monday.com..." but if the API is slow (10-30s), there's no progress indicator or "taking longer than expected" message. The 65s safety timer exists but the user stares at a static emoji for over a minute.
**Fix:** After 5s, show "Esto está tardando más de lo normal...". After 15s, show "Monday está lento. Puedes esperar o trabajar offline."

## UX-31: Reset sesion deletes data without backup export option
**File:** `Dashboard.jsx:525-531`
**Priority:** P2
**Bug:** The reset confirmation says "Las minutas historicas NO se eliminan" but doesn't mention that focos and compromisos ARE permanently deleted. There's a backup to `STORE_KEY:before_reset` but the user has no way to restore it from the UI.
**Fix:** Add a "Descargar backup" button in the confirmation dialog, or make the `:before_reset` data accessible via the Audit Log panel.

## UX-32: Cross-Squad view in Focos is read-only — no way to add cross-squad items
**File:** `TabFocos.jsx:74-98`
**Priority:** P3
**Bug:** The Cross-Squad tab aggregates blockers/necesitos from all squads but doesn't allow adding cross-squad items directly. If a blocker spans multiple squads, it must be entered under one squad.
**Fix:** Allow adding entries with `activeSquad === "cross"` that tag multiple squads.

---

## Sprint 2 Recommendation

### Batch A — Quick Wins (< 30 min each, high impact)
| Bug | Fix | Files |
|-----|-----|-------|
| UX-15/16/17 | Escape key for all modals | MinutaLightbox, PhaseModal, ui.jsx |
| UX-18 | Compromiso delete confirmation | TabCompromisos.jsx |
| UX-19 | Focos delete confirmation | TabFocos.jsx |
| UX-12 | Timer bar border-radius | TimerZone.jsx |

### Batch B — Mobile Critical (P1)
| Bug | Fix | Files |
|-----|-----|-------|
| UX-10 | Compromisos mobile layout | TabCompromisos.jsx, css.js |
| UX-20 | GdD metrics mobile grid | TabHome.jsx |

### Batch C — UX Polish (P2)
| Bug | Fix | Files |
|-----|-----|-------|
| UX-24 | Tendencia expandedWeek state | TabHome.jsx |
| UX-13 | Focos form collapse | TabFocos.jsx |
| UX-30 | Loading timeout feedback | Dashboard.jsx |
| UX-28 | Tab a11y roles | Dashboard.jsx |
| UX-23 | Presenter mode scaling | css.js |

### Batch D — Deferred (P3 / larger scope)
UX-11, UX-14, UX-21, UX-22, UX-25, UX-26, UX-27, UX-29, UX-31, UX-32
