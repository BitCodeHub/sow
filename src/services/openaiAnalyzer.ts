import { AzureOpenAI } from "openai";
import { v4 as uuidv4 } from "uuid";
import type {
  Section,
  ParsedSOW,
  Issue,
  IssueCategory,
  SectionAnalysis,
  GlobalAnalysis,
  AnalysisResult,
  Severity,
  IssueType,
} from "@/types";
import { matchSections } from "./docxParser";

// Lazy-initialize Azure OpenAI client to avoid build-time errors
let azureClient: AzureOpenAI | null = null;

function getAzureOpenAIClient(): AzureOpenAI {
  if (!azureClient) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

    if (!endpoint || !apiKey) {
      throw new Error("Azure OpenAI environment variables are not configured (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY)");
    }

    azureClient = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
    });
  }
  return azureClient;
}

// Get the deployment name from environment
function getDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1";
}

// System prompt for SOW analysis
const SYSTEM_PROMPT = `You are an expert contract reviewer.
You analyze Statements of Work (SOWs) by comparing a draft SOW against a template/reference SOW section by section.
You must return your analysis in valid JSON only, with no additional text or markdown formatting.

IMPORTANT CONTEXT:
- Project costs, deliverable dates, and timeline specifics are EXPECTED to differ between template and draft as they vary by project scope - do NOT flag these as issues unless they seem unreasonable or inconsistent
- Focus on identifying DISCREPANCIES in legal language, terms, conditions, and structure
- Identify any ACRONYMS used in the draft that are not defined or not present in the template
- Check for missing DELIVERABLES or scope items that were in the template but removed from draft
- Flag any LEGAL CLAUSE changes (liability, termination, IP, indemnification, confidentiality)

Key analysis areas:
1. DELIVERABLES - Flag if deliverables are removed, significantly modified, or have unclear acceptance criteria
2. LEGAL CLAUSES - Any changes to liability caps, indemnification, termination rights, IP ownership, confidentiality
3. TERMS & CONDITIONS - Changes to payment terms structure, warranty periods, support commitments
4. LANGUAGE CLARITY - Undefined acronyms, vague language ("reasonable", "as needed"), inconsistent terminology
5. STRUCTURE - Missing required sections, wrong section ordering, missing standard boilerplate
6. SERVICE LEVELS - Changes to SLAs, KPIs, or performance metrics

Things to IGNORE or mark as LOW severity:
- Different dollar amounts (expected to vary by scope)
- Different dates/timelines (expected to vary by project)
- Minor formatting differences
- Stylistic wording changes that don't affect meaning

Severity guidelines:
- HIGH: Legal clause changes, removed/changed liability protection, missing critical deliverables, undefined key terms
- MEDIUM: Structural issues, vague language in important sections, undefined acronyms, inconsistent terminology
- LOW: Minor formatting issues, stylistic suggestions, informational notes`;

// JSON schema for section analysis response
const SECTION_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    section_id: { type: "string" },
    severity_overall: { type: "string", enum: ["high", "medium", "low"] },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: [
              "deliverable_added", "deliverable_removed", "deliverable_modified",
              "amount_changed", "date_changed", "legal_clause_changed",
              "sla_changed", "undefined_acronym", "vague_language",
              "inconsistent_terminology", "missing_section", "extra_section",
              "formatting_issue", "boilerplate_missing", "scope_expansion", "scope_reduction"
            ]
          },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          description: { type: "string" },
          old_text_snippet: { type: "string" },
          new_text_snippet: { type: "string" },
          category: {
            type: "string",
            enum: ["legal_risk", "financial", "deliverables_scope", "language_clarity", "formatting_structure"]
          }
        },
        required: ["type", "severity", "description", "category"]
      }
    },
    suggested_revision: { type: "string" },
    notes_for_legal_review: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["section_id", "severity_overall", "issues", "notes_for_legal_review"]
};

