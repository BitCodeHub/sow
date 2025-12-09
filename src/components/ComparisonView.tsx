"use client";

import { useMemo, useState } from "react";
import SectionPairView from "./SectionPairView";
import AcronymPanel from "./AcronymPanel";
import type { ParsedSOW, Issue, AnalysisResult, Section } from "@/types";
import { calculateSimilarity } from "@/utils/diffUtils";
import {
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import clsx from "clsx";

interface ComparisonViewProps {
  templateSow: ParsedSOW;
  newSow: ParsedSOW;
  analysis: AnalysisResult;
  selectedSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
  editedSections: Record<string, string>;
  onEdit: (sectionId: string, content: string) => void;
  onApplySuggestion: (sectionId: string, suggestion: string) => void;
}

interface SectionPair {
  templateSection: Section | null;
  draftSection: Section;
  matchScore: number;
  issues: Issue[];
}

export default function ComparisonView({
  templateSow,
  newSow,
  analysis,
  selectedSectionId,
  onSectionClick,
  editedSections,
  onEdit,
  onApplySuggestion,
}: ComparisonViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(true);

  // Group issues by section
  const issuesBySectionId = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of analysis.allIssues) {
      const existing = map.get(issue.sectionId) || [];
      existing.push(issue);
      map.set(issue.sectionId, existing);
    }
    return map;
  }, [analysis.allIssues]);

  // Create matched section pairs
  const sectionPairs = useMemo((): SectionPair[] => {
    const pairs: SectionPair[] = [];
    const usedTemplateIds = new Set<string>();

    // For each draft section, find the best matching template section
    for (const draftSection of newSow.sections) {
      let bestMatch: Section | null = null;
      let bestScore = 0;

      for (const templateSection of templateSow.sections) {
        if (usedTemplateIds.has(templateSection.id)) continue;

        let score = 0;

        // Exact number match
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
          const titleSimilarity = calculateSimilarity(
            draftSection.title,
            templateSection.title
          );
          score += titleSimilarity * 0.8;
        }

        // Content similarity (weighted less)
        const contentSimilarity = calculateSimilarity(
          draftSection.body.substring(0, 500),
          templateSection.body.substring(0, 500)
        );
        score += contentSimilarity * 0.2;

        // Level match bonus
        if (draftSection.level === templateSection.level) {
          score += 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = templateSection;
        }
      }

      // Only match if score is reasonable
      if (bestMatch && bestScore >= 30) {
        usedTemplateIds.add(bestMatch.id);
      } else {
        bestMatch = null;
        bestScore = 0;
      }

      pairs.push({
        templateSection: bestMatch,
        draftSection,
        matchScore: bestScore,
        issues: issuesBySectionId.get(draftSection.id) || [],
      });
    }

    return pairs;
  }, [templateSow.sections, newSow.sections, issuesBySectionId]);

  // Get full text for acronym analysis
  const templateFullText = useMemo(
    () => templateSow.sections.map((s) => s.body).join("\n\n"),
    [templateSow]
  );
  const draftFullText = useMemo(
    () => newSow.sections.map((s) => s.body).join("\n\n"),
    [newSow]
  );

  // Count stats
  const stats = useMemo(() => {
    const matched = sectionPairs.filter((p) => p.templateSection).length;
    const unmatched = sectionPairs.filter((p) => !p.templateSection).length;
    const withIssues = sectionPairs.filter((p) => p.issues.length > 0).length;

    return { matched, unmatched, withIssues, total: sectionPairs.length };
  }, [sectionPairs]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (expandAll) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(sectionPairs.map((p) => p.draftSection.id)));
    }
    setExpandAll(!expandAll);
  };

  const isSectionExpanded = (sectionId: string) => {
    if (expandAll && expandedSections.size === 0) return true;
    return expandedSections.has(sectionId);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Section-by-Section Comparison
            </h2>
            <p className="text-sm text-gray-500">
              Template: <span className="font-medium">{templateSow.filename}</span>
              {" vs "}
              Draft: <span className="font-medium">{newSow.filename}</span>
            </p>
          </div>

          <button
            onClick={handleExpandAll}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Layers className="w-4 h-4" />
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              <span className="font-medium text-gray-900">{stats.total}</span> sections
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600">
              <span className="font-medium text-gray-900">{stats.matched}</span> matched
            </span>
          </div>
          {stats.unmatched > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-gray-600">
                <span className="font-medium text-gray-900">{stats.unmatched}</span> new
              </span>
            </div>
          )}
          {stats.withIssues > 0 && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600">
                <span className="font-medium text-gray-900">{stats.withIssues}</span> with issues
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Acronym Panel */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <AcronymPanel templateText={templateFullText} draftText={draftFullText} />
      </div>

      {/* Section Pairs List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sectionPairs.map((pair) => (
          <SectionPairView
            key={pair.draftSection.id}
            templateSection={pair.templateSection}
            draftSection={pair.draftSection}
            issues={pair.issues}
            isExpanded={isSectionExpanded(pair.draftSection.id)}
            onToggleExpand={() => toggleSection(pair.draftSection.id)}
            isHighlighted={selectedSectionId === pair.draftSection.id}
            editedContent={editedSections[pair.draftSection.id]}
            onEdit={onEdit}
            onApplySuggestion={onApplySuggestion}
          />
        ))}

        {/* Unmatched Template Sections */}
        {(() => {
          const matchedTemplateIds = new Set(
            sectionPairs
              .filter((p) => p.templateSection)
              .map((p) => p.templateSection!.id)
          );
          const unmatchedTemplateSections = templateSow.sections.filter(
            (s) => !matchedTemplateIds.has(s.id)
          );

          if (unmatchedTemplateSections.length === 0) return null;

          return (
            <div className="border border-red-200 rounded-lg overflow-hidden bg-red-50">
              <div className="px-4 py-3 bg-red-100 border-b border-red-200">
                <h3 className="font-medium text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Missing Sections from Draft
                </h3>
                <p className="text-sm text-red-600">
                  These sections exist in the template but are missing from the draft
                </p>
              </div>
              <div className="p-4 space-y-2">
                {unmatchedTemplateSections.map((section) => (
                  <div
                    key={section.id}
                    className="p-3 bg-white rounded-lg border border-red-200"
                  >
                    <h4 className="font-medium text-gray-900">
                      {section.number
                        ? `${section.number}. ${section.title || ""}`
                        : section.title || "Untitled Section"}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {section.body.substring(0, 200)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
