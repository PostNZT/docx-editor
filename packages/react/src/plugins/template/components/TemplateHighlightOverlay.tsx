/**
 * Template Highlight Overlay Component
 *
 * Renders highlight rectangles for template tags on the visible pages.
 * Uses RenderedDomContext to get accurate positioning.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { RenderedDomContext } from '../../../plugin-api/types';
import type { TemplateTag, TagType } from '../prosemirror-plugin';

interface TemplateHighlightOverlayProps {
  context: RenderedDomContext;
  tags: TemplateTag[];
  hoveredId?: string;
  selectedId?: string;
  onHover?: (id: string | undefined) => void;
  onSelect?: (id: string) => void;
}

interface HighlightRect {
  tagId: string;
  tagType: TagType;
  varName: string;
  label: string;
  /**
   * True when the tag's text wraps across more than one line (a long name in a
   * narrow table cell). The pill then becomes a multi-line button: the label
   * wraps to fit inside the box instead of being clipped to a single line.
   */
  multiline: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A merged horizontal band covering one visual line of a tag. */
interface LineGroup {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Cluster a tag's painted rects into one band per visual line.
 *
 * Rects on the same line (e.g. the tag is split across spans by a formatting
 * boundary) share most of their vertical extent and are merged horizontally.
 * Rects on different lines (the tag wrapped) have little vertical overlap and
 * stay separate. The count of bands tells us whether the tag wrapped, and their
 * union is the box for the single pill drawn over the whole tag.
 *
 * Exported for unit testing.
 */
export function groupRectsByLine(
  tagRects: Array<{ x: number; y: number; width: number; height: number }>
): LineGroup[] {
  const sorted = [...tagRects].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: LineGroup[] = [];

  for (const r of sorted) {
    const top = r.y;
    const bottom = r.y + r.height;
    const left = r.x;
    const right = r.x + r.width;
    const last = groups[groups.length - 1];

    // Same line when the vertical overlap exceeds half the shorter box — robust
    // to sub-pixel differences without fusing adjacent (wrapped) lines.
    let sameLine = false;
    if (last) {
      const overlap = Math.min(bottom, last.bottom) - Math.max(top, last.top);
      const minHeight = Math.min(bottom - top, last.bottom - last.top);
      sameLine = overlap > minHeight * 0.5;
    }

    if (sameLine && last) {
      last.left = Math.min(last.left, left);
      last.top = Math.min(last.top, top);
      last.right = Math.max(last.right, right);
      last.bottom = Math.max(last.bottom, bottom);
    } else {
      groups.push({ left, top, right, bottom });
    }
  }

  return groups;
}

export function TemplateHighlightOverlay({
  context,
  tags,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: TemplateHighlightOverlayProps) {
  // Version counter bumped by resize/layout changes to trigger recompute
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Compute highlight rectangles synchronously during render (no blank frames).
  // Measure every tag in a SINGLE span scan (getRectsForRanges) instead of one
  // full-document scan per tag — the per-tag scan was the dominant cost of the
  // post-paint recompute and made pills lag/stagger behind the painted text on
  // large templates. Falls back to per-range when the batched API is absent.
  const computeHighlights = useCallback((): HighlightRect[] => {
    const containerOffset = context.getContainerOffset();
    const rects: HighlightRect[] = [];

    const ranges = tags.map((t) => ({ from: t.from, to: t.to }));
    const perTagRects = context.getRectsForRanges
      ? context.getRectsForRanges(ranges)
      : ranges.map((r) => context.getRectsForRange(r.from, r.to));

    tags.forEach((tag, tagIndex) => {
      const tagRects = perTagRects[tagIndex] ?? [];
      if (tagRects.length === 0) return;

      // A tag can paint several rects: multiple spans on ONE line (a formatting
      // boundary splits `[[`, the name and `]]`) and/or one rect PER line when a
      // long name wraps inside a narrow table cell. Collapse them to ONE pill
      // covering the tag's full extent — a single tidy button, never a clipped
      // label stacked on an empty continuation pill.
      const lineGroups = groupRectsByLine(tagRects);
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const group of lineGroups) {
        left = Math.min(left, group.left);
        top = Math.min(top, group.top);
        right = Math.max(right, group.right);
        bottom = Math.max(bottom, group.bottom);
      }

      rects.push({
        tagId: tag.id,
        tagType: tag.type,
        varName: tag.name,
        label: tag.name,
        // When the underlying text spans >1 line the box is tall enough to wrap
        // the label inside it, so the full name stays readable in narrow cells.
        multiline: lineGroups.length > 1,
        x: left + containerOffset.x,
        y: top + containerOffset.y,
        width: right - left,
        height: bottom - top,
      });
    });

    return rects;
  }, [context, tags]);

  // Compute synchronously — no useEffect gap that causes blinking

  const highlights = useMemo(() => computeHighlights(), [computeHighlights, layoutVersion]);

  // Recompute on window resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Also observe the pagesContainer for size changes (zoom, layout changes)
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    });
    observer.observe(context.pagesContainer);
    return () => observer.disconnect();
  }, [context.pagesContainer]);

  // Recompute when the painted pages change. Large documents virtualize their
  // pages: off-screen pages are empty shells, so a tag on one is positioned via
  // the layout-engine fallback (which can't see table cell vAlign/margins) and
  // its pill drifts. When such a page scrolls into view its content is painted —
  // a subtree mutation we observe here — and we re-measure so the pill snaps onto
  // the now-real DOM text. The overlay paints into a sibling container, never
  // into pagesContainer, so this can't observe its own writes (no loop).
  useEffect(() => {
    let raf = 0;
    const observer = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setLayoutVersion((v) => v + 1);
      });
    });
    observer.observe(context.pagesContainer, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [context.pagesContainer]);

  // Show all highlights, with enhanced styling for hovered/selected
  if (highlights.length === 0) {
    return null;
  }

  return (
    <div className="template-highlight-overlay">
      {highlights.map((rect, index) => {
        const isHovered = rect.tagId === hoveredId;
        const isSelected = rect.tagId === selectedId;
        const stateClasses = [
          'template-highlight',
          isHovered ? 'hovered' : '',
          isSelected ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={`${rect.tagId}-${index}`}
            className={stateClasses}
            data-tag-id={rect.tagId}
            data-var-name={rect.varName}
            style={{
              left: rect.x,
              top: rect.y,
              // Pin the pill to the painted text box so it covers the [[…]] text
              // exactly (no raw-text bleed-through) and never spills past it into
              // a neighbouring table cell.
              width: rect.width,
              minWidth: rect.width,
              maxWidth: rect.width,
              height: rect.height,
              // Wrapped tags get a multi-line button: let the long name wrap and
              // break inside the box so it stays readable instead of clipping to
              // an unreadable middle slice ("yments_made_amou").
              ...(rect.multiline
                ? {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.1,
                    fontSize: 10,
                    padding: '1px 3px',
                  }
                : null),
            }}
            onMouseEnter={() => onHover?.(rect.tagId)}
            onMouseLeave={() => onHover?.(undefined)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect?.(rect.tagId);
            }}
          >
            {/* One button per tag covering its full (possibly wrapped) extent.
                The label wraps inside when the box is multi-line. */}
            {rect.label}
          </div>
        );
      })}
    </div>
  );
}

export const TEMPLATE_HIGHLIGHT_OVERLAY_STYLES = `
.template-highlight-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: visible;
}

.template-highlight {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /* Grow to fit the label, but never narrower than the inline minWidth set above
     (which covers the underlying text). Capped so an unusually long name can't
     run off the page; only then does the ellipsis below apply. */
  width: max-content;
  max-width: 240px;
  padding: 0 4px;
  background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%) !important;
  color: #ffffff !important;
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
  letter-spacing: -0.01em;
  border: 1px solid #6d28d9;
  border-radius: 6px;
  box-shadow:
    0 1px 2px rgba(76, 29, 149, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
}

.template-highlight:hover,
.template-highlight.hovered {
  background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%) !important;
  box-shadow:
    0 3px 6px rgba(76, 29, 149, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
  z-index: 2;
}

.template-highlight:active {
  background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%) !important;
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.25),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(0);
}

.template-highlight.selected {
  box-shadow:
    0 0 0 3px rgba(139, 92, 246, 0.4),
    0 2px 4px rgba(76, 29, 149, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  z-index: 2;
}
`;
