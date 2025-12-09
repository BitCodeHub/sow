"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Scale,
  DollarSign,
  Package,
  Type,
  Layout,
  Sparkles,
  Check,
} from "lucide-react";
import type { Issue, IssueCategory, Severity, AnalysisResult } from "@/types";
import clsx from "clsx";

interface IssuesSidebarProps {
  analysis: AnalysisResult;
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue | null) => void;
  onApplySuggestion?: (sectionId: string, suggestion: string) => void;
}

const categoryConfig: Record<
  IssueCategory,
  { label: string; icon: typeof Scale; color: string }
> = {
  legal_risk: { label: "Legal Risk", icon: Scale, color: "text-red-600" },
  financial: { label: "Financial", icon: DollarSign, color: "text-green-600" },
  deliverables_scope: { label: "Scope & Deliverables", icon: Package, color: "text-purple-600" },
  language_clarity: { label: "Language & Clarity", icon: Type, color: "text-blue-600" },
  formatting_structure: { label: "Formatting", icon: Layout, color: "text-gray-600" },
};

const severityConfig: Record<Severity, { icon: typeof AlertCircle; color: string; bgColor: string }> = {
  high: { icon: AlertCircle, color: "text-red-600", bgColor: "bg-red-50" },
  medium: { icon: AlertTriangle, color: "text-yellow-600", bgColor: "bg-yellow-50" },
  low: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-50" },
};

interface IssueCategoryGroupProps {
  category: IssueCategory;
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue | null) => void;
  onApplySuggestion?: (sectionId: string, suggestion: string) => void;
}

function IssueCategoryGroup({
  category,
  issues,
  selectedIssue,
  onSelectIssue,
  onApplySuggestion,
}: IssueCategoryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = categoryConfig[category];
  const CategoryIcon = config.icon;

  if (issues.length === 0) return null;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CategoryIcon className={clsx("w-4 h-4", config.color)} />
          <span className="font-medium text-gray-700">{config.label}</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
            {issues.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {issues.map((issue) => {
            const severityConf = severityConfig[issue.severity];
            const SeverityIcon = severityConf.icon;
            const isSelected = selectedIssue?.id === issue.id;

            return (
              <div
                key={issue.id}
                className={clsx(
                  "p-3 rounded-lg cursor-pointer transition-all",
                  isSelected ? "bg-hyundai-sky/10 ring-1 ring-hyundai-sky" : "hover:bg-gray-50"
                )}
                onClick={() => onSelectIssue(isSelected ? null : issue)}
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon className={clsx("w-4 h-4 mt-0.5 flex-shrink-0", severityConf.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">{issue.description}</p>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={clsx(
                          "text-xs px-1.5 py-0.5 rounded capitalize",
                          severityConf.bgColor,
                          severityConf.color
                        )}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-400">
                        {issue.type.replace(/_/g, " ")}
                      </span>
                    </div>

                    {isSelected && issue.suggestedRevision && onApplySuggestion && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1 text-xs text-hyundai-sky font-medium mb-2">
                          <Sparkles className="w-3 h-3" />
                          AI Suggestion
                        </div>
                        <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-2">
                          {issue.suggestedRevision.substring(0, 200)}
                          {issue.suggestedRevision.length > 200 && "..."}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplySuggestion(issue.sectionId, issue.suggestedRevision!);
                          }}
                          className="text-xs bg-hyundai-sky text-white px-2 py-1 rounded hover:bg-hyundai-sky/90 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Apply Suggestion
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function IssuesSidebar({
  analysis,
  selectedIssue,
  onSelectIssue,
  onApplySuggestion,
}: IssuesSidebarProps) {
  const { issueCounts, categoryBreakdown, globalAnalysis } = analysis;
  const totalIssues = issueCounts.high + issueCounts.medium + issueCounts.low;

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Analysis Results</h2>
        <p className="text-sm text-gray-500 mt-1">
          {totalIssues} issue{totalIssues !== 1 ? "s" : ""} found
        </p>

        {/* Issue count badges */}
        <div className="flex gap-2 mt-3">
          <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">{issueCounts.high}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">{issueCounts.medium}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">{issueCounts.low}</span>
          </div>
        </div>
      </div>

      {/* Global Analysis Summary */}
      {globalAnalysis.summary && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Summary</h3>
          <p className="text-sm text-gray-600">{globalAnalysis.summary}</p>

          {globalAnalysis.criticalRedFlags.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">
                Critical Red Flags
              </h4>
              <ul className="space-y-1">
                {globalAnalysis.criticalRedFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Issue Categories */}
      <div className="flex-1 overflow-y-auto">
        {(Object.keys(categoryConfig) as IssueCategory[]).map((category) => (
          <IssueCategoryGroup
            key={category}
            category={category}
            issues={categoryBreakdown[category]}
            selectedIssue={selectedIssue}
            onSelectIssue={onSelectIssue}
            onApplySuggestion={onApplySuggestion}
          />
        ))}
      </div>
    </div>
  );
}
