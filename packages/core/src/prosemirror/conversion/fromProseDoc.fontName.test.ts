/**
 * Regression test: font names are sanitized to a single DOCX-valid family on save.
 *
 * The font-family mark can hold a CSS-style stack (e.g. when applied via the
 * font picker or pasted HTML). Writing that verbatim into w:rFonts produces an
 * invalid `w:ascii="&quot;Arial&quot;, Helvetica, sans-serif"` that Word cannot
 * resolve. fromProseDoc must reduce it to the primary family name.
 */
import { describe, test, expect } from 'bun:test';
import { schema } from '../schema';
import { fromProseDoc } from './fromProseDoc';

function runFontOf(asciiValue: string): { ascii?: string; cs?: string } {
  const mark = schema.marks.fontFamily.create({ ascii: asciiValue, hAnsi: asciiValue });
  const doc = schema.node('doc', null, [
    schema.node('paragraph', {}, [schema.text('legal text', [mark])]),
  ]);
  const out = fromProseDoc(doc);
  const para = out.package.document.content.find((b) => b.type === 'paragraph') as any;
  const run = para.content.find((c: any) => c.type === 'run');
  return { ascii: run?.formatting?.fontFamily?.ascii, cs: run?.formatting?.fontFamily?.cs };
}

describe('fromProseDoc — font name sanitization', () => {
  test('a CSS font stack is reduced to its primary family name', () => {
    const { ascii } = runFontOf('"Century Schoolbook", "Noto Serif", Georgia, serif');
    expect(ascii).toBe('Century Schoolbook');
  });

  test('a clean font name passes through unchanged', () => {
    expect(runFontOf('Times New Roman').ascii).toBe('Times New Roman');
  });

  test('cs falls back to the sanitized ascii name', () => {
    const { cs } = runFontOf('Arial, Helvetica, sans-serif');
    expect(cs).toBe('Arial');
  });
});
