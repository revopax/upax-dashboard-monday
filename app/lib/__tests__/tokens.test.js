import { describe, it, expect } from 'vitest';
import { CSS } from '../css.js';

describe('Design system tokens in CSS', () => {

  describe('typography scale (--ts-*)', () => {
    const expected = {
      '--ts-2xs:9px':    'micro labels, phase badges',
      '--ts-xs:10px':    'eyebrows, metadata',
      '--ts-sm:11px':    'body small, task names',
      '--ts-base:12px':  'inputs, table cells',
      '--ts-md:13px':    'body default, textareas',
      '--ts-lg:14px':    'section labels',
      '--ts-xl:17px':    'tab titles, headings',
      '--ts-display:28px': 'KPIs, timer clock',
      '--ts-hero:36px':  'hero KPI',
    };
    Object.entries(expected).forEach(([token, usage]) => {
      it(`declares ${token} (${usage})`, () => {
        expect(CSS).toContain(token);
      });
    });
  });

  describe('radius new tokens (--r-*)', () => {
    it('declares --r-2xs:3px', () => { expect(CSS).toContain('--r-2xs:3px'); });
    it('declares --r-xs:6px', () => { expect(CSS).toContain('--r-xs:6px'); });
    it('declares --r-full:9999px', () => { expect(CSS).toContain('--r-full:9999px'); });
  });

  describe('radius existing tokens preserved', () => {
    it('keeps --r:14px', () => { expect(CSS).toContain('--r:14px'); });
    it('keeps --r-sm:10px', () => { expect(CSS).toContain('--r-sm:10px'); });
    it('keeps --r-lg:18px', () => { expect(CSS).toContain('--r-lg:18px'); });
  });

  describe('--r-md removed (0 uses)', () => {
    it('does not contain --r-md', () => { expect(CSS).not.toContain('--r-md'); });
  });

  describe('spacing tokens (--s-*)', () => {
    ['--s-1:4px','--s-2:6px','--s-3:8px','--s-4:10px','--s-5:12px',
     '--s-6:16px','--s-7:20px','--s-8:24px','--s-10:32px'].forEach(token => {
      it(`declares ${token}`, () => { expect(CSS).toContain(token); });
    });
  });

  describe('font weight tokens (--fw-*)', () => {
    ['--fw-regular:400','--fw-medium:500','--fw-semibold:600',
     '--fw-bold:700','--fw-heavy:800'].forEach(token => {
      it(`declares ${token}`, () => { expect(CSS).toContain(token); });
    });
  });

  describe('shadow elevated', () => {
    it('declares --shadow-lg', () => { expect(CSS).toContain('--shadow-lg:'); });
  });
});
