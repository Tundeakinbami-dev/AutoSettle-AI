import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PayPalDisputesClient, PayPalExecutionMode } from "@/lib/paypal";
import { recordAuditLog, sanitizeData } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

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

    // 1. Idempotency Check: Prevent duplicate submissions
    if (dispute.responseWorkflowStatus === "SUBMITTED") {
      return NextResponse.json(
        {
          success: false,
          error: "Dispute response has already been submitted to PayPal and cannot be re-submitted.",
          workflowStatus: "SUBMITTED",
        },
        { status: 409 }
      );
    }

    // 2. Strict Human Approval Guardrail
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

    // 3. Ensure draft exists and is approved before submission
    const latestDraft = dispute.draftResponses[0];
    if (!latestDraft) {
      return NextResponse.json(
        {
          success: false,
          error: "No draft response available for submission",
        },
        { status: 400 }
      );
    }
    if (!latestDraft.isApproved) {
      return NextResponse.json(
        {
          success: false,
          error: "Draft response must be approved by a merchant before submission",
        },
        { status: 403 }
      );
    }

    // 4. Resolve Execution Mode (3 distinct execution paths)
    const isDemoAppMode =
      process.env.APP_MODE === "DEMO" ||
      process.env.APP_MODE === "HACKATHON" ||
      process.env.APP_MODE === "SIMULATION";

    const merchantMode = dispute.merchant?.mode ?? "DEMO";
    const forceSimulation = isDemoAppMode || merchantMode === "DEMO";

    const connection = await prisma.payPalConnection.findFirst({
      where: { merchantId: dispute.merchantId },
    });

    const connectionEnv =
      (connection?.environment as any) || process.env.PAYPAL_ENVIRONMENT || "sandbox";

    // Safety Requirement: Prohibit PAYPAL_LIVE in DEMO/HACKATHON mode
    if ((connectionEnv === "live" || process.env.PAYPAL_ENVIRONMENT === "live") && isDemoAppMode) {
      return NextResponse.json(
        {
          success: false,
          error: "PAYPAL_LIVE mode is strictly prohibited in DEMO/HACKATHON environment. Switch to sandbox or DEMO mode.",
        },
        { status: 403 }
      );
    }

    let executionMode: PayPalExecutionMode = "INTERNAL_SIMULATION";
    if (!forceSimulation) {
      if (connectionEnv === "live") {
        executionMode = "PAYPAL_LIVE";
      } else {
        executionMode = "PAYPAL_SANDBOX";
      }
    }

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { responseWorkflowStatus: "SUBMITTING" },
    });

    const endpointPath = `/v1/customer/disputes/${dispute.paypalDisputeId}/${action.toLowerCase().replace(/_/g, "-")}`;

    // Create In-Flight Submission Attempt Record
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
            executionMode,
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
      summary: executionMode === "INTERNAL_SIMULATION"
        ? `[SIMULATED] Dispatched ${action} request via internal simulation (${endpointPath})`
        : `Dispatched ${action} request to PayPal Disputes API (${endpointPath})`,
      details: {
        attemptId: attempt.id,
        endpoint: endpointPath,
        action,
        workflowStatus: "SUBMITTING",
        mode: executionMode,
      },
      actor: "merchant_user",
    });

    // 5. Failure Simulation Option (Independent Demo Toggle)
    // Intercepts immediately before client invocation: zero network activity
    if (simulateError) {
      const errorMsg =
        "PayPal API Error: 400 Bad Request — Dispute deadline elapsed or invalid document attachment [SIMULATED].";

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

      // Note: dispute.draftResponses[0].isApproved remains TRUE so merchant can retry submission

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "SUBMISSION_FAILED",
        severity: "ERROR",
        summary: `PayPal submission failed (400 Bad Request) [SIMULATED]: ${errorMsg}`,
        details: {
          attemptId: attempt.id,
          httpStatus: 400,
          error: errorMsg,
          mode: "INTERNAL_SIMULATION",
          isSimulated: true,
        },
        actor: "paypal_api",
      });

      return NextResponse.json(
        {
          success: false,
          workflowStatus: "SUBMISSION_FAILED",
          error: errorMsg,
          attemptId: attempt.id,
          mode: "INTERNAL_SIMULATION",
        },
        { status: 400 }
      );
    }

    // 6. Instantiate Client with Explicit Simulation Guard
    const paypalClient = new PayPalDisputesClient({
      clientId: forceSimulation ? "" : (connection?.clientId ?? undefined),
      clientSecret: forceSimulation ? "" : (connection?.clientSecret ?? undefined),
      environment: connectionEnv === "live" ? "live" : "sandbox",
      isSimulation: forceSimulation,
      forceMode: executionMode,
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

    // 7. Process API Result & Update Database
    if (result.success && (result.statusCode === 200 || result.statusCode === 201 || result.statusCode === 204)) {
      const newStatus =
        action === "ACCEPT_CLAIM"
          ? "RESOLVED"
          : action === "MAKE_OFFER"
          ? "WAITING_FOR_BUYER"
          : "UNDER_REVIEW";
      const newOutcome = action === "ACCEPT_CLAIM" ? "ACCEPTED" : dispute.resolutionOutcome;

      await prisma.submissionAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
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
          responseWorkflowStatus: "SUBMITTED",
        },
      });

      if (dispute.draftResponses[0]) {
        await prisma.draftResponse.update({
          where: { id: dispute.draftResponses[0].id },
          data: { status: "SUBMITTED" },
        });
      }

      const isInternalSim = (result.executionMode || result.mode) === "INTERNAL_SIMULATION" || result.mode === "simulation";

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "API_RESULT_RECEIVED",
        severity: "SUCCESS",
        summary: isInternalSim
          ? `[SIMULATED] PayPal Disputes API confirmed evidence receipt (${result.statusCode} OK). Dispute updated to ${newStatus}.`
          : `PayPal Disputes API confirmed evidence receipt (${result.statusCode} OK). Dispute updated to ${newStatus}.`,
        details: {
          attemptId: attempt.id,
          httpStatus: result.statusCode,
          workflowStatus: "SUBMITTED",
          mode: result.executionMode || result.mode,
          isSimulated: isInternalSim,
        },
        actor: "paypal_api",
      });

      return NextResponse.json({
        success: true,
        workflowStatus: "SUBMITTED",
        mode: result.executionMode || result.mode,
        statusCode: result.statusCode,
        paypalResponse: result.responsePayload,
        attemptId: attempt.id,
      });
    } else {
      // Failure Outcome
      const errorMsg =
        result.responsePayload?.message ||
        result.responsePayload?.error ||
        "PayPal Disputes API rejected submission";

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

      // Preserve draftResponse.isApproved: true so retry remains possible

      await recordAuditLog({
        disputeId: dispute.id,
        merchantId: dispute.merchantId,
        eventType: "SUBMISSION_FAILED",
        severity: "ERROR",
        summary: `PayPal Disputes API rejected request (${result.statusCode}): ${errorMsg}`,
        details: {
          attemptId: attempt.id,
          httpStatus: result.statusCode,
          error: errorMsg,
          mode: result.executionMode || result.mode,
        },
        actor: "paypal_api",
      });

      return NextResponse.json(
        {
          success: false,
          workflowStatus: "SUBMISSION_FAILED",
          error: errorMsg,
          paypalResponse: result.responsePayload,
          attemptId: attempt.id,
          mode: result.executionMode || result.mode,
        },
        { status: result.statusCode || 500 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/submit-paypal error:", error);

    // Revert dispute from SUBMITTING to SUBMISSION_FAILED if stuck
    if (params?.id) {
      await prisma.dispute.updateMany({
        where: {
          OR: [{ id: params.id }, { paypalDisputeId: params.id }],
          responseWorkflowStatus: "SUBMITTING",
        },
        data: { responseWorkflowStatus: "SUBMISSION_FAILED" },
      }).catch(() => {});
    }

    return NextResponse.json(
      { success: false, error: error.message || "Submission process failed" },
      { status: 500 }
    );
  }
}
