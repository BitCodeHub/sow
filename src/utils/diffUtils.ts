import { diffWords, diffSentences } from "diff";

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface DiffResult {
  parts: DiffPart[];
  hasChanges: boolean;
  addedCount: number;
  removedCount: number;
}

/**
 * Compare two text strings and return diff parts
 */
export function computeTextDiff(oldText: string, newText: string, mode: "words" | "sentences" = "words"): DiffResult {
  const diffFn = mode === "words" ? diffWords : diffSentences;
  const parts = diffFn(oldText || "", newText || "");

  let addedCount = 0;
  let removedCount = 0;
  let hasChanges = false;

  for (const part of parts) {
    if (part.added) {
      addedCount++;
      hasChanges = true;
    }
    if (part.removed) {
      removedCount++;
      hasChanges = true;
    }
  }

  return {
    parts,
    hasChanges,
    addedCount,
    removedCount,
  };
}

/**
 * Extract acronyms from text (2-6 uppercase letters)
 */
export function extractAcronyms(text: string): Set<string> {
  const acronymRegex = /\b([A-Z]{2,6})\b/g;
  const acronyms = new Set<string>();
  let match;

  while ((match = acronymRegex.exec(text)) !== null) {
    // Filter out common words that happen to be uppercase
    const commonWords = new Set(["THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HAD", "HER", "WAS", "ONE", "OUR", "OUT"]);
    if (!commonWords.has(match[1])) {
      acronyms.add(match[1]);
    }
  }

  return acronyms;
}

/**
 * Check if an acronym is defined in the text (e.g., "API (Application Programming Interface)")
 */
export function isAcronymDefined(text: string, acronym: string): boolean {
  // Look for patterns like "API (Application..." or "(API)" after the definition
  const definitionPatterns = [
    new RegExp(`${acronym}\\s*\\([^)]+\\)`, "i"),  // API (Application...)
    new RegExp(`\\([^)]*${acronym}[^)]*\\)`, "i"), // (Application Programming Interface, API)
    new RegExp(`"${acronym}"`, "i"),                // "API"
    new RegExp(`${acronym}\\s*[-–—:]\\s*\\w+`, "i"), // API - Application...
  ];

  return definitionPatterns.some(pattern => pattern.test(text));
}

/**
 * Analyze acronyms between template and draft
 */
export interface AcronymAnalysis {
  acronym: string;
  inTemplate: boolean;
  inDraft: boolean;
  definedInTemplate: boolean;
  definedInDraft: boolean;
  status: "ok" | "undefined" | "new" | "missing";
}

export function analyzeAcronyms(templateText: string, draftText: string): AcronymAnalysis[] {
  const templateAcronyms = extractAcronyms(templateText);
  const draftAcronyms = extractAcronyms(draftText);

  const allAcronyms = new Set([...templateAcronyms, ...draftAcronyms]);
  const results: AcronymAnalysis[] = [];

  for (const acronym of allAcronyms) {
    const inTemplate = templateAcronyms.has(acronym);
    const inDraft = draftAcronyms.has(acronym);
    const definedInTemplate = inTemplate && isAcronymDefined(templateText, acronym);
    const definedInDraft = inDraft && isAcronymDefined(draftText, acronym);

    let status: AcronymAnalysis["status"] = "ok";

    if (inDraft && !inTemplate) {
      status = definedInDraft ? "new" : "undefined";
    } else if (inTemplate && !inDraft) {
      status = "missing";
    } else if (inDraft && !definedInDraft && !definedInTemplate) {
      status = "undefined";
    }

    results.push({
      acronym,
      inTemplate,
      inDraft,
      definedInTemplate,
      definedInDraft,
      status,
    });
  }

  // Sort: undefined first, then new, then missing, then ok
  const statusOrder = { undefined: 0, new: 1, missing: 2, ok: 3 };
  results.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return results;
}

/**
 * Calculate similarity score between two strings (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 100;
  if (!str1 || !str2) return 0;

  const words1 = str1.toLowerCase().split(/\s+/).filter(Boolean);
  const words2 = str2.toLowerCase().split(/\s+/).filter(Boolean);

  if (words1.length === 0 && words2.length === 0) return 100;
  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let matches = 0;
  for (const word of set1) {
    if (set2.has(word)) matches++;
  }

  const union = new Set([...set1, ...set2]).size;
  return Math.round((matches / union) * 100);
}

/**
 * Extract key terms (deliverables, dates, amounts) from text
 */
export interface ExtractedTerms {
  amounts: string[];
  dates: string[];
  deliverables: string[];
}

export function extractKeyTerms(text: string): ExtractedTerms {
  // Extract monetary amounts
  const amountRegex = /\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)/gi;
  const amounts = text.match(amountRegex) || [];

  // Extract dates
  const dateRegex = /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})\b/gi;
  const dates = text.match(dateRegex) || [];

  // Extract potential deliverables (capitalized phrases, items after bullets/numbers)
  const deliverableRegex = /(?:^|\n)\s*(?:[-•*]|\d+\.|\([a-z]\))\s*([^\n]+)/gi;
  const deliverableMatches = text.match(deliverableRegex) || [];
  const deliverables = deliverableMatches.map(d => d.replace(/^[\s\-•*\d.()a-z]+/i, "").trim()).filter(d => d.length > 5);

  return {
    amounts: [...new Set(amounts)],
    dates: [...new Set(dates)],
    deliverables: [...new Set(deliverables)].slice(0, 20), // Limit to 20
  };
}
