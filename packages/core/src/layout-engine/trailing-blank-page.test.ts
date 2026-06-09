/**
 * Regression: a spurious trailing page that paints nothing is dropped.
 *
 * Tall line spacing or trailing empty/spacer paragraphs can push a content-less
 * paragraph onto a fresh page. Word and Google never render such a blank trailing
 * page (a lone trailing empty paragraph does not occupy a new page). layoutDocument
 * drops a trailing page whose every fragment is an invisible (empty) paragraph,
 * while never removing the final page or a page with real content.
 */
import { describe, test, expect } from 'bun:test';
import { layoutDocument } from './index';
import type {
  ParagraphBlock,
  ParagraphMeasure,
  MeasuredLine,
  FlowBlock,
  Measure,
  PageMargins,
} from './types';

const PAGE = { w: 816, h: 1056 };
const MARGINS: PageMargins = { top: 96, right: 96, bottom: 96, left: 96 };
// content height = 1056 - 96 - 96 = 864

function line(width: number, lineHeight: number): MeasuredLine {
  return {
    fromRun: 0,
    fromChar: 0,
    toRun: 0,
    toChar: 0,
    width,
    ascent: lineHeight * 0.8,
    descent: lineHeight * 0.2,
    lineHeight,
  };
}
function measure(lineHeight: number): ParagraphMeasure {
  return { kind: 'paragraph', lines: [line(100, lineHeight)], totalHeight: lineHeight };
}
function textBlock(id: number, text: string): ParagraphBlock {
  return {
    kind: 'paragraph',
    id,
    runs: [{ kind: 'text', text, pmStart: 0, pmEnd: text.length }],
    attrs: {},
    pmStart: 0,
    pmEnd: text.length + 1,
  };
}
function emptyBlock(id: number): ParagraphBlock {
  return { kind: 'paragraph', id, runs: [], attrs: {}, pmStart: 0, pmEnd: 1 };
}

function layout(blocks: FlowBlock[], measures: Measure[]) {
  return layoutDocument(blocks, measures, { pageSize: PAGE, margins: MARGINS });
}

describe('layoutDocument — trailing blank page', () => {
  test('drops a trailing page that holds only an empty paragraph', () => {
    // Block A nearly fills page 1 (800 of 864); the empty paragraph spills to page 2.
    const blocks = [textBlock(1, 'fills the page'), emptyBlock(2)];
    const measures = [measure(800), measure(100)];
    const layoutResult = layout(blocks, measures);
    expect(layoutResult.pages.length).toBe(1);
  });

  test('keeps the second page when it carries real text', () => {
    const blocks = [textBlock(1, 'fills the page'), textBlock(2, 'visible overflow')];
    const measures = [measure(800), measure(100)];
    const layoutResult = layout(blocks, measures);
    expect(layoutResult.pages.length).toBe(2);
  });

  test('never drops the only page, even when empty', () => {
    const blocks = [emptyBlock(1)];
    const measures = [measure(20)];
    const layoutResult = layout(blocks, measures);
    expect(layoutResult.pages.length).toBe(1);
  });
});
