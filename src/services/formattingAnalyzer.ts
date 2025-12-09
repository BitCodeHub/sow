import { v4 as uuidv4 } from "uuid";
import { AzureOpenAI } from "openai";
import type {
  FormattingDifference,
  FormattingAnalysis,
  AcronymInfo,
  JargonInfo,
  ParagraphFormatting,
  TextRunFormatting,
  RichParsedSOW,
  RichSection,
  RichParagraph,
} from "@/types";
import {
  parseRichDocx,
  compareParagraphFormatting,
  extractAcronymsFromRichDoc,
  extractJargonFromRichDoc,
  type RichParsedSOW as ParserRichSOW,
} from "./richDocxParser";

// Get Azure OpenAI client
let azureClient: AzureOpenAI | null = null;

function getAzureOpenAIClient(): AzureOpenAI {
  if (!azureClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

    if (!endpoint || !apiKey) {
      throw new Error("Azure OpenAI not configured");
    }

    azureClient = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
    });
  }
  return azureClient;
}

function getDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1";
}

// Convert parser types to our types
function convertRichParagraph(p: any): RichParagraph {
  return {
    id: p.id,
    text: p.runs.map((r: any) => r.text).join(""),
    formatting: {
      alignment: p.style.alignment,
      indentLeft: p.style.indentLeft,
      indentRight: p.style.indentRight,
      indentFirstLine: p.style.indentFirstLine,
      spacingBefore: p.style.spacingBefore,
      spacingAfter: p.style.spacingAfter,
      lineSpacing: p.style.lineSpacing,
      styleId: p.style.styleId,
      styleName: p.style.styleName,
      outlineLevel: p.style.outlineLevel,
    },
    runs: p.runs.map((r: any) => ({
      text: r.text,
      formatting: {
        bold: r.bold,
        italic: r.italic,
        underline: r.underline,
        strike: r.strike,
        fontSize: r.fontSize,
        fontFamily: r.fontFamily,
        color: r.color,
        highlight: r.highlight,
      },
    })),
    isHeading: p.isHeading,
    headingLevel: p.headingLevel,
    listLevel: p.listLevel,
    listType: p.listType,
  };
}

