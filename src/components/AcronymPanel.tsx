"use client";

import { useState, useMemo } from "react";
import {
  AlertCircle,
  Check,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { analyzeAcronyms, type AcronymAnalysis } from "@/utils/diffUtils";
import clsx from "clsx";

interface AcronymPanelProps {
  templateText: string;
  draftText: string;
}

const statusConfig = {
  undefined: {
    label: "Undefined",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: AlertCircle,
    description: "Used in draft but not defined",
  },
  new: {
    label: "New",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Plus,
    description: "New acronym added in draft (defined)",
  },
  missing: {
    label: "Missing",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: Minus,
    description: "In template but missing from draft",
  },
  ok: {
    label: "OK",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: Check,
    description: "Present in both documents",
  },
};

export default function AcronymPanel({ templateText, draftText }: AcronymPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<AcronymAnalysis["status"] | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const acronyms = useMemo(() => {
    return analyzeAcronyms(templateText, draftText);
  }, [templateText, draftText]);

  const filteredAcronyms = useMemo(() => {
    return acronyms.filter((a) => {
      const matchesFilter = filter === "all" || a.status === filter;
      const matchesSearch = searchTerm === "" || a.acronym.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [acronyms, filter, searchTerm]);

  const counts = useMemo(() => {
    return {
      undefined: acronyms.filter((a) => a.status === "undefined").length,
      new: acronyms.filter((a) => a.status === "new").length,
      missing: acronyms.filter((a) => a.status === "missing").length,
      ok: acronyms.filter((a) => a.status === "ok").length,
      total: acronyms.length,
    };
  }, [acronyms]);

  if (acronyms.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="font-medium text-gray-900">Acronym Analysis</span>
          <span className="text-sm text-gray-500">({counts.total} found)</span>
        </div>

        {counts.undefined > 0 && (
          <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
            <AlertCircle className="w-4 h-4" />
            {counts.undefined} undefined
          </span>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2 p-3 border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setFilter("all")}
              className={clsx(
                "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap",
                filter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              All ({counts.total})
            </button>
            {counts.undefined > 0 && (
              <button
                onClick={() => setFilter("undefined")}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-1",
                  filter === "undefined"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-600 hover:bg-red-100"
                )}
              >
                <AlertCircle className="w-3 h-3" />
                Undefined ({counts.undefined})
              </button>
            )}
            {counts.new > 0 && (
              <button
                onClick={() => setFilter("new")}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-1",
                  filter === "new"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                )}
              >
                <Plus className="w-3 h-3" />
                New ({counts.new})
              </button>
            )}
            {counts.missing > 0 && (
              <button
                onClick={() => setFilter("missing")}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-1",
                  filter === "missing"
                    ? "bg-orange-600 text-white"
                    : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                )}
              >
                <Minus className="w-3 h-3" />
                Missing ({counts.missing})
              </button>
            )}
            {counts.ok > 0 && (
              <button
                onClick={() => setFilter("ok")}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-1",
                  filter === "ok"
                    ? "bg-green-600 text-white"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                )}
              >
                <Check className="w-3 h-3" />
                OK ({counts.ok})
              </button>
            )}
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search acronyms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-hyundai-sky focus:border-hyundai-sky"
              />
            </div>
          </div>

          {/* Acronym List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredAcronyms.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No acronyms match your filter
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredAcronyms.map((acronym) => {
                  const config = statusConfig[acronym.status];
                  const Icon = config.icon;

                  return (
                    <div
                      key={acronym.acronym}
                      className={clsx(
                        "flex items-center justify-between px-4 py-2",
                        config.bgColor
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={clsx("w-4 h-4", config.color)} />
                        <span className="font-mono font-medium text-gray-900">
                          {acronym.acronym}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {acronym.inTemplate && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            Template{acronym.definedInTemplate && " (defined)"}
                          </span>
                        )}
                        {acronym.inDraft && (
                          <span className={clsx(
                            "px-2 py-0.5 rounded",
                            acronym.definedInDraft ? "bg-green-100 text-green-700" : "bg-white text-gray-600"
                          )}>
                            Draft{acronym.definedInDraft && " (defined)"}
                          </span>
                        )}
                        <span className={clsx(
                          "px-2 py-0.5 rounded font-medium",
                          config.bgColor,
                          config.color,
                          config.borderColor,
                          "border"
                        )}>
                          {config.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
