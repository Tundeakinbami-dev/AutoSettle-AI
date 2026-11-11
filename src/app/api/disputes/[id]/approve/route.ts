import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/disputes/:id/approve
 * Human Approval Gate: Explicitly marks the draft response as approved by the merchant.
 * Supports lookup by database CUID or PayPal Dispute ID (e.g. PP-D-30329).
 *
 * Requirements:
 * 1. Validate that the draft exists and is not empty.
 * 2. Record the approving merchant and approval timestamp.
 * 3. Persist the approval state in the database (draft + dispute responseWorkflowStatus).
 * 4. Record a RESPONSE_APPROVED event in the immutable Audit Trail.
 * 5. Return clear success response.
 * 6. Prevent accidental duplicate approvals safely.
 * 7. Never automatically submit to PayPal (submission remains a separate explicit human action).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON body is acceptable; fallback to defaults
    }

    const approver =
      (typeof body?.approver === "string" && body.approver.trim())
        ? body.approver.trim()
        : "merchant_user";

    // 1. Resolve dispute by internal CUID or external paypalDisputeId
    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [
          { id },
          { paypalDisputeId: id },
        ],
      },
      include: {
        merchant: true,
        draftResponses: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: `Dispute not found for ID '${id}'` },
        { status: 404 }
      );
    }

    // Check if already submitted
    if (dispute.responseWorkflowStatus === "SUBMITTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Dispute response has already been submitted to PayPal and cannot be re-approved.",
        },
        { status: 400 }
      );
    }

    // 2. Validate draft existence
    const latestDraft = dispute.draftResponses[0];
    if (!latestDraft) {
      return NextResponse.json(
        {
          success: false,
          error: "No draft response available to approve. Please draft or generate a response first.",
        },
        { status: 400 }
      );
    }

    // If caller provided updated rebuttal narrative, use it; otherwise use stored narrative
    const updatedNarrative =
      typeof body.rebuttalNarrative === "string"
        ? body.rebuttalNarrative.trim()
        : latestDraft.rebuttalNarrative?.trim() || "";

    // Validate that draft is not empty
    if (!updatedNarrative || updatedNarrative.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot approve empty draft rebuttal narrative. Please write or generate a rebuttal first.",
        },
        { status: 400 }
      );
    }

    // 3. Idempotency: Prevent duplicate approvals safely
    if (latestDraft.isApproved && dispute.responseWorkflowStatus === "APPROVED") {
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        message: `Draft response version ${latestDraft.version} is already approved and ready for dispatch.`,
        disputeId: dispute.id,
        paypalDisputeId: dispute.paypalDisputeId,
        draftId: latestDraft.id,
        version: latestDraft.version,
        status: "APPROVED",
        approvedBy: latestDraft.approvedBy || approver,
        approvedAt: latestDraft.approvedAt?.toISOString() || new Date().toISOString(),
      });
    }

    const approvalTimestamp = new Date();

    // 4. Atomically persist approval state to database
    const [updatedDraft] = await prisma.$transaction([
      prisma.draftResponse.update({
        where: { id: latestDraft.id },
        data: {
          isApproved: true,
          approvedAt: approvalTimestamp,
          approvedBy: approver,
          status: "APPROVED",
          rebuttalNarrative: updatedNarrative,
          characterCount: updatedNarrative.length,
          ...(typeof body.rebuttalNarrative === "string"
            ? { editedBy: approver, editedAt: approvalTimestamp }
            : {}),
        },
      }),
      prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          responseWorkflowStatus: "APPROVED",
          updatedAt: approvalTimestamp,
        },
      }),
    ]);

    // 5. Record immutable Audit Trail entry
    await recordAuditLog({
      disputeId: dispute.id,
      merchantId: dispute.merchantId || undefined,
      eventType: "RESPONSE_APPROVED",
      severity: "SUCCESS",
      summary: `Merchant (${approver}) approved draft response version ${updatedDraft.version}. Unlocked for PayPal dispatch.`,
      details: {
        disputeId: dispute.paypalDisputeId,
        draftId: updatedDraft.id,
        version: updatedDraft.version,
        approver,
        characterCount: updatedDraft.characterCount,
        targetAction: updatedDraft.targetAction,
        approvedAt: approvalTimestamp.toISOString(),
      },
      actor: "merchant_user",
    });

    return NextResponse.json({
      success: true,
      message: `Draft response version ${updatedDraft.version} successfully approved by merchant.`,
      disputeId: dispute.id,
      paypalDisputeId: dispute.paypalDisputeId,
      draftId: updatedDraft.id,
      version: updatedDraft.version,
      status: "APPROVED",
      approvedBy: approver,
      approvedAt: approvalTimestamp.toISOString(),
    });
  } catch (err: any) {
    console.error("POST /api/disputes/[id]/approve error:", err);

    await recordAuditLog({
      disputeId: undefined,
      eventType: "APPROVAL_ERROR",
      severity: "ERROR",
      summary: `Error approving draft for dispute ${id}: ${err.message}`,
      actor: "system",
    });

    return NextResponse.json(
      { success: false, error: err.message || "Internal server error during approval" },
      { status: 500 }
    );
  }
}
