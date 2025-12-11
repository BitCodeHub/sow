"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Type,
  AlignLeft,
  List,
  Table,
  Heading,
  Sparkles,
  Info,
  BookOpen,
  Zap,
  Loader2,
} from "lucide-react";
import type {
  FormattingAnalysis,
  FormattingDifference,
  AcronymInfo,
  JargonInfo,
  ParsedSOW,
  Section,
} from "@/types";

interface FormattingPanelProps {
  analysis: FormattingAnalysis;
  templateSow: ParsedSOW;
  draftSow: ParsedSOW;
  onApplyFix: (differenceId: string) => void;
  onApplyAllFixes: () => void;
  isApplying?: boolean;
}

// Icon mapping for formatting types
const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  style: FileText,
  font: Type,
  alignment: AlignLeft,
  spacing: List,
  indent: AlignLeft,
  list: List,
  table: Table,
  heading: Heading,
};

const severityConfig = {
  high: {
    bg: "bg-[rgba(244,33,46,0.1)]",
    border: "border-[rgba(244,33,46,0.3)]",
    text: "text-[--accent-red]",
    badge: "badge-high",
  },
  medium: {
    bg: "bg-[rgba(255,217,61,0.1)]",
    border: "border-[rgba(255,217,61,0.3)]",
    text: "text-[--accent-yellow]",
    badge: "badge-medium",
  },
  low: {
    bg: "bg-[rgba(29,155,240,0.1)]",
    border: "border-[rgba(29,155,240,0.3)]",
    text: "text-[--accent-blue]",
    badge: "badge-low",
  },
};

