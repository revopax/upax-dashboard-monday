// lib/css.js — Apple Modern Light design system

export const CSS = `
/* fonts cargadas vía next/font en layout.js (P3.1) */
*{box-sizing:border-box;margin:0}
:root{
  --bg:#FAFAFA;--bg2:#FFFFFF;--bg3:#F2F2F7;--bg4:#E5E5EA;
  --tx:#1D1D1F;--tx2:#3A3A3C;--tx3:#6E6E73;--border:#D1D1D6;
  --red:#FF3B30;--green:#34C759;--yellow:#FF9F0A;--orange:#FF9500;--blue:#007AFF;--purple:#AF52DE;--cyan:#5AC8FA;--pink:#FF2D55;
  --shadow:0 1px 3px rgba(0,0,0,.06),0 2px 8px rgba(0,0,0,.04);
  --mono:var(--font-mono,'JetBrains Mono',monospace);--sans:var(--font-sans,'Inter',-apple-system,BlinkMacSystemFont,sans-serif);
  --r:14px;--r-sm:10px;--r-lg:18px;
  --ts-2xs:9px;--ts-xs:10px;--ts-sm:11px;--ts-base:12px;--ts-md:13px;--ts-lg:14px;--ts-xl:17px;--ts-display:28px;--ts-hero:36px;
  --r-2xs:3px;--r-xs:6px;--r-full:9999px;
  --s-1:4px;--s-2:6px;--s-3:8px;--s-4:10px;--s-5:12px;--s-6:16px;--s-7:20px;--s-8:24px;--s-10:32px;
  --fw-regular:400;--fw-medium:500;--fw-semibold:600;--fw-bold:700;--fw-heavy:800;
  --shadow-lg:0 4px 12px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.06);
}
body{background:var(--bg);font-family:var(--sans);color:var(--tx);-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.5}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes liveDot{0%,100%{transform:scale(1)}50%{transform:scale(1.8);opacity:.4}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(52,199,89,.35)}50%{box-shadow:0 0 0 14px rgba(52,199,89,0)}}
.fade{animation:fadeIn .3s ease both}
input[type=range]{-webkit-appearance:none;height:6px;border-radius:3px;background:var(--bg4);outline:none;cursor:pointer;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid var(--blue);box-shadow:0 1px 4px rgba(0,0,0,.15);cursor:pointer}
select{-webkit-appearance:auto}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:3px}
::selection{background:rgba(0,122,255,.15)}
:root{--ps:1}
.presenter-mode{--ps:1.25}
.presenter-mode .fade{transform:scale(var(--ps));transform-origin:top left}
.sticky-nav{position:sticky;top:0;z-index:90;background:var(--bg);border-bottom:1px solid var(--bg4);padding:0 20px;margin:0 -20px;box-shadow:0 1px 0 var(--bg4),0 4px 12px rgba(0,0,0,.04);scrollbar-width:none;}
.sticky-nav::-webkit-scrollbar{display:none;}

@media print{body>div>*:not(#print-root){display:none!important}#print-root{display:block!important;position:static!important;background:#fff!important}#print-bar{display:none!important}}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:640px){
  .sticky-nav button{padding:8px 10px;font-size:11px}
  .sticky-nav{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 8px;margin:0 -8px;-webkit-mask-image:linear-gradient(to right,#000 85%,transparent);mask-image:linear-gradient(to right,#000 85%,transparent)}
  .mobile-stack{flex-direction:column!important}
  .mobile-hide{display:none!important}
  .mobile-only{display:block!important}
  .mobile-full{width:100%!important;min-width:0!important}
  .kpi-grid-mobile{grid-template-columns:repeat(2,1fr)!important}
  .compromisos-row{grid-template-columns:26px 1fr 80px 50px!important}
  .compromisos-row>*:nth-child(4){display:none!important}
  .compromisos-row>*:nth-child(6){display:none!important}
}
@media(max-width:480px){
  .mobile-xs-hide{display:none!important}
  .compromisos-row{grid-template-columns:26px 1fr 50px!important}
  .compromisos-row>*:nth-child(3){display:none!important}
}
button:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
select:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
input:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
textarea:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(prefers-reduced-motion:reduce){
  .fade{animation:none!important}
  *{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important}
}`;

/* ═══════════════════════════════════════════════════════════════
   SECTION 7: SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
