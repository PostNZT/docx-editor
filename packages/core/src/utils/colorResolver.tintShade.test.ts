import { describe, test, expect } from 'bun:test';
import { getThemeTintShadeHex } from './colorResolver';

// Ported from upstream eigenpal/docx-editor #270: theme tint/shade must use
// OOXML per-channel linear interpolation (toward white / black), not an
// HSL-luminance approximation which distorts hue/saturation on saturated
// colors. Our parameter convention is preserved: tint 0=no change..1=white,
// shade 0=black..1=no change.
describe('theme tint/shade — per-channel linear interpolation (#270)', () => {
  test('tint blends each channel toward white', () => {
    // FF0000 @ 0.5 → R 255, G/B round(255*0.5)=128 → FF8080
    expect(getThemeTintShadeHex('FF0000', 'tint', 0.5)).toBe('FF8080');
    // 3366CC @ 0.4 → 85A3E0 (per-channel c + (255-c)*0.4)
    expect(getThemeTintShadeHex('3366CC', 'tint', 0.4)).toBe('85A3E0');
  });

  test('shade scales each channel toward black', () => {
    // FF0000 @ 0.5 → R round(255*0.5)=128 → 800000
    expect(getThemeTintShadeHex('FF0000', 'shade', 0.5)).toBe('800000');
  });

  test('boundary fractions are exact no-op / full white / full black', () => {
    expect(getThemeTintShadeHex('3366CC', 'tint', 0)).toBe('3366CC');
    expect(getThemeTintShadeHex('3366CC', 'tint', 1)).toBe('FFFFFF');
    expect(getThemeTintShadeHex('3366CC', 'shade', 1)).toBe('3366CC');
    expect(getThemeTintShadeHex('3366CC', 'shade', 0)).toBe('000000');
  });

  test('a neutral gray keeps its hue (no HSL drift)', () => {
    // Pure gray tinted stays gray — trivially true for per-channel, but the
    // old HSL path could drift on rounding. 808080 @ 0.5 → C0C0C0.
    expect(getThemeTintShadeHex('808080', 'tint', 0.5)).toBe('C0C0C0');
  });
});
