import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import type { Section, ParsedSOW } from "@/types";

// Regex patterns for detecting section numbering
const SECTION_PATTERNS = [
  // 1. or 1.2 or 1.2.3 followed by title
  /^(\d+(?:\.\d+)*)\.\s+(.+)$/,
  // SECTION 1 or Section 1.2
  /^(?:SECTION|Section)\s+(\d+(?:\.\d+)*)[:\.]?\s*(.*)$/i,
  // ARTICLE I or Article 1
  /^(?:ARTICLE|Article)\s+([IVXLCDM\d]+)[:\.]?\s*(.*)$/i,
];

// Common SOW section titles that indicate a new section
const SECTION_TITLE_PATTERNS = [
  /^(executive\s+summary)$/i,
  /^(scope\s+of\s+work)$/i,
  /^(scope\s+of\s+services)$/i,
  /^(deliverables)$/i,
  /^(timeline|milestones?)$/i,
  /^(payment\s+terms?|pricing|fees?)$/i,
  /^(terms?\s+and\s+termination|termination)$/i,
  /^(confidentiality)$/i,
  /^(intellectual\s+property)$/i,
  /^(liability|limitation\s+of\s+liability)$/i,
  /^(indemnification)$/i,
  /^(warrant(?:y|ies))$/i,
  /^(service\s+level\s+agreement|sla)$/i,
  /^(acceptance\s+criteria)$/i,
  /^(definitions?)$/i,
  /^(background|introduction|overview)$/i,
  /^(assumptions|dependencies|exclusions)$/i,
  /^(appendix|exhibit|schedule)\s*[a-z0-9]*$/i,
];

function calculateSectionLevel(number: string | null): number {
  if (!number) return 1;
  const dotCount = (number.match(/\./g) || []).length;
  if (dotCount > 0) return dotCount + 1;
  if (/^[IVXLCDM]+$/i.test(number)) return 1;
  return 1;
}

// Strip HTML tags and decode entities
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Check if text looks like a TOC entry (ends with page number pattern)
function isTocEntry(text: string): boolean {
  // TOC entries often end with dots and page numbers like "Executive Summary.....6"
  return /[.·…]{3,}\s*\d+\s*$/.test(text) || /\t+\d+\s*$/.test(text);
}

// Check if a paragraph is a section header
function detectSectionHeader(text: string): { number: string | null; title: string } | null {
  const trimmed = text.trim();

  // Skip empty, very short, or very long text
  if (!trimmed || trimmed.length < 3 || trimmed.length > 150) return null;

  // Skip TOC entries
  if (isTocEntry(trimmed)) return null;

  // Try numbered section patterns
  for (const pattern of SECTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        number: match[1],
        title: match[2]?.trim() || "Untitled",
      };
    }
  }

  // Try title-only patterns (must be short and match exactly)
  if (trimmed.length < 60) {
    for (const pattern of SECTION_TITLE_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          number: null,
          title: trimmed,
        };
      }
    }

    // All uppercase short text is likely a section header
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)) {
      return {
        number: null,
        title: trimmed,
      };
    }
  }

  return null;
}

