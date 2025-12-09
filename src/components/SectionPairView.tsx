"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Edit2,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Copy,
} from "lucide-react";
import type { Section, Issue, Severity } from "@/types";
import { computeTextDiff, type DiffPart } from "@/utils/diffUtils";
import clsx from "clsx";

interface SectionPairViewProps {
  templateSection: Section | null;
  draftSection: Section;
  issues: Issue[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isHighlighted?: boolean;
  editedContent?: string;
  onEdit?: (sectionId: string, newContent: string) => void;
  onApplySuggestion?: (sectionId: string, suggestion: string) => void;
}

// Render diff-highlighted text
function DiffText({ parts }: { parts: DiffPart[] }) {
  return (
    <span>
      {parts.map((part, i) => {
        if (part.removed) {
          return (
            <span key={i} className="bg-red-200 text-red-900 line-through px-0.5">
              {part.value}
            </span>
          );
        }
        if (part.added) {
          return (
            <span key={i} className="bg-green-200 text-green-900 px-0.5">
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}

export default function SectionPairView({
  templateSection,
  draftSection,
  issues,
  isExpanded = true,
  onToggleExpand,
  isHighlighted = false,
  editedContent,
  onEdit,
  onApplySuggestion,
}: SectionPairViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(editedContent || draftSection.body);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalContent(editedContent || draftSection.body);
  }, [editedContent, draftSection.body]);

  useEffect(() => {
    if (isHighlighted && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  // Compute diff between template and draft
  const diff = useMemo(() => {
    if (!templateSection) return null;
    return computeTextDiff(templateSection.body, editedContent || draftSection.body, "words");
  }, [templateSection, draftSection.body, editedContent]);

  // Get highest severity
  const highestSeverity = useMemo(() => {
    return issues.reduce<Severity | null>((acc, issue) => {
      if (!acc) return issue.severity;
      if (issue.severity === "high") return "high";
      if (issue.severity === "medium" && acc !== "high") return "medium";
      return acc;
    }, null);
  }, [issues]);

  const handleSave = () => {
    if (onEdit) {
      onEdit(draftSection.id, localContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalContent(editedContent || draftSection.body);
    setIsEditing(false);
  };

  const handleCopyFromTemplate = () => {
    if (templateSection) {
      setLocalContent(templateSection.body);
      if (onEdit) {
        onEdit(draftSection.id, templateSection.body);
      }
    }
  };

  const sectionTitle = draftSection.number
    ? `${draftSection.number}. ${draftSection.title || ""}`
    : draftSection.title || "Untitled Section";

  const templateTitle = templateSection
    ? templateSection.number
      ? `${templateSection.number}. ${templateSection.title || ""}`
      : templateSection.title || "Untitled Section"
    : null;

  return (
    <div
      ref={sectionRef}
      className={clsx(
        "border rounded-lg overflow-hidden transition-all duration-200",
        isHighlighted && "ring-2 ring-hyundai-sky shadow-lg",
        !isHighlighted && highestSeverity === "high" && "border-red-300",
        !isHighlighted && highestSeverity === "medium" && "border-yellow-300",
        !isHighlighted && highestSeverity === "low" && "border-blue-300",
        !isHighlighted && !highestSeverity && "border-gray-200"
      )}
    >
      {/* Section Header */}
      <div
        onClick={onToggleExpand}
        className={clsx(
          "flex items-center justify-between px-4 py-3 cursor-pointer",
          highestSeverity === "high" && "bg-red-50",
          highestSeverity === "medium" && "bg-yellow-50",
          highestSeverity === "low" && "bg-blue-50",
          !highestSeverity && "bg-gray-50"
        )}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}

          <div>
            <h3 className="font-semibold text-gray-900">{sectionTitle}</h3>
            {templateSection && templateTitle !== sectionTitle && (
              <p className="text-xs text-gray-500">
                Template: {templateTitle}
              </p>
            )}
            {!templateSection && (
              <p className="text-xs text-orange-600 font-medium">New section (not in template)</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {diff && diff.hasChanges && (
            <span className="text-xs text-gray-500">
              {diff.addedCount > 0 && <span className="text-green-600">+{diff.addedCount}</span>}
              {diff.addedCount > 0 && diff.removedCount > 0 && " / "}
              {diff.removedCount > 0 && <span className="text-red-600">-{diff.removedCount}</span>}
              {" changes"}
            </span>
          )}

          {issues.length > 0 && (
            <div className="flex items-center gap-1.5">
              {highestSeverity === "high" && (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              {highestSeverity === "medium" && (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              {highestSeverity === "low" && (
                <Info className="w-4 h-4 text-blue-500" />
              )}
              <span className="text-sm font-medium text-gray-600">
                {issues.length} issue{issues.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Side by Side Comparison */}
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            {/* Template Section (Left) */}
            <div className="p-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Template (Reference)
                </span>
              </div>
              {templateSection ? (
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {templateSection.body}
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">
                  No matching section in template
                </div>
              )}
            </div>

            {/* Draft Section (Right) */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-hyundai-sky uppercase tracking-wide">
                  Draft (Editable)
                </span>
                <div className="flex items-center gap-2">
                  {templateSection && !isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyFromTemplate();
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      title="Copy from template"
                    >
                      <Copy className="w-3 h-3" />
                      Use Template
                    </button>
                  )}
                  {!isEditing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                      className="text-xs text-hyundai-sky hover:text-hyundai-sky/80 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={localContent}
                    onChange={(e) => setLocalContent(e.target.value)}
                    className="w-full min-h-[200px] p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-hyundai-sky focus:border-hyundai-sky resize-y"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                      className="px-3 py-1.5 text-sm bg-hyundai-blue text-white hover:bg-hyundai-blue/90 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {diff && diff.hasChanges ? (
                    <DiffText parts={diff.parts} />
                  ) : (
                    editedContent || draftSection.body
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Issues for this section */}
          {issues.length > 0 && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Issues & Suggestions
              </h4>
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={clsx(
                      "p-3 rounded-lg border",
                      issue.severity === "high" && "bg-red-50 border-red-200",
                      issue.severity === "medium" && "bg-yellow-50 border-yellow-200",
                      issue.severity === "low" && "bg-blue-50 border-blue-200"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {issue.severity === "high" && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                      {issue.severity === "medium" && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                      {issue.severity === "low" && <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{issue.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={clsx(
                            "text-xs px-1.5 py-0.5 rounded capitalize",
                            issue.severity === "high" && "bg-red-100 text-red-700",
                            issue.severity === "medium" && "bg-yellow-100 text-yellow-700",
                            issue.severity === "low" && "bg-blue-100 text-blue-700"
                          )}>
                            {issue.severity}
                          </span>
                          <span className="text-xs text-gray-400">
                            {issue.type.replace(/_/g, " ")}
                          </span>
                        </div>

                        {issue.suggestedRevision && onApplySuggestion && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-1 text-xs text-hyundai-sky font-medium mb-1">
                              <Sparkles className="w-3 h-3" />
                              AI Suggestion
                            </div>
                            <p className="text-xs text-gray-600 bg-white p-2 rounded border mb-2">
                              {issue.suggestedRevision.substring(0, 300)}
                              {issue.suggestedRevision.length > 300 && "..."}
                            </p>
                            <button
                              onClick={() => onApplySuggestion(draftSection.id, issue.suggestedRevision!)}
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
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
