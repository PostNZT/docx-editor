/**
 * Template Variable Modal — onVariableClick callback API
 *
 * Verifies that clicking a template-variable chip in the editor fires the
 * `onVariableClick` callback registered via `createTemplatePlugin({...})`.
 *
 * The Vite example app (`examples/vite/src/App.tsx`) wires the callback to
 * a state setter and renders the value in a modal with
 * `data-testid="template-variable-modal"` — so we assert by reading the
 * modal's text content.
 *
 * Only DOUBLE-enclosed placeholders are recognized:
 *   - curly:   {{ name }}   (whitespace optional)
 *   - bracket: [[name]]     (whitespace optional)
 * Single-brace {name} is intentionally NOT treated as a variable.
 *
 * Plus: sidebar chip click fires the same callback as overlay rect click,
 * and the flag-off case (App.tsx ?flagOff=1) confirms the modal is gated
 * by `enableVariableModal`.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import type { Page } from '@playwright/test';

function modal(page: Page) {
  return page.locator('[data-testid="template-variable-modal"]');
}

test.describe('Template variable modal — onVariableClick', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
    await editor.waitForReady();
    await editor.newDocument();
    await editor.focus();
  });

  test('overlay click fires callback for {{ jinja }} syntax', async ({ page }) => {
    await editor.typeText('{{ CourtDistrict }}');

    // Tag may render as multiple overlay rects (one per visual line); .first() picks one
    const overlay = page.locator('.template-highlight[data-var-name="CourtDistrict"]').first();
    await overlay.waitFor({ state: 'visible', timeout: 5000 });

    await overlay.click();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator('h2', { hasText: 'CourtDistrict' })).toBeVisible();
    await expect(modal(page).getByText('{{ CourtDistrict }}')).toBeVisible();

    // Visual smoke screenshot — captures the rendered modal so a human can
    // inspect later if needed. Saved to screenshots/ per project convention.
    await page.screenshot({
      path: 'screenshots/template-variable-modal-jinja.png',
      fullPage: false,
    });
  });

  test('overlay click fires callback for [[bracket]] syntax', async ({ page }) => {
    await editor.typeText('[[test_var]]');

    const overlay = page.locator('.template-highlight[data-var-name="test_var"]').first();
    await overlay.waitFor({ state: 'visible', timeout: 5000 });

    await overlay.click();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator('h2', { hasText: 'test_var' })).toBeVisible();
    await expect(modal(page).getByText('[[test_var]]')).toBeVisible();
  });

  test('single-brace {brace} is NOT treated as a variable', async ({ page }) => {
    await editor.typeText('{another_var}');

    // No template overlay should be created for single-brace text, and a click
    // on it must not open the modal — it is ordinary literal text now.
    const overlay = page.locator('.template-highlight[data-var-name="another_var"]');
    await expect(overlay).toHaveCount(0);
    await expect(modal(page)).toHaveCount(0);
  });

  test('sidebar chip click fires the same callback as overlay click', async ({ page }) => {
    await editor.typeText('{{ SidebarTest }}');

    // Sidebar chip uses .template-annotation-chip class (from TemplateChip.tsx)
    const sidebarChip = page
      .locator('.template-annotation-chip', { hasText: 'SidebarTest' })
      .first();
    await sidebarChip.waitFor({ state: 'visible', timeout: 5000 });

    await sidebarChip.click();

    await expect(modal(page)).toBeVisible();
    await expect(modal(page).locator('h2', { hasText: 'SidebarTest' })).toBeVisible();
  });

  test('cursor does not jump to chip position when callback handles the click', async ({
    page,
  }) => {
    // Type the variable followed by extra text — cursor ends up after "END"
    await editor.typeText('{{ CursorTest }} END');

    // Capture cursor position before clicking the chip
    const cursorBefore = await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      return {
        node: sel.anchorNode?.textContent ?? null,
        offset: sel.anchorOffset,
      };
    });

    const overlay = page.locator('.template-highlight[data-var-name="CursorTest"]').first();
    await overlay.waitFor({ state: 'visible', timeout: 5000 });

    await overlay.click();

    await expect(modal(page)).toBeVisible();

    // Cursor should not have jumped into the chip — selection is unchanged
    const cursorAfter = await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      return {
        node: sel.anchorNode?.textContent ?? null,
        offset: sel.anchorOffset,
      };
    });

    expect(cursorAfter).toEqual(cursorBefore);
  });
});

test.describe('Template variable modal — flag off', () => {
  // App.tsx reads ?flagOff=1 and passes enableVariableModal: false to the plugin.
  // Expected behavior: clicking a chip selects the tag visually but does NOT
  // open the modal and DOES move the editor cursor (the pre-API default).
  test('callback does not fire and cursor moves into the chip', async ({ page }) => {
    const editor = new EditorPage(page);
    await page.goto('/?flagOff=1');
    await editor.waitForReady();
    await editor.newDocument();
    await editor.focus();

    await editor.typeText('{{ FlagOffTest }} END');

    const overlay = page.locator('.template-highlight[data-var-name="FlagOffTest"]').first();
    await overlay.waitFor({ state: 'visible', timeout: 5000 });

    await overlay.click();

    // Modal must NOT appear (flag gates it)
    await expect(modal(page)).toHaveCount(0);

    // Cursor should now be inside/near the chip (default selectTag behavior
    // moves the selection to tag.from). We verify by inserting a sentinel
    // character and checking it lands inside the placeholder area rather than
    // after " END".
    await page.keyboard.type('X');

    const text = await page.evaluate(() => {
      const pm = document.querySelector('.ProseMirror');
      return pm?.textContent ?? '';
    });

    // 'X' should appear before/within the placeholder, not after the ' END' suffix
    const xIndex = text.indexOf('X');
    const endIndex = text.indexOf(' END');
    expect(xIndex).toBeGreaterThanOrEqual(0);
    expect(xIndex).toBeLessThan(endIndex);
  });
});
