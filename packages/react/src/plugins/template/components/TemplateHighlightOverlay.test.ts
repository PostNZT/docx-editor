/**
 * groupRectsByLine — clusters a tag's painted rects into one band per visual
 * line. This is what makes a wrapped variable (a long name in a narrow table
 * cell) render as one pill PER line that hugs its text, instead of a single
 * bounding box spanning the gap between the lines.
 */
import { describe, test, expect } from 'bun:test';
import { groupRectsByLine } from './TemplateHighlightOverlay';

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('groupRectsByLine', () => {
  test('a single rect yields a single band', () => {
    expect(groupRectsByLine([r(10, 100, 40, 16)])).toEqual([
      { left: 10, top: 100, right: 50, bottom: 116 },
    ]);
  });

  test('rects on the same line (split by a formatting boundary) merge horizontally', () => {
    // "{{", the name and "}}" painted as three adjacent spans on one line.
    const groups = groupRectsByLine([r(10, 100, 12, 16), r(22, 100, 50, 16), r(72, 100, 12, 16)]);
    expect(groups).toEqual([{ left: 10, top: 100, right: 84, bottom: 116 }]);
  });

  test('rects on different lines (wrapped tag) stay as separate bands', () => {
    // Long name wraps: tail of line 1, then start of line 2 (≈ one line lower).
    const groups = groupRectsByLine([r(120, 100, 60, 16), r(8, 120, 70, 16)]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ left: 120, top: 100, right: 180, bottom: 116 });
    expect(groups[1]).toEqual({ left: 8, top: 120, right: 78, bottom: 136 });
  });

  test('sub-pixel vertical jitter on the same line still merges', () => {
    // getClientRects can report fractionally different tops for adjacent spans.
    const groups = groupRectsByLine([r(10, 100, 30, 16), r(40, 100.4, 30, 15.6)]);
    expect(groups).toHaveLength(1);
  });

  test('input order does not matter (line 2 rect listed first)', () => {
    const groups = groupRectsByLine([r(8, 120, 70, 16), r(120, 100, 60, 16)]);
    expect(groups).toHaveLength(2);
    // sorted top-to-bottom
    expect(groups[0].top).toBe(100);
    expect(groups[1].top).toBe(120);
  });
});
