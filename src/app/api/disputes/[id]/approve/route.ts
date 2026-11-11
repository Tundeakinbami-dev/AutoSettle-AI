import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

/**
 * POST /api/disputes/:id/approve
 * Marks the latest draft response as approved by the merchant.
 * Updates dispute workflow status to APPROVED.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // PayPal dispute ID (paypalDisputeId)
  try {
    // Find dispute and latest draft
    const dispute = await prisma.dispute.findFirst({
      where: { paypalDisputeId: id },
      include: { draftResponses: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!dispute) {
      return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
    }
    const latestDraft = dispute.draftResponses[0];
    if (!latestDraft) {
      return NextResponse.json({ success: false, error: "No draft response to approve" }, { status: 400 });
    }

    // Update draft as approved
    await prisma.draftResponse.update({
      where: { id: latestDraft.id },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: "merchant_user", // placeholder – replace with auth user ID
        status: "APPROVED",
      },
    });

    // Update dispute workflow status
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseWorkflowStatus: "APPROVED" },
    });

    await recordAuditLog({
      disputeId: dispute.id,
      eventType: "RESPONSE_APPROVED",
      severity: "INFO",
      summary: `Merchant approved draft response version ${latestDraft.version}`,
      actor: "merchant_user",
    });

    return NextResponse.json({ success: true, draftId: latestDraft.id });
  } catch (err: any) {
    console.error("POST /api/disputes/[id]/approve error:", err);
    await recordAuditLog({
      disputeId: undefined,
      eventType: "APPROVAL_ERROR",
      severity: "ERROR",
      summary: `Error approving draft for dispute ${id}: ${err.message}`,
      actor: "system",
    });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