// Compare formatting between template and draft sections
export function compareSectionFormatting(
  templateSection: RichSection | null,
  draftSection: RichSection
): FormattingDifference[] {
  const differences: FormattingDifference[] = [];

  if (!templateSection || !templateSection.paragraphs || !draftSection.paragraphs) {
    return differences;
  }

  const templateParas = templateSection.paragraphs;
  const draftParas = draftSection.paragraphs;

  // Compare paragraphs
  for (let i = 0; i < Math.min(templateParas.length, draftParas.length); i++) {
    const tPara = templateParas[i];
    const dPara = draftParas[i];

    // Compare paragraph alignment
    if (tPara.formatting.alignment !== dPara.formatting.alignment) {
      differences.push({
        id: uuidv4(),
        type: "alignment",
        description: `Paragraph alignment differs: "${tPara.formatting.alignment || 'left'}" in template vs "${dPara.formatting.alignment || 'left'}" in draft`,
        templateValue: tPara.formatting.alignment || "left",
        draftValue: dPara.formatting.alignment || "left",
        severity: "medium",
        location: {
          sectionId: draftSection.id,
          paragraphIndex: i,
          textSnippet: dPara.text.substring(0, 50),
        },
        fix: {
          type: "apply_template_formatting",
          templateFormatting: { alignment: tPara.formatting.alignment },
        },
      });
    }

    // Compare paragraph style
    if (tPara.formatting.styleId !== dPara.formatting.styleId && tPara.formatting.styleId) {
      differences.push({
        id: uuidv4(),
        type: "style",
        description: `Paragraph style differs: "${tPara.formatting.styleName || tPara.formatting.styleId}" in template vs "${dPara.formatting.styleName || dPara.formatting.styleId || 'Normal'}" in draft`,
        templateValue: tPara.formatting.styleName || tPara.formatting.styleId || "Normal",
        draftValue: dPara.formatting.styleName || dPara.formatting.styleId || "Normal",
        severity: "high",
        location: {
          sectionId: draftSection.id,
          paragraphIndex: i,
          textSnippet: dPara.text.substring(0, 50),
        },
        fix: {
          type: "apply_template_style",
          templateFormatting: tPara.formatting,
        },
      });
    }

    // Compare spacing
    if (tPara.formatting.spacingAfter !== dPara.formatting.spacingAfter && tPara.formatting.spacingAfter) {
      differences.push({
        id: uuidv4(),
        type: "spacing",
        description: `Paragraph spacing after differs`,
        templateValue: `${tPara.formatting.spacingAfter}`,
        draftValue: `${dPara.formatting.spacingAfter || 0}`,
        severity: "low",
        location: {
          sectionId: draftSection.id,
          paragraphIndex: i,
          textSnippet: dPara.text.substring(0, 50),
        },
        fix: {
          type: "apply_template_formatting",
          templateFormatting: { spacingAfter: tPara.formatting.spacingAfter },
        },
      });
    }

    // Compare indent
    if (tPara.formatting.indentLeft !== dPara.formatting.indentLeft && tPara.formatting.indentLeft) {
      differences.push({
        id: uuidv4(),
        type: "indent",
        description: `Left indentation differs`,
        templateValue: `${tPara.formatting.indentLeft}`,
        draftValue: `${dPara.formatting.indentLeft || 0}`,
        severity: "low",
        location: {
          sectionId: draftSection.id,
          paragraphIndex: i,
          textSnippet: dPara.text.substring(0, 50),
        },
        fix: {
          type: "apply_template_formatting",
          templateFormatting: { indentLeft: tPara.formatting.indentLeft },
        },
      });
    }

    // Compare heading levels
    if (tPara.isHeading !== dPara.isHeading || tPara.headingLevel !== dPara.headingLevel) {
      if (tPara.isHeading) {
        differences.push({
          id: uuidv4(),
          type: "heading",
          description: `Heading level differs: Level ${tPara.headingLevel} in template vs ${dPara.isHeading ? `Level ${dPara.headingLevel}` : 'not a heading'} in draft`,
          templateValue: `Heading ${tPara.headingLevel}`,
          draftValue: dPara.isHeading ? `Heading ${dPara.headingLevel}` : "Normal",
          severity: "high",
          location: {
            sectionId: draftSection.id,
            paragraphIndex: i,
            textSnippet: dPara.text.substring(0, 50),
          },
          fix: {
            type: "apply_template_style",
            templateFormatting: tPara.formatting,
          },
        });
      }
    }

    // Compare text run formatting (font, bold, italic, etc.)
    const minRuns = Math.min(tPara.runs.length, dPara.runs.length);
    for (let j = 0; j < minRuns; j++) {
      const tRun = tPara.runs[j];
      const dRun = dPara.runs[j];

      // Bold
      if (tRun.formatting.bold !== dRun.formatting.bold) {
        differences.push({
          id: uuidv4(),
          type: "font",
          description: `Bold formatting differs for "${dRun.text.substring(0, 30)}..."`,
          templateValue: tRun.formatting.bold ? "Bold" : "Normal",
          draftValue: dRun.formatting.bold ? "Bold" : "Normal",
          severity: "medium",
          location: {
            sectionId: draftSection.id,
            paragraphIndex: i,
            textSnippet: dRun.text.substring(0, 50),
          },
          fix: {
            type: "apply_template_font",
            templateFormatting: { bold: tRun.formatting.bold },
          },
        });
      }

      // Italic
      if (tRun.formatting.italic !== dRun.formatting.italic) {
        differences.push({
          id: uuidv4(),
          type: "font",
          description: `Italic formatting differs for "${dRun.text.substring(0, 30)}..."`,
          templateValue: tRun.formatting.italic ? "Italic" : "Normal",
          draftValue: dRun.formatting.italic ? "Italic" : "Normal",
          severity: "medium",
          location: {
            sectionId: draftSection.id,
            paragraphIndex: i,
            textSnippet: dRun.text.substring(0, 50),
          },
          fix: {
            type: "apply_template_font",
            templateFormatting: { italic: tRun.formatting.italic },
          },
        });
      }

      // Font size
      if (tRun.formatting.fontSize !== dRun.formatting.fontSize && tRun.formatting.fontSize) {
        differences.push({
          id: uuidv4(),
          type: "font",
          description: `Font size differs: ${tRun.formatting.fontSize}pt in template vs ${dRun.formatting.fontSize || 'default'}pt in draft`,
          templateValue: `${tRun.formatting.fontSize}pt`,
          draftValue: `${dRun.formatting.fontSize || 'default'}pt`,
          severity: "high",
          location: {
            sectionId: draftSection.id,
            paragraphIndex: i,
            textSnippet: dRun.text.substring(0, 50),
          },
          fix: {
            type: "apply_template_font",
            templateFormatting: { fontSize: tRun.formatting.fontSize },
          },
        });
      }

      // Font family
      if (tRun.formatting.fontFamily !== dRun.formatting.fontFamily && tRun.formatting.fontFamily) {
        differences.push({
          id: uuidv4(),
          type: "font",
          description: `Font family differs: "${tRun.formatting.fontFamily}" in template vs "${dRun.formatting.fontFamily || 'default'}" in draft`,
          templateValue: tRun.formatting.fontFamily,
          draftValue: dRun.formatting.fontFamily || "default",
          severity: "high",
          location: {
            sectionId: draftSection.id,
            paragraphIndex: i,
            textSnippet: dRun.text.substring(0, 50),
          },
          fix: {
            type: "apply_template_font",
            templateFormatting: { fontFamily: tRun.formatting.fontFamily },
          },
        });
      }
    }
  }

  // Check for table differences
  if (templateSection.tables && draftSection.tables) {
    const tTables = templateSection.tables.length;
    const dTables = draftSection.tables.length;

    if (tTables !== dTables) {
      differences.push({
        id: uuidv4(),
        type: "table",
        description: `Table count differs: ${tTables} in template vs ${dTables} in draft`,
        templateValue: `${tTables} tables`,
        draftValue: `${dTables} tables`,
        severity: "high",
        location: {
          sectionId: draftSection.id,
        },
      });
    }
  }

  return differences;
}

