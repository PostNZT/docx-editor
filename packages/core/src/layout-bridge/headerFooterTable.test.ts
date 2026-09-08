/**
 * A header table must reach the layout engine as a table block.
 *
 * Bug: the paged editor converted header/footer content to flow blocks with
 * a paragraph-only walk, so a table in a header — the usual shape of a
 * letterhead: logo in one cell, address and contact beside it — was skipped
 * and the header painted blank while the file still carried it.
 *
 * Fix: header tables go through the same bridge the body uses,
 * `headerFooterToProseDoc` → `toFlowBlocks`. This locks in what that path
 * yields for a letterhead-shaped table, including the image inside a cell.
 */
import { describe, test, expect } from 'bun:test';
import { headerFooterToProseDoc } from '../prosemirror/conversion/toProseDoc';
import { toFlowBlocks } from './toFlowBlocks';
import type { Table, Paragraph } from '../types/content';
import type { TableBlock, ParagraphBlock, ImageRun, TextRun } from '../layout-engine/types';

const LOGO_SRC = 'data:image/png;base64,iVBORw0KGgo=';
const EMU_PER_INCH = 914400;

function textParagraph(text: string): Paragraph {
  return {
    type: 'paragraph',
    content: [{ type: 'run', content: [{ type: 'text', text }] }],
  };
}

function logoParagraph(): Paragraph {
  return {
    type: 'paragraph',
    content: [
      {
        type: 'run',
        content: [
          {
            type: 'drawing',
            image: {
              type: 'image',
              rId: 'rId1',
              src: LOGO_SRC,
              size: { width: 2.96 * EMU_PER_INCH, height: 1.03 * EMU_PER_INCH },
              wrap: { type: 'inline' },
            },
          },
        ],
      },
    ],
  };
}

/** Logo | address | attorney — the three-column letterhead a firm letter carries. */
function letterheadTable(): Table {
  return {
    type: 'table',
    columnWidths: [4320, 2880, 2160],
    rows: [
      {
        type: 'tableRow',
        cells: [
          { type: 'tableCell', content: [logoParagraph()] },
          { type: 'tableCell', content: [textParagraph('500 NE 4th Street')] },
          { type: 'tableCell', content: [textParagraph('Chad T. Van Horn, Esq.')] },
        ],
      },
    ],
  };
}

describe('header table → flow blocks', () => {
  test('a letterhead table becomes one table block with every cell intact', () => {
    const pmDoc = headerFooterToProseDoc([letterheadTable()]);
    const blocks = toFlowBlocks(pmDoc);

    const tables = blocks.filter((b): b is TableBlock => b.kind === 'table');
    expect(tables).toHaveLength(1);

    const [table] = tables;
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells).toHaveLength(3);
  });

  test('the logo survives as an image run inside its cell', () => {
    const pmDoc = headerFooterToProseDoc([letterheadTable()]);
    const table = toFlowBlocks(pmDoc).find((b): b is TableBlock => b.kind === 'table')!;

    const logoCell = table.rows[0].cells[0];
    const paragraph = logoCell.blocks.find((b): b is ParagraphBlock => b.kind === 'paragraph')!;
    const image = paragraph.runs.find((r): r is ImageRun => r.kind === 'image');

    expect(image).toBeDefined();
    expect(image!.src).toBe(LOGO_SRC);
    expect(image!.width).toBeGreaterThan(0);
    expect(image!.height).toBeGreaterThan(0);
  });

  test('the text columns keep their words', () => {
    const pmDoc = headerFooterToProseDoc([letterheadTable()]);
    const table = toFlowBlocks(pmDoc).find((b): b is TableBlock => b.kind === 'table')!;

    const words = (cellIndex: number) =>
      table.rows[0].cells[cellIndex].blocks
        .filter((b): b is ParagraphBlock => b.kind === 'paragraph')
        .flatMap((p) => p.runs)
        .filter((r): r is TextRun => r.kind === 'text')
        .map((r) => r.text)
        .join('');

    expect(words(1)).toBe('500 NE 4th Street');
    expect(words(2)).toBe('Chad T. Van Horn, Esq.');
  });

  test('a paragraph beside the table is not lost', () => {
    const pmDoc = headerFooterToProseDoc([textParagraph('DRAFT'), letterheadTable()]);
    const kinds = toFlowBlocks(pmDoc).map((b) => b.kind);

    expect(kinds).toEqual(['paragraph', 'table']);
  });
});
