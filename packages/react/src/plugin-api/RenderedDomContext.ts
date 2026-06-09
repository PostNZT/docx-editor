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
   * Vertically the rect hugs the glyph box (ascent+descent) at the glyph top,
   * matching the caret overlay, which positions at fragment.y+lineOffset+pageTop
   * with NO extra half-leading. The previous code centered the glyph box in the
   * full line box, which pushed pills below the text in spaced paragraphs.
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
        return {
          x: origin.left + r.x,
          y: origin.top + pageLocalY,
          width: r.width,
          height: r.glyphHeight ?? r.height,
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
    if (this.hasLayoutData()) {
      return this.layoutRectsForRanges([{ from, to }])[0] ?? [];
    }
    const containerRect = this.pagesContainer.getBoundingClientRect();
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

    const spans = this.pagesContainer.querySelectorAll('span[data-pm-start][data-pm-end]');

    for (const span of Array.from(spans)) {
      const spanEl = span as HTMLElement;
      const pmStart = Number(spanEl.dataset.pmStart);
      const pmEnd = Number(spanEl.dataset.pmEnd);

      // Check if this span overlaps with selection
      if (pmEnd > from && pmStart < to) {
        // Handle tab spans - highlight full visual width
        if (spanEl.classList.contains('layout-run-tab')) {
          const spanRect = spanEl.getBoundingClientRect();
          rects.push({
            x: (spanRect.left - containerRect.left) / this.zoom,
            y: (spanRect.top - containerRect.top) / this.zoom,
            width: spanRect.width / this.zoom,
            height: spanRect.height / this.zoom,
          });
          continue;
        }

        if (span.firstChild?.nodeType !== Node.TEXT_NODE) continue;

        const textNode = span.firstChild as Text;
        const ownerDoc = spanEl.ownerDocument;
        if (!ownerDoc) continue;

        // Calculate character range within this span
        const startChar = Math.max(0, from - pmStart);
        const endChar = Math.min(textNode.length, to - pmStart);

        if (startChar < endChar) {
          const range = ownerDoc.createRange();
          range.setStart(textNode, startChar);
          range.setEnd(textNode, endChar);

          // Get all client rects (handles line wraps)
          const clientRects = range.getClientRects();
          for (const rect of Array.from(clientRects)) {
            rects.push({
              x: (rect.left - containerRect.left) / this.zoom,
              y: (rect.top - containerRect.top) / this.zoom,
              width: rect.width / this.zoom,
              height: rect.height / this.zoom,
            });
          }
        }
      }
    }

    return rects;
  }

  /**
   * Batched {@link getRectsForRange}. Scans the rendered spans ONCE and returns
   * one rect array per input range (index-aligned with `ranges`). Equivalent to
   * calling getRectsForRange for each range, but avoids re-querying the whole
   * span set per range — the dominant cost when positioning every template tag
   * on a large document. The per-span logic (tab full-width, non-text-child
   * skip, character slicing, zoom, container-relative coords) is identical.
   */
  getRectsForRanges(
    ranges: Array<{ from: number; to: number }>
  ): Array<Array<{ x: number; y: number; width: number; height: number }>> {
    if (this.hasLayoutData()) {
      return this.layoutRectsForRanges(ranges);
    }
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
