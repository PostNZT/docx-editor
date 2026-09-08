/**
 * A table in a header must be painted, not skipped.
 *
 * Bug: `renderHeaderFooterContent` walked header blocks and painted only
 * paragraphs. A letterhead built as a borderless table — logo in one cell,
 * address and contact beside it — measured a height, pushed the body down,
 * and drew nothing. The document still carried it; the page did not show it.
 *
 * Fix: a table block renders through `renderTableFragment` as one fragment
 * covering every row, stacked in flow with the paragraphs around it.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

// One process runs every test file; Happy DOM can only be registered once.
if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register();
}

import { describe, test, expect } from 'bun:test';
import { renderHeaderFooterContent, type RenderContext } from './renderPage';
import { TABLE_CLASS_NAMES } from './renderTable';
import type {
  FlowBlock,
  Measure,
  ParagraphBlock,
  ParagraphMeasure,
  TableBlock,
  TableMeasure,
} from '../layout-engine/types';

const CONTENT_WIDTH = 700;
const LINE_HEIGHT = ((12 * 96) / 72) * 1.2;
const LOGO_SRC = 'data:image/png;base64,iVBORw0KGgo=';

const CTX: RenderContext = {
  pageNumber: 1,
  totalPages: 1,
  section: 'header',
  contentWidth: CONTENT_WIDTH,
};

const LAYOUT = {
  flowTop: 48,
  flowLeft: 96,
  contentWidth: CONTENT_WIDTH,
  pageWidth: 816,
  pageHeight: 1056,
  margins: { top: 96, right: 96, bottom: 96, left: 96 },
};

let nextId = 0;

function paragraph(text: string): ParagraphBlock {
  return {
    kind: 'paragraph',
    id: `p${nextId++}`,
    runs: [{ kind: 'text', text, fontFamily: 'Times New Roman', fontSize: 12 }],
  };
}

function logoParagraph(width: number, height: number): ParagraphBlock {
  return {
    kind: 'paragraph',
    id: `p${nextId++}`,
    runs: [{ kind: 'image', src: LOGO_SRC, width, height }],
  };
}

/** One measured line covering the whole of a single-run paragraph. */
function oneLine(block: ParagraphBlock, height = LINE_HEIGHT): ParagraphMeasure {
  const run = block.runs[0];
  const chars = run.kind === 'text' ? run.text.length : 1;
  return {
    kind: 'paragraph',
    totalHeight: height,
    lines: [
      {
        fromRun: 0,
        fromChar: 0,
        toRun: 0,
        toChar: chars,
        width: 60,
        lineHeight: height,
        ascent: height * 0.8,
        descent: height * 0.2,
      },
    ],
  };
}

/** Logo | address — a two-column letterhead, one row. */
function letterhead(): { block: TableBlock; measure: TableMeasure } {
  const logoHeight = 99;
  const logo = logoParagraph(284, logoHeight);
  const address = paragraph('500 NE 4th Street');
  const columnWidths = [300, 400];

  const block: TableBlock = {
    kind: 'table',
    id: 't0',
    rows: [
      {
        id: 'r0',
        cells: [
          { id: 'c0', blocks: [logo] },
          { id: 'c1', blocks: [address] },
        ],
      },
    ],
    columnWidths,
  };

  const rowHeight = logoHeight;
  const measure: TableMeasure = {
    kind: 'table',
    rows: [
      {
        height: rowHeight,
        cells: [
          { blocks: [oneLine(logo, logoHeight)], width: columnWidths[0], height: rowHeight },
          { blocks: [oneLine(address)], width: columnWidths[1], height: rowHeight },
        ],
      },
    ],
    columnWidths,
    totalWidth: 700,
    totalHeight: rowHeight,
  };

  return { block, measure };
}

function render(blocks: FlowBlock[], measures: Measure[]): HTMLElement {
  const height = measures.reduce((h, m) => ('totalHeight' in m ? h + m.totalHeight : h), 0);
  return renderHeaderFooterContent({ blocks, measures, height }, CTX, { document }, LAYOUT);
}

describe('header table rendering', () => {
  test('a letterhead table is painted with its logo and its words', () => {
    const { block, measure } = letterhead();
    const el = render([block], [measure]);

    const table = el.querySelector(`.${TABLE_CLASS_NAMES.table}`);
    expect(table).not.toBeNull();
    expect(el.querySelectorAll(`.${TABLE_CLASS_NAMES.cell}`)).toHaveLength(2);

    const img = el.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(LOGO_SRC);

    expect(el.textContent).toContain('500 NE 4th Street');
  });

  test('the table sits in the flow, not on the page absolute grid', () => {
    const { block, measure } = letterhead();
    const el = render([block], [measure]);

    const table = el.querySelector(`.${TABLE_CLASS_NAMES.table}`) as HTMLElement;
    expect(table.style.position).toBe('relative');
    expect(table.style.top).toBe('0px');
    expect(table.style.left).toBe('0px');
    expect(table.style.height).toBe(`${measure.totalHeight}px`);
  });

  test('a paragraph after the table still renders, in order', () => {
    const { block, measure } = letterhead();
    const tagline = paragraph('The Law Firm that Cares');
    const el = render([block, tagline], [measure, oneLine(tagline)]);

    const children = Array.from(el.children) as HTMLElement[];
    expect(children[0].classList.contains(TABLE_CLASS_NAMES.table)).toBe(true);
    expect(children[1].textContent).toContain('The Law Firm that Cares');
  });

  test('a centred table is offset to the middle of the content width', () => {
    const { block, measure } = letterhead();
    const narrow: TableMeasure = { ...measure, totalWidth: 500 };
    const el = render([{ ...block, justification: 'center' }], [narrow]);

    const table = el.querySelector(`.${TABLE_CLASS_NAMES.table}`) as HTMLElement;
    expect(table.style.left).toBe(`${(CONTENT_WIDTH - 500) / 2}px`);
  });
});
