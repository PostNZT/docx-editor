/**
 * Template Plugin
 *
 * Docxtemplater template support as a plugin for the DOCX Editor.
 *
 * Features:
 * - Full docxtemplater syntax detection (variables, loops, conditionals)
 * - Sidebar annotation chips showing template structure (via getSidebarItems)
 * - Differentiated visual highlighting by element type
 *
 * @example
 * ```tsx
 * import { PluginHost } from '@docx-editor/plugin-api';
 * import { templatePlugin } from '@docx-editor/plugins/template';
 *
 * function MyEditor() {
 *   return (
 *     <PluginHost plugins={[templatePlugin]}>
 *       <DocxEditor document={doc} onChange={handleChange} />
 *     </PluginHost>
 *   );
 * }
 * ```
 */

import React from 'react';
import { TextSelection } from 'prosemirror-state';
import type {
  ReactEditorPlugin,
  ReactSidebarItem,
  RenderedDomContext,
  SidebarItemContext,
} from '../../plugin-api/types';
import type { EditorView } from 'prosemirror-view';
import type { TemplateTag, TemplatePluginOptions } from './prosemirror-plugin';
import {
  createTemplatePlugin,
  templatePluginKey,
  setHoveredElement,
  setSelectedElement,
  TEMPLATE_DECORATION_STYLES,
} from './prosemirror-plugin';
import {
  TemplateHighlightOverlay,
  TEMPLATE_HIGHLIGHT_OVERLAY_STYLES,
} from './components/TemplateHighlightOverlay';
import { TemplateChip, TEMPLATE_CHIP_STYLES } from './components/TemplateChip';

/**
 * Plugin state interface
 */
function selectTag(
  view: EditorView | null,
  tags: TemplateTag[],
  id: string,
  options: TemplatePluginOptions
) {
  if (!view) return;
  const tag = tags.find((t) => t.id === id);
  setSelectedElement(view, id);

  if (options.enableVariableModal && options.onVariableClick && tag) {
    options.onVariableClick({
      name: tag.name,
      rawTag: tag.rawTag,
      type: tag.type,
      tagId: tag.id,
    });
    return;
  }

  if (tag) {
    const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(tag.from)));
    view.dispatch(tr);
    view.focus();
  }
}

interface TemplatePluginState {
  tags: TemplateTag[];
  hoveredId?: string;
  selectedId?: string;
}

/**
 * Create the template plugin instance.
 *
 * @example
 * ```tsx
 * const plugin = createTemplatePlugin({
 *   enableVariableModal: true,
 *   onVariableClick: (variable) => openMyModal(variable),
 * });
 * <PluginHost plugins={[plugin]}>...</PluginHost>
 * ```
 */
export function createPlugin(
  options: TemplatePluginOptions = {}
): ReactEditorPlugin<TemplatePluginState> {
  const pmPlugin = createTemplatePlugin(options);

  return {
    id: 'template',
    name: 'Template',

    proseMirrorPlugins: [pmPlugin],

    onStateChange: (view: EditorView): TemplatePluginState | undefined => {
      const pluginState = templatePluginKey.getState(view.state);
      if (!pluginState) return undefined;
      return {
        tags: pluginState.tags,
        hoveredId: pluginState.hoveredId,
        selectedId: pluginState.selectedId,
      };
    },

    initialize: (_view: EditorView | null): TemplatePluginState => {
      return { tags: [] };
    },

    getSidebarItems: (
      state: TemplatePluginState | undefined,
      context: SidebarItemContext
    ): ReactSidebarItem[] => {
      if (!state || state.tags.length === 0) return [];

      const visibleTags = state.tags.filter((t) => t.type !== 'sectionEnd' && !t.insideSection);

      return visibleTags.map((tag) => ({
        id: `template-${tag.id}`,
        anchorPos: tag.from,
        priority: 10,
        estimatedHeight: 32,
        render: (props) =>
          React.createElement(TemplateChip, {
            ...props,
            tag,
            isHovered: tag.id === state.hoveredId,
            onHover: (id: string | undefined) => {
              if (context.editorView) setHoveredElement(context.editorView, id);
            },
            onSelect: (id: string) => selectTag(context.editorView, state.tags, id, options),
          }),
      }));
    },

    renderOverlay: (
      context: RenderedDomContext,
      state: TemplatePluginState | undefined,
      editorView: EditorView | null
    ): React.ReactNode => {
      if (!state || state.tags.length === 0) return null;

      return React.createElement(TemplateHighlightOverlay, {
        context,
        tags: state.tags,
        hoveredId: state.hoveredId,
        selectedId: state.selectedId,
        onHover: (id: string | undefined) => {
          if (editorView) setHoveredElement(editorView, id);
        },
        onSelect: (id: string) => selectTag(editorView, state.tags, id, options),
      });
    },

    styles: `
${TEMPLATE_DECORATION_STYLES}
${TEMPLATE_CHIP_STYLES}
${TEMPLATE_HIGHLIGHT_OVERLAY_STYLES}
`,
  };
}

/**
 * Default template plugin instance.
 */
export const templatePlugin = createPlugin();

// Re-export types and utilities
export type {
  TemplateTag,
  TagType,
  ClickedVariable,
  TemplatePluginOptions,
} from './prosemirror-plugin';
export {
  createTemplatePlugin,
  templatePluginKey,
  getTemplateTags,
  setHoveredElement,
  setSelectedElement,
  TEMPLATE_DECORATION_STYLES,
} from './prosemirror-plugin';
