import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [
          { id },
          { paypalDisputeId: id },
        ],
      },
      include: {
        transaction: true,
        order: true,
        trackingInfo: true,
        evidenceItems: {
          orderBy: { createdAt: "desc" },
        },
        messages: {
          orderBy: { timestamp: "asc" },
        },
        aiAnalysis: true,
        draftResponses: {
          orderBy: { version: "desc" },
        },
        submissionAttempts: {
          orderBy: { attemptedAt: "desc" },
        },
        auditLogs: {
          orderBy: { timestamp: "desc" },
        },
        webhookEvents: {
          orderBy: { receivedAt: "desc" },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      dispute,
    });
  } catch (error: any) {
    console.error("GET /api/disputes/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch dispute details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const dispute = await prisma.dispute.findFirst({
      where: { OR: [{ id }, { paypalDisputeId: id }] },
      include: { draftResponses: { orderBy: { version: "desc" }, take: 1 } },
    });

    if (!dispute) {
      return NextResponse.json({ success: false, error: "Dispute not found" }, { status: 404 });
    }

    // Handle draft rebuttal edit
    if (body.rebuttalNarrative !== undefined) {
      const latestDraft = dispute.draftResponses[0];
      if (latestDraft) {
        await prisma.draftResponse.update({
          where: { id: latestDraft.id },
          data: {
            rebuttalNarrative: body.rebuttalNarrative,
            characterCount: body.rebuttalNarrative.length,
            status: dispute.responseWorkflowStatus === "APPROVED" ? "NEEDS_REVIEW" : latestDraft.status,
            editedBy: "merchant_user",
            editedAt: new Date(),
          },
        });
      }

      await recordAuditLog({
        disputeId: dispute.id,
        eventType: "RESPONSE_EDITED",
        severity: "INFO",
        summary: "Merchant edited rebuttal narrative draft",
        details: { characterCount: body.rebuttalNarrative.length },
        actor: "merchant_user",
      });
    }

    const updated = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        merchantNotes: body.merchantNotes !== undefined ? body.merchantNotes : dispute.merchantNotes,
        responseWorkflowStatus: body.responseWorkflowStatus || dispute.responseWorkflowStatus,
        status: body.status || dispute.status,
      },
      include: {
        draftResponses: true,
        auditLogs: { orderBy: { timestamp: "desc" } },
      },
    });

    return NextResponse.json({ success: true, dispute: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update dispute" },
      { status: 500 }
    );
  }
}
