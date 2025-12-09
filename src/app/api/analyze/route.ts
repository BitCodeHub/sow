import { NextRequest, NextResponse } from "next/server";
import { analyzeSOWs } from "@/services/openaiAnalyzer";
import type { ParsedSOW, AnalyzeResponse } from "@/types";

interface AnalyzeRequestBody {
  templateSow: ParsedSOW;
  newSow: ParsedSOW;
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeResponse>> {
  try {
    // Check for Azure OpenAI credentials
    if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Azure OpenAI not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in environment variables." },
        { status: 500 }
      );
    }

    const body: AnalyzeRequestBody = await request.json();

    if (!body.templateSow || !body.newSow) {
      return NextResponse.json(
        { success: false, error: "Both template SOW and new SOW are required" },
        { status: 400 }
      );
    }

    // Validate that both SOWs have sections
    if (!body.templateSow.sections?.length || !body.newSow.sections?.length) {
      return NextResponse.json(
        { success: false, error: "Both documents must have parseable sections" },
        { status: 400 }
      );
    }

    // Run the analysis
    const analysis = await analyzeSOWs(body.templateSow, body.newSow);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to analyze documents",
      },
      { status: 500 }
    );
  }
}
