"use client";

import { useState, useRef, useEffect } from "react";
import { Edit2, Check, X, AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { Section, Issue, Severity } from "@/types";
import clsx from "clsx";

interface SectionViewerProps {
  section: Section;
  issues?: Issue[];
  isEditable?: boolean;
  editedContent?: string;
  onEdit?: (sectionId: string, newContent: string) => void;
  isHighlighted?: boolean;
  onSectionClick?: (sectionId: string) => void;
}

const severityIcons: Record<Severity, typeof AlertTriangle> = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
};

const severityColors: Record<Severity, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

export default function SectionViewer({
  section,
  issues = [],
  isEditable = false,
  editedContent,
  onEdit,
  isHighlighted = false,
  onSectionClick,
}: SectionViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(editedContent || section.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalContent(editedContent || section.body);
  }, [editedContent, section.body]);

  useEffect(() => {
    if (isHighlighted && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isHighlighted]);

  const handleSave = () => {
    if (onEdit) {
      onEdit(section.id, localContent);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalContent(editedContent || section.body);
    setIsEditing(false);
  };

  // Get highest severity issue for this section
  const highestSeverity = issues.reduce<Severity | null>((acc, issue) => {
    if (!acc) return issue.severity;
    if (issue.severity === "high") return "high";
    if (issue.severity === "medium" && acc !== "high") return "medium";
    return acc;
  }, null);

  const SeverityIcon = highestSeverity ? severityIcons[highestSeverity] : null;

  return (
    <div
      ref={sectionRef}
      onClick={() => onSectionClick?.(section.id)}
      className={clsx(
        "p-4 rounded-lg border transition-all duration-200 cursor-pointer",
        isHighlighted && "ring-2 ring-hyundai-sky bg-blue-50",
        !isHighlighted && issues.length > 0 && highestSeverity === "high" && "border-red-200 bg-red-50/50",
        !isHighlighted && issues.length > 0 && highestSeverity === "medium" && "border-yellow-200 bg-yellow-50/50",
        !isHighlighted && issues.length > 0 && highestSeverity === "low" && "border-blue-200 bg-blue-50/50",
        !isHighlighted && issues.length === 0 && "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {section.number && (
            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              {section.number}
            </span>
          )}
          {section.title && (
            <h3 className="font-semibold text-gray-900">{section.title}</h3>
          )}
          {!section.title && !section.number && (
            <h3 className="font-semibold text-gray-500 italic">Untitled Section</h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          {SeverityIcon && issues.length > 0 && (
            <div className={clsx("flex items-center gap-1", severityColors[highestSeverity!])}>
              <SeverityIcon className="w-4 h-4" />
              <span className="text-xs font-medium">{issues.length}</span>
            </div>
          )}

          {isEditable && !isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit section"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            className="w-full min-h-[200px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hyundai-sky focus:border-hyundai-sky resize-y"
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
          {(editedContent || section.body).split("\n").map((line, i) => (
            <p key={i} className={line.trim() ? "mb-2" : "mb-4"}>
              {line || "\u00A0"}
            </p>
          ))}
        </div>
      )}

      {/* Issue badges (inline preview) */}
      {issues.length > 0 && !isHighlighted && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
          {issues.slice(0, 3).map((issue) => (
            <span
              key={issue.id}
              className={clsx(
                "text-xs px-2 py-0.5 rounded-full border",
                issue.severity === "high" && "severity-high",
                issue.severity === "medium" && "severity-medium",
                issue.severity === "low" && "severity-low"
              )}
            >
              {issue.type.replace(/_/g, " ")}
            </span>
          ))}
          {issues.length > 3 && (
            <span className="text-xs text-gray-500">+{issues.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
}
