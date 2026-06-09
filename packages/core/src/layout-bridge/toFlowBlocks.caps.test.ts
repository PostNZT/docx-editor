import { describe, test, expect } from 'bun:test';
import { schema } from '../prosemirror/schema';
import { toFlowBlocks } from './toFlowBlocks';
import type { ParagraphBlock, TextRun } from '../layout-engine/types';

// w:caps (allCaps) is an OOXML display transform: the text is stored mixed-case
// but rendered uppercase (as Word / Google Docs do). Because our layout engine
// measures text with Canvas measureText (which ignores CSS text-transform), the
// flow run's text must itself be uppercased so measurement, line wrapping, and
// painting all agree. w:smallCaps stays as a CSS-only transform.
function textRunsOf(doc: ReturnType<typeof schema.node>): TextRun[] {
  const runs: TextRun[] = [];
  for (const block of toFlowBlocks(doc)) {
    if (block.kind === 'paragraph') {
      for (const run of (block as ParagraphBlock).runs) {
        if (run.kind === 'text') runs.push(run);
      }
    }
  }
  return runs;
}

describe('toFlowBlocks — caps handling', () => {
  test('allCaps run text is uppercased for layout (matches Word/Google Docs)', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('Kristin lynn fleisher', [schema.mark('allCaps')]),
      ]),
    ]);
    const runs = textRunsOf(doc);
    expect(runs.map((r) => r.text).join('')).toBe('KRISTIN LYNN FLEISHER');
    // length preserved so PM↔flow position mapping stays aligned
    expect(runs[0].text.length).toBe('Kristin lynn fleisher'.length);
    expect(runs[0].allCaps).toBe(true);
  });

  test('smallCaps run keeps its original text and carries the flag (CSS handles display)', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('hello world', [schema.mark('smallCaps')])]),
    ]);
    const runs = textRunsOf(doc);
    expect(runs[0].text).toBe('hello world');
    expect(runs[0].smallCaps).toBe(true);
  });

  test('plain run text is left untouched', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Mixed Case Text')]),
    ]);
    const runs = textRunsOf(doc);
    expect(runs[0].text).toBe('Mixed Case Text');
    expect(runs[0].allCaps).toBeUndefined();
  });
});
