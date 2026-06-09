/**
 * RenderedDomContext Implementation
 *
 * Provides DOM-based position mapping for the LayoutPainter output.
 * Uses the same data-pm-start/data-pm-end attribute pattern as the
 * selection overlay in PagedEditor.
 */

import type { RenderedDomContext, PositionCoordinates } from './types';
import { selectionToRects } from '@postnzt/docx-core/layout-bridge/selectionRects';
import { getPageTop } from '@postnzt/docx-core/layout-bridge/hitTest';
import type { Layout, FlowBlock, Measure } from '@postnzt/docx-core/layout-engine/types';

/**
 * Optional layout data. When supplied, range→rect mapping is computed from the
 * layout engine — reliable and available the instant layout completes, exactly
 * like the caret/selection overlay — instead of scanning the painted DOM per
 * range. The DOM path is kept as a fallback when this is absent.
 */
export interface RenderedDomLayoutData {
  layout: Layout;
  blocks: FlowBlock[];
  measures: Measure[];
}

/**
 * Implementation of RenderedDomContext.
 *
 * This class provides position mapping between ProseMirror document
 * positions and pixel coordinates in the rendered DOM. It uses the
 * data-pm-start and data-pm-end attributes that LayoutPainter adds
 * to span elements.
 */
export class RenderedDomContextImpl implements RenderedDomContext {
  public pagesContainer: HTMLElement;
  public zoom: number;
  private layout?: Layout;
  private blocks?: FlowBlock[];
  private measures?: Measure[];

  constructor(pagesContainer: HTMLElement, zoom: number = 1, layoutData?: RenderedDomLayoutData) {
    this.pagesContainer = pagesContainer;
    this.zoom = zoom;
    this.layout = layoutData?.layout;
    this.blocks = layoutData?.blocks;
    this.measures = layoutData?.measures;
  }

  /**
   * Range→rect mapping computed from the layout engine (no per-range DOM scan,
   * no dependence on a post-paint React tick).
   *
   * Each rect is anchored to its OWN page's real rendered position rather than
   * assuming the layout engine's pageGap matches the painted page stacking.
   * selectionToRects returns y in full-document layout space (the page top is
   * baked in) plus the 0-based pageIndex; we subtract the layout page top to get
   * a page-local offset, then add the MEASURED DOM top/left of that specific
   * page. This removes cross-page drift (pills landing a line too high on later
   * pages, where any pageGap/margin mismatch accumulated) and needs no pageGap
   * assumption — the subtract/add cancels the model's own page top exactly.
   *
   * Vertically the rect hugs the glyph box (ascent+descent). The painter renders
   * each line as a block of height=lineHeight with line-height=lineHeight, so the
   * browser centers the glyph box within the line box. selectionToRects' y is the
   * line-box TOP, so the painted text sits a half-leading lower — we add that
   * half-leading so the pill lands ON the text rather than floating above it in
   * spaced (1.5×/double) paragraphs.
   */
  private layoutRectsForRanges(
    ranges: Array<{ from: number; to: number }>
  ): Array<Array<{ x: number; y: number; width: number; height: number }>> {
    const { layout, blocks, measures } = this;
    if (!layout || !blocks || !measures) return ranges.map(() => []);

    const containerRect = this.pagesContainer.getBoundingClientRect();
    const pageOrigins = Array.from(this.pagesContainer.querySelectorAll('.layout-page')).map(
      (el) => {
        const r = el.getBoundingClientRect();
        return {
          left: (r.left - containerRect.left) / this.zoom,
          top: (r.top - containerRect.top) / this.zoom,
        };
      }
    );
    const fallbackOrigin = pageOrigins[0] ?? { left: 0, top: 0 };

    return ranges.map(({ from, to }) => {
      if (from === to) return [];
      return selectionToRects(layout, blocks, measures, from, to).map((r) => {
        const origin = pageOrigins[r.pageIndex] ?? fallbackOrigin;
        const pageLocalY = r.y - getPageTop(layout, r.pageIndex);
        const tightHeight = r.glyphHeight ?? r.height;
        const halfLeading = Math.max(0, (r.height - tightHeight) / 2);
        return {
          x: origin.left + r.x,
          y: origin.top + pageLocalY + halfLeading,
          width: r.width,
          height: tightHeight,
        };
      });
    });
  }

