import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { EditorPage } from '../helpers/editor-page';

test('uploaded DOCX preserves tab alignment and consecutive spaces', async ({ page }) => {
  const zip = await JSZip.loadAsync(await readFile('e2e/fixtures/empty.docx'));
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="1440"/></w:tabs></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="24"/></w:rPr><w:tab/><w:t>RIGHT</w:t></w:r>
        </w:p>
        <w:p><w:pPr><w:ind w:left="300"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="24"/></w:rPr><w:t>Q</w:t><w:tab/><w:t>TARGET</w:t></w:r>
        </w:p>
        <w:p><w:r><w:t xml:space="preserve">A  B</w:t></w:r></w:p>
        <w:sectPr><w:pgSz w:w="4680" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
      </w:body>
    </w:document>`
  );
  const editor = new EditorPage(page);
  await editor.goto();
  await editor.waitForReady();
  await page.locator('input[type="file"][accept=".docx"]').setInputFiles({
    name: 'tab-spacing.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  const pages = page.locator('.paged-editor__pages');
  await expect(pages).toContainText('TARGET');
  await page.evaluate(() => document.fonts.ready);

  await expect(async () => {
    const positions = await pages.evaluate((root) => {
      const find = (value: string) =>
        Array.from(root.querySelectorAll<HTMLElement>('.layout-run-text')).find(
          (el) => el.textContent === value
        )!;
      const right = find('RIGHT');
      const target = find('TARGET');
      const rightLine = right.closest('.layout-line')!;
      const targetParagraph = target.closest('.layout-paragraph')!;
      // Normalize to CSS pixels if the editor is zoomed.
      const scale =
        rightLine.getBoundingClientRect().height / (rightLine as HTMLElement).offsetHeight;
      return {
        rightHasTab: !!rightLine.querySelector('.layout-run-tab'),
        rightEdge:
          (right.getBoundingClientRect().right - rightLine.getBoundingClientRect().left) / scale,
        targetStart:
          (target.getBoundingClientRect().left - targetParagraph.getBoundingClientRect().left) /
          scale,
        spaces: find('A  B').textContent,
      };
    });
    expect(positions.rightHasTab).toBe(true);
    expect(Math.abs(positions.rightEdge - 96)).toBeLessThan(2);
    expect(Math.abs(positions.targetStart - 48)).toBeLessThan(2);
    expect(positions.spaces).toBe('A  B');
  }).toPass({ timeout: 10000 });
});
