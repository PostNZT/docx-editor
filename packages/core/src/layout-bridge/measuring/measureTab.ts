import type { FieldRun, Run } from '../../layout-engine/types';
import { calculateTabWidth, type TabContext } from '../../prosemirror/utils/tabCalculator';
import { measureTextWidth } from './measureContainer';

/** Use the same formatted text metrics for tab alignment in layout and painting. */
export function measureTab(
  currentX: number,
  context: TabContext,
  runs: Run[],
  tabIndex: number,
  fieldText: (run: FieldRun) => string = (run) =>
    run.fallback ?? (run.fieldType === 'OTHER' ? '' : '1')
) {
  const following: { text: string; run: Run & { kind: 'text' | 'field' } }[] = [];
  for (let i = tabIndex + 1; i < runs.length; i++) {
    const run = runs[i];
    if (run.kind === 'tab' || run.kind === 'lineBreak') break;
    if (run.kind === 'text' || run.kind === 'field') {
      following.push({ text: run.kind === 'text' ? run.text : fieldText(run), run });
    }
  }
  const text = following.map((part) => part.text).join('');
  return calculateTabWidth(currentX, context, text, (prefix) => {
    let remaining = prefix.length;
    let width = 0;
    for (const part of following) {
      if (remaining === 0) break;
      const slice = part.text.slice(0, remaining);
      width += measureTextWidth(slice, part.run);
      remaining -= slice.length;
    }
    return width;
  });
}
