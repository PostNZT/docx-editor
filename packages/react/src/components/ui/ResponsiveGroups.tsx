import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { MaterialSymbol } from './MaterialSymbol';
import { useTranslation } from '../../i18n';

export interface ResponsiveGroupSpec {
  id: string;
  priority: number;
  content: ReactNode;
}

interface ResponsiveGroupsProps {
  groups: ResponsiveGroupSpec[];
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  testId?: string;
  trailing?: ReactNode;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  containerRef?: RefObject<HTMLDivElement | null>;
}

const OVERFLOW_BUTTON_WIDTH = 36;

export function ResponsiveGroups({
  groups,
  className,
  style,
  ariaLabel,
  testId,
  trailing,
  onMouseDown,
  onMouseUp,
  containerRef: externalContainerRef,
}: ResponsiveGroupsProps) {
  const { t } = useTranslation();
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef ?? internalRef;
  const measureRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;

    const widths = new Map<string, number>();
    groups.forEach((g) => {
      const el = measure.querySelector(
        `[data-measure-id="${CSS.escape(g.id)}"]`
      ) as HTMLElement | null;
      if (el) widths.set(g.id, el.offsetWidth);
    });

    const styles = window.getComputedStyle(container);
    const horizontalPadding =
      parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');

    let totalWidth = horizontalPadding;
    groups.forEach((g) => {
      totalWidth += widths.get(g.id) ?? 0;
    });

    if (totalWidth <= containerWidth) {
      setHiddenIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const sorted = [...groups].sort((a, b) => b.priority - a.priority);
    const newHidden = new Set<string>(groups.map((g) => g.id));
    let used = horizontalPadding + OVERFLOW_BUTTON_WIDTH;

    for (const g of sorted) {
      const w = widths.get(g.id) ?? 0;
      if (used + w <= containerWidth) {
        used += w;
        newHidden.delete(g.id);
      }
    }

    setHiddenIds((prev) => {
      if (prev.size === newHidden.size && [...prev].every((id) => newHidden.has(id))) {
        return prev;
      }
      return newHidden;
    });
  }, [groups, containerRef]);

  useLayoutEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => recompute());
    observer.observe(container);
    return () => observer.disconnect();
  }, [recompute, containerRef]);

  useEffect(() => {
    recompute();
  });

  useEffect(() => {
    if (!moreOpen) return;

    const onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (moreButtonRef.current?.contains(target)) return;
      setMoreOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const hiddenGroups = groups.filter((g) => hiddenIds.has(g.id));

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
        }}
      >
        {groups.map((g) => (
          <div
            key={g.id}
            data-measure-id={g.id}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >
            {g.content}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className={className}
        style={style}
        role="toolbar"
        aria-label={ariaLabel}
        data-testid={testId}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {groups.map((g) =>
          hiddenIds.has(g.id) ? null : <Fragment key={g.id}>{g.content}</Fragment>
        )}

        {hiddenGroups.length > 0 && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              ref={moreButtonRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={t('formattingBar.moreOptions')}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              data-testid="formatting-bar-more"
              className="inline-flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-md"
              style={{ width: 32, height: 32 }}
            >
              <MaterialSymbol name="more_horiz" size={18} />
            </button>
            {moreOpen && (
              <div
                ref={panelRef}
                role="menu"
                data-testid="formatting-bar-more-panel"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  zIndex: 50,
                  background: 'white',
                  border: '1px solid rgb(226 232 240)',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  padding: 6,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 4,
                  maxWidth: 360,
                }}
              >
                {hiddenGroups.map((g) => (
                  <Fragment key={g.id}>{g.content}</Fragment>
                ))}
              </div>
            )}
          </div>
        )}

        {trailing}
      </div>
    </>
  );
}
