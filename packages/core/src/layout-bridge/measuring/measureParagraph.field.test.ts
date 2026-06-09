/**
 * Regression: an OTHER field with an empty fallback must measure to ZERO width.
 *
 * A hidden field such as `SEQ … \h` produces no visible text — the painter draws
 * nothing for an OTHER field whose fallback is empty. The measurer used to default
 * any field's fallback to '1', reserving ~8px the painter never draws. In a caption
 * like  "In re <tab> Case No. <SEQ \h> 26-bk-12569-MAM"  that phantom width pushed
 * the case number past the right edge and wrapped "MAM" to a second line (Google
 * Docs keeps it on one line). Fields that DO resolve to a value at paint time
 * (PAGE / NUMPAGES / DATE / TIME) keep the single-char placeholder.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { measureParagraph } from './measureParagraph';
import { resetCanvasContext } from './measureContainer';
import type { ParagraphBlock, FieldRun } from '../../layout-engine/types';

// Stub canvas: width proportional to character count (real metrics need a browser).
const SCALE = 8;
beforeAll(() => {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({
      getContext: () => ({
        font: '',
        measureText: (t: string) => ({ width: t.length * SCALE }),
      }),
    }),
  };
  resetCanvasContext();
});
afterAll(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
  resetCanvasContext();
});

function paraWithField(fieldType: FieldRun['fieldType'], fallback: string): ParagraphBlock {
  const field: FieldRun = { kind: 'field', fieldType, fallback, pmStart: 1, pmEnd: 2 };
  return { kind: 'paragraph', id: 'b1', attrs: {}, runs: [field] } as ParagraphBlock;
}

describe('measureParagraph — empty field width', () => {
  test('OTHER field with empty fallback contributes zero width', () => {
    const m = measureParagraph(paraWithField('OTHER', ''), 600);
    expect(m.lines[0].width).toBe(0);
  });

  test('OTHER field with a real fallback contributes its measured width', () => {
    const m = measureParagraph(paraWithField('OTHER', 'X'), 600);
    expect(m.lines[0].width).toBe(SCALE); // one char
  });

  test('PAGE field with empty fallback still reserves a placeholder width', () => {
    const m = measureParagraph(paraWithField('PAGE', ''), 600);
    expect(m.lines[0].width).toBe(SCALE); // reserves '1'
  });

  test('NUMPAGES field with empty fallback still reserves a placeholder width', () => {
    const m = measureParagraph(paraWithField('NUMPAGES', ''), 600);
    expect(m.lines[0].width).toBe(SCALE);
  });
});
