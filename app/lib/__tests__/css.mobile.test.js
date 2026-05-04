import { describe, it, expect } from 'vitest';
import { CSS } from '../css.js';

describe('UX-10: compromisos-row mobile grid', () => {
  it('640px: overrides to 26px 1fr 80px 50px', () => {
    expect(CSS).toContain('.compromisos-row{grid-template-columns:26px 1fr 80px 50px!important}');
  });

  it('480px: collapses to 26px 1fr 50px', () => {
    expect(CSS).toContain('.compromisos-row{grid-template-columns:26px 1fr 50px!important}');
  });

  it('480px: hides child 3 (Quien column)', () => {
    expect(CSS).toContain('.compromisos-row>*:nth-child(3){display:none!important}');
  });
});

describe('UX-20: kpi-grid-mobile regression', () => {
  it('640px: overrides to repeat(2,1fr)', () => {
    expect(CSS).toContain('.kpi-grid-mobile{grid-template-columns:repeat(2,1fr)!important}');
  });
});

describe('UX-23: presenter mode scaling', () => {
  it('uses transform scale on .presenter-mode .fade', () => {
    expect(CSS).toContain('.presenter-mode .fade{transform:scale(var(--ps));transform-origin:top left}');
  });

  it('does not use the broken font-size calc hack', () => {
    expect(CSS).not.toContain('.presenter-mode .fade *{font-size:calc(');
  });
});
