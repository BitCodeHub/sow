"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Upload,
  Zap,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  X,
  FileUp,
} from "lucide-react";
import ReviewDashboard from "@/components/ReviewDashboard";
import type { ParsedSOW, AnalysisResult } from "@/types";

type AppStep = "upload" | "review";

// File upload component
function FileUploadZone({
  label,
  description,
  file,
  onUpload,
  onClear,
  isUploading,
}: {
  label: string;
  description: string;
  file: ParsedSOW | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  isUploading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".docx")) {
      onUpload(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  if (file) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[--accent-green]/10">
              <CheckCircle2 className="w-6 h-6 text-[--accent-green]" />
            </div>
            <div>
              <h4 className="font-medium text-[--text-primary]">{file.filename}</h4>
              <p className="text-sm text-[--text-secondary]">
                {file.sections.length} sections detected
              </p>
            </div>
          </div>
          <button
            onClick={onClear}
            className="p-2 hover:bg-[--bg-tertiary] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[--text-muted]" />
          </button>
        </div>
      </div>
    );
  }

  const inputId = `file-upload-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <label
      htmlFor={inputId}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      className={`card p-8 text-center cursor-pointer transition-all block relative ${
        isDragging ? "border-[--accent-blue] bg-[--accent-blue]/5" : "hover:border-[--border-light]"
      } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
    >
      <input
        id={inputId}
        type="file"
        accept=".docx"
        onChange={handleFileSelect}
        className="sr-only"
        disabled={isUploading}
      />
      <div>
        {isUploading ? (
          <Loader2 className="w-10 h-10 text-[--accent-blue] mx-auto spinner" />
        ) : (
          <FileUp className="w-10 h-10 text-[--text-muted] mx-auto" />
        )}
        <h3 className="mt-4 font-semibold text-[--text-primary]">{label}</h3>
        <p className="mt-1 text-sm text-[--text-secondary]">{description}</p>
        <p className="mt-3 text-xs text-[--text-muted]">
          Drop DOCX file here or click to browse
        </p>
      </div>
    </label>
  );
}

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [templateSow, setTemplateSow] = useState<ParsedSOW | null>(null);
  const [draftSow, setDraftSow] = useState<ParsedSOW | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isUploading, setIsUploading] = useState<"template" | "draft" | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);

  const uploadFile = async (file: File, type: "template" | "draft") => {
    setIsUploading(type);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      if (type === "template") {
        setTemplateSow(data.sow);
      } else {
        setDraftSow(data.sow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(null);
    }
  };

  const handleAnalyze = async () => {
    if (!templateSow || !draftSow) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateSow, newSow: draftSow }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis(data.analysis);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEdit = useCallback((sectionId: string, content: string) => {
    setEditedSections((prev) => ({ ...prev, [sectionId]: content }));
  }, []);

  const handleExport = async () => {
    if (!draftSow) return;

    setIsExporting(true);
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sow: draftSow, editedSections }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = draftSow.filename.replace(".docx", "_revised.docx");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export document");
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setTemplateSow(null);
    setDraftSow(null);
    setAnalysis(null);
    setEditedSections({});
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[--bg-primary]">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[--border-color] bg-[--bg-secondary]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[--accent-blue]/10">
              <FileText className="w-6 h-6 text-[--accent-blue]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[--text-primary]">SOW Copilot</h1>
              <p className="text-xs text-[--text-muted]">AI-Powered SOW Analysis</p>
            </div>
          </div>

          {step === "review" && (
            <div className="flex items-center gap-3">
              <button onClick={handleReset} className="btn-secondary text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Start Over
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 spinner" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export Revised SOW
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {step === "upload" && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              {/* Title */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-[--text-primary] mb-2">
                  Review Your SOW
                </h2>
                <p className="text-[--text-secondary]">
                  Upload your template and draft SOW documents to compare and identify discrepancies
                </p>
              </div>

              {/* Upload boxes */}
              <div className="grid gap-6 md:grid-cols-2 mb-8">
                <div className="relative">
                  <FileUploadZone
                    label="Template SOW"
                    description="The approved reference document"
                    file={templateSow}
                    onUpload={(file) => uploadFile(file, "template")}
                    onClear={() => setTemplateSow(null)}
                    isUploading={isUploading === "template"}
                  />
                </div>
                <div className="relative">
                  <FileUploadZone
                    label="Draft SOW"
                    description="Your new document to review"
                    file={draftSow}
                    onUpload={(file) => uploadFile(file, "draft")}
                    onClear={() => setDraftSow(null)}
                    isUploading={isUploading === "draft"}
                  />
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-[--accent-red]/10 border border-[--accent-red]/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[--accent-red] flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-[--accent-red]">Error</h4>
                    <p className="text-sm text-[--text-secondary]">{error}</p>
                  </div>
                </div>
              )}

              {/* Analyze button */}
              <div className="flex justify-center">
                <button
                  onClick={handleAnalyze}
                  disabled={!templateSow || !draftSow || isAnalyzing}
                  className="btn-primary text-lg px-8 py-4 flex items-center gap-3"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-6 h-6 spinner" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6" />
                      Analyze with AI
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {isAnalyzing && (
                <p className="text-center text-sm text-[--text-muted] mt-4">
                  Comparing sections, identifying discrepancies, and generating suggestions...
                </p>
              )}

              {/* Features list */}
              <div className="mt-12 grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-10 h-10 rounded-full bg-[--accent-blue]/10 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-5 h-5 text-[--accent-blue]" />
                  </div>
                  <h4 className="font-medium text-[--text-primary] mb-1">Side-by-Side</h4>
                  <p className="text-xs text-[--text-muted]">Compare sections directly</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-[--accent-yellow]/10 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-5 h-5 text-[--accent-yellow]" />
                  </div>
                  <h4 className="font-medium text-[--text-primary] mb-1">Find Issues</h4>
                  <p className="text-xs text-[--text-muted]">AI-powered analysis</p>
                </div>
                <div>
                  <div className="w-10 h-10 rounded-full bg-[--accent-green]/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-5 h-5 text-[--accent-green]" />
                  </div>
                  <h4 className="font-medium text-[--text-primary] mb-1">Fix & Export</h4>
                  <p className="text-xs text-[--text-muted]">Edit and download</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "review" && analysis && templateSow && draftSow && (
          <ReviewDashboard
            templateSow={templateSow}
            draftSow={draftSow}
            analysis={analysis}
            editedSections={editedSections}
            onEdit={handleEdit}
          />
        )}
      </main>
    </div>
  );
}
