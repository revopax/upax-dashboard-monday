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

// Cross-validation: tokens.js values must reference vars that exist in css.js
import { C, TS, R, F } from '../tokens.js';

function extractVar(val) {
  return val.match(/var\((--[^),]+)\)/)?.[1];
}

describe('tokens.js <-> css.js cross-validation', () => {

  describe('C (colors)', () => {
    Object.entries(C).forEach(([key, val]) => {
      it(`C.${key} = "${val}" exists in CSS`, () => {
        const v = extractVar(val);
        expect(v).toBeTruthy();
        expect(CSS).toContain(v);
      });
    });
  });

  describe('TS (type sizes)', () => {
    Object.entries(TS).forEach(([key, val]) => {
      it(`TS["${key}"] = "${val}" exists in CSS`, () => {
        const v = extractVar(val);
        expect(v).toBeTruthy();
        expect(CSS).toContain(v);
      });
    });
  });

  describe('R (radius)', () => {
    Object.entries(R).forEach(([key, val]) => {
      it(`R["${key}"] = "${val}" exists in CSS`, () => {
        const v = extractVar(val);
        expect(v).toBeTruthy();
        expect(CSS).toContain(v);
      });
    });
  });

  describe('F (font families)', () => {
    Object.entries(F).forEach(([key, val]) => {
      it(`F.${key} = "${val}" exists in CSS`, () => {
        const v = extractVar(val);
        expect(v).toBeTruthy();
        expect(CSS).toContain(v);
      });
    });
  });
});

// Component structural tests
import { Button, Skeleton, Card } from '../../components/ui.jsx';

describe('Button component', () => {
  it('is exported as a function', () => {
    expect(typeof Button).toBe('function');
  });

  it('accepts every variant x size without throwing', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'cta'];
    const sizes = ['sm', 'md', 'lg'];
    for (const variant of variants) {
      for (const size of sizes) {
        expect(() => Button({ variant, size, children: 'Test' })).not.toThrow();
      }
    }
  });

  it('defaults to variant="secondary" size="md"', () => {
    const result = Button({ children: 'Test' });
    expect(result).toBeTruthy();
    expect(result.type).toBe('button');
  });

  it('passes extra props through', () => {
    const result = Button({ children: 'X', disabled: true });
    expect(result.props.disabled).toBe(true);
  });
});

describe('Skeleton component', () => {
  it('is exported as a function', () => {
    expect(typeof Skeleton).toBe('function');
  });

  it('accepts each type without throwing', () => {
    for (const type of ['line', 'kpi', 'card', 'row']) {
      expect(() => Skeleton({ type })).not.toThrow();
    }
  });

  it('renders count items', () => {
    const result = Skeleton({ type: 'line', count: 3 });
    expect(result.props.children).toHaveLength(3);
  });

  it('defaults to count=1', () => {
    const result = Skeleton({ type: 'row' });
    expect(result.props.children).toHaveLength(1);
  });
});

describe('Card backward compat', () => {
  it('works with original API: Card({ children, style })', () => {
    const result = Card({ children: 'Hello', style: { padding: 10 } });
    expect(result).toBeTruthy();
    expect(result.type).toBe('div');
    expect(result.props.style.padding).toBe(10);
    expect(result.props.style.boxShadow).toBe('var(--shadow)');
  });

  it('works with new variant API', () => {
    for (const variant of ['default', 'elevated', 'flat', 'dashed']) {
      expect(() => Card({ variant, children: 'Test' })).not.toThrow();
    }
  });

  it('elevated variant uses shadow-lg', () => {
    const result = Card({ variant: 'elevated', children: 'X' });
    expect(result.props.style.boxShadow).toBe('var(--shadow-lg)');
  });

  it('accent prop adds borderTop', () => {
    const result = Card({ accent: '#FF0000', children: 'X' });
    expect(result.props.style.borderTop).toBe('3px solid #FF0000');
  });

  it('no accent = no borderTop', () => {
    const result = Card({ children: 'X' });
    expect(result.props.style.borderTop).toBeUndefined();
  });
});