// Analyze acronyms with AI to get definitions
async function analyzeAcronymsWithAI(
  acronyms: string[],
  documentContext: string
): Promise<Map<string, string>> {
  const definitions = new Map<string, string>();

  if (acronyms.length === 0) return definitions;

  try {
    const client = getAzureOpenAIClient();
    const deployment = getDeploymentName();

    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: "system",
          content: "You are an expert at identifying acronym definitions. Return JSON with acronym as key and likely definition as value. If unsure, provide the most common meaning in a business/SOW context."
        },
        {
          role: "user",
          content: `Given these acronyms found in an SOW document, provide likely definitions:\n\nAcronyms: ${acronyms.join(", ")}\n\nDocument context: ${documentContext.substring(0, 2000)}\n\nReturn JSON only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      for (const [acronym, definition] of Object.entries(parsed)) {
        definitions.set(acronym, definition as string);
      }
    }
  } catch (error) {
    console.error("Error analyzing acronyms with AI:", error);
  }

  return definitions;
}

// Analyze jargon with AI to identify non-standard terms
async function analyzeJargonWithAI(
  jargon: string[],
  templateTerms: string[],
  documentContext: string
): Promise<Map<string, { isStandard: boolean; alternatives?: string[] }>> {
  const analysis = new Map<string, { isStandard: boolean; alternatives?: string[] }>();

  if (jargon.length === 0) return analysis;

  try {
    const client = getAzureOpenAIClient();
    const deployment = getDeploymentName();

    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: "system",
          content: "You analyze business/SOW terminology. Return JSON with each term as key and an object with 'isStandard' (boolean) and 'alternatives' (array of better terms if not standard)."
        },
        {
          role: "user",
          content: `Analyze these terms from an SOW draft. Compare against template terms and identify if they're standard or should be replaced.\n\nDraft terms: ${jargon.join(", ")}\nTemplate terms: ${templateTerms.join(", ")}\n\nContext: ${documentContext.substring(0, 1500)}\n\nReturn JSON only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      for (const [term, info] of Object.entries(parsed)) {
        const typedInfo = info as { isStandard: boolean; alternatives?: string[] };
        analysis.set(term, {
          isStandard: typedInfo.isStandard,
          alternatives: typedInfo.alternatives,
        });
      }
    }
  } catch (error) {
    console.error("Error analyzing jargon with AI:", error);
  }

  return analysis;
}

