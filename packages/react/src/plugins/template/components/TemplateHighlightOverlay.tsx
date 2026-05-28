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

  // Compute highlight rectangles synchronously during render (no blank frames)
  const computeHighlights = useCallback((): HighlightRect[] => {
    const containerOffset = context.getContainerOffset();
    const rects: HighlightRect[] = [];

    for (const tag of tags) {
      const tagRects = context.getRectsForRange(tag.from, tag.to);
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
    }

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
              top: rect.y,
              width: rect.width,
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
            {rect.isFirstRect ? rect.label : ''}
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
