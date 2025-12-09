import { NextRequest, NextResponse } from "next/server";
import { analyzeFormatting } from "@/services/formattingAnalyzer";
import type { FormattingAnalysis } from "@/types";

interface AnalyzeFormattingResponse {
  success: boolean;
  analysis?: FormattingAnalysis;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeFormattingResponse>> {
  try {
    // Check for Azure OpenAI credentials
    if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Azure OpenAI not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const templateFile = formData.get("template") as File | null;
    const draftFile = formData.get("draft") as File | null;
    const templateSectionsJson = formData.get("templateSections") as string;
    const draftSectionsJson = formData.get("draftSections") as string;

    if (!templateFile || !draftFile) {
      return NextResponse.json(
        { success: false, error: "Both template and draft files are required" },
        { status: 400 }
      );
    }

    // Get file buffers
    const templateBytes = await templateFile.arrayBuffer();
    const templateBuffer = Buffer.from(templateBytes);

    const draftBytes = await draftFile.arrayBuffer();
    const draftBuffer = Buffer.from(draftBytes);

    // Parse sections
    const templateSections = templateSectionsJson ? JSON.parse(templateSectionsJson) : [];
    const draftSections = draftSectionsJson ? JSON.parse(draftSectionsJson) : [];

    // Run formatting analysis
    const analysis = await analyzeFormatting(
      templateBuffer,
      templateFile.name,
      draftBuffer,
      draftFile.name,
      templateSections,
      draftSections
    );

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Formatting analysis error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze formatting",
      },
      { status: 500 }
    );
  }
}
