/**
 * Regression test for list-marker first-line positioning.
 *
 * Bug: numbered/bulleted paragraphs that use a positive first-line indent
 * (w:ind firstLine=…, no hanging) had their marker positioned at `indentLeft`
 * only — the firstLine offset was ignored — so the marker rendered too far
 * left (appearing flush-left) compared to Microsoft Word. Hanging-indent lists
 * were unaffected.
 *
 * Fix (renderParagraph.ts): the marker origin is now
 *   indentLeft + firstLine - hanging
 * (firstLine and hanging are mutually exclusive in OOXML), and the marker box
 * width fills the firstLine offset when there is no hanging, so the text after
 * the marker lands at the intended tab position.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();

import { describe, test, expect } from 'bun:test';
import { renderParagraphFragment } from './renderParagraph';
import type {
  ParagraphBlock,
  ParagraphMeasure,
  ParagraphFragment,
  ParagraphIndent,
} from '../layout-engine/types';
import type { RenderContext } from './renderPage';

const CTX: RenderContext = {
  pageNumber: 1,
  totalPages: 1,
  section: 'body',
  contentWidth: 700,
};

function makeBlock(marker: string, indent: ParagraphIndent): ParagraphBlock {
  return {
    kind: 'paragraph',
    id: 1,
    runs: [{ kind: 'text', text: 'Item text', fontFamily: 'Times New Roman', fontSize: 12 }],
    attrs: {
      indent,
      listMarker: marker,
    } as ParagraphBlock['attrs'],
  };
}

function oneLineMeasure(): ParagraphMeasure {
  const lineHeight = ((12 * 96) / 72) * 1.2;
  return {
    kind: 'paragraph',
    totalHeight: lineHeight,
    lines: [
      {
        fromRun: 0,
        fromChar: 0,
        toRun: 0,
        toChar: 9,
        width: 60,
        lineHeight,
        ascent: lineHeight * 0.8,
        descent: lineHeight * 0.2,
      },
    ],
  };
}

function renderMarker(block: ParagraphBlock): { paddingLeft: number; minWidth: number } {
  const measure = oneLineMeasure();
  const fragment: ParagraphFragment = {
    kind: 'paragraph',
    blockId: block.id,
    x: 0,
    y: 0,
    width: 700,
    fromLine: 0,
    toLine: 1,
    height: measure.totalHeight,
  };
  const el = renderParagraphFragment(fragment, block, measure, CTX, { document });
  const markerEl = el.querySelector('.layout-list-marker') as HTMLElement | null;
  if (!markerEl) throw new Error('marker not rendered');
  const lineEl = markerEl.parentElement as HTMLElement;
  return {
    paddingLeft: parseFloat(lineEl.style.paddingLeft) || 0,
    minWidth: parseFloat(markerEl.style.minWidth) || 0,
  };
}

describe('list marker first-line positioning', () => {
  test('first-line-indent list: marker shifts right by firstLine offset', () => {
    // ind left=72 firstLine=48 (no hanging). Marker must sit at 72 + 48 = 120.
    const { paddingLeft, minWidth } = renderMarker(makeBlock('1.', { left: 72, firstLine: 48 }));
    expect(paddingLeft).toBeCloseTo(120, 1);
    // Marker box fills the firstLine gap so text lands further right (at the tab).
    expect(minWidth).toBeCloseTo(48, 1);
  });

  test('hanging-indent list: marker sits at indentLeft - hanging (unchanged)', () => {
    // ind left=168 hanging=48. Marker at 168 - 48 = 120; text aligns at indentLeft.
    const { paddingLeft, minWidth } = renderMarker(makeBlock('2.', { left: 168, hanging: 48 }));
    expect(paddingLeft).toBeCloseTo(120, 1);
    expect(minWidth).toBeCloseTo(48, 1);
  });

  test('first-line and hanging lists align their markers at the same X', () => {
    const firstLine = renderMarker(makeBlock('1.', { left: 72, firstLine: 48 }));
    const hanging = renderMarker(makeBlock('2.', { left: 168, hanging: 48 }));
    expect(firstLine.paddingLeft).toBeCloseTo(hanging.paddingLeft, 1);
  });

  test('plain list with only left indent: marker at indentLeft, default gap', () => {
    // No firstLine, no hanging → marker at left, 24px default box (common bullet case).
    const { paddingLeft, minWidth } = renderMarker(makeBlock('•', { left: 36 }));
    expect(paddingLeft).toBeCloseTo(36, 1);
    expect(minWidth).toBeCloseTo(24, 1);
  });
});
