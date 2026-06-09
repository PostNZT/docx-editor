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
  isFirstRect: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
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
      tagRects.forEach((rect, rectIndex) => {
        rects.push({
          tagId: tag.id,
          tagType: tag.type,
          varName: tag.name,
          label: tag.name,
          isFirstRect: rectIndex === 0,
          x: rect.x + containerOffset.x,
          y: rect.y + containerOffset.y,
          width: rect.width,
          height: rect.height,
        });
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
              // minWidth (not width) guarantees the pill fully covers the
              // underlying [[…]] text (no raw-text bleed-through) while CSS
              // `width: max-content` lets it grow to fit the variable name when
              // the text is narrower than the label — e.g. a long name wrapped
              // inside a narrow table cell, which would otherwise clip to an
              // unreadable "vments_made_amou…".
              minWidth: rect.width,
              top: rect.y,
              height: rect.height,
            }}
            onMouseEnter={() => onHover?.(rect.tagId)}
            onMouseLeave={() => onHover?.(undefined)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect?.(rect.tagId);
            }}
          >
            {/* Label every rect (not just the first): when a tag wraps across
                lines it yields multiple rects, and blank continuation rects
                read as broken empty buttons. The label is clipped per-rect via
                CSS (text-overflow: ellipsis). */}
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
