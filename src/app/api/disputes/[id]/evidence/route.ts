import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    const {
      evidenceType,
      title,
      description,
      fileName,
      fileUrl,
      strength = "STRONG",
    } = body;

    if (!evidenceType || !title || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required evidence fields (evidenceType, title, description)" },
        { status: 400 }
      );
    }

    const evidence = await prisma.evidenceItem.create({
      data: {
        disputeId: dispute.id,
        evidenceType,
        title,
        description,
        fileName: fileName || `${title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
        fileUrl: fileUrl || `/evidence/${fileName || "doc.pdf"}`,
        fileType: "application/pdf",
        strength,
        verified: true,
      },
    });

    // Re-trigger analysis flag so merchant is prompted or can re-analyze with newly attached evidence
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { aiAnalyzed: false },
    });

    return NextResponse.json({
      success: true,
      evidence,
      message: "Evidence item successfully attached to locker.",
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/evidence error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to attach evidence" },
      { status: 500 }
    );
  }
}
