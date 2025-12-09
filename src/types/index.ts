// Core SOW section structure
export interface Section {
  id: string;
  number: string | null;
  title: string | null;
  level: number;
  body: string;
  startIndex?: number;
  endIndex?: number;
}

// Parsed SOW document
export interface ParsedSOW {
  id: string;
  filename: string;
  uploadedAt: string;
  sections: Section[];
  rawText: string;
  metadata?: {
    title?: string;
    vendor?: string;
    client?: string;
    effectiveDate?: string;
    totalValue?: string;
  };
}

// Issue types that can be flagged
export type IssueType =
  | "deliverable_added"
  | "deliverable_removed"
  | "deliverable_modified"
  | "amount_changed"
  | "date_changed"
  | "legal_clause_changed"
  | "sla_changed"
  | "undefined_acronym"
  | "vague_language"
  | "inconsistent_terminology"
  | "missing_section"
  | "extra_section"
  | "formatting_issue"
  | "boilerplate_missing"
  | "scope_expansion"
  | "scope_reduction";

// Severity levels
export type Severity = "high" | "medium" | "low";

// Individual issue found during analysis
export interface Issue {
  id: string;
  type: IssueType;
  severity: Severity;
  sectionId: string;
  description: string;
  oldTextSnippet?: string;
  newTextSnippet?: string;
  suggestedRevision?: string;
  category: IssueCategory;
}

// Issue categories for grouping in UI
export type IssueCategory =
  | "legal_risk"
  | "financial"
  | "deliverables_scope"
  | "language_clarity"
  | "formatting_structure";

// Section-level analysis result
export interface SectionAnalysis {
  sectionId: string;
  matchedOldSectionId?: string;
  severityOverall: Severity;
  issues: Issue[];
  suggestedRevision?: string;
  notesForLegalReview: string[];
}

// Global/document-level analysis
export interface GlobalAnalysis {
  scopeChange: "expanded" | "reduced" | "unchanged";
  scopeChangeDescription?: string;
  totalValueChange?: {
    oldValue?: string;
    newValue?: string;
    percentChange?: number;
  };
  timelineChanges?: string[];
  criticalRedFlags: string[];
  summary: string;
}

// Complete analysis result
export interface AnalysisResult {
  id: string;
  templateSowId: string;
  newSowId: string;
  analyzedAt: string;
  globalAnalysis: GlobalAnalysis;
  sectionAnalyses: SectionAnalysis[];
  allIssues: Issue[];
  issueCounts: {
    high: number;
    medium: number;
    low: number;
  };
  categoryBreakdown: Record<IssueCategory, Issue[]>;
}

// API response types
export interface UploadResponse {
  success: boolean;
  sow?: ParsedSOW;
  error?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  analysis?: AnalysisResult;
  error?: string;
}

// UI State types
export interface AppState {
  templateSow: ParsedSOW | null;
  newSow: ParsedSOW | null;
  analysis: AnalysisResult | null;
  isUploading: boolean;
  isAnalyzing: boolean;
  selectedIssue: Issue | null;
  selectedSectionId: string | null;
  editedSections: Record<string, string>;
}

// Rich formatting types
export interface TextRunFormatting {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  highlight?: string;
}

export interface ParagraphFormatting {
  alignment?: "left" | "center" | "right" | "justify";
  indentLeft?: number;
  indentRight?: number;
  indentFirstLine?: number;
  spacingBefore?: number;
  spacingAfter?: number;
  lineSpacing?: number;
  styleId?: string;
  styleName?: string;
  outlineLevel?: number;
}

export interface FormattingDifference {
  id: string;
  type: "style" | "font" | "alignment" | "spacing" | "indent" | "list" | "table" | "heading";
  description: string;
  templateValue: string;
  draftValue: string;
  severity: "high" | "medium" | "low";
  location: {
    sectionId: string;
    paragraphIndex?: number;
    textSnippet?: string;
  };
  fix?: {
    type: "apply_template_style" | "apply_template_formatting" | "apply_template_font";
    templateFormatting: ParagraphFormatting | TextRunFormatting;
  };
}

export interface AcronymInfo {
  acronym: string;
  occurrences: number;
  definedInTemplate: boolean;
  definedInDraft: boolean;
  suggestedDefinition?: string;
  sectionIds: string[];
}

export interface JargonInfo {
  term: string;
  occurrences: number;
  isStandard: boolean;
  alternativesInTemplate?: string[];
  sectionIds: string[];
}

export interface FormattingAnalysis {
  differences: FormattingDifference[];
  acronyms: AcronymInfo[];
  jargon: JargonInfo[];
  summary: {
    totalFormattingIssues: number;
    highPriorityIssues: number;
    undefinedAcronyms: number;
    nonStandardJargon: number;
  };
}

// Extended analysis result with formatting
export interface ExtendedAnalysisResult extends AnalysisResult {
  formattingAnalysis?: FormattingAnalysis;
}

// Rich parsed section with formatting
export interface RichSection extends Section {
  paragraphs?: RichParagraph[];
  tables?: RichTable[];
}

export interface RichParagraph {
  id: string;
  text: string;
  formatting: ParagraphFormatting;
  runs: RichTextRun[];
  isHeading?: boolean;
  headingLevel?: number;
  listLevel?: number;
  listType?: "bullet" | "number";
}

export interface RichTextRun {
  text: string;
  formatting: TextRunFormatting;
}

export interface RichTable {
  id: string;
  rows: RichTableRow[];
  columns: number;
  style?: string;
}

export interface RichTableRow {
  cells: RichTableCell[];
  height?: number;
  isHeader?: boolean;
}

export interface RichTableCell {
  content: RichParagraph[];
  colSpan?: number;
  rowSpan?: number;
  shading?: string;
}

// Extended parsed SOW with rich formatting
export interface RichParsedSOW extends ParsedSOW {
  richSections?: RichSection[];
  documentStyles?: Record<string, ParagraphFormatting>;
}
