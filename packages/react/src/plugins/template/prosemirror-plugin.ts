/**
 * Template ProseMirror Plugin
 *
 * Simple plugin that finds template tags using regex and creates decorations.
 * No separate parsing layer - everything happens here.
 */

import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';

/**
 * Template tag types
 */
export type TagType = 'variable' | 'sectionStart' | 'sectionEnd' | 'invertedStart' | 'raw';

/**
 * A found template tag
 */
export interface TemplateTag {
  id: string;
  type: TagType;
  name: string;
  rawTag: string;
  from: number;
  to: number;
  /** For sections: nested variable names */
  nestedVars?: string[];
  /** True if this variable is inside a section (shown in section's nested vars) */
  insideSection?: boolean;
}

/**
 * Payload passed to {@link TemplatePluginOptions.onVariableClick}.
 */
export interface ClickedVariable {
  /** The variable name (e.g. "CourtDistrict") */
  name: string;
  /** The full raw placeholder text (e.g. "{{ CourtDistrict }}") */
  rawTag: string;
  /** Tag classification */
  type: TagType;
  /** Internal stable ID — useful for calling setSelectedElement */
  tagId: string;
}

/**
 * Options for the template plugin.
 *
 * @example
 * ```ts
 * createTemplatePlugin({
 *   enableVariableModal: true,
 *   onVariableClick: (v) => openMyModal(v),
 * });
 * ```
 */
export interface TemplatePluginOptions {
  /**
   * Fires when the user clicks any template-variable chip
   * (inline decoration, overlay rect, or sidebar chip).
   * Only fires when `enableVariableModal` is true.
   */
  onVariableClick?: (variable: ClickedVariable) => void;
  /**
   * Feature flag. When false (default), clicks select the tag and move
   * the cursor — existing behavior. When true, clicks fire
   * `onVariableClick` (if provided) and the cursor stays put.
   */
  enableVariableModal?: boolean;
}

/**
 * Plugin state
 */
interface TemplatePluginState {
  tags: TemplateTag[];
  decorations: DecorationSet;
  hoveredId?: string;
  selectedId?: string;
}

/**
 * Regex to match template tags. Only DOUBLE enclosures are recognized, so a
 * stray single brace in ordinary text (e.g. "{note}") is never turned into a
 * variable pill. Both double syntaxes are supported equally:
 *   curly:   {{ name }} / {{name}}                          plain variable
 *            {{#name}} {{/name}} {{^name}} {{@name}}         section / inverted / raw
 *   bracket: [[ name ]] / [[name]]                          plain variable
 *
 * Single-brace docxtemplater syntax ({name}, {#name}, …) is intentionally NOT
 * matched — templates must use {{ }} or [[ ]]. Whitespace inside the braces is
 * optional in both forms.
 */
