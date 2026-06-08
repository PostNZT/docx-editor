import { describe, test, expect } from 'bun:test';
import { pixelsToEmu, emuToTwips, twipsToEmu } from '../units';

// Ported from upstream eigenpal/docx-editor #417: EMU/twip coordinates are
// integer-typed in OOXML (xs:long), and Microsoft Word rejects DOCX files
// whose integer attributes carry floating-point values. The conversion
// helpers must therefore round, not leak IEEE-754 drift.
describe('unit conversions return integers (OOXML integer-typed coords)', () => {
  test('pixelsToEmu rounds away IEEE-754 drift', () => {
    // (52 / 96) * 914400 === 495299.99999999994 in IEEE-754 → must be 495300.
    expect(pixelsToEmu(52)).toBe(495300);
    expect(Number.isInteger(pixelsToEmu(52))).toBe(true);
  });

  test('pixelsToEmu is integer-valued across a range', () => {
    for (let px = 0; px <= 300; px++) {
      expect(Number.isInteger(pixelsToEmu(px))).toBe(true);
    }
  });

  test('twipsToEmu and emuToTwips round-trip as integers', () => {
    expect(twipsToEmu(1440)).toBe(914400);
    expect(Number.isInteger(twipsToEmu(1440))).toBe(true);
    expect(emuToTwips(914400)).toBe(1440);
    expect(Number.isInteger(emuToTwips(914400))).toBe(true);
    // A value that would drift without rounding.
    expect(Number.isInteger(twipsToEmu(1007))).toBe(true);
    expect(Number.isInteger(emuToTwips(639445))).toBe(true);
  });
});
