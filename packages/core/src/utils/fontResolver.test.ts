/**
 * Unit tests for fontResolver — focused on CSS-list font name handling.
 *
 * Some DOCX exporters (web-based ones in particular) write a full
 * CSS font-family value into a single rFonts attribute, e.g.
 * `<w:rFonts w:ascii="&quot;Times New Roman&quot;, Times, serif"/>`.
 * The resolver must unwrap that to the primary font name; otherwise
 * the rendered CSS is unrecognized and the run falls back to the
 * browser default (sans-serif), producing visible inconsistency.
 */

import { describe, test, expect } from 'bun:test';
import {
  resolveFontFamily,
  hasGoogleFontEquivalent,
  getGoogleFontEquivalent,
} from './fontResolver';

describe('resolveFontFamily — CSS-style font lists', () => {
  test('quoted CSS list resolves to the primary font mapping', () => {
    const resolved = resolveFontFamily('"Times New Roman", Times, serif');
    expect(resolved.hasGoogleEquivalent).toBe(true);
    expect(resolved.googleFont).toBe('Tinos');
    expect(resolved.cssFallback).toContain('Times New Roman');
    expect(resolved.cssFallback).not.toContain('\\"');
  });

  test('single-quoted CSS list resolves the same way', () => {
    const resolved = resolveFontFamily(`'Times New Roman', Times, serif`);
    expect(resolved.googleFont).toBe('Tinos');
  });

  test('Calibri inside a CSS list resolves to its mapping', () => {
    const resolved = resolveFontFamily(`Calibri, "Helvetica Neue", Arial, sans-serif`);
    expect(resolved.googleFont).toBe('Carlito');
  });

  test('plain font name (no list) still works unchanged', () => {
    const resolved = resolveFontFamily('Times New Roman');
    expect(resolved.googleFont).toBe('Tinos');
  });

  test('list of only generic families falls back gracefully', () => {
    const resolved = resolveFontFamily('serif');
    expect(resolved.hasGoogleEquivalent).toBe(false);
    expect(resolved.cssFallback.toLowerCase()).toContain('serif');
  });
});

describe('resolveFontFamily — legal-document fonts', () => {
  test('Century Schoolbook resolves with a serif web-font fallback', () => {
    const resolved = resolveFontFamily('Century Schoolbook');
    expect(resolved.hasGoogleEquivalent).toBe(true);
    expect(resolved.googleFont).toBe('Noto Serif');
    expect(resolved.cssFallback).toContain('Century Schoolbook');
    expect(resolved.cssFallback.toLowerCase()).toContain('serif');
  });

  test('Bookman Old Style resolves with a serif web-font fallback', () => {
    const resolved = resolveFontFamily('Bookman Old Style');
    expect(resolved.hasGoogleEquivalent).toBe(true);
    expect(resolved.googleFont).toBe('Noto Serif');
    expect(resolved.cssFallback).toContain('Bookman Old Style');
  });

  test('previously-hidden professional fonts keep their accurate metrics', () => {
    // These were already mapped; exposing them in the picker must not change metrics.
    expect(resolveFontFamily('Palatino Linotype').singleLineRatio).toBeCloseTo(1.0259, 4);
    expect(resolveFontFamily('Book Antiqua').singleLineRatio).toBeCloseTo(1.0259, 4);
    expect(resolveFontFamily('Tahoma').singleLineRatio).toBeCloseTo(1.2075, 4);
    expect(resolveFontFamily('Trebuchet MS').singleLineRatio).toBeCloseTo(1.1431, 4);
  });

  test('a Century Schoolbook CSS stack (as a picker preview) unwraps to the mapping', () => {
    const resolved = resolveFontFamily('"Century Schoolbook", "Noto Serif", Georgia, serif');
    expect(resolved.googleFont).toBe('Noto Serif');
  });
});

describe('hasGoogleFontEquivalent / getGoogleFontEquivalent — CSS-list inputs', () => {
  test('hasGoogleFontEquivalent returns true for a quoted CSS list', () => {
    expect(hasGoogleFontEquivalent('"Times New Roman", Times, serif')).toBe(true);
  });

  test('getGoogleFontEquivalent returns the mapped font for a quoted CSS list', () => {
    expect(getGoogleFontEquivalent('"Times New Roman", Times, serif')).toBe('Tinos');
  });
});
