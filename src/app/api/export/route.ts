import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from "docx";
import type { ParsedSOW, Section, FormattingDifference, ParagraphFormatting, TextRunFormatting } from "@/types";

interface ExportRequestBody {
  sow: ParsedSOW;
  editedSections?: Record<string, string>;
  appliedFormatting?: string[]; // IDs of formatting fixes that were applied
  formattingFixes?: FormattingDifference[]; // The actual formatting fixes
}

// Map alignment values to docx AlignmentType
function mapAlignment(alignment?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  switch (alignment) {
    case "left": return AlignmentType.LEFT;
    case "center": return AlignmentType.CENTER;
    case "right": return AlignmentType.RIGHT;
    case "justify": return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

interface FormattingOptions {
  paragraphFormatting?: ParagraphFormatting;
  textFormatting?: TextRunFormatting;
}

function sectionToDocxParagraphs(
  section: Section,
  editedBody?: string,
  formattingOptions?: FormattingOptions
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const body = editedBody || section.body;
  const pFormat = formattingOptions?.paragraphFormatting;
  const tFormat = formattingOptions?.textFormatting;

  // Add section heading
  if (section.title || section.number) {
    const headingLevel = section.level === 1 ? HeadingLevel.HEADING_1 :
                         section.level === 2 ? HeadingLevel.HEADING_2 :
                         HeadingLevel.HEADING_3;

    paragraphs.push(
      new Paragraph({
        heading: headingLevel,
        alignment: mapAlignment(pFormat?.alignment),
        children: [
          new TextRun({
            text: `${section.number ? section.number + ". " : ""}${section.title || ""}`,
            bold: true,
            font: tFormat?.fontFamily,
            size: tFormat?.fontSize ? tFormat.fontSize * 2 : undefined, // Convert pt to half-pt
          }),
        ],
      })
    );
  }

  // Add section body paragraphs
  const bodyParagraphs = body.split("\n\n");
  for (const para of bodyParagraphs) {
    if (para.trim()) {
      paragraphs.push(
        new Paragraph({
          alignment: mapAlignment(pFormat?.alignment),
          indent: pFormat?.indentLeft ? {
            left: pFormat.indentLeft,
            firstLine: pFormat.indentFirstLine,
          } : undefined,
          spacing: {
            before: pFormat?.spacingBefore,
            after: pFormat?.spacingAfter || 200,
            line: pFormat?.lineSpacing,
          },
          children: [
            new TextRun({
              text: para.trim(),
              bold: tFormat?.bold,
              italics: tFormat?.italic,
              font: tFormat?.fontFamily,
              size: tFormat?.fontSize ? tFormat.fontSize * 2 : undefined,
              color: tFormat?.color,
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ExportRequestBody = await request.json();

    if (!body.sow) {
      return NextResponse.json(
        { success: false, error: "SOW document is required" },
        { status: 400 }
      );
    }

    const { sow, editedSections = {}, appliedFormatting = [], formattingFixes = [] } = body;

    // Build a map of formatting fixes by section ID
    const formattingBySectionId = new Map<string, FormattingOptions>();

    for (const fix of formattingFixes) {
      if (appliedFormatting.includes(fix.id) && fix.fix) {
        const sectionId = fix.location.sectionId;
        const existing = formattingBySectionId.get(sectionId) || {};

        if (fix.fix.type === "apply_template_formatting" || fix.fix.type === "apply_template_style") {
          existing.paragraphFormatting = {
            ...existing.paragraphFormatting,
            ...(fix.fix.templateFormatting as ParagraphFormatting),
          };
        }

        if (fix.fix.type === "apply_template_font") {
          existing.textFormatting = {
            ...existing.textFormatting,
            ...(fix.fix.templateFormatting as TextRunFormatting),
          };
        }

        formattingBySectionId.set(sectionId, existing);
      }
    }

    // Build document paragraphs
    const docParagraphs: Paragraph[] = [];

    // Add title
    if (sow.metadata?.title) {
      docParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [
            new TextRun({
              text: sow.metadata.title,
              bold: true,
              size: 32,
            }),
          ],
          spacing: {
            after: 400,
          },
        })
      );
    } else {
      docParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [
            new TextRun({
              text: "Statement of Work",
              bold: true,
              size: 32,
            }),
          ],
          spacing: {
            after: 400,
          },
        })
      );
    }

    // Add metadata
    if (sow.metadata) {
      const metaItems: string[] = [];
      if (sow.metadata.vendor) metaItems.push(`Vendor: ${sow.metadata.vendor}`);
      if (sow.metadata.client) metaItems.push(`Client: ${sow.metadata.client}`);
      if (sow.metadata.effectiveDate) metaItems.push(`Effective Date: ${sow.metadata.effectiveDate}`);
      if (sow.metadata.totalValue) metaItems.push(`Total Value: $${sow.metadata.totalValue}`);

      for (const item of metaItems) {
        docParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item,
                italics: true,
              }),
            ],
          })
        );
      }

      if (metaItems.length > 0) {
        docParagraphs.push(new Paragraph({ children: [] })); // Spacer
      }
    }

    // Add sections
    for (const section of sow.sections) {
      const editedBody = editedSections[section.id];
      const formattingOptions = formattingBySectionId.get(section.id);
      const sectionParagraphs = sectionToDocxParagraphs(section, editedBody, formattingOptions);
      docParagraphs.push(...sectionParagraphs);
    }

    // Create document
    const doc = new Document({
      sections: [
        {
          children: docParagraphs,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Return as downloadable file
    const filename = sow.filename.replace(".docx", "_revised.docx");

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export document",
      },
      { status: 500 }
    );
  }
}
