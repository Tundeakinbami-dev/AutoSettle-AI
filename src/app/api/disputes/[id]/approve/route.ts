import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));

    const dispute = await prisma.dispute.findFirst({
      where: { OR: [{ id }, { paypalDisputeId: id }] },
      include: {
        draftResponses: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!dispute) {
      return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
    }

    const approver = body.approver || "merchant_operator";

    // 1. Update latest draft response
    const latestDraft = dispute.draftResponses[0];
    if (latestDraft) {
      await prisma.draftResponse.update({
        where: { id: latestDraft.id },
        data: {
          status: "APPROVED",
          isApproved: true,
          approvedBy: approver,
          approvedAt: new Date(),
        },
      });
    }

    // 2. Transition dispute state to APPROVED
    const updatedDispute = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        responseWorkflowStatus: "APPROVED",
      },
      include: {
        draftResponses: true,
      },
    });

    // 3. Record audit trail
    await recordAuditLog({
      disputeId: dispute.id,
      eventType: "APPROVAL_GRANTED",
      severity: "SUCCESS",
      summary: `Human approval granted by ${approver}. Response certified for PayPal Disputes API dispatch.`,
      details: {
        approver,
        approvedAt: new Date().toISOString(),
        workflowStatus: "APPROVED",
      },
      actor: "merchant_user",
      actorId: approver,
    });

    return NextResponse.json({
      success: true,
      message: "Dispute response approved. Ready for PayPal API submission.",
      dispute: updatedDispute,
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/approve error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve dispute response" },
      { status: 500 }
    );
  }
}
