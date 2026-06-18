/**
 * Generate DOCX Test Fixtures
 *
 * This script generates sample DOCX files for testing.
 * Run with: bun run e2e/fixtures/generate-fixtures.ts
 */

import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.dirname(new URL(import.meta.url).pathname);

/**
 * Minimal DOCX structure components
 */
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="200" w:line="276" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:sz w:val="22"/>
    </w:rPr>
  </w:style>
</w:styles>`;

/**
 * Create a minimal DOCX file
 */
async function createDocx(documentXml: string, filename: string): Promise<void> {
  const zip = new JSZip();

  // Add required DOCX structure
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', RELS_XML);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS_XML);
  zip.file('word/styles.xml', STYLES_XML);
  zip.file('word/document.xml', documentXml);

  // Generate the DOCX file
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outputPath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath}`);
}

/**
 * Generate empty.docx
 */
async function generateEmptyDocx(): Promise<void> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t></w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  await createDocx(documentXml, 'empty.docx');
}

/**
 * Generate styled-content.docx
 */
async function generateStyledContentDocx(): Promise<void> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Normal text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>Bold text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>Italic text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:u w:val="single"/>
        </w:rPr>
        <w:t>Underlined text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:i/>
        </w:rPr>
        <w:t>Bold and italic text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:strike/>
        </w:rPr>
        <w:t>Strikethrough text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="36"/>
        </w:rPr>
        <w:t>Large text (18pt). </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:sz w:val="16"/>
        </w:rPr>
        <w:t>Small text (8pt).</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:t>Centered paragraph.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="right"/>
      </w:pPr>
      <w:r>
        <w:t>Right-aligned paragraph.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  await createDocx(documentXml, 'styled-content.docx');
}

/**
 * Generate with-tables.docx
 */
async function generateWithTablesDocx(): Promise<void> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>Document with tables:</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>A1</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>B1</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>C1</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>A2</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>B2</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>C2</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:t>A3</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>B3</w:t></w:r></w:p>
        </w:tc>
        <w:tc>
          <w:p><w:r><w:t>C3</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:r>
        <w:t>End of document.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  await createDocx(documentXml, 'with-tables.docx');
}

/**
 * Generate complex-styles.docx
 */
async function generateComplexStylesDocx(): Promise<void> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:t>Heading 1</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This is a paragraph under heading 1. It contains normal text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading2"/>
      </w:pPr>
      <w:r>
        <w:t>Heading 2</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>Another paragraph with </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        </w:rPr>
        <w:t>Times New Roman font</w:t>
      </w:r>
      <w:r>
        <w:t> and </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
        </w:rPr>
        <w:t>Arial font</w:t>
      </w:r>
      <w:r>
        <w:t>.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:color w:val="FF0000"/>
        </w:rPr>
        <w:t>Red text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:color w:val="0000FF"/>
        </w:rPr>
        <w:t>Blue text. </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:color w:val="00FF00"/>
        </w:rPr>
        <w:t>Green text.</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:highlight w:val="yellow"/>
        </w:rPr>
        <w:t>Highlighted text</w:t>
      </w:r>
      <w:r>
        <w:t> and normal text.</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  await createDocx(documentXml, 'complex-styles.docx');
}

/**
 * Generate legal-caption.docx
 *
 * Sanitized reproduction of a bankruptcy "Certificate of Service" caption
 * (fake debtor name and case number; no private content). The layout-driving
 * structure is preserved EXACTLY from the source document:
 *   - one left tab stop at 5039 twips
 *   - a hanging indent (left=720, hanging=720) so the first line starts at the
 *     margin and wrapped lines indent 0.5"
 *   - a right indent of 2177 twips that narrows the line
 *   - page margins left=1440 / right=1080 (so the wrap column matches the source)
 *   - Times New Roman 12pt throughout
 *
 * Faithful rendering (Word/Google/Pages) wraps the hyphenated case number at the
 * dash: "Case No. 00-00000-" sits on line 1 at the 5039 tab stop and "MAM Debtor."
 * wraps to line 2, with "Chapter 13" landing at the same 5039 stop. A regression
 * in tab-stop origin or hyphen line-breaking (see commit 54aa655) forces the case
 * number flush to the right margin and keeps "…00-00000-MAM" on one line.
 */
async function generateLegalCaptionDocx(): Promise<void> {
  // Identical run properties for every run (Times New Roman, 12pt).
  const rpr =
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:spacing w:before="241"/></w:pPr>
      <w:r>${rpr}<w:t>In re:</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:tabs><w:tab w:val="left" w:pos="5039"/></w:tabs>
        <w:spacing w:line="530" w:lineRule="atLeast"/>
        <w:ind w:left="720" w:right="2177" w:hanging="720"/>
      </w:pPr>
      <w:r>${rpr}<w:t>JANE ALEXANDRA DOE,</w:t></w:r>
      <w:r>${rpr}<w:tab/></w:r>
      <w:r>${rpr}<w:t>Case No. 00-00000-MAM Debtor.</w:t></w:r>
      <w:r>${rpr}<w:tab/></w:r>
      <w:r>${rpr}<w:t xml:space="preserve">Chapter 13 </w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:line="530" w:lineRule="atLeast"/>
        <w:ind w:left="720" w:right="2177" w:hanging="720"/>
      </w:pPr>
      <w:r>${rpr}<w:t>_______________________________/</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1354" w:right="1080" w:bottom="936" w:left="1440" w:header="0" w:footer="763" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  await createDocx(documentXml, 'legal-caption.docx');
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('Generating DOCX test fixtures...\n');

  await generateEmptyDocx();
  await generateStyledContentDocx();
  await generateWithTablesDocx();
  await generateComplexStylesDocx();
  await generateLegalCaptionDocx();

  console.log('\nAll fixtures generated successfully!');
}

main().catch((error) => {
  console.error('Error generating fixtures:', error);
  process.exit(1);
});
