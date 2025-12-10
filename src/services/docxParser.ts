import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import type { Section, ParsedSOW } from "@/types";

// Regex patterns for detecting section numbering
const SECTION_PATTERNS = [
  // 1. or 1.2 or 1.2.3
  /^(\d+(?:\.\d+)*)\.\s+(.+)$/,
  // I. or II. or III.
  /^([IVXLCDM]+)\.\s+(.+)$/i,
  // A. or B. or C.
  /^([A-Z])\.\s+(.+)$/,
  // (a) or (1) or (i)
  /^\(([a-z0-9ivx]+)\)\s+(.+)$/i,
  // SECTION 1 or Section 1.2
  /^(?:SECTION|Section)\s+(\d+(?:\.\d+)*)[:\.]?\s*(.*)$/i,
  // ARTICLE I or Article 1
  /^(?:ARTICLE|Article)\s+([IVXLCDM\d]+)[:\.]?\s*(.*)$/i,
];

// Common SOW section titles
const COMMON_SECTION_TITLES = [
  "scope of work",
  "scope of services",
  "deliverables",
  "timeline",
  "milestones",
  "payment terms",
  "pricing",
  "fees",
  "term and termination",
  "termination",
  "confidentiality",
  "intellectual property",
  "liability",
  "limitation of liability",
  "indemnification",
  "warranty",
  "warranties",
  "service level agreement",
  "sla",
  "acceptance criteria",
  "change management",
  "governance",
  "definitions",
  "background",
  "introduction",
  "overview",
  "assumptions",
  "dependencies",
  "exclusions",
  "appendix",
  "exhibit",
  "schedule",
];

function calculateSectionLevel(number: string | null): number {
  if (!number) return 1;

  // Count dots for numeric sections
  const dotCount = (number.match(/\./g) || []).length;
  if (dotCount > 0) return dotCount + 1;

  // Roman numerals are usually top level
  if (/^[IVXLCDM]+$/i.test(number)) return 1;

  // Single letters are usually second level
  if (/^[A-Z]$/i.test(number)) return 2;

  // Parenthetical numbers are usually third level
  if (/^\([a-z0-9ivx]+\)$/i.test(number)) return 3;

  return 1;
}

function parseParagraphAsSection(text: string, index: number): Section | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 3) return null;

  // Try to match against section patterns
  for (const pattern of SECTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const number = match[1];
      const title = match[2]?.trim() || null;
      const level = calculateSectionLevel(number);

      return {
        id: uuidv4(),
        number,
        title,
        level,
        body: trimmed,
        startIndex: index,
      };
    }
  }

  // Check if it looks like a section title (all caps or title case, short)
  const isLikelyTitle =
    (trimmed === trimmed.toUpperCase() && trimmed.length < 100) ||
    COMMON_SECTION_TITLES.some(t => trimmed.toLowerCase().includes(t));

  if (isLikelyTitle && trimmed.length < 150) {
    return {
      id: uuidv4(),
      number: null,
      title: trimmed,
      level: 1,
      body: trimmed,
      startIndex: index,
    };
  }

  return null;
}

function extractSections(text: string): Section[] {
  const sections: Section[] = [];

  // Normalize line endings and split by paragraphs
  // Handle both single and double newlines - treat double+ newlines as paragraph breaks
  const normalizedText = text.replace(/\r\n/g, '\n');

  // Split by one or more newlines to get paragraphs
  const paragraphs = normalizedText.split(/\n+/).filter(p => p.trim());

  let currentSection: Section | null = null;
  let currentBody: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;

    // Only detect as a new section if paragraph looks like a section header
    // (short text that matches section patterns)
    const isLikelyHeader = para.length < 200;
    const potentialSection = isLikelyHeader ? parseParagraphAsSection(para, i) : null;

    if (potentialSection) {
      // Save the previous section with accumulated body
      if (currentSection) {
        // Join body paragraphs with double newlines for proper spacing
        currentSection.body = currentBody.join("\n\n");
        currentSection.endIndex = i - 1;
        sections.push(currentSection);
      }

      currentSection = potentialSection;
      // Don't include the header in the body - body starts empty
      currentBody = [];
    } else if (currentSection) {
      // Add to current section body
      currentBody.push(para);
    } else {
      // No current section, create a generic one
      currentSection = {
        id: uuidv4(),
        number: null,
        title: "Introduction",
        level: 1,
        body: "",
        startIndex: i,
      };
      currentBody = [para];
    }
  }

  // Don't forget the last section
  if (currentSection) {
    currentSection.body = currentBody.join("\n\n");
    currentSection.endIndex = paragraphs.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

function extractMetadata(text: string): ParsedSOW["metadata"] {
  const metadata: ParsedSOW["metadata"] = {};

  // Try to extract title (usually first line or after "SOW" or "Statement of Work")
  const titleMatch = text.match(/(?:Statement of Work|SOW)[:\s]*(.+?)(?:\n|$)/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim();
  }

  // Extract vendor name
  const vendorMatch = text.match(/(?:Vendor|Provider|Contractor)[:\s]*(.+?)(?:\n|$)/i);
  if (vendorMatch) {
    metadata.vendor = vendorMatch[1].trim();
  }

  // Extract client name
  const clientMatch = text.match(/(?:Client|Customer|Buyer)[:\s]*(.+?)(?:\n|$)/i);
  if (clientMatch) {
    metadata.client = clientMatch[1].trim();
  }

  // Extract effective date
  const dateMatch = text.match(/(?:Effective Date|Start Date)[:\s]*(.+?)(?:\n|$)/i);
  if (dateMatch) {
    metadata.effectiveDate = dateMatch[1].trim();
  }

  // Extract total value
  const valueMatch = text.match(/(?:Total Value|Contract Value|Total Amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (valueMatch) {
    metadata.totalValue = valueMatch[1].trim();
  }

  return metadata;
}

export async function parseDocx(buffer: Buffer, filename: string): Promise<ParsedSOW> {
  try {
    // Extract text from DOCX using mammoth
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value;

    // Parse sections from the text
    const sections = extractSections(rawText);

    // Extract metadata
    const metadata = extractMetadata(rawText);

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