  private hasLayoutData(): boolean {
    return Boolean(this.layout && this.blocks && this.measures);
  }

  /**
   * Get pixel coordinates for a ProseMirror position.
   * Uses the browser's text rendering via Range API for precise positioning.
   */
  getCoordinatesForPosition(pmPos: number): PositionCoordinates | null {
    const containerRect = this.pagesContainer.getBoundingClientRect();

    // Find spans with PM position data
    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Handle tab spans with exclusive end (tab at [5,6) means pos 6 is next run)
      if (spanEl.classList.contains('layout-run-tab')) {
        if (pmPos >= pmStart && pmPos < pmEnd) {
          const spanRect = spanEl.getBoundingClientRect();
          const lineEl = spanEl.closest('.layout-line');
          const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

          return {
            x: (spanRect.left - containerRect.left) / this.zoom,
            y: (spanRect.top - containerRect.top) / this.zoom,
            height: lineHeight / this.zoom,
          };
        }
        continue;
      }

      // For text runs, use inclusive range
      if (pmPos >= pmStart && pmPos <= pmEnd && span.firstChild?.nodeType === Node.TEXT_NODE) {
        const textNode = span.firstChild as Text;
        const charIndex = Math.min(pmPos - pmStart, textNode.length);

        // Create a range at the exact character position
        const ownerDoc = spanEl.ownerDocument;
        if (!ownerDoc) continue;

        const range = ownerDoc.createRange();
        range.setStart(textNode, charIndex);
        range.setEnd(textNode, charIndex);

        const rangeRect = range.getBoundingClientRect();
        const lineEl = spanEl.closest('.layout-line');
        const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

        return {
          x: (rangeRect.left - containerRect.left) / this.zoom,
          y: (rangeRect.top - containerRect.top) / this.zoom,
          height: lineHeight / this.zoom,
        };
      }
    }

    // Fallback: try to find position in empty paragraphs
    const emptyRuns = this.pagesContainer.querySelectorAll('.layout-empty-run');
    for (const emptyRun of Array.from(emptyRuns)) {
      const paragraph = emptyRun.closest('.layout-paragraph') as HTMLElement;
      if (!paragraph) continue;

      const pmStart = Number(paragraph.dataset.pmStart);
      const pmEnd = Number(paragraph.dataset.pmEnd);

      if (pmPos >= pmStart && pmPos <= pmEnd) {
        const runRect = emptyRun.getBoundingClientRect();
        const lineEl = emptyRun.closest('.layout-line');
        const lineHeight = lineEl ? (lineEl as HTMLElement).offsetHeight : 16;

        return {
          x: (runRect.left - containerRect.left) / this.zoom,
          y: (runRect.top - containerRect.top) / this.zoom,
          height: lineHeight / this.zoom,
        };
      }
    }