const TAG_REGEX =
  /\{\{\s*(?<prefix>[#/^@]?)\s*(?<curlyName>[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}|\[\[\s*(?<bracketName>[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\]\]/g;

/**
 * Plugin key
 */
export const templatePluginKey = new PluginKey<TemplatePluginState>('template');

/**
 * Generate a stable tag ID based on content, not a counter.
 * This ensures React keys remain stable across re-parses,
 * preventing DOM destruction/recreation (which causes blinking).
 */
function stableId(type: TagType, name: string, occurrence: number): string {
  return `${type}:${name}:${occurrence}`;
}

/**
 * Find all template tags in the document.
 *
 * Exported for unit testing of the detection rules.
 */
export function findTags(doc: ProseMirrorNode): TemplateTag[] {
  // Collect all text with positions
  const parts: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      parts.push({ text: node.text, pos });
    }
    return true;
  });

  // Build combined text and position map
  let combined = '';
  const posMap: number[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.text.length; i++) {
      posMap.push(p.pos + i);
    }
    combined += p.text;
  }

  // Find tags
  const tags: TemplateTag[] = [];
  const sectionStack: TemplateTag[] = [];
  const occurrences = new Map<string, number>();
  let match: RegExpExecArray | null;

  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(combined)) !== null) {
    const rawTag = match[0];
    const curlyName = match.groups?.curlyName;
    const bracketName = match.groups?.bracketName;
    const prefix = match.groups?.prefix ?? '';
    const name = curlyName ?? bracketName ?? '';
    const from = posMap[match.index];
    const to = posMap[match.index + rawTag.length - 1] + 1;

    // [[ ]] is always a plain variable. {{ }} carries an optional prefix that
    // selects the section / inverted / raw kinds; no prefix => plain variable.
    let type: TagType;
    if (bracketName) type = 'variable';
    else if (prefix === '#') type = 'sectionStart';
    else if (prefix === '/') type = 'sectionEnd';
    else if (prefix === '^') type = 'invertedStart';
    else if (prefix === '@') type = 'raw';
    else type = 'variable';

    const key = `${type}:${name}`;
    const occ = occurrences.get(key) ?? 0;
    occurrences.set(key, occ + 1);

    const tag: TemplateTag = { id: stableId(type, name, occ), type, name, rawTag, from, to };

    // Track nested variables in sections
    if (type === 'sectionStart' || type === 'invertedStart') {
      tag.nestedVars = [];
      sectionStack.push(tag);
    } else if (type === 'sectionEnd') {
      // Pop matching section
      for (let i = sectionStack.length - 1; i >= 0; i--) {
        if (sectionStack[i].name === name) {
          sectionStack.splice(i, 1);
          break;
        }
      }
    } else if (type === 'variable' && sectionStack.length > 0) {
      // Add to nearest section's nested vars and mark as inside section
      const section = sectionStack[sectionStack.length - 1];
      section.nestedVars?.push(name);
      tag.insideSection = true;
    }

    tags.push(tag);
  }

  return tags;
}

/**
 * Create decorations for tags
 */
