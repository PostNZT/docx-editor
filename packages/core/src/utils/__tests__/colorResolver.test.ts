import { describe, test, expect } from 'bun:test';
import { generateThemeTintShadeMatrix, getThemeTintShadeHex, resolveColor } from '../colorResolver';
import type { ThemeColorScheme } from '../../types/document';

const OFFICE_2016_DEFAULTS: ThemeColorScheme = {
  dk1: '000000',
  lt1: 'FFFFFF',
  dk2: '44546A',
  lt2: 'E7E6E6',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
  hlink: '0563C1',
  folHlink: '954F72',
};

describe('generateThemeTintShadeMatrix', () => {
  test('returns 6 rows x 10 columns', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    expect(matrix).toHaveLength(6);
    for (const row of matrix) {
      expect(row).toHaveLength(10);
    }
  });

  test('row 0 contains base theme colors', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    const baseRow = matrix[0];
    // Column order: lt1, dk1, lt2, dk2, accent1-6
    expect(baseRow[0].hex).toBe('FFFFFF'); // lt1
    expect(baseRow[0].themeSlot).toBe('lt1');
    expect(baseRow[1].hex).toBe('000000'); // dk1
    expect(baseRow[1].themeSlot).toBe('dk1');
    expect(baseRow[4].hex).toBe('4472C4'); // accent1
    expect(baseRow[4].themeSlot).toBe('accent1');
  });

  test('base row cells have no tint/shade', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    for (const cell of matrix[0]) {
      expect(cell.tint).toBeUndefined();
      expect(cell.shade).toBeUndefined();
    }
  });

  test('tint rows (1-3) have tint values', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    // w:themeTint is a "keep" byte (byte/255 = fraction of base kept), so
    // Lighter 80% keeps 20% → 0x33, Lighter 60% → 0x66, Lighter 40% → 0x99.
    expect(matrix[1][4].tint).toBe('33'); // Lighter 80%
    expect(matrix[2][4].tint).toBe('66'); // Lighter 60%
    expect(matrix[3][4].tint).toBe('99'); // Lighter 40%
    // No shade on tint rows
    expect(matrix[1][4].shade).toBeUndefined();
  });

  test('shade rows (4-5) have shade values', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    expect(matrix[4][4].shade).toBe('BF'); // 25% darker
    expect(matrix[5][4].shade).toBe('80'); // 50% darker
    // No tint on shade rows
    expect(matrix[4][4].tint).toBeUndefined();
  });

  test('tinted colors are lighter than base', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    // accent1 base = 4472C4
    const baseHex = parseInt(matrix[0][4].hex.slice(0, 2), 16);
    const tintedHex = parseInt(matrix[1][4].hex.slice(0, 2), 16);
    // Tinted red channel should be higher (lighter)
    expect(tintedHex).toBeGreaterThan(baseHex);
  });

  test('shaded colors are darker than base', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    // accent1 base = 4472C4, blue channel
    const baseBlue = parseInt(matrix[0][4].hex.slice(4, 6), 16);
    const shadedBlue = parseInt(matrix[4][4].hex.slice(4, 6), 16);
    expect(shadedBlue).toBeLessThan(baseBlue);
  });

  test('labels include color name and variant', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    expect(matrix[0][4].label).toBe('Accent 1');
    expect(matrix[1][4].label).toBe('Accent 1, Lighter 80%');
    expect(matrix[4][4].label).toBe('Accent 1, Darker 25%');
  });

  test('falls back to Office 2016 defaults when no scheme provided', () => {
    const matrix = generateThemeTintShadeMatrix(null);
    expect(matrix[0][4].hex).toBe('4472C4'); // accent1 default
    expect(matrix[0][0].hex).toBe('FFFFFF'); // lt1 default
  });

  test('handles white theme color tints/shades', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    // lt1 = FFFFFF (white) - tinting white stays white
    expect(matrix[0][0].hex).toBe('FFFFFF');
    expect(matrix[1][0].hex).toBe('FFFFFF'); // tint of white = white
  });

  test('handles black theme color tints/shades', () => {
    const matrix = generateThemeTintShadeMatrix(OFFICE_2016_DEFAULTS);
    // dk1 = 000000 (black) - shading black stays black
    expect(matrix[4][1].hex).toBe('000000'); // shade of black
    expect(matrix[5][1].hex).toBe('000000');
    // Tinting black produces grays
    const tint80 = parseInt(matrix[1][1].hex.slice(0, 2), 16);
    expect(tint80).toBeGreaterThan(0);
  });
});

describe('getThemeTintShadeHex', () => {
  test('tint makes color lighter', () => {
    const result = getThemeTintShadeHex('4472C4', 'tint', 0.6);
    // Should be lighter than base
    const baseR = parseInt('44', 16);
    const resultR = parseInt(result.slice(0, 2), 16);
    expect(resultR).toBeGreaterThan(baseR);
  });

  test('shade makes color darker', () => {
    const result = getThemeTintShadeHex('4472C4', 'shade', 0.5);
    // Should be darker than base
    const baseR = parseInt('44', 16);
    const resultR = parseInt(result.slice(0, 2), 16);
    expect(resultR).toBeLessThan(baseR);
  });

  test('tint of 0 returns original color', () => {
    const result = getThemeTintShadeHex('FF0000', 'tint', 0);
    expect(result).toBe('FF0000');
  });

  test('shade of 1 returns original color', () => {
    const result = getThemeTintShadeHex('FF0000', 'shade', 1);
    expect(result).toBe('FF0000');
  });

  test('tint of 1 returns white', () => {
    const result = getThemeTintShadeHex('FF0000', 'tint', 1);
    expect(result).toBe('FFFFFF');
  });

  test('shade of 0 returns black', () => {
    const result = getThemeTintShadeHex('FF0000', 'shade', 0);
    expect(result).toBe('000000');
  });
});

// w:themeTint / w:themeShade are ST_UcharHexNumber "keep" fractions (byte/255 =
// how much of the base color survives; 0xFF = unchanged). resolveColor must
// lighten/darken accordingly. accent1 defaults to #4472C4.
describe('resolveColor theme tint/shade (OOXML keep semantics)', () => {
  test('themeTint="66" on accent1 lightens toward white (Word caches #B4C6E7)', () => {
    // keep 0x66/255 = 0.4 → 60% toward white. Per-channel rounding yields
    // #B4C7E7, matching Word's cached #B4C6E7 within 1/255. The OLD inverted
    // code produced the far-too-dark #8FAADC.
    const result = resolveColor({ themeColor: 'accent1', themeTint: '66' }, null);
    expect(result).toBe('#B4C7E7');
  });

  test('themeTint="33" on accent1 is Lighter 80% (near white)', () => {
    // keep 0x33/255 ≈ 0.2 → 80% toward white ≈ Office "Lighter 80%" #DAE3F3.
    expect(resolveColor({ themeColor: 'accent1', themeTint: '33' }, null)).toBe('#DAE3F3');
  });

  test('themeTint="FF" (keep all) leaves the base unchanged', () => {
    expect(resolveColor({ themeColor: 'accent1', themeTint: 'FF' }, null)).toBe('#4472C4');
  });

  test('themeShade="BF" on accent1 darkens (keep 75%)', () => {
    // keep 0xBF/255 ≈ 0.749 → each channel * 0.749.
    expect(resolveColor({ themeColor: 'accent1', themeShade: 'BF' }, null)).toBe('#335593');
  });
});
