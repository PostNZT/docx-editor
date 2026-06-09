/**
 * Regression: a field run inherits the document font, not the painter default.
 *
 * A field node (PAGE / DATE / etc.) carries the run's font on its marks. When
 * toFlowBlocks built the FieldRun it dropped those marks, so the substituted
 * value (e.g. a DATE field "April 8, 2026") rendered in the painter's default
 * Calibri instead of the surrounding font — visibly mismatching the adjacent
 * "Dated:" text (Times New Roman). The FieldRun must carry the field node's
 * font/size so render-time substitution matches the document.
 */
import { describe, test, expect } from 'bun:test';
import { schema } from '../prosemirror/schema';
import { toFlowBlocks } from './toFlowBlocks';
import type { ParagraphBlock, FieldRun } from '../layout-engine/types';

describe('toFlowBlocks — field run formatting', () => {
  test('a DATE field carries the font/size from its node marks', () => {
    const fontMarks = [
      schema.mark('fontFamily', { ascii: 'Times New Roman', hAnsi: 'Times New Roman' }),
      schema.mark('fontSize', { size: 24 }), // 24 half-points = 12pt
    ];
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('Dated: ', fontMarks),
        schema.node(
          'field',
          { fieldType: 'DATE', displayText: 'April 8, 2026' },
          undefined,
          fontMarks
        ),
      ]),
    ]);

    const para = toFlowBlocks(doc).find((b) => b.kind === 'paragraph') as ParagraphBlock;
    const field = para.runs.find((r) => r.kind === 'field') as FieldRun | undefined;

    expect(field).toBeTruthy();
    expect(field!.fallback).toBe('April 8, 2026');
    expect(field!.fontFamily).toBe('Times New Roman');
    expect(field!.fontSize).toBe(12);
  });

  test('an unstyled field has no font (falls through to paragraph/painter default)', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.node('field', { fieldType: 'PAGE' }, undefined, [])]),
    ]);
    const para = toFlowBlocks(doc).find((b) => b.kind === 'paragraph') as ParagraphBlock;
    const field = para.runs.find((r) => r.kind === 'field') as FieldRun | undefined;
    expect(field).toBeTruthy();
    expect(field!.fontFamily).toBeUndefined();
  });
});