function extractSectionsFromHtml(html: string): Section[] {
  const sections: Section[] = [];

  // Extract paragraph content from HTML
  // Match <p>, <h1>-<h6>, <li> tags and their content
  const paragraphRegex = /<(?:p|h[1-6]|li)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li)>/gi;
  const paragraphs: string[] = [];

  let match;
  while ((match = paragraphRegex.exec(html)) !== null) {
    const content = stripHtml(match[1]);
    if (content) {
      paragraphs.push(content);
    }
  }

  // If no paragraphs found via HTML parsing, fall back to line-by-line
  if (paragraphs.length === 0) {
    const plainText = stripHtml(html);
    paragraphs.push(...plainText.split(/\n+/).filter(p => p.trim()));
  }

  let currentSection: Section | null = null;
  let currentBody: string[] = [];
  let tocSectionDetected = false;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect and skip Table of Contents section
    if (/^table\s+of\s+contents$/i.test(trimmed) || /^contents$/i.test(trimmed)) {
      tocSectionDetected = true;
      continue;
    }

    // Skip TOC entries
    if (tocSectionDetected && isTocEntry(trimmed)) {
      continue;
    }

    // End TOC detection when we hit a real section
    if (tocSectionDetected && !isTocEntry(trimmed) && trimmed.length > 60) {
      tocSectionDetected = false;
    }

    // Check if this is a section header
    const headerInfo = detectSectionHeader(trimmed);

    if (headerInfo) {
      // End TOC detection on first real section header after TOC
      tocSectionDetected = false;

      // Save previous section
      if (currentSection) {
        currentSection.body = currentBody.join("\n\n");
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        id: uuidv4(),
        number: headerInfo.number,
        title: headerInfo.title,
        level: calculateSectionLevel(headerInfo.number),
        body: "",
        startIndex: sections.length,
      };
      currentBody = [];
    } else if (currentSection) {
      // Add to current section body (skip if still in TOC)
      if (!tocSectionDetected) {
        currentBody.push(trimmed);
      }
    } else {
      // No section yet, create introduction section
      currentSection = {
        id: uuidv4(),
        number: null,
        title: "Introduction",
        level: 1,
        body: "",
        startIndex: 0,
      };
      currentBody = [trimmed];
    }
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.body = currentBody.join("\n\n");
    sections.push(currentSection);
  }

  return sections;
}

function extractMetadata(text: string): ParsedSOW["metadata"] {
  const metadata: ParsedSOW["metadata"] = {};

  const titleMatch = text.match(/(?:Statement of Work|SOW)[:\s]*(.+?)(?:\n|$)/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  const vendorMatch = text.match(/(?:Vendor|Provider|Contractor)[:\s]*(.+?)(?:\n|$)/i);
  if (vendorMatch) {
    metadata.vendor = vendorMatch[1].trim();
  }

  const clientMatch = text.match(/(?:Client|Customer|Buyer)[:\s]*(.+?)(?:\n|$)/i);
  if (clientMatch) {
    metadata.client = clientMatch[1].trim();
  }

  const dateMatch = text.match(/(?:Effective Date|Start Date)[:\s]*(.+?)(?:\n|$)/i);
  if (dateMatch) {
    metadata.effectiveDate = dateMatch[1].trim();
  }

  const valueMatch = text.match(/(?:Total Value|Contract Value|Total Amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (valueMatch) {
    metadata.totalValue = valueMatch[1].trim();
  }

  return metadata;
}

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParsedSOW> {
  try {
    // Convert to HTML first for better structure preservation
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;

    // Also get raw text for metadata extraction
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;

    // Parse sections from HTML
    const sections = extractSectionsFromHtml(html);

    // Extract metadata from raw text
    const metadata = extractMetadata(rawText);

    // Log for debugging (remove in production)
    console.log(`Parsed ${sections.length} sections from ${filename}`);
    sections.forEach((s, i) => {
      console.log(`  Section ${i + 1}: "${s.number ? s.number + '. ' : ''}${s.title}" - Body length: ${s.body.length} chars`);
    });

    return {
      id: uuidv4(),
      filename,
      uploadedAt: new Date().toISOString(),
      sections,
      rawText,
      metadata,
    };
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error(`Failed to parse DOCX file: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// Match sections between template and new SOW
export function matchSections(templateSections: Section[], newSections: Section[]): Map<string, string | null> {
  const matches = new Map<string, string | null>();

  for (const newSection of newSections) {
    let bestMatch: Section | null = null;
    let bestScore = 0;

    for (const templateSection of templateSections) {
      let score = 0;

      // Exact number match is highest priority
      if (newSection.number && templateSection.number) {
        if (newSection.number === templateSection.number) {
          score += 100;
        } else if (newSection.number.startsWith(templateSection.number) ||
                   templateSection.number.startsWith(newSection.number)) {
          score += 50;
        }
      }

      // Title similarity
      if (newSection.title && templateSection.title) {
        const newTitle = newSection.title.toLowerCase();
        const templateTitle = templateSection.title.toLowerCase();

        if (newTitle === templateTitle) {
          score += 80;
        } else if (newTitle.includes(templateTitle) || templateTitle.includes(newTitle)) {
          score += 40;
        }
      }

      // Level match
      if (newSection.level === templateSection.level) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = templateSection;
      }
    }

    matches.set(newSection.id, bestMatch?.id || null);
  }

  return matches;
}
