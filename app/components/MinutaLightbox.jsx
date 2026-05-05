'use client'
import React, { useEffect } from 'react'
import { MinutaDetailView } from './MinutaDetailView'
import { C, R } from '../lib/tokens'

function MinutaLightbox({ minutaLightbox, wd, analysis, gddData, blockTimes, onClose }) {
  useEffect(() => {
    if (!minutaLightbox) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [minutaLightbox, onClose]);

  if (!minutaLightbox) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Detalle de minuta" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: typeof window !== "undefined" && window.innerWidth <= 640 ? 12 : 20 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg2, borderRadius: R.lg, boxShadow: "0 40px 100px rgba(0,0,0,.4)", width: "100%", maxWidth: 700, height: "82vh", display: "flex", flexDirection: "column", overflow: "hidden", overflowX: "hidden" }}>
        <MinutaDetailView
          weekKey={minutaLightbox.key} data={minutaLightbox.data}
          todayWd={wd} todayAnalysis={analysis} gddData={gddData} blockTimes={blockTimes}
          initialEditMode={minutaLightbox.editMode || false}
          onBack={onClose}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export { MinutaLightbox }
