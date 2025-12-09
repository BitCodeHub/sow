"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  Info,
  Sparkles,
  X,
  Check,
  Eye,
  ArrowRight,
  Zap,
  Scale,
  DollarSign,
  Target,
  MessageSquare,
  LayoutList,
  TrendingUp,
  TrendingDown,
  Minus,
  Flag,
} from "lucide-react";
import type { ParsedSOW, AnalysisResult, Issue, Section } from "@/types";
import { computeTextDiff, type DiffPart } from "@/utils/diffUtils";

interface ReviewDashboardProps {
  templateSow: ParsedSOW;
  draftSow: ParsedSOW;
  analysis: AnalysisResult;
  editedSections: Record<string, string>;
  onEdit: (sectionId: string, content: string) => void;
}

interface SectionMatch {
  draftSection: Section;
  templateSection: Section | null;
  issues: Issue[];
  status: "ok" | "warning" | "error" | "new";
  isResolved: boolean;
}

// Category icons mapping
const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  legal_risk: Scale,
  financial: DollarSign,
  deliverables_scope: Target,
  language_clarity: MessageSquare,
  formatting_structure: LayoutList,
};

const categoryLabels: Record<string, string> = {
  legal_risk: "Legal Risk",
  financial: "Financial",
  deliverables_scope: "Deliverables & Scope",
  language_clarity: "Language Clarity",
  formatting_structure: "Formatting & Structure",
};

