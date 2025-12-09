import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
import { v4 as uuidv4 } from "uuid";

// Rich formatting types
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
}

export interface ParagraphStyle {
  alignment?: "left" | "center" | "right" | "justify";
  indentLeft?: number;
  indentRight?: number;
  indentFirstLine?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  lineSpacing?: number;
  outlineLevel?: number;
  styleId?: string;
  styleName?: string;
}

export interface TableCell {
  content: RichParagraph[];
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  shading?: string;
  borders?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export interface TableRow {
  cells: TableCell[];
  height?: number;
  isHeader?: boolean;
}

export interface RichTable {
  id: string;
  rows: TableRow[];
  columns: number;
  width?: number;
  style?: string;
}

export interface RichParagraph {
  id: string;
  runs: TextRun[];
  style: ParagraphStyle;
  listLevel?: number;
  listType?: "bullet" | "number";
  isHeading?: boolean;
  headingLevel?: number;
}

export interface RichSection {
  id: string;
  number?: string;
  title?: string;
  paragraphs: RichParagraph[];
  tables: RichTable[];
  rawXml?: string;
}

export interface RichParsedSOW {
  id: string;
  filename: string;
  sections: RichSection[];
  styles: Map<string, ParagraphStyle>;
  metadata?: {
    title?: string;
    author?: string;
    created?: string;
  };
  rawDocumentXml?: string;
}

// Helper to get text content from XML element
function getTextContent(element: any): string {
  if (!element) return "";
  if (typeof element === "string") return element;
  if (element._) return element._;
  if (Array.isArray(element)) {
    return element.map(getTextContent).join("");
  }
  return "";
}

// Parse text run properties
function parseRunProperties(rPr: any): Partial<TextRun> {
  const props: Partial<TextRun> = {};

  if (!rPr) return props;

  if (rPr["w:b"]) props.bold = true;
  if (rPr["w:i"]) props.italic = true;
  if (rPr["w:u"]) props.underline = true;
  if (rPr["w:strike"]) props.strike = true;

  if (rPr["w:sz"]) {
    const sz = rPr["w:sz"][0];
    if (sz && sz.$) {
      props.fontSize = parseInt(sz.$["w:val"]) / 2; // Half-points to points
    }
  }

  if (rPr["w:rFonts"]) {
    const fonts = rPr["w:rFonts"][0];
    if (fonts && fonts.$) {
      props.fontFamily = fonts.$["w:ascii"] || fonts.$["w:hAnsi"];
    }
  }

  if (rPr["w:color"]) {
    const color = rPr["w:color"][0];
    if (color && color.$) {
      props.color = color.$["w:val"];
    }
  }

  if (rPr["w:highlight"]) {
    const highlight = rPr["w:highlight"][0];
    if (highlight && highlight.$) {
      props.highlight = highlight.$["w:val"];
    }
  }

  return props;
}

// Parse paragraph properties
function parseParagraphProperties(pPr: any): ParagraphStyle {
  const style: ParagraphStyle = {};

  if (!pPr) return style;

  if (pPr["w:jc"]) {
    const jc = pPr["w:jc"][0];
    if (jc && jc.$) {
      const val = jc.$["w:val"];
      if (val === "center") style.alignment = "center";
      else if (val === "right") style.alignment = "right";
      else if (val === "both") style.alignment = "justify";
      else style.alignment = "left";
    }
  }

  if (pPr["w:ind"]) {
    const ind = pPr["w:ind"][0];
    if (ind && ind.$) {
      if (ind.$["w:left"]) style.indentLeft = parseInt(ind.$["w:left"]);
      if (ind.$["w:right"]) style.indentRight = parseInt(ind.$["w:right"]);
      if (ind.$["w:firstLine"]) style.indentFirstLine = parseInt(ind.$["w:firstLine"]);
    }
  }

  if (pPr["w:spacing"]) {
    const spacing = pPr["w:spacing"][0];
    if (spacing && spacing.$) {
      if (spacing.$["w:before"]) style.spacingBefore = parseInt(spacing.$["w:before"]);
      if (spacing.$["w:after"]) style.spacingAfter = parseInt(spacing.$["w:after"]);
      if (spacing.$["w:line"]) style.lineSpacing = parseInt(spacing.$["w:line"]);
    }
  }

  if (pPr["w:outlineLvl"]) {
    const lvl = pPr["w:outlineLvl"][0];
    if (lvl && lvl.$) {
      style.outlineLevel = parseInt(lvl.$["w:val"]);
    }
  }

  if (pPr["w:pStyle"]) {
    const pStyle = pPr["w:pStyle"][0];
    if (pStyle && pStyle.$) {
      style.styleId = pStyle.$["w:val"];
    }
  }

  return style;
}

// Parse a single paragraph
function parseParagraph(p: any): RichParagraph {
  const paragraph: RichParagraph = {
    id: uuidv4(),
    runs: [],
    style: {},
  };

  // Parse paragraph properties
  if (p["w:pPr"]) {
    paragraph.style = parseParagraphProperties(p["w:pPr"][0]);

    // Check for list
    const pPr = p["w:pPr"][0];
    if (pPr["w:numPr"]) {
      const numPr = pPr["w:numPr"][0];
      if (numPr["w:ilvl"]) {
        paragraph.listLevel = parseInt(numPr["w:ilvl"][0].$["w:val"]);
      }
      paragraph.listType = "bullet"; // Default, would need numbering.xml to determine
    }

    // Check for heading
    if (paragraph.style.styleId?.startsWith("Heading")) {
      paragraph.isHeading = true;
      const level = parseInt(paragraph.style.styleId.replace("Heading", ""));
      if (!isNaN(level)) paragraph.headingLevel = level;
    }
  }

  // Parse text runs
  if (p["w:r"]) {
    for (const r of p["w:r"]) {
      const run: TextRun = { text: "" };

      // Get run properties
      if (r["w:rPr"]) {
        Object.assign(run, parseRunProperties(r["w:rPr"][0]));
      }

      // Get text content
      if (r["w:t"]) {
        run.text = getTextContent(r["w:t"][0]);
      }

      if (run.text) {
        paragraph.runs.push(run);
      }
    }
  }

  return paragraph;
}

// Parse table
function parseTable(tbl: any): RichTable {
  const table: RichTable = {
    id: uuidv4(),
    rows: [],
    columns: 0,
  };

  // Parse table properties
  if (tbl["w:tblPr"]) {
    const tblPr = tbl["w:tblPr"][0];
    if (tblPr["w:tblStyle"]) {
      table.style = tblPr["w:tblStyle"][0].$["w:val"];
    }
  }

  // Parse rows
  if (tbl["w:tr"]) {
    for (const tr of tbl["w:tr"]) {
      const row: TableRow = { cells: [] };

      // Parse row properties
      if (tr["w:trPr"]) {
        const trPr = tr["w:trPr"][0];
        if (trPr["w:tblHeader"]) row.isHeader = true;
        if (trPr["w:trHeight"]) {
          row.height = parseInt(trPr["w:trHeight"][0].$["w:val"]);
        }
      }

      // Parse cells
      if (tr["w:tc"]) {
        for (const tc of tr["w:tc"]) {
          const cell: TableCell = { content: [] };

          // Parse cell properties
          if (tc["w:tcPr"]) {
            const tcPr = tc["w:tcPr"][0];
            if (tcPr["w:gridSpan"]) {
              cell.colSpan = parseInt(tcPr["w:gridSpan"][0].$["w:val"]);
            }
            if (tcPr["w:shd"]) {
              cell.shading = tcPr["w:shd"][0].$["w:fill"];
            }
          }

          // Parse cell content (paragraphs)
          if (tc["w:p"]) {
            for (const p of tc["w:p"]) {
              cell.content.push(parseParagraph(p));
            }
          }

          row.cells.push(cell);
        }
      }

      table.rows.push(row);
      if (row.cells.length > table.columns) {
        table.columns = row.cells.length;
      }
    }
  }

  return table;
}

// Extract sections from document
function extractSections(body: any): RichSection[] {
  const sections: RichSection[] = [];
  let currentSection: RichSection | null = null;
  let sectionNumber = 0;

  const elements = [];

  // Collect all paragraphs and tables in order
  if (body["w:p"]) {
    for (const p of body["w:p"]) {
      elements.push({ type: "paragraph", element: p });
    }
  }

  // Note: In a real implementation, we'd need to preserve element order
  // For now, process paragraphs then tables

  for (const item of elements) {
    if (item.type === "paragraph") {
      const paragraph = parseParagraph(item.element);
      const text = paragraph.runs.map(r => r.text).join("");

      // Check if this is a section header
      const sectionMatch = text.match(/^(\d+(?:\.\d+)*\.?)\s+(.+)/);
      const isHeading = paragraph.isHeading || paragraph.style.outlineLevel !== undefined;

      if (sectionMatch || (isHeading && text.trim().length > 0)) {
        // Start new section
        if (currentSection) {
          sections.push(currentSection);
        }

        sectionNumber++;
        currentSection = {
          id: uuidv4(),
          number: sectionMatch ? sectionMatch[1] : String(sectionNumber),
          title: sectionMatch ? sectionMatch[2] : text,
          paragraphs: [paragraph],
          tables: [],
        };
      } else if (currentSection) {
        currentSection.paragraphs.push(paragraph);
      } else {
        // Content before first section
        currentSection = {
          id: uuidv4(),
          number: "0",
          title: "Introduction",
          paragraphs: [paragraph],
          tables: [],
        };
      }
    }
  }

  // Process tables
  if (body["w:tbl"]) {
    for (const tbl of body["w:tbl"]) {
      const table = parseTable(tbl);
      if (currentSection) {
        currentSection.tables.push(table);
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

// Parse styles from styles.xml
async function parseStyles(zip: JSZip): Promise<Map<string, ParagraphStyle>> {
  const styles = new Map<string, ParagraphStyle>();

  const stylesXml = zip.file("word/styles.xml");
  if (!stylesXml) return styles;

  const content = await stylesXml.async("string");
  const parsed = await parseStringPromise(content);

  if (parsed["w:styles"] && parsed["w:styles"]["w:style"]) {
    for (const style of parsed["w:styles"]["w:style"]) {
      if (style.$ && style.$["w:styleId"]) {
        const styleId = style.$["w:styleId"];
        const pStyle: ParagraphStyle = { styleId };

        if (style["w:name"]) {
          pStyle.styleName = style["w:name"][0].$["w:val"];
        }

        if (style["w:pPr"]) {
          Object.assign(pStyle, parseParagraphProperties(style["w:pPr"][0]));
        }

        styles.set(styleId, pStyle);
      }
    }
  }

  return styles;
}

// Main parsing function
export async function parseRichDocx(buffer: Buffer, filename: string): Promise<RichParsedSOW> {
  const zip = await JSZip.loadAsync(buffer);

  // Parse main document
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    throw new Error("Invalid DOCX file: missing document.xml");
  }

  const content = await documentXml.async("string");
  const parsed = await parseStringPromise(content);

  const body = parsed["w:document"]["w:body"][0];

  // Extract sections with rich formatting
  const sections = extractSections(body);

  // Parse styles
  const styles = await parseStyles(zip);

  // Parse metadata
  let metadata: RichParsedSOW["metadata"] = {};
  const coreXml = zip.file("docProps/core.xml");
  if (coreXml) {
    try {
      const coreContent = await coreXml.async("string");
      const coreParsed = await parseStringPromise(coreContent);
      const props = coreParsed["cp:coreProperties"];
      if (props) {
        if (props["dc:title"]) metadata.title = props["dc:title"][0];
        if (props["dc:creator"]) metadata.author = props["dc:creator"][0];
        if (props["dcterms:created"]) metadata.created = props["dcterms:created"][0]._;
      }
    } catch (e) {
      // Ignore metadata parsing errors
    }
  }

  return {
    id: uuidv4(),
    filename,
    sections,
    styles,
    metadata,
    rawDocumentXml: content,
  };
}

// Compare formatting between two paragraphs
export interface FormattingDifference {
  type: "style" | "font" | "alignment" | "spacing" | "indent" | "list" | "table";
  description: string;
  templateValue: string;
  draftValue: string;
  severity: "high" | "medium" | "low";
}

export function compareParagraphFormatting(
  template: RichParagraph,
  draft: RichParagraph
): FormattingDifference[] {
  const differences: FormattingDifference[] = [];

  // Compare alignment
  if (template.style.alignment !== draft.style.alignment) {
    differences.push({
      type: "alignment",
      description: "Text alignment differs",
      templateValue: template.style.alignment || "left",
      draftValue: draft.style.alignment || "left",
      severity: "medium",
    });
  }

  // Compare indentation
  if (template.style.indentLeft !== draft.style.indentLeft) {
    differences.push({
      type: "indent",
      description: "Left indent differs",
      templateValue: `${template.style.indentLeft || 0}`,
      draftValue: `${draft.style.indentLeft || 0}`,
      severity: "low",
    });
  }

  // Compare spacing
  if (template.style.spacingAfter !== draft.style.spacingAfter) {
    differences.push({
      type: "spacing",
      description: "Paragraph spacing after differs",
      templateValue: `${template.style.spacingAfter || 0}`,
      draftValue: `${draft.style.spacingAfter || 0}`,
      severity: "low",
    });
  }

  // Compare style
  if (template.style.styleId !== draft.style.styleId) {
    differences.push({
      type: "style",
      description: "Paragraph style differs",
      templateValue: template.style.styleId || "Normal",
      draftValue: draft.style.styleId || "Normal",
      severity: "high",
    });
  }

  // Compare text formatting in runs
  const templateRuns = template.runs;
  const draftRuns = draft.runs;

  for (let i = 0; i < Math.min(templateRuns.length, draftRuns.length); i++) {
    const tRun = templateRuns[i];
    const dRun = draftRuns[i];

    if (tRun.bold !== dRun.bold) {
      differences.push({
        type: "font",
        description: `Bold formatting differs for "${dRun.text.substring(0, 30)}..."`,
        templateValue: tRun.bold ? "Bold" : "Normal",
        draftValue: dRun.bold ? "Bold" : "Normal",
        severity: "medium",
      });
    }

    if (tRun.italic !== dRun.italic) {
      differences.push({
        type: "font",
        description: `Italic formatting differs for "${dRun.text.substring(0, 30)}..."`,
        templateValue: tRun.italic ? "Italic" : "Normal",
        draftValue: dRun.italic ? "Italic" : "Normal",
        severity: "medium",
      });
    }

    if (tRun.fontSize !== dRun.fontSize && tRun.fontSize && dRun.fontSize) {
      differences.push({
        type: "font",
        description: `Font size differs for "${dRun.text.substring(0, 30)}..."`,
        templateValue: `${tRun.fontSize}pt`,
        draftValue: `${dRun.fontSize}pt`,
        severity: "high",
      });
    }

    if (tRun.fontFamily !== dRun.fontFamily && tRun.fontFamily && dRun.fontFamily) {
      differences.push({
        type: "font",
        description: `Font family differs for "${dRun.text.substring(0, 30)}..."`,
        templateValue: tRun.fontFamily,
        draftValue: dRun.fontFamily,
        severity: "high",
      });
    }
  }

  return differences;
}

// Extract acronyms from text
export function extractAcronymsFromRichDoc(doc: RichParsedSOW): string[] {
  const acronyms = new Set<string>();
  const acronymPattern = /\b[A-Z]{2,}(?:\s*[&\/]\s*[A-Z]{2,})*\b/g;

  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      const text = para.runs.map(r => r.text).join("");
      const matches = text.match(acronymPattern);
      if (matches) {
        for (const match of matches) {
          // Filter out common words that look like acronyms
          if (!["I", "A", "THE", "AND", "OR", "FOR", "TO", "IN", "OF", "IT", "IS", "AS", "AT", "BY", "ON"].includes(match)) {
            acronyms.add(match);
          }
        }
      }
    }
  }

  return Array.from(acronyms).sort();
}

// Extract potential jargon (domain-specific terms)
export function extractJargonFromRichDoc(doc: RichParsedSOW): string[] {
  const jargonPatterns = [
    /\b(?:deliverable|milestone|scope|SLA|KPI|stakeholder|vendor|contractor|subcontractor)\b/gi,
    /\b(?:indemnification|liability|termination|confidential|proprietary)\b/gi,
    /\b(?:phase|sprint|iteration|release|deployment|implementation)\b/gi,
  ];

  const jargon = new Set<string>();

  for (const section of doc.sections) {
    for (const para of section.paragraphs) {
      const text = para.runs.map(r => r.text).join("");
      for (const pattern of jargonPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            jargon.add(match.toLowerCase());
          }
        }
      }
    }
  }

  return Array.from(jargon).sort();
}
