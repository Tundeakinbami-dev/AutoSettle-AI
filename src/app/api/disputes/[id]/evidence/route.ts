import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

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
        provenanceSource: "Merchant Upload",
      },
    });

    // Reset workflow status to NEEDS_REVIEW when new evidence is attached
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseWorkflowStatus: "NEEDS_REVIEW" },
    });

    // Record audit log for evidence added
    await recordAuditLog({
      disputeId: dispute.id,
      merchantId: dispute.merchantId,
      eventType: "EVIDENCE_ADDED",
      severity: "INFO",
      summary: `Evidence added to locker: "${title}" (${evidenceType})`,
      details: { title, evidenceType, strength },
      actor: "merchant_user",
    });

    return NextResponse.json({
      success: true,
      evidence,
      workflowStatus: "NEEDS_REVIEW",
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
