/**
 * Regression: a hyperlink run inherits the paragraph's font, not docDefaults.
 *
 * Real-world DOCX (e.g. legal filings) put email links in a Body Text paragraph
 * styled Times New Roman 12pt. The link run carries only the Hyperlink character
 * style (color + underline, no font) plus a `<w:rFonts w:cs="Times New Roman"/>`
 * override — no ascii/hAnsi, no size. Two cascade bugs made such links render as
 * Calibri 11pt (the docDefault theme font) instead of inheriting TNR 12pt:
 *
 *   1. convertHyperlink resolved the Hyperlink character style WITH docDefaults
 *      baked in (resolveRunStyle), so docDefault Calibri overrode the paragraph
 *      style's Times New Roman. Fixed by using getRunStyleOwnProperties (the same
 *      method convertRun already uses).
 *   2. mergeTextFormatting replaced the whole w:rFonts object, so a cs-only run
 *      override wiped the inherited ascii/hAnsi. Fixed by merging rFonts slots
 *      independently (ECMA-376 §17.3.2.26).
 *
 * Both must hold for the link to match the surrounding body text and Word.
 */
import { describe, test, expect } from 'bun:test';
import { toProseDoc } from './toProseDoc';
import type { Document } from '../../types/document';
import type { StyleDefinitions } from '../../types/styles';

const styles: StyleDefinitions = {
  docDefaults: {
    rPr: {
      fontFamily: { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: 'Calibri' },
      fontSize: 22, // 11pt
    },
  },
  styles: [
    { styleId: 'Normal', type: 'paragraph', name: 'Normal', default: true },
    {
      styleId: 'BodyText',
      type: 'paragraph',
      name: 'Body Text',
      basedOn: 'Normal',
      rPr: {
        fontFamily: { ascii: 'Times New Roman', hAnsi: 'Times New Roman' },
        fontSize: 24, // 12pt
      },
    },
    {
      styleId: 'Hyperlink',
      type: 'character',
      name: 'Hyperlink',
      // color + underline only — deliberately NO font
      rPr: { color: { rgb: '0000FF' }, underline: { style: 'single' } },
    },
  ],
};

function buildDoc(): Document {
  return {
    package: {
      document: {
        content: [
          {
            type: 'paragraph',
            formatting: { styleId: 'BodyText' },
            content: [
              {
                type: 'hyperlink',
                href: 'mailto:a@b.com',
                children: [
                  {
                    type: 'run',
                    // Hyperlink char style + cs-only rFonts override, no size
                    formatting: {
                      styleId: 'Hyperlink',
                      fontFamily: { cs: 'Times New Roman' },
                    },
                    content: [{ type: 'text', text: 'a@b.com' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  } as unknown as Document;
}

describe('toProseDoc — hyperlink font inheritance', () => {
  test('link run inherits the paragraph style font (TNR 12pt), not docDefault Calibri 11pt', () => {
    const pm = toProseDoc(buildDoc(), { styles });

    let link: ReturnType<typeof pm.child> | null = null;
    pm.descendants((node) => {
      if (!link && node.isText && node.text === 'a@b.com') link = node;
      return !link;
    });
    expect(link).not.toBeNull();

    const marks = Object.fromEntries(link!.marks.map((m) => [m.type.name, m.attrs]));
    // Font: ascii/hAnsi resolve to Times New Roman (the BodyText style), the
    // cs slot keeps its explicit override — none are wiped to Calibri.
    expect(marks.fontFamily?.ascii).toBe('Times New Roman');
    expect(marks.fontFamily?.hAnsi).toBe('Times New Roman');
    expect(marks.fontFamily?.cs).toBe('Times New Roman');
    // Size: 24 half-points (12pt) from BodyText, not 22 (docDefault 11pt).
    expect(marks.fontSize?.size).toBe(24);
    // The Hyperlink character style still applies (underline + blue).
    expect(marks.underline).toBeTruthy();
    expect(marks.hyperlink?.href).toBe('mailto:a@b.com');
  });
});
