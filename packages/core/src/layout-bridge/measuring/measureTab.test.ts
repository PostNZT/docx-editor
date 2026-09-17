import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { measureParagraph } from './measureParagraph';
import { resetCanvasContext } from './measureContainer';
import { renderLine } from '../../layout-painter/renderParagraph';
import type { ParagraphBlock, Run } from '../../layout-engine/types';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
let canvasSpy: ReturnType<typeof spyOn>;
beforeAll(() => {
  canvasSpy = spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    font: '',
    measureText(text: string) {
      return { width: text.length * (this.font.includes('bold') ? 12 : 8) };
    },
  })) as unknown as HTMLCanvasElement['getContext']);
  resetCanvasContext();
});
afterAll(() => {
  canvasSpy.mockRestore();
  resetCanvasContext();
});

const text = (value: string): Run => ({ kind: 'text', text: value });
const tab: Run = { kind: 'tab' };
function block(runs: Run[], attrs: ParagraphBlock['attrs'] = {}): ParagraphBlock {
  return { kind: 'paragraph', id: 'tabs', runs, attrs };
}
function paintedTabs(paragraph: ParagraphBlock, width = 500): number[][] {
  const measured = measureParagraph(paragraph, width);
  return measured.lines.map((line, index) => {
    const indent = paragraph.attrs?.indent;
    const el = renderLine(paragraph, line, 'left', document, {
      availableWidth: width,
      isLastLine: index === measured.lines.length - 1,
      paragraphEndsWithLineBreak: false,
      tabStops: paragraph.attrs?.tabs,
      leftIndentPx: indent?.left,
      firstLineIndentPx: indent?.firstLine ?? -(indent?.hanging ?? 0),
      isFirstLine: index === 0,
    });
    expect(el.style.whiteSpace).toBe('pre');
    return Array.from(el.querySelectorAll<HTMLElement>('.layout-run-tab')).map((tabEl) =>
      parseFloat(tabEl.style.width)
    );
  });
}

describe('tab measurement and visible rendering', () => {
  test.each([
    ['end', 'ABCD', 64, 96],
    ['center', 'ABCD', 80, 112],
    ['decimal', '12.3', 80, 112],
    ['decimal', '1234', 64, 96],
  ] as const)('%s tab aligns following text (%s)', (val, value, tabWidth, lineWidth) => {
    const paragraph = block([tab, text(value)], { tabs: [{ val, pos: 1440 }] });
    const measured = measureParagraph(paragraph, 115);
    expect(measured.lines).toHaveLength(1);
    expect(measured.lines[0].width).toBe(lineWidth);
    expect(paintedTabs(paragraph, 115)).toEqual([[tabWidth]]);
  });

  test('default stops remain on the margin grid after an indent', () => {
    const paragraph = block([tab, text('A')], { indent: { left: 20 } });
    expect(measureParagraph(paragraph, 500).lines[0].width).toBe(36);
    expect(paintedTabs(paragraph)).toEqual([[28]]);
  });

  test('uses sorted stops and skips cleared stops', () => {
    const paragraph = block([tab, text('A')], {
      tabs: [
        { val: 'start', pos: 2160 },
        { val: 'clear', pos: 720 },
        { val: 'start', pos: 1440 },
      ],
    });
    expect(measureParagraph(paragraph, 500).lines[0].width).toBe(104);
    expect(paintedTabs(paragraph)).toEqual([[96]]);
  });

  test('recalculates a tab moved to the next line', () => {
    const paragraph = block([text('abcdefghij'), tab]);
    expect(measureParagraph(paragraph, 90).lines.map((line) => line.width)).toEqual([80, 48]);
    expect(paintedTabs(paragraph, 90)).toEqual([[], [48]]);
  });

  test('tracks bold text and character spacing before a tab', () => {
    const paragraph = block([{ kind: 'text', text: 'AA', bold: true, letterSpacing: 2 }, tab]);
    expect(measureParagraph(paragraph, 500).lines[0].width).toBe(48);
    expect(paintedTabs(paragraph)).toEqual([[22]]);
  });

  test('aligns mixed formatting after a right tab', () => {
    const paragraph = block([tab, text('A'), { kind: 'text', text: 'BB', bold: true }], {
      tabs: [{ val: 'end', pos: 1440 }],
    });
    expect(measureParagraph(paragraph, 100).lines).toHaveLength(1);
    expect(paintedTabs(paragraph, 100)).toEqual([[64]]);
  });

  test('preserves consecutive spaces before a tab', () => {
    const paragraph = block([text('A  B'), tab]);
    expect(measureParagraph(paragraph, 500).lines[0].width).toBe(48);
    expect(paintedTabs(paragraph)).toEqual([[16]]);
  });

  test('accounts for the list marker before the first tab', () => {
    const paragraph = block([tab, text('A')], {
      listMarker: '1.',
      indent: { left: 48, hanging: 24 },
    });
    expect(measureParagraph(paragraph, 500).lines[0].width).toBe(56);
    expect(paintedTabs(paragraph)).toEqual([[48]]);
  });
});