const GLOBAL_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    scope_change: { type: "string", enum: ["expanded", "reduced", "unchanged"] },
    scope_change_description: { type: "string" },
    total_value_change: {
      type: "object",
      properties: {
        old_value: { type: "string" },
        new_value: { type: "string" },
        percent_change: { type: "number" }
      }
    },
    timeline_changes: {
      type: "array",
      items: { type: "string" }
    },
    critical_red_flags: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string" }
  },
  required: ["scope_change", "critical_red_flags", "summary"]
};

function mapIssueCategory(category: string): IssueCategory {
  const mapping: Record<string, IssueCategory> = {
    legal_risk: "legal_risk",
    financial: "financial",
    deliverables_scope: "deliverables_scope",
    language_clarity: "language_clarity",
    formatting_structure: "formatting_structure",
  };
  return mapping[category] || "deliverables_scope";
}

async function analyzeSectionPair(
  templateSection: Section | null,
  newSection: Section,
  context: { projectName?: string; company?: string }
): Promise<SectionAnalysis> {
  const userContent = JSON.stringify({
    context: {
      project_name: context.projectName || "SOW Project",
      company: context.company || "Company"
    },
    template_section: templateSection ? {
      id: templateSection.id,
      number: templateSection.number,
      title: templateSection.title,
      body: templateSection.body.substring(0, 3000) // Limit for token usage
    } : null,
    new_section: {
      id: newSection.id,
      number: newSection.number,
      title: newSection.title,
      body: newSection.body.substring(0, 3000)
    }
  });

  try {
    const client = getAzureOpenAIClient();
    const deployment = getDeploymentName();
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Analyze this SOW section comparison and return JSON matching this schema: ${JSON.stringify(SECTION_ANALYSIS_SCHEMA)}\n\nSection data:\n${userContent}`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from Azure OpenAI");
    }

    const parsed = JSON.parse(content);

    // Transform the response into our internal format
    return {
      sectionId: newSection.id,
      matchedOldSectionId: templateSection?.id,
      severityOverall: parsed.severity_overall as Severity,
      issues: parsed.issues.map((issue: Record<string, unknown>) => ({
        id: uuidv4(),
        type: issue.type as IssueType,
        severity: issue.severity as Severity,
        sectionId: newSection.id,
        description: issue.description as string,
        oldTextSnippet: issue.old_text_snippet as string | undefined,
        newTextSnippet: issue.new_text_snippet as string | undefined,
        suggestedRevision: issue.suggested_revision as string | undefined,
        category: mapIssueCategory(issue.category as string),
      })),
      suggestedRevision: parsed.suggested_revision,
      notesForLegalReview: parsed.notes_for_legal_review || [],
    };
  } catch (error) {
    console.error("Error analyzing section:", error);
    // Return a minimal analysis on error
    return {
      sectionId: newSection.id,
      matchedOldSectionId: templateSection?.id,
      severityOverall: "low",
      issues: [],
      notesForLegalReview: [],
    };
  }
}

async function analyzeGlobal(
  templateSow: ParsedSOW,
  newSow: ParsedSOW
): Promise<GlobalAnalysis> {
  // Create summaries of both documents
  const templateSummary = templateSow.sections
    .map(s => `${s.number || ""} ${s.title || ""}: ${s.body.substring(0, 200)}...`)
    .join("\n");

  const newSummary = newSow.sections
    .map(s => `${s.number || ""} ${s.title || ""}: ${s.body.substring(0, 200)}...`)
    .join("\n");

  const userContent = JSON.stringify({
    template_document: {
      filename: templateSow.filename,
      metadata: templateSow.metadata,
      section_count: templateSow.sections.length,
      summary: templateSummary.substring(0, 4000)
    },
    new_document: {
      filename: newSow.filename,
      metadata: newSow.metadata,
      section_count: newSow.sections.length,
      summary: newSummary.substring(0, 4000)
    }
  });

  try {
    const client = getAzureOpenAIClient();
    const deployment = getDeploymentName();
    const response = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Perform a global document-level analysis comparing these two SOWs. Return JSON matching this schema: ${JSON.stringify(GLOBAL_ANALYSIS_SCHEMA)}\n\nDocuments:\n${userContent}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from Azure OpenAI");
    }

    const parsed = JSON.parse(content);

    return {
      scopeChange: parsed.scope_change,
      scopeChangeDescription: parsed.scope_change_description,
      totalValueChange: parsed.total_value_change ? {
        oldValue: parsed.total_value_change.old_value,
        newValue: parsed.total_value_change.new_value,
        percentChange: parsed.total_value_change.percent_change,
      } : undefined,
      timelineChanges: parsed.timeline_changes,
      criticalRedFlags: parsed.critical_red_flags || [],
      summary: parsed.summary,
    };
  } catch (error) {
    console.error("Error in global analysis:", error);
    // Provide more context about the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate");
    const isTimeout = errorMessage.toLowerCase().includes("timeout") || errorMessage.includes("ETIMEDOUT");
    const isAuth = errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.toLowerCase().includes("auth");

    let summary = "Unable to complete global analysis.";
    if (isRateLimit) {
      summary = "Global analysis skipped due to API rate limiting. Please wait a moment and try again.";
    } else if (isTimeout) {
      summary = "Global analysis timed out. The documents may be too large for analysis.";
    } else if (isAuth) {
      summary = "Global analysis failed due to authentication issues. Please check API credentials.";
    } else {
      summary = `Global analysis encountered an error: ${errorMessage.substring(0, 100)}`;
    }

    return {
      scopeChange: "unchanged",
      criticalRedFlags: [],
      summary,
    };
  }
}

export async function analyzeSOWs(
  templateSow: ParsedSOW,
  newSow: ParsedSOW
): Promise<AnalysisResult> {
  // Match sections between template and new SOW
  const sectionMatches = matchSections(templateSow.sections, newSow.sections);

  // Analyze each section in the new SOW
  const sectionAnalyses: SectionAnalysis[] = [];
  const allIssues: Issue[] = [];

  // Process sections in batches of 3 for efficiency
  const batchSize = 3;
  for (let i = 0; i < newSow.sections.length; i += batchSize) {
    const batch = newSow.sections.slice(i, i + batchSize);
    const batchPromises = batch.map(async (newSection) => {
      const matchedTemplateId = sectionMatches.get(newSection.id);
      const templateSection = matchedTemplateId
        ? templateSow.sections.find(s => s.id === matchedTemplateId) || null
        : null;

      return analyzeSectionPair(templateSection, newSection, {
        projectName: newSow.metadata?.title,
        company: "Company"
      });
    });

    const batchResults = await Promise.all(batchPromises);
    for (const analysis of batchResults) {
      sectionAnalyses.push(analysis);
      allIssues.push(...analysis.issues);
    }
  }

  // Perform global analysis
  const globalAnalysis = await analyzeGlobal(templateSow, newSow);

  // Count issues by severity
  const issueCounts = {
    high: allIssues.filter(i => i.severity === "high").length,
    medium: allIssues.filter(i => i.severity === "medium").length,
    low: allIssues.filter(i => i.severity === "low").length,
  };

  // Group issues by category
  const categoryBreakdown: Record<IssueCategory, Issue[]> = {
    legal_risk: [],
    financial: [],
    deliverables_scope: [],
    language_clarity: [],
    formatting_structure: [],
  };

  for (const issue of allIssues) {
    categoryBreakdown[issue.category].push(issue);
  }

  return {
    id: uuidv4(),
    templateSowId: templateSow.id,
    newSowId: newSow.id,
    analyzedAt: new Date().toISOString(),
    globalAnalysis,
    sectionAnalyses,
    allIssues,
    issueCounts,
    categoryBreakdown,
  };
}