function createDecorations(
  doc: ProseMirrorNode,
  tags: TemplateTag[],
  hoveredId?: string,
  selectedId?: string
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const tag of tags) {
    const isHovered = tag.id === hoveredId;
    const isSelected = tag.id === selectedId;

    const classes = ['docx-template-tag', `docx-template-tag--${tag.type}`];
    if (isHovered) classes.push('hovered');
    if (isSelected) classes.push('selected');

    decorations.push(
      Decoration.inline(tag.from, tag.to, {
        class: classes.join(' '),
        'data-tag-id': tag.id,
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Compare two tag arrays for structural equality (same tag IDs in same order).
 * Position shifts (from/to) are expected during typing and don't count as structural changes.
 */
function tagsStructureEqual(a: TemplateTag[], b: TemplateTag[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
  }
  return true;
}

/**
 * Create the template plugin
 */
export function createTemplatePlugin(
  options: TemplatePluginOptions = {}
): Plugin<TemplatePluginState> {
  return new Plugin<TemplatePluginState>({
    key: templatePluginKey,

    state: {
      init(_, state) {
        const tags = findTags(state.doc);
        return {
          tags,
          decorations: createDecorations(state.doc, tags),
        };
      },

      apply(tr, value, _oldState, newState) {
        // Re-parse on doc change
        if (tr.docChanged) {
          const newTags = findTags(newState.doc);

          // When tag structure is unchanged (same IDs, just shifted positions),
          // map existing decorations instead of rebuilding from scratch.
          // Tags still get updated positions for overlay rendering.
          const structureSame = tagsStructureEqual(value.tags, newTags);

          return {
            tags: newTags,
            decorations: structureSame
              ? value.decorations.map(tr.mapping, tr.doc)
              : createDecorations(newState.doc, newTags, value.hoveredId, value.selectedId),
            hoveredId: value.hoveredId,
            selectedId: value.selectedId,
          };
        }

        // Handle hover/select changes
        const meta = tr.getMeta(templatePluginKey);
        if (meta) {
          const newHovered = meta.hoveredId ?? value.hoveredId;
          const newSelected = meta.selectedId ?? value.selectedId;
          return {
            ...value,
            hoveredId: newHovered,
            selectedId: newSelected,
            decorations: createDecorations(newState.doc, value.tags, newHovered, newSelected),
          };
        }

        // Map decorations
        return {
          ...value,
          decorations: value.decorations.map(tr.mapping, tr.doc),
        };
      },
    },

    props: {
      decorations(state) {
        return templatePluginKey.getState(state)?.decorations ?? DecorationSet.empty;
      },

      handleClick(view: EditorView, pos: number) {
        const tags = templatePluginKey.getState(view.state)?.tags ?? [];
        const clicked = tags.find((t) => pos >= t.from && pos <= t.to);

        if (clicked) {
          view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: clicked.id }));
          if (options.enableVariableModal && options.onVariableClick) {
            options.onVariableClick({
              name: clicked.name,
              rawTag: clicked.rawTag,
              type: clicked.type,
              tagId: clicked.id,
            });
          }
          return true;
        }

        const current = templatePluginKey.getState(view.state)?.selectedId;
        if (current) {
          view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: undefined }));
        }
        return false;
      },

      handleDOMEvents: {
        mouseover(view: EditorView, event) {
          const el = (event.target as HTMLElement).closest?.('[data-tag-id]');
          const id = el?.getAttribute('data-tag-id') || undefined;
          const current = templatePluginKey.getState(view.state)?.hoveredId;

          if (id !== current) {
            view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: id }));
          }
          return false;
        },

        mouseout(view: EditorView, event: MouseEvent) {
          const related = event.relatedTarget as HTMLElement;
          if (!related?.closest?.('[data-tag-id]')) {
            const current = templatePluginKey.getState(view.state)?.hoveredId;
            if (current) {
              view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: undefined }));
            }
          }
          return false;
        },
      },
    },
  });
}

/**
 * Get tags from editor state
 */
export function getTemplateTags(state: import('prosemirror-state').EditorState): TemplateTag[] {
  return templatePluginKey.getState(state)?.tags ?? [];
}

/**
 * Set hovered tag
 */
export function setHoveredElement(view: EditorView, id: string | undefined): void {
  view.dispatch(view.state.tr.setMeta(templatePluginKey, { hoveredId: id }));
}

/**
 * Set selected tag
 */
export function setSelectedElement(view: EditorView, id: string | undefined): void {
  view.dispatch(view.state.tr.setMeta(templatePluginKey, { selectedId: id }));
}

/**
 * CSS styles for template decorations — purple 3D button look,
 * applied to inline `{{var}}` / `[[var]]` tokens so the literal
 * placeholder text reads as a clickable pill.
 */
export const TEMPLATE_DECORATION_STYLES = `
.docx-template-tag {
  display: inline-block;
  padding: 1px 8px;
  margin: 0 1px;
  background: linear-gradient(180deg, #a78bfa 0%, #8b5cf6 100%);
  color: #ffffff;
  font-weight: 600;
  font-size: 0.95em;
  line-height: 1.3;
  border: 1px solid #6d28d9;
  border-radius: 6px;
  box-shadow:
    0 1px 2px rgba(76, 29, 149, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  vertical-align: baseline;
}

.docx-template-tag:hover,
.docx-template-tag.hovered {
  background: linear-gradient(180deg, #c4b5fd 0%, #a78bfa 100%);
  box-shadow:
    0 3px 6px rgba(76, 29, 149, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

.docx-template-tag:active {
  background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.25),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(0);
}

.docx-template-tag.selected {
  box-shadow:
    0 0 0 3px rgba(139, 92, 246, 0.35),
    0 2px 4px rgba(76, 29, 149, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(0, 0, 0, 0.18);
}
`;
