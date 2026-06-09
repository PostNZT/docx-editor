/**
 * RenderedDomContext.getRectsForRanges — parity with per-range getRectsForRange.
 *
 * getRectsForRanges is a performance refactor: it scans the rendered spans ONCE
 * for all ranges instead of re-querying per range. It MUST return exactly what
 * calling getRectsForRange(from,to) for each range would return (same grouping,
 * same overlap test, same tab/text handling, same coordinates) — otherwise the
 * template-pill overlay would drift. This test pins that equivalence with a
 * mocked DOM (jsdom/node has no layout, so we inject deterministic rects).
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { RenderedDomContextImpl } from './RenderedDomContext';

// The impl references the global `Node` for Node.TEXT_NODE.
const prevNode = (globalThis as { Node?: unknown }).Node;
beforeAll(() => {
  (globalThis as { Node?: unknown }).Node = { TEXT_NODE: 3 };
});
afterAll(() => {
  (globalThis as { Node?: unknown }).Node = prevNode;
});

// A fake Range whose client rect is derived deterministically from the char
// offsets, so getRectsForRange and getRectsForRanges produce identical output.
function makeOwnerDoc() {
  return {
    createRange() {
      let s = 0;
      let e = 0;
      return {
        setStart: (_n: unknown, c: number) => {
          s = c;
        },
        setEnd: (_n: unknown, c: number) => {
          e = c;
        },
        getClientRects: () => [{ left: 100 + s, top: 50, width: (e - s) * 7, height: 16 }],
      };
    },
  };
}

interface SpanSpec {
  pmStart: number;
  pmEnd: number;
  text?: string;
  tab?: boolean;
}

function makeContainer(specs: SpanSpec[]) {
  const ownerDocument = makeOwnerDoc();
  const spans = specs.map((spec) => {
    const textNode = spec.tab ? null : { nodeType: 3, length: (spec.text ?? '').length };
    return {
      dataset: { pmStart: String(spec.pmStart), pmEnd: String(spec.pmEnd) },
      classList: { contains: (c: string) => Boolean(spec.tab) && c === 'layout-run-tab' },
      firstChild: textNode,
      ownerDocument,
      getBoundingClientRect: () => ({ left: 200, top: 50, width: 30, height: 16 }),
    };
  });
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    querySelectorAll: () => spans,
    parentElement: null,
  };
}

describe('getRectsForRanges — parity with getRectsForRange', () => {
  const specs: SpanSpec[] = [
    { pmStart: 10, pmEnd: 25, text: 'hello world abc' }, // text run
    { pmStart: 25, pmEnd: 26, tab: true }, // tab run
    { pmStart: 26, pmEnd: 40, text: 'second chunk!!' }, // text run
  ];
  const ranges = [
    { from: 12, to: 20 }, // inside first span
    { from: 24, to: 30 }, // spans text → tab → text
    { from: 99, to: 105 }, // matches nothing
    { from: 10, to: 40 }, // covers everything
  ];

  test('batched output equals per-range output, index-aligned', () => {
    const ctx = new RenderedDomContextImpl(makeContainer(specs) as unknown as HTMLElement, 1);
    const batched = ctx.getRectsForRanges(ranges);
    const perRange = ranges.map((r) => ctx.getRectsForRange(r.from, r.to));
    expect(batched).toEqual(perRange);
  });

  test('empty ranges returns empty array', () => {
    const ctx = new RenderedDomContextImpl(makeContainer(specs) as unknown as HTMLElement, 1);
    expect(ctx.getRectsForRanges([])).toEqual([]);
  });

  test('zoom is applied identically in both paths', () => {
    const ctx = new RenderedDomContextImpl(makeContainer(specs) as unknown as HTMLElement, 2);
    const batched = ctx.getRectsForRanges(ranges);
    const perRange = ranges.map((r) => ctx.getRectsForRange(r.from, r.to));
    expect(batched).toEqual(perRange);
  });
});