// AI Analysis Summary Panel
function AnalysisSummary({ analysis }: { analysis: AnalysisResult }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { globalAnalysis, issueCounts, categoryBreakdown } = analysis;

  const scopeIcon = globalAnalysis.scopeChange === "expanded"
    ? TrendingUp
    : globalAnalysis.scopeChange === "reduced"
    ? TrendingDown
    : Minus;

  const scopeColor = globalAnalysis.scopeChange === "expanded"
    ? "text-[--accent-yellow]"
    : globalAnalysis.scopeChange === "reduced"
    ? "text-[--accent-red]"
    : "text-[--accent-green]";

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[--accent-purple]/10">
            <Zap className="w-5 h-5 text-[--accent-purple]" />
          </div>
          <div>
            <h3 className="font-semibold text-[--text-primary]">AI Analysis Summary</h3>
            <p className="text-sm text-[--text-secondary]">
              {issueCounts.high} high • {issueCounts.medium} medium • {issueCounts.low} low priority issues
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-[--text-muted]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[--text-muted]" />
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[--border-color]">
          {/* Global Analysis */}
          <div className="p-4 bg-[--bg-primary]/50 border-b border-[--border-color]">
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Scope Change */}
              <div className="p-3 rounded-lg bg-[--bg-secondary] border border-[--border-color]">
                <div className="flex items-center gap-2 mb-1">
                  {React.createElement(scopeIcon, { className: `w-4 h-4 ${scopeColor}` })}
                  <span className="text-xs font-medium text-[--text-muted] uppercase">Scope Change</span>
                </div>
                <p className={`text-lg font-semibold capitalize ${scopeColor}`}>
                  {globalAnalysis.scopeChange}
                </p>
                {globalAnalysis.scopeChangeDescription && (
                  <p className="text-xs text-[--text-secondary] mt-1">
                    {globalAnalysis.scopeChangeDescription}
                  </p>
                )}
              </div>

              {/* Value Change */}
              {globalAnalysis.totalValueChange && (
                <div className="p-3 rounded-lg bg-[--bg-secondary] border border-[--border-color]">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-[--accent-green]" />
                    <span className="text-xs font-medium text-[--text-muted] uppercase">Value Change</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[--text-muted] line-through">
                      {globalAnalysis.totalValueChange.oldValue}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[--text-muted]" />
                    <span className="text-lg font-semibold text-[--text-primary]">
                      {globalAnalysis.totalValueChange.newValue}
                    </span>
                  </div>
                  {globalAnalysis.totalValueChange.percentChange !== undefined && (
                    <p className={`text-xs mt-1 ${
                      globalAnalysis.totalValueChange.percentChange > 0
                        ? "text-[--accent-yellow]"
                        : globalAnalysis.totalValueChange.percentChange < 0
                        ? "text-[--accent-green]"
                        : "text-[--text-muted]"
                    }`}>
                      {globalAnalysis.totalValueChange.percentChange > 0 ? "+" : ""}
                      {globalAnalysis.totalValueChange.percentChange.toFixed(1)}% change
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* AI Summary */}
            {globalAnalysis.summary && (
              <div className="p-3 rounded-lg bg-[--bg-secondary] border border-[--border-color]">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[--accent-purple] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[--text-secondary] leading-relaxed">
                    {globalAnalysis.summary}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Red Flags */}
          {globalAnalysis.criticalRedFlags && globalAnalysis.criticalRedFlags.length > 0 && (
            <div className="p-4 bg-[rgba(244,33,46,0.05)] border-b border-[--border-color]">
              <h4 className="text-sm font-semibold text-[--accent-red] mb-3 flex items-center gap-2">
                <Flag className="w-4 h-4" />
                Critical Red Flags ({globalAnalysis.criticalRedFlags.length})
              </h4>
              <ul className="space-y-2">
                {globalAnalysis.criticalRedFlags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-[--accent-red] flex-shrink-0 mt-0.5" />
                    <span className="text-[--text-primary]">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issue Breakdown by Category */}
          <div className="p-4">
            <h4 className="text-sm font-semibold text-[--text-muted] mb-3 uppercase tracking-wider">
              Issues by Category
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(categoryBreakdown).map(([category, issues]) => {
                const Icon = categoryIcons[category] || FileText;
                const count = issues.length;
                const highCount = issues.filter(i => i.severity === "high").length;

                return (
                  <div
                    key={category}
                    className={`p-3 rounded-lg border transition-colors ${
                      count > 0
                        ? highCount > 0
                          ? "bg-[rgba(244,33,46,0.05)] border-[rgba(244,33,46,0.2)]"
                          : "bg-[--bg-tertiary] border-[--border-light]"
                        : "bg-[--bg-primary] border-[--border-color] opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-4 h-4 ${
                        highCount > 0 ? "text-[--accent-red]" : count > 0 ? "text-[--accent-yellow]" : "text-[--text-muted]"
                      }`} />
                      <span className={`text-lg font-bold ${
                        highCount > 0 ? "text-[--accent-red]" : count > 0 ? "text-[--text-primary]" : "text-[--text-muted]"
                      }`}>
                        {count}
                      </span>
                    </div>
                    <p className="text-xs text-[--text-muted] leading-tight">
                      {categoryLabels[category]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced word-based diff display with legend
function DiffDisplay({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = computeTextDiff(oldText, newText, "words");

  if (!diff.hasChanges) {
    return (
      <div className="text-sm">
        <div className="flex items-center gap-2 mb-2 text-[--accent-green]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-medium">No changes detected</span>
        </div>
        <p className="text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
          {newText}
        </p>
      </div>
    );
  }

  const addedCount = diff.parts.filter(p => p.added).length;
  const removedCount = diff.parts.filter(p => p.removed).length;

  return (
    <div className="text-sm">
      {/* Change summary legend */}
      <div className="flex items-center gap-4 mb-3 pb-2 border-b border-[--border-color]">
        {removedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[rgba(244,33,46,0.3)] border border-[rgba(244,33,46,0.5)]" />
            <span className="text-xs text-[--text-muted]">{removedCount} removed</span>
          </div>
        )}
        {addedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[rgba(0,186,124,0.3)] border border-[rgba(0,186,124,0.5)]" />
            <span className="text-xs text-[--text-muted]">{addedCount} added</span>
          </div>
        )}
      </div>

      {/* Diff content */}
      <div className="leading-relaxed whitespace-pre-wrap">
        {diff.parts.map((part, i) => {
          if (part.removed) {
            return (
              <span key={i} className="diff-removed mx-0.5 inline-block my-0.5">
                {part.value}
              </span>
            );
          }
          if (part.added) {
            return (
              <span key={i} className="diff-added mx-0.5 inline-block my-0.5">
                {part.value}
              </span>
            );
          }
          return <span key={i} className="text-[--text-secondary]">{part.value}</span>;
        })}
      </div>
    </div>
  );
}

// Individual section review card
function SectionCard({
  match,
  isExpanded,
  onToggle,
  editedContent,
  onEdit,
  onMarkResolved,
}: {
  match: SectionMatch;
  isExpanded: boolean;
  onToggle: () => void;
  editedContent?: string;
  onEdit: (content: string) => void;
  onMarkResolved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(editedContent || match.draftSection.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalContent(editedContent || match.draftSection.body);
  }, [editedContent, match.draftSection.body]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const sectionTitle = match.draftSection.number
    ? `${match.draftSection.number}. ${match.draftSection.title || "Untitled"}`
    : match.draftSection.title || "Untitled Section";

  const statusConfig = {
    ok: { icon: CheckCircle2, color: "text-[--accent-green]", bg: "section-indicator-ok", label: "OK" },
    warning: { icon: AlertTriangle, color: "text-[--accent-yellow]", bg: "section-indicator-warning", label: "Review" },
    error: { icon: AlertCircle, color: "text-[--accent-red]", bg: "section-indicator-error", label: "Issues" },
    new: { icon: Info, color: "text-[--accent-purple]", bg: "section-indicator-new", label: "New" },
  };

  const config = statusConfig[match.status];
  const StatusIcon = config.icon;

  const handleSave = () => {
    onEdit(localContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalContent(editedContent || match.draftSection.body);
    setIsEditing(false);
  };

  const handleUseTemplate = () => {
    if (match.templateSection) {
      setLocalContent(match.templateSection.body);
      onEdit(match.templateSection.body);
    }
  };

  return (
    <div className={`card overflow-hidden transition-all duration-200 ${match.isResolved ? 'opacity-60' : ''}`}>
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[--bg-tertiary] transition-colors"
      >
        {/* Status indicator */}
        <div className={`section-indicator self-stretch ${config.bg}`} />

        {/* Expand/collapse */}
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-[--text-muted] flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[--text-muted] flex-shrink-0" />
        )}

        {/* Title and status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[--text-primary] truncate">{sectionTitle}</h3>
            {match.isResolved && (
              <span className="badge status-ok">Resolved</span>
            )}
          </div>
          {!match.templateSection && (
            <p className="text-sm text-[--accent-purple]">New section - not in template</p>
          )}
        </div>

        {/* Issue count */}
        {match.issues.length > 0 && !match.isResolved && (
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>
              {match.issues.length} {match.issues.length === 1 ? "issue" : "issues"}
            </span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[--border-color]">
          {/* Issues list - shown prominently at top if any */}
          {match.issues.length > 0 && !match.isResolved && (
            <div className="p-4 bg-[--bg-primary] border-b border-[--border-color]">
              <h4 className="text-sm font-semibold text-[--accent-red] mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Issues to Fix
              </h4>
              <div className="space-y-2">
                {match.issues.map((issue, idx) => (
                  <div
                    key={issue.id}
                    className={`p-3 rounded-lg border ${
                      issue.severity === "high"
                        ? "bg-[rgba(244,33,46,0.05)] border-[rgba(244,33,46,0.2)]"
                        : issue.severity === "medium"
                        ? "bg-[rgba(255,217,61,0.05)] border-[rgba(255,217,61,0.2)]"
                        : "bg-[rgba(29,155,240,0.05)] border-[rgba(29,155,240,0.2)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`badge ${
                        issue.severity === "high" ? "badge-high" :
                        issue.severity === "medium" ? "badge-medium" : "badge-low"
                      }`}>
                        {issue.severity}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-[--text-primary]">{issue.description}</p>
                        {issue.suggestedRevision && (
                          <div className="mt-2 p-2 bg-[--bg-secondary] rounded border border-[--border-color]">
                            <div className="flex items-center gap-1 text-xs text-[--accent-blue] mb-1">
                              <Sparkles className="w-3 h-3" />
                              AI Suggestion
                            </div>
                            <p className="text-xs text-[--text-secondary]">
                              {issue.suggestedRevision.substring(0, 200)}
                              {issue.suggestedRevision.length > 200 && "..."}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocalContent(issue.suggestedRevision!);
                                onEdit(issue.suggestedRevision!);
                              }}
                              className="mt-2 text-xs btn-success flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Apply Fix
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side by side comparison */}
          <div className="grid grid-cols-2 divide-x divide-[--border-color]">
            {/* Template (left) */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                  Template (Reference)
                </span>
                {match.templateSection && (
                  <button
                    onClick={handleUseTemplate}
                    className="text-xs text-[--accent-blue] hover:text-[--accent-blue]/80 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Use This
                  </button>
                )}
              </div>
              {match.templateSection ? (
                <div className="text-sm text-[--text-secondary] leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {match.templateSection.body}
                </div>
              ) : (
                <div className="text-sm text-[--text-muted] italic p-4 text-center bg-[--bg-primary] rounded-lg">
                  No matching section in template
                </div>
              )}
            </div>

            {/* Draft (right) */}
            <div className="p-4 bg-[--bg-primary]/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[--accent-blue] uppercase tracking-wider">
                  Draft (Your Version)
                </span>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-[--accent-blue] hover:text-[--accent-blue]/80 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    className="w-full min-h-[200px] p-3 text-sm bg-[--bg-primary] border border-[--border-color] rounded-lg resize-y"
                    placeholder="Enter section content..."
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={handleCancel} className="btn-secondary text-sm flex items-center gap-1">
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {match.templateSection ? (
                    <DiffDisplay
                      oldText={match.templateSection.body}
                      newText={editedContent || match.draftSection.body}
                    />
                  ) : (
                    <div className="text-sm text-[--text-secondary] leading-relaxed whitespace-pre-wrap">
                      {editedContent || match.draftSection.body}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action footer */}
          {match.issues.length > 0 && !match.isResolved && (
            <div className="p-4 bg-[--bg-tertiary] border-t border-[--border-color] flex justify-between items-center">
              <p className="text-sm text-[--text-muted]">
                Review the issues above and make changes if needed
              </p>
              <button
                onClick={onMarkResolved}
                className="btn-success text-sm flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Mark as Reviewed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReviewDashboard({
  templateSow,
  draftSow,
  analysis,
  editedSections,
  onEdit,
}: ReviewDashboardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [resolvedSections, setResolvedSections] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "issues" | "resolved">("all");

  // Match sections and organize data
  const sectionMatches = useMemo((): SectionMatch[] => {
    const matches: SectionMatch[] = [];
    const usedTemplateIds = new Set<string>();

    // Group issues by section
    const issuesBySectionId = new Map<string, Issue[]>();
    for (const issue of analysis.allIssues) {
      const existing = issuesBySectionId.get(issue.sectionId) || [];
      existing.push(issue);
      issuesBySectionId.set(issue.sectionId, existing);
    }

    // Match each draft section to template
    for (const draftSection of draftSow.sections) {
      let bestMatch: Section | null = null;
      let bestScore = 0;

      for (const templateSection of templateSow.sections) {
        if (usedTemplateIds.has(templateSection.id)) continue;

        let score = 0;

        // Number match
        if (draftSection.number && templateSection.number) {
          if (draftSection.number === templateSection.number) score += 100;
        }

        // Title match
        if (draftSection.title && templateSection.title) {
          const t1 = draftSection.title.toLowerCase();
          const t2 = templateSection.title.toLowerCase();
          if (t1 === t2) score += 80;
          else if (t1.includes(t2) || t2.includes(t1)) score += 40;
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = templateSection;
        }
      }

      if (bestMatch && bestScore >= 40) {
        usedTemplateIds.add(bestMatch.id);
      } else {
        bestMatch = null;
      }

      const issues = issuesBySectionId.get(draftSection.id) || [];
      const hasHighIssue = issues.some((i) => i.severity === "high");
      const hasMediumIssue = issues.some((i) => i.severity === "medium");

      let status: SectionMatch["status"] = "ok";
      if (!bestMatch) status = "new";
      else if (hasHighIssue) status = "error";
      else if (hasMediumIssue || issues.length > 0) status = "warning";

      matches.push({
        draftSection,
        templateSection: bestMatch,
        issues,
        status,
        isResolved: resolvedSections.has(draftSection.id),
      });
    }

    return matches;
  }, [draftSow.sections, templateSow.sections, analysis.allIssues, resolvedSections]);

  // Filter sections
  const filteredMatches = useMemo(() => {
    switch (filter) {
      case "issues":
        return sectionMatches.filter((m) => m.issues.length > 0 && !m.isResolved);
      case "resolved":
        return sectionMatches.filter((m) => m.isResolved);
      default:
        return sectionMatches;
    }
  }, [sectionMatches, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = sectionMatches.length;
    const withIssues = sectionMatches.filter((m) => m.issues.length > 0).length;
    const resolved = sectionMatches.filter((m) => m.isResolved).length;
    const highPriority = sectionMatches.filter((m) => m.status === "error" && !m.isResolved).length;

    return { total, withIssues, resolved, highPriority };
  }, [sectionMatches]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const markResolved = (sectionId: string) => {
    setResolvedSections((prev) => new Set([...prev, sectionId]));
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  };

  // Auto-expand sections with high priority issues on initial load
  useEffect(() => {
    const highPrioritySections = sectionMatches
      .filter((m) => m.status === "error" && !m.isResolved)
      .map((m) => m.draftSection.id);
    if (highPrioritySections.length > 0 && expandedSections.size === 0) {
      setExpandedSections(new Set([highPrioritySections[0]]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionMatches]);

  return (
    <div className="h-full flex flex-col">
      {/* Summary Header */}
      <div className="flex-shrink-0 p-6 border-b border-[--border-color] bg-[--bg-secondary]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[--text-primary]">SOW Review</h1>
            <p className="text-sm text-[--text-secondary] mt-1">
              Comparing <span className="text-[--text-primary]">{draftSow.filename}</span> against template
            </p>
          </div>

          {/* Progress */}
          <div className="text-right">
            <div className="text-2xl font-bold text-[--text-primary]">
              {stats.resolved}/{stats.withIssues}
            </div>
            <div className="text-xs text-[--text-muted]">sections reviewed</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar mb-4">
          <div
            className="progress-fill"
            style={{ width: `${stats.withIssues > 0 ? (stats.resolved / stats.withIssues) * 100 : 100}%` }}
          />
        </div>

        {/* Quick stats */}
        <div className="flex gap-4">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 p-3 rounded-lg border transition-colors ${
              filter === "all"
                ? "bg-[--bg-tertiary] border-[--accent-blue]"
                : "border-[--border-color] hover:bg-[--bg-tertiary]"
            }`}
          >
            <div className="text-2xl font-bold text-[--text-primary]">{stats.total}</div>
            <div className="text-xs text-[--text-muted]">Total Sections</div>
          </button>

          <button
            onClick={() => setFilter("issues")}
            className={`flex-1 p-3 rounded-lg border transition-colors ${
              filter === "issues"
                ? "bg-[--bg-tertiary] border-[--accent-yellow]"
                : "border-[--border-color] hover:bg-[--bg-tertiary]"
            }`}
          >
            <div className="text-2xl font-bold text-[--accent-yellow]">{stats.withIssues - stats.resolved}</div>
            <div className="text-xs text-[--text-muted]">Need Review</div>
          </button>

          {stats.highPriority > 0 && (
            <button
              onClick={() => setFilter("issues")}
              className="flex-1 p-3 rounded-lg border border-[--border-color] bg-[rgba(244,33,46,0.1)] hover:bg-[rgba(244,33,46,0.15)] transition-colors pulse-attention"
            >
              <div className="text-2xl font-bold text-[--accent-red]">{stats.highPriority}</div>
              <div className="text-xs text-[--accent-red]">High Priority</div>
            </button>
          )}

          <button
            onClick={() => setFilter("resolved")}
            className={`flex-1 p-3 rounded-lg border transition-colors ${
              filter === "resolved"
                ? "bg-[--bg-tertiary] border-[--accent-green]"
                : "border-[--border-color] hover:bg-[--bg-tertiary]"
            }`}
          >
            <div className="text-2xl font-bold text-[--accent-green]">{stats.resolved}</div>
            <div className="text-xs text-[--text-muted]">Reviewed</div>
          </button>
        </div>
      </div>

      {/* Section List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* AI Analysis Summary */}
        <AnalysisSummary analysis={analysis} />

        {filteredMatches.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-[--accent-green] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[--text-primary]">All Clear!</h3>
            <p className="text-[--text-secondary]">
              {filter === "issues"
                ? "No more sections need review"
                : filter === "resolved"
                ? "No sections have been reviewed yet"
                : "No sections found"}
            </p>
          </div>
        ) : (
          filteredMatches.map((match) => (
            <SectionCard
              key={match.draftSection.id}
              match={match}
              isExpanded={expandedSections.has(match.draftSection.id)}
              onToggle={() => toggleSection(match.draftSection.id)}
              editedContent={editedSections[match.draftSection.id]}
              onEdit={(content) => onEdit(match.draftSection.id, content)}
              onMarkResolved={() => markResolved(match.draftSection.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