// Main function to analyze formatting
export async function analyzeFormatting(
  templateBuffer: Buffer,
  templateFilename: string,
  draftBuffer: Buffer,
  draftFilename: string,
  templateSections: any[],
  draftSections: any[]
): Promise<FormattingAnalysis> {
  // Parse both documents with rich formatting
  const templateRich = await parseRichDocx(templateBuffer, templateFilename);
  const draftRich = await parseRichDocx(draftBuffer, draftFilename);

  const differences: FormattingDifference[] = [];

  // Convert to our types and build rich sections
  const templateRichSections: RichSection[] = templateRich.sections.map((s) => ({
    id: s.id,
    number: s.number || null,
    title: s.title || null,
    level: 1,
    body: s.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n"),
    paragraphs: s.paragraphs.map(convertRichParagraph),
    tables: s.tables?.map((t) => ({
      id: t.id,
      rows: t.rows.map((r) => ({
        cells: r.cells.map((c) => ({
          content: c.content.map(convertRichParagraph),
          colSpan: c.colSpan,
          rowSpan: c.rowSpan,
          shading: c.shading,
        })),
        height: r.height,
        isHeader: r.isHeader,
      })),
      columns: t.columns,
      style: t.style,
    })),
  }));

  const draftRichSections: RichSection[] = draftRich.sections.map((s) => ({
    id: s.id,
    number: s.number || null,
    title: s.title || null,
    level: 1,
    body: s.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n"),
    paragraphs: s.paragraphs.map(convertRichParagraph),
    tables: s.tables?.map((t) => ({
      id: t.id,
      rows: t.rows.map((r) => ({
        cells: r.cells.map((c) => ({
          content: c.content.map(convertRichParagraph),
          colSpan: c.colSpan,
          rowSpan: c.rowSpan,
          shading: c.shading,
        })),
        height: r.height,
        isHeader: r.isHeader,
      })),
      columns: t.columns,
      style: t.style,
    })),
  }));

  // Match sections and compare formatting
  for (const draftSection of draftRichSections) {
    // Find matching template section by title or number
    let matchedTemplate: RichSection | null = null;

    for (const templateSection of templateRichSections) {
      if (
        (draftSection.number && templateSection.number === draftSection.number) ||
        (draftSection.title && templateSection.title?.toLowerCase() === draftSection.title?.toLowerCase())
      ) {
        matchedTemplate = templateSection;
        break;
      }
    }

    // Compare formatting
    const sectionDiffs = compareSectionFormatting(matchedTemplate, draftSection);
    differences.push(...sectionDiffs);
  }

  // Extract and analyze acronyms
  const templateAcronyms = extractAcronymsFromRichDoc(templateRich);
  const draftAcronyms = extractAcronymsFromRichDoc(draftRich);

  const templateAcronymSet = new Set(templateAcronyms);
  const draftAcronymSet = new Set(draftAcronyms);

  // Get document text for AI context
  const draftText = draftRich.sections
    .map((s) => s.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join(" "))
    .join(" ");

  // Find undefined acronyms and get AI suggestions
  const undefinedAcronyms = draftAcronyms.filter((a) => !templateAcronymSet.has(a));
  const acronymDefinitions = await analyzeAcronymsWithAI(undefinedAcronyms, draftText);

  const acronyms: AcronymInfo[] = Array.from(draftAcronymSet).map((acronym) => {
    // Count occurrences
    const regex = new RegExp(`\\b${acronym}\\b`, "g");
    const occurrences = (draftText.match(regex) || []).length;

    // Find which sections contain this acronym
    const sectionIds = draftRichSections
      .filter((s) => s.body?.includes(acronym))
      .map((s) => s.id);

    return {
      acronym,
      occurrences,
      definedInTemplate: templateAcronymSet.has(acronym),
      definedInDraft: false, // Would need more analysis to determine
      suggestedDefinition: acronymDefinitions.get(acronym),
      sectionIds,
    };
  });

  // Extract and analyze jargon
  const templateJargon = extractJargonFromRichDoc(templateRich);
  const draftJargon = extractJargonFromRichDoc(draftRich);

  const jargonAnalysis = await analyzeJargonWithAI(draftJargon, templateJargon, draftText);

  const jargon: JargonInfo[] = Array.from(new Set(draftJargon)).map((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    const occurrences = (draftText.match(regex) || []).length;

    const sectionIds = draftRichSections
      .filter((s) => s.body?.toLowerCase().includes(term.toLowerCase()))
      .map((s) => s.id);

    const analysis = jargonAnalysis.get(term);

    return {
      term,
      occurrences,
      isStandard: analysis?.isStandard ?? true,
      alternativesInTemplate: analysis?.alternatives,
      sectionIds,
    };
  });

  // Calculate summary
  const highPriorityIssues = differences.filter((d) => d.severity === "high").length;
  const undefinedAcronymCount = acronyms.filter((a) => !a.definedInTemplate).length;
  const nonStandardJargonCount = jargon.filter((j) => !j.isStandard).length;

  return {
    differences,
    acronyms,
    jargon,
    summary: {
      totalFormattingIssues: differences.length,
      highPriorityIssues,
      undefinedAcronyms: undefinedAcronymCount,
      nonStandardJargon: nonStandardJargonCount,
    },
  };
}

// Apply template formatting to a paragraph (returns formatted XML snippet)
export function applyTemplateFormatting(
  draftParagraph: RichParagraph,
  templateFormatting: ParagraphFormatting | TextRunFormatting
): RichParagraph {
  const updated = { ...draftParagraph };

  // Apply paragraph formatting
  if ("alignment" in templateFormatting || "indentLeft" in templateFormatting) {
    updated.formatting = {
      ...updated.formatting,
      ...(templateFormatting as ParagraphFormatting),
    };
  }

  // Apply text run formatting
  if ("bold" in templateFormatting || "fontSize" in templateFormatting) {
    updated.runs = updated.runs.map((run) => ({
      ...run,
      formatting: {
        ...run.formatting,
        ...(templateFormatting as TextRunFormatting),
      },
    }));
  }

  return updated;
}
