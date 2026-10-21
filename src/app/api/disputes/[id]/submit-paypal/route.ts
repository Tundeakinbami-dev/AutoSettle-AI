import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PayPalDisputesClient } from "@/lib/paypal";
import { recordAuditLog, sanitizeData } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const {
      action = "PROVIDE_EVIDENCE", // 'PROVIDE_EVIDENCE' | 'ACCEPT_CLAIM' | 'MAKE_OFFER'
      notes,
      evidenceType = "PROOF_OF_DELIVERY",
      authorizedByMerchant,
      offerAmount,
      simulateError = false, // Demo toggle to test failure handling
    } = body;

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
      include: {
        merchant: true,
        order: true,
        trackingInfo: true,
        evidenceItems: true,
        draftResponses: { orderBy: { version: "desc" }, take: 1 },
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Strict Human Approval Guardrail
    const merchantRequiresApproval = dispute.merchant?.requireHumanApproval ?? true;
    if (merchantRequiresApproval && !authorizedByMerchant) {
      return NextResponse.json(
        {
          success: false,
          error: "Human approval required by default configuration. You must review the evidence and confirm authorization before submitting to PayPal.",
        },
        { status: 403 }
      );
    }

    // Step 1: Transition state to SUBMITTING
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseWorkflowStatus: "SUBMITTING" },
    });

    const endpointPath = `/v1/customer/disputes/${dispute.paypalDisputeId}/${action.toLowerCase().replace(/_/g, "-")}`;

    // Create In-Flight Submission Attempt
    const attempt = await prisma.submissionAttempt.create({
      data: {
        disputeId: dispute.id,
        draftResponseId: dispute.draftResponses[0]?.id || null,
        action,
        status: "SUBMITTING",
        endpoint: endpointPath,
        requestPayloadSanitized: JSON.stringify(
          sanitizeData({
            action,
            notes,
            evidenceType,
            trackingNumber: dispute.trackingInfo?.trackingNumber,
            carrier: dispute.trackingInfo?.carrier,
            documentsCount: dispute.evidenceItems.length,
            offerAmount,
          })
        ),
      },
    });

    // Record SUBMISSION_ATTEMPTED in Audit Trail
    await recordAuditLog({
      disputeId: dispute.id,
      merchantId: dispute.merchantId,
      eventType: "SUBMISSION_ATTEMPTED",
      severity: "INFO",
      summary: `Dispatched ${action} request to PayPal Disputes API (${endpointPath})`,
      details: {
        attemptId: attempt.id,
        endpoint: endpointPath,
        action,
        workflowStatus: "SUBMITTING",
      },
      actor: "merchant_user",
    });

    // If simulated error requested (for testing failure handling)
    if (simulateError) {
      const errorMsg = "PayPal API Error: 400 Bad Request — Dispute deadline elapsed or invalid document attachment.";
      
      await prisma.submissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMISSION_FAILED",
          httpStatusCode: 400,
          errorMessage: errorMsg,
          completedAt: new Date(),
        },
      });

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: { responseWorkflowStatus: "SUBMISSION_FAILED" },
      });

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "SUBMISSION_FAILED",
        severity: "ERROR",
        summary: `PayPal submission failed (400 Bad Request): ${errorMsg}`,
        details: { attemptId: attempt.id, httpStatus: 400, error: errorMsg },
        actor: "paypal_api",
      });

      return NextResponse.json(
        {
          success: false,
          workflowStatus: "SUBMISSION_FAILED",
          error: errorMsg,
          attemptId: attempt.id,
        },
        { status: 400 }
      );
    }

    // Step 2: Dispatch to PayPal Disputes Client
    const connection = await prisma.payPalConnection.findFirst({
      where: { merchantId: dispute.merchantId },
    });

    const paypalClient = new PayPalDisputesClient({
      clientId: connection?.clientId || undefined,
      clientSecret: connection?.clientSecret || undefined,
      environment: (connection?.environment as any) || "sandbox",
    });

    let result: any;
    if (action === "PROVIDE_EVIDENCE") {
      result = await paypalClient.provideEvidence({
        disputeId: dispute.paypalDisputeId,
        evidenceType,
        notes: notes || dispute.draftResponses[0]?.rebuttalNarrative || "Supporting evidence provided by merchant via AutoSettle AI.",
        trackingNumber: dispute.trackingInfo?.trackingNumber,
        carrierName: dispute.trackingInfo?.carrier,
        documents: dispute.evidenceItems.map((e) => ({
          name: e.title,
          url: e.fileUrl || undefined,
        })),
      });
    } else if (action === "ACCEPT_CLAIM") {
      result = await paypalClient.acceptClaim({
        disputeId: dispute.paypalDisputeId,
        note: notes || "Merchant accepts dispute claim and authorizes refund to buyer.",
      });
    } else if (action === "MAKE_OFFER") {
      result = await paypalClient.makeOffer({
        disputeId: dispute.paypalDisputeId,
        note: notes || "Settlement offer provided by merchant.",
        offerAmount: String(offerAmount || (dispute.disputeAmount * 0.5).toFixed(2)),
        currencyCode: dispute.currency,
      });
    }

    // Step 3: Handle result and strictly verify state transition
    // A draft must NEVER be displayed as submitted. Only show "SUBMITTED" after verified successful result!
    if (result.success && (result.statusCode === 200 || result.statusCode === 201 || result.statusCode === 204)) {
      // SUCCESSFUL RESULT RECEIVED
      const newStatus = action === "ACCEPT_CLAIM" ? "RESOLVED" : action === "MAKE_OFFER" ? "WAITING_FOR_BUYER" : "UNDER_REVIEW";
      const newOutcome = action === "ACCEPT_CLAIM" ? "ACCEPTED" : dispute.resolutionOutcome;

      await prisma.submissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED", // Exact submitted state!
          httpStatusCode: result.statusCode,
          responsePayloadSanitized: JSON.stringify(sanitizeData(result.responsePayload)),
          completedAt: new Date(),
        },
      });

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: newStatus,
          resolutionOutcome: newOutcome,
          responseWorkflowStatus: "SUBMITTED", // DISTINCT STATE: SUBMITTED
        },
      });

      if (dispute.draftResponses[0]) {
        await prisma.draftResponse.update({
          where: { id: dispute.draftResponses[0].id },
          data: { status: "SUBMITTED" },
        });
      }

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "API_RESULT_RECEIVED",
        severity: "SUCCESS",
        summary: `PayPal Disputes API confirmed evidence receipt (${result.statusCode} OK). Dispute updated to ${newStatus}.`,
        details: {
          attemptId: attempt.id,
          httpStatus: result.statusCode,
          workflowStatus: "SUBMITTED",
          mode: result.mode,
        },
        actor: "paypal_api",
      });

      return NextResponse.json({
        success: true,
        workflowStatus: "SUBMITTED",
        mode: result.mode,
        statusCode: result.statusCode,
        paypalResponse: result.responsePayload,
        attemptId: attempt.id,
      });
    } else {
      // FAILURE OR UNCERTAIN OUTCOME -> SUBMISSION_FAILED
      const errorMsg = result.responsePayload?.message || result.responsePayload?.error || "PayPal Disputes API rejected submission";

      await prisma.submissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMISSION_FAILED",
          httpStatusCode: result.statusCode || 500,
          errorMessage: errorMsg,
          responsePayloadSanitized: JSON.stringify(sanitizeData(result.responsePayload)),
          completedAt: new Date(),
        },
      });

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: { responseWorkflowStatus: "SUBMISSION_FAILED" },
      });

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "SUBMISSION_FAILED",
        severity: "ERROR",
        summary: `PayPal Disputes API rejected request (${result.statusCode}): ${errorMsg}`,
        details: { attemptId: attempt.id, httpStatus: result.statusCode, error: errorMsg },
        actor: "paypal_api",
      });

      return NextResponse.json(
        {
          success: false,
          workflowStatus: "SUBMISSION_FAILED",
          error: errorMsg,
          paypalResponse: result.responsePayload,
          attemptId: attempt.id,
        },
        { status: result.statusCode || 500 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/submit-paypal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Submission process failed" },
      { status: 500 }
    );
  }
}