    return null;
  }

  /**
   * Find DOM elements that overlap with a ProseMirror position range.
   */
  findElementsForRange(from: number, to: number): Element[] {
    const elements: Element[] = [];
    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Check if this span overlaps with the range
      if (pmEnd > from && pmStart < to) {
        elements.push(spanEl);
      }
    }

    return elements;
  }

  /**
   * Get bounding rectangles for a range of text.
   * Handles line wraps by returning multiple rects.
   */
  getRectsForRange(
    from: number,
    to: number
  ): Array<{ x: number; y: number; width: number; height: number }> {
    return this.getRectsForRanges([{ from, to }])[0] ?? [];
  }

  /**
   * Batched range→rect mapping, index-aligned with `ranges`.
   *
   * Strategy: measure the PAINTED DOM first (ground truth), and fall back to the
   * layout engine only for ranges the DOM can't answer.
   *
   * The painted text is the single source of truth for where a glyph actually
   * sits — it already reflects table cell margins, cell vertical alignment
   * (top/center/bottom), font metrics and line spacing. The layout-engine model
   * (selectionToRects) only approximates these and notably does NOT model table
   * cell padding or vertical alignment, so deriving pill rects from it floated
   * the pills tens of pixels above the text in vertically-aligned table cells.
   * Reading getClientRects on the rendered spans removes that whole class of
   * drift, so pills stick to their variable.
   *
   * The DOM scan is a single querySelectorAll over all data-pm spans (O(spans)),
   * NOT the per-tag re-query that once made pills lag. The layout path is kept
   * only as a fallback for ranges with no painted spans — e.g. a tag on a
   * virtualized/off-screen page whose content isn't in the DOM yet — so those
   * pills still get an approximate position instead of vanishing.
   */
  getRectsForRanges(
    ranges: Array<{ from: number; to: number }>
  ): Array<Array<{ x: number; y: number; width: number; height: number }>> {
    const domRects = this.domRectsForRanges(ranges);
    if (!this.hasLayoutData()) return domRects;

    // Only pay for the layout pass when some range had no painted spans.
    if (!domRects.some((r) => r.length === 0)) return domRects;
    const layoutRects = this.layoutRectsForRanges(ranges);
    return domRects.map((r, i) => (r.length > 0 ? r : (layoutRects[i] ?? [])));
  }

  /**
   * Per-range rects measured from the painted DOM via Range.getClientRects.
   * Scans every `data-pm` span ONCE and slices each to the requested character
   * range (tab spans contribute their full visual box). Coordinates are
   * container-relative and unscaled (divided by zoom), matching
   * {@link layoutRectsForRanges} so the two can be mixed per-range.
   */
  private domRectsForRanges(
    ranges: Array<{ from: number; to: number }>
  ): Array<Array<{ x: number; y: number; width: number; height: number }>> {
    const result = ranges.map(
      () => [] as Array<{ x: number; y: number; width: number; height: number }>
    );
    if (ranges.length === 0) return result;

    const containerRect = this.pagesContainer.getBoundingClientRect();
    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);
      const isTab = spanEl.classList.contains('layout-run-tab');
      const textNode =
        !isTab && span.firstChild?.nodeType === Node.TEXT_NODE ? (span.firstChild as Text) : null;
      // Skip spans that are neither a tab nor a plain text node (e.g. hyperlink
      // <a>-wrapped runs) — matches getRectsForRange.
      if (!isTab && !textNode) continue;

      for (let i = 0; i < ranges.length; i++) {
        const { from, to } = ranges[i];
        // Same overlap test as getRectsForRange (half-open against [from, to)).
        if (!(pmEnd > from && pmStart < to)) continue;

        if (isTab) {
          const spanRect = spanEl.getBoundingClientRect();
          result[i].push({
            x: (spanRect.left - containerRect.left) / this.zoom,
            y: (spanRect.top - containerRect.top) / this.zoom,
            width: spanRect.width / this.zoom,
            height: spanRect.height / this.zoom,
          });
          continue;
        }

        const ownerDoc = spanEl.ownerDocument;
        if (!ownerDoc || !textNode) continue;

        const startChar = Math.max(0, from - pmStart);
        const endChar = Math.min(textNode.length, to - pmStart);
        if (startChar < endChar) {
          const range = ownerDoc.createRange();
          range.setStart(textNode, startChar);
          range.setEnd(textNode, endChar);
          for (const rect of Array.from(range.getClientRects())) {
            result[i].push({
              x: (rect.left - containerRect.left) / this.zoom,
              y: (rect.top - containerRect.top) / this.zoom,
              width: rect.width / this.zoom,
              height: rect.height / this.zoom,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Get the offset of the pages container from its parent viewport.
   * This is needed for positioning overlays that are rendered in the
   * viewport container rather than directly in the pages container.
   */
  getContainerOffset(): { x: number; y: number } {
    const parent = this.pagesContainer.parentElement;
    if (!parent) return { x: 0, y: 0 };

    const containerRect = this.pagesContainer.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    return {
      x: (containerRect.left - parentRect.left) / this.zoom,
      y: (containerRect.top - parentRect.top) / this.zoom,
    };
  }
}

/**
 * Create a RenderedDomContext for a pages container element.
 *
 * @param pagesContainer - The container element holding rendered pages
 * @param zoom - Current zoom level (default 1)
 */
export function createRenderedDomContext(
  pagesContainer: HTMLElement,
  zoom: number = 1,
  layoutData?: RenderedDomLayoutData
): RenderedDomContext {
  return new RenderedDomContextImpl(pagesContainer, zoom, layoutData);
}