// Formatting Difference Card
function FormattingDiffCard({
  diff,
  onApplyFix,
  isApplying,
}: {
  diff: FormattingDifference;
  onApplyFix: (id: string) => void;
  isApplying: boolean;
}) {
  const Icon = typeIcons[diff.type] || FileText;
  const severity = severityConfig[diff.severity];

  return (
    <div className={`p-3 rounded-lg border ${severity.bg} ${severity.border}`}>
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded ${severity.bg}`}>
          <Icon className={`w-4 h-4 ${severity.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${severity.badge}`}>{diff.severity}</span>
            <span className="text-xs text-[--text-muted] capitalize">{diff.type}</span>
          </div>
          <p className="text-sm text-[--text-primary] mb-2">{diff.description}</p>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[--text-muted]">Template: </span>
              <span className="text-[--accent-green] font-medium">{diff.templateValue}</span>
            </div>
            <div>
              <span className="text-[--text-muted]">Draft: </span>
              <span className="text-[--accent-red] font-medium">{diff.draftValue}</span>
            </div>
          </div>
          {diff.location.textSnippet && (
            <div className="mt-2 p-2 bg-[--bg-primary] rounded text-xs text-[--text-secondary] italic">
              &ldquo;{diff.location.textSnippet}...&rdquo;
            </div>
          )}
        </div>
        {diff.fix && (
          <button
            onClick={() => onApplyFix(diff.id)}
            disabled={isApplying}
            className="btn-success text-xs flex items-center gap-1 flex-shrink-0"
          >
            {isApplying ? (
              <Loader2 className="w-3 h-3 spinner" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Apply Fix
          </button>
        )}
      </div>
    </div>
  );
}

// Acronym Card
function AcronymCard({ acronym }: { acronym: AcronymInfo }) {
  const isUndefined = !acronym.definedInTemplate;

  return (
    <div
      className={`p-3 rounded-lg border ${
        isUndefined
          ? "bg-[rgba(255,217,61,0.1)] border-[rgba(255,217,61,0.3)]"
          : "bg-[--bg-tertiary] border-[--border-color]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-[--text-primary]">{acronym.acronym}</span>
          {isUndefined && (
            <span className="badge badge-medium text-xs">Not in template</span>
          )}
        </div>
        <span className="text-xs text-[--text-muted]">{acronym.occurrences} uses</span>
      </div>
      {acronym.suggestedDefinition && (
        <div className="flex items-start gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-[--accent-purple] flex-shrink-0 mt-0.5" />
          <span className="text-[--text-secondary]">{acronym.suggestedDefinition}</span>
        </div>
      )}
    </div>
  );
}

// Jargon Card
function JargonCard({ jargon }: { jargon: JargonInfo }) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        !jargon.isStandard
          ? "bg-[rgba(255,217,61,0.1)] border-[rgba(255,217,61,0.3)]"
          : "bg-[--bg-tertiary] border-[--border-color]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[--text-primary] capitalize">{jargon.term}</span>
          {!jargon.isStandard && (
            <span className="badge badge-medium text-xs">Non-standard</span>
          )}
        </div>
        <span className="text-xs text-[--text-muted]">{jargon.occurrences} uses</span>
      </div>
      {jargon.alternativesInTemplate && jargon.alternativesInTemplate.length > 0 && (
        <div className="text-sm">
          <span className="text-[--text-muted]">Alternatives: </span>
          <span className="text-[--accent-green]">
            {jargon.alternativesInTemplate.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

// Section comparison card for side-by-side view
function SectionComparisonCard({
  templateSection,
  draftSection,
  differences,
  onApplyFix,
  isApplying,
}: {
  templateSection: Section;
  draftSection: Section;
  differences: FormattingDifference[];
  onApplyFix: (id: string) => void;
  isApplying: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasDifferences = differences.length > 0;

  return (
    <div className={`card overflow-hidden ${hasDifferences ? 'border-[--accent-yellow]/30' : ''}`}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[--text-muted]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[--text-muted]" />
          )}
          <div>
            <h4 className="font-medium text-[--text-primary]">
              {templateSection.number ? `${templateSection.number}. ` : ""}
              {templateSection.title || "Untitled Section"}
            </h4>
          </div>
        </div>
        {hasDifferences && (
          <span className="badge badge-medium text-xs">
            {differences.length} formatting {differences.length === 1 ? 'issue' : 'issues'}
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-[--border-color]">
          {/* Side-by-side content comparison */}
          <div className="grid grid-cols-2 gap-0 divide-x divide-[--border-color]">
            {/* Template side */}
            <div className="p-3">
              <div className="text-xs font-semibold text-[--accent-green] uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Template (Reference)
              </div>
              <div className="p-3 bg-[--bg-primary] rounded-lg border border-[--border-color] min-h-[80px] max-h-[200px] overflow-y-auto">
                {templateSection.body && templateSection.body.trim() ? (
                  <div className="text-sm text-[--text-primary] leading-relaxed whitespace-pre-wrap">
                    {templateSection.body}
                  </div>
                ) : (
                  <div className="text-sm text-[--text-muted] italic text-center py-2">
                    No content
                  </div>
                )}
              </div>
            </div>

            {/* Draft side */}
            <div className="p-3">
              <div className="text-xs font-semibold text-[--accent-blue] uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Draft (Your Version)
              </div>
              <div className="p-3 bg-[--bg-primary] rounded-lg border border-[--border-color] min-h-[80px] max-h-[200px] overflow-y-auto">
                {draftSection.body && draftSection.body.trim() ? (
                  <div className="text-sm text-[--text-primary] leading-relaxed whitespace-pre-wrap">
                    {draftSection.body}
                  </div>
                ) : (
                  <div className="text-sm text-[--text-muted] italic text-center py-2">
                    No content
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formatting differences for this section */}
          {hasDifferences && (
            <div className="border-t border-[--border-color] p-3 bg-[--bg-tertiary]">
              <h5 className="text-xs font-semibold text-[--accent-yellow] uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Formatting Issues in This Section
              </h5>
              <div className="space-y-2">
                {differences.map((diff) => (
                  <div key={diff.id} className="p-2 bg-[--bg-primary] rounded-lg border border-[--border-color]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${severityConfig[diff.severity].badge} text-xs`}>
                            {diff.severity}
                          </span>
                          <span className="text-xs text-[--text-muted] capitalize">{diff.type}</span>
                        </div>
                        <p className="text-sm text-[--text-primary]">{diff.description}</p>
                        <div className="flex items-center gap-4 text-xs mt-1">
                          <div>
                            <span className="text-[--text-muted]">Template: </span>
                            <span className="text-[--accent-green] font-medium">{diff.templateValue}</span>
                          </div>
                          <div>
                            <span className="text-[--text-muted]">Draft: </span>
                            <span className="text-[--accent-red] font-medium">{diff.draftValue}</span>
                          </div>
                        </div>
                      </div>
                      {diff.fix && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplyFix(diff.id);
                          }}
                          disabled={isApplying}
                          className="btn-success text-xs flex items-center gap-1 flex-shrink-0"
                        >
                          {isApplying ? (
                            <Loader2 className="w-3 h-3 spinner" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Fix
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Match sections between template and draft
function matchSections(
  templateSections: Section[],
  draftSections: Section[]
): { templateSection: Section; draftSection: Section }[] {
  const matches: { templateSection: Section; draftSection: Section }[] = [];

  for (const draftSection of draftSections) {
    let bestMatch: Section | null = null;
    let bestScore = 0;

    for (const templateSection of templateSections) {
      let score = 0;

      // Exact number match is highest priority
      if (draftSection.number && templateSection.number) {
        if (draftSection.number === templateSection.number) {
          score += 100;
        } else if (
          draftSection.number.startsWith(templateSection.number) ||
          templateSection.number.startsWith(draftSection.number)
        ) {
          score += 50;
        }
      }

      // Title similarity
      if (draftSection.title && templateSection.title) {
        const draftTitle = draftSection.title.toLowerCase();
        const templateTitle = templateSection.title.toLowerCase();

        if (draftTitle === templateTitle) {
          score += 80;
        } else if (draftTitle.includes(templateTitle) || templateTitle.includes(draftTitle)) {
          score += 40;
        }
      }

      // Level match
      if (draftSection.level === templateSection.level) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = templateSection;
      }
    }

    if (bestMatch) {
      matches.push({ templateSection: bestMatch, draftSection });
    }
  }

  return matches;
}

// Main Formatting Panel
export default function FormattingPanel({
  analysis,
  templateSow,
  draftSow,
  onApplyFix,
  onApplyAllFixes,
  isApplying = false,
}: FormattingPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["comparison", "formatting", "acronyms"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const { differences, acronyms, jargon, summary } = analysis;

  // Match sections between template and draft
  const sectionMatches = matchSections(templateSow.sections, draftSow.sections);

  // Group differences by section ID
  const diffsBySectionId = differences.reduce((acc, diff) => {
    const sectionId = diff.location.sectionId;
    if (!acc[sectionId]) acc[sectionId] = [];
    acc[sectionId].push(diff);
    return acc;
  }, {} as Record<string, FormattingDifference[]>);

  // Group differences by type
  const diffsByType = differences.reduce((acc, diff) => {
    if (!acc[diff.type]) acc[diff.type] = [];
    acc[diff.type].push(diff);
    return acc;
  }, {} as Record<string, FormattingDifference[]>);

  // Filter significant items
  const undefinedAcronyms = acronyms.filter((a) => !a.definedInTemplate);
  const nonStandardJargon = jargon.filter((j) => !j.isStandard);
  const fixableDiffs = differences.filter((d) => d.fix);

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[--accent-purple]/10">
              <Zap className="w-5 h-5 text-[--accent-purple]" />
            </div>
            <div>
              <h3 className="font-semibold text-[--text-primary]">Formatting Analysis</h3>
              <p className="text-sm text-[--text-secondary]">
                {summary.totalFormattingIssues} formatting issues •{" "}
                {summary.undefinedAcronyms} undefined acronyms •{" "}
                {summary.nonStandardJargon} non-standard terms
              </p>
            </div>
          </div>
          {fixableDiffs.length > 0 && (
            <button
              onClick={onApplyAllFixes}
              disabled={isApplying}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 spinner" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Apply All Template Formatting ({fixableDiffs.length})
            </button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-[--bg-primary] border border-[--border-color]">
            <div className="text-2xl font-bold text-[--accent-red]">
              {summary.highPriorityIssues}
            </div>
            <div className="text-xs text-[--text-muted]">High Priority</div>
          </div>
          <div className="p-3 rounded-lg bg-[--bg-primary] border border-[--border-color]">
            <div className="text-2xl font-bold text-[--text-primary]">
              {summary.totalFormattingIssues}
            </div>
            <div className="text-xs text-[--text-muted]">Total Issues</div>
          </div>
          <div className="p-3 rounded-lg bg-[--bg-primary] border border-[--border-color]">
            <div className="text-2xl font-bold text-[--accent-yellow]">
              {summary.undefinedAcronyms}
            </div>
            <div className="text-xs text-[--text-muted]">Undefined Acronyms</div>
          </div>
          <div className="p-3 rounded-lg bg-[--bg-primary] border border-[--border-color]">
            <div className="text-2xl font-bold text-[--accent-blue]">
              {summary.nonStandardJargon}
            </div>
            <div className="text-xs text-[--text-muted]">Non-standard Terms</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Content Comparison */}
      <div className="card overflow-hidden">
        <div
          onClick={() => toggleSection("comparison")}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[--accent-green]" />
            <div>
              <h4 className="font-semibold text-[--text-primary]">
                Side-by-Side Comparison
              </h4>
              <p className="text-sm text-[--text-secondary]">
                Compare template and draft content section by section
              </p>
            </div>
          </div>
          {expandedSections.has("comparison") ? (
            <ChevronDown className="w-5 h-5 text-[--text-muted]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[--text-muted]" />
          )}
        </div>

        {expandedSections.has("comparison") && (
          <div className="border-t border-[--border-color] p-4 space-y-4">
            {sectionMatches.length > 0 ? (
              sectionMatches.map(({ templateSection, draftSection }) => (
                <SectionComparisonCard
                  key={draftSection.id}
                  templateSection={templateSection}
                  draftSection={draftSection}
                  differences={diffsBySectionId[draftSection.id] || []}
                  onApplyFix={onApplyFix}
                  isApplying={isApplying}
                />
              ))
            ) : (
              <div className="text-center py-8 text-[--text-muted]">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No matching sections found between template and draft.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formatting Differences Section */}
      {differences.length > 0 && (
        <div className="card overflow-hidden">
          <div
            onClick={() => toggleSection("formatting")}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Type className="w-5 h-5 text-[--accent-blue]" />
              <div>
                <h4 className="font-semibold text-[--text-primary]">
                  Formatting Differences
                </h4>
                <p className="text-sm text-[--text-secondary]">
                  {differences.length} differences found
                </p>
              </div>
            </div>
            {expandedSections.has("formatting") ? (
              <ChevronDown className="w-5 h-5 text-[--text-muted]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[--text-muted]" />
            )}
          </div>

          {expandedSections.has("formatting") && (
            <div className="border-t border-[--border-color] p-4 space-y-3">
              {Object.entries(diffsByType).map(([type, diffs]) => (
                <div key={type}>
                  <h5 className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2 flex items-center gap-2">
                    {React.createElement(typeIcons[type] || FileText, {
                      className: "w-3 h-3",
                    })}
                    {type} ({diffs.length})
                  </h5>
                  <div className="space-y-2">
                    {diffs.map((diff) => (
                      <FormattingDiffCard
                        key={diff.id}
                        diff={diff}
                        onApplyFix={onApplyFix}
                        isApplying={isApplying}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Acronyms Section */}
      {acronyms.length > 0 && (
        <div className="card overflow-hidden">
          <div
            onClick={() => toggleSection("acronyms")}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-[--accent-yellow]" />
              <div>
                <h4 className="font-semibold text-[--text-primary]">Acronyms</h4>
                <p className="text-sm text-[--text-secondary]">
                  {acronyms.length} found • {undefinedAcronyms.length} not in template
                </p>
              </div>
            </div>
            {expandedSections.has("acronyms") ? (
              <ChevronDown className="w-5 h-5 text-[--text-muted]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[--text-muted]" />
            )}
          </div>

          {expandedSections.has("acronyms") && (
            <div className="border-t border-[--border-color] p-4">
              {undefinedAcronyms.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-[--accent-yellow] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Not in Template ({undefinedAcronyms.length})
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {undefinedAcronyms.map((a) => (
                      <AcronymCard key={a.acronym} acronym={a} />
                    ))}
                  </div>
                </div>
              )}

              {acronyms.filter((a) => a.definedInTemplate).length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2">
                    Defined in Template
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {acronyms
                      .filter((a) => a.definedInTemplate)
                      .map((a) => (
                        <span
                          key={a.acronym}
                          className="px-2 py-1 bg-[--bg-tertiary] rounded text-sm text-[--text-secondary] font-mono"
                        >
                          {a.acronym}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Jargon Section */}
      {jargon.length > 0 && (
        <div className="card overflow-hidden">
          <div
            onClick={() => toggleSection("jargon")}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-[--accent-purple]" />
              <div>
                <h4 className="font-semibold text-[--text-primary]">
                  Terminology & Jargon
                </h4>
                <p className="text-sm text-[--text-secondary]">
                  {jargon.length} terms • {nonStandardJargon.length} non-standard
                </p>
              </div>
            </div>
            {expandedSections.has("jargon") ? (
              <ChevronDown className="w-5 h-5 text-[--text-muted]" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[--text-muted]" />
            )}
          </div>

          {expandedSections.has("jargon") && (
            <div className="border-t border-[--border-color] p-4">
              {nonStandardJargon.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-xs font-semibold text-[--accent-yellow] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Non-standard Terms ({nonStandardJargon.length})
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {nonStandardJargon.map((j) => (
                      <JargonCard key={j.term} jargon={j} />
                    ))}
                  </div>
                </div>
              )}

              {jargon.filter((j) => j.isStandard).length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2">
                    Standard Terms
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {jargon
                      .filter((j) => j.isStandard)
                      .map((j) => (
                        <span
                          key={j.term}
                          className="px-2 py-1 bg-[--bg-tertiary] rounded text-sm text-[--text-secondary] capitalize"
                        >
                          {j.term}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Issues */}
      {differences.length === 0 && acronyms.length === 0 && jargon.length === 0 && (
        <div className="card p-8 text-center">
          <Check className="w-12 h-12 text-[--accent-green] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[--text-primary]">
            Formatting Looks Good!
          </h3>
          <p className="text-[--text-secondary]">
            No significant formatting differences detected between template and draft.
          </p>
        </div>
      )}
    </div>
  );
}
