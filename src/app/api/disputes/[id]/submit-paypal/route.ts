import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PayPalDisputesClient } from "@/lib/paypal";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const {
      action, // 'PROVIDE_EVIDENCE' | 'ACCEPT_CLAIM' | 'MAKE_OFFER'
      notes,
      evidenceType = "PROOF_OF_DELIVERY",
      authorizedByMerchant,
      offerAmount,
    } = body;

    // Strict compliance guard: Must have explicit merchant authorization checkbox
    if (!authorizedByMerchant) {
      return NextResponse.json(
        {
          success: false,
          error: "Merchant authorization required. You must review the evidence and check the authorization box before submitting to PayPal.",
        },
        { status: 400 }
      );
    }

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
      include: {
        order: true,
        trackingInfo: true,
        evidenceItems: true,
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Load merchant settings for PayPal credentials
    const settings = await prisma.merchantSettings.findFirst({
      where: { id: "default" },
    });

    const paypalClient = new PayPalDisputesClient({
      clientId: settings?.paypalClientId || undefined,
      clientSecret: settings?.paypalClientSecret || undefined,
      environment: (settings?.paypalEnvironment as any) || "sandbox",
    });

    let result: any;
    let newDisputeStatus = dispute.status;
    let newResolutionOutcome = dispute.resolutionOutcome;

    if (action === "PROVIDE_EVIDENCE") {
      result = await paypalClient.provideEvidence({
        disputeId: dispute.paypalDisputeId,
        evidenceType,
        notes: notes || "Supporting evidence provided by merchant via AutoSettle AI.",
        trackingNumber: dispute.trackingInfo?.trackingNumber,
        carrierName: dispute.trackingInfo?.carrier,
        documents: dispute.evidenceItems.map((e) => ({
          name: e.title,
          url: e.fileUrl || undefined,
        })),
      });

      newDisputeStatus = "UNDER_REVIEW";
    } else if (action === "ACCEPT_CLAIM") {
      result = await paypalClient.acceptClaim({
        disputeId: dispute.paypalDisputeId,
        note: notes || "Merchant accepts dispute claim and authorizes refund to buyer.",
      });

      newDisputeStatus = "RESOLVED";
      newResolutionOutcome = "ACCEPTED";
    } else if (action === "MAKE_OFFER") {
      result = await paypalClient.makeOffer({
        disputeId: dispute.paypalDisputeId,
        note: notes || "Settlement offer provided by merchant.",
        offerAmount: String(offerAmount || (dispute.disputeAmount * 0.5).toFixed(2)),
        currencyCode: dispute.currency,
      });

      newDisputeStatus = "WAITING_FOR_BUYER";
      newResolutionOutcome = "OFFERED";
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported submission action: ${action}` },
        { status: 400 }
      );
    }

    // Update dispute status and outcome
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: newDisputeStatus,
        resolutionOutcome: newResolutionOutcome,
      },
    });

    // Save full audit log
    const audit = await prisma.submissionAuditLog.create({
      data: {
        disputeId: dispute.id,
        action,
        status: result.success ? "SUCCESS" : "FAILED",
        payloadSent: JSON.stringify({
          action,
          notes,
          evidenceType,
          trackingNumber: dispute.trackingInfo?.trackingNumber,
          carrier: dispute.trackingInfo?.carrier,
          documentsCount: dispute.evidenceItems.length,
          offerAmount,
        }),
        paypalResponse: JSON.stringify(result.responsePayload),
        submittedBy: "merchant_authorized",
      },
    });

    return NextResponse.json({
      success: result.success,
      mode: result.mode,
      statusCode: result.statusCode,
      disputeStatus: newDisputeStatus,
      resolutionOutcome: newResolutionOutcome,
      paypalResponse: result.responsePayload,
      auditLogId: audit.id,
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/submit-paypal error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "PayPal submission failed" },
      { status: 500 }
    );
  }
}
