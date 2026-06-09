/**
 * Template tag detection — only DOUBLE enclosures are recognized.
 *
 * Product rule: a template variable must be written {{ name }} or [[ name ]].
 * A stray single brace in ordinary text (e.g. "{amount}") must stay literal and
 * never render as a variable pill. Section prefixes live inside double curlies
 * ({{#items}} … {{/items}}).
 */
import { describe, test, expect } from 'bun:test';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { findTags } from './prosemirror-plugin';

// Minimal stand-in for a ProseMirror doc: findTags only walks text nodes via
// descendants(node, pos), reading node.isText / node.text.
function docOf(text: string): ProseMirrorNode {
  return {
    descendants(cb: (node: { isText: boolean; text: string }, pos: number) => boolean) {
      cb({ isText: true, text }, 1);
    },
  } as unknown as ProseMirrorNode;
}

describe('findTags — double-delimiter detection', () => {
  test('recognizes {{ name }} and [[ name ]] as variables', () => {
    const tags = findTags(docOf('Hi {{ FirstName }} and [[ last_name ]] end'));
    expect(tags.map((t) => ({ name: t.name, type: t.type, raw: t.rawTag }))).toEqual([
      { name: 'FirstName', type: 'variable', raw: '{{ FirstName }}' },
      { name: 'last_name', type: 'variable', raw: '[[ last_name ]]' },
    ]);
  });

  test('does NOT recognize single-brace {name} or {#section}', () => {
    expect(findTags(docOf('Total {amount}, see {#note} and {/note}'))).toHaveLength(0);
  });

  test('matches double braces without inner whitespace and dotted paths', () => {
    const tags = findTags(docOf('{{user.email}}'));
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: 'user.email', type: 'variable' });
  });

  test('matches [[name]] without inner whitespace', () => {
    const tags = findTags(docOf('[[city]]'));
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: 'city', type: 'variable' });
  });

  test('supports section prefixes inside double curlies', () => {
    const tags = findTags(docOf('{{#items}}{{ label }}{{/items}}'));
    expect(tags.map((t) => t.type)).toEqual(['sectionStart', 'variable', 'sectionEnd']);
    expect(tags[1].insideSection).toBe(true);
  });

  test('a single brace adjacent to a double tag does not break detection', () => {
    const tags = findTags(docOf('{ {{ Real }} }'));
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('Real');
  });
});
