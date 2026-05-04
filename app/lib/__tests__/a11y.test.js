import { describe, it, expect } from 'vitest';
import { CSS } from '../css.js';

describe('A11y: sr-only class in CSS', () => {
  it('includes sr-only with clip rect', () => {
    expect(CSS).toContain('.sr-only{');
    expect(CSS).toContain('clip:rect(0,0,0,0)');
  });
  it('includes position absolute for screen-reader-only', () => {
    expect(CSS).toContain('width:1px;height:1px');
  });
});

describe('A11y: prefers-reduced-motion', () => {
  it('includes reduced motion media query', () => {
    expect(CSS).toContain('@media(prefers-reduced-motion:reduce)');
  });
  it('disables animations', () => {
    expect(CSS).toContain('animation-duration:0.01ms');
  });
  it('disables transitions', () => {
    expect(CSS).toContain('transition-duration:0.01ms');
  });
});

describe('A11y: focus-visible styles', () => {
  it('has focus-visible for buttons', () => {
    expect(CSS).toContain('button:focus-visible');
  });
  it('has focus-visible for inputs', () => {
    expect(CSS).toContain('input:focus-visible');
  });
  it('has focus-visible for textareas', () => {
    expect(CSS).toContain('textarea:focus-visible');
  });
  it('uses blue outline', () => {
    expect(CSS).toContain('outline:2px solid var(--blue)');
  });
});
