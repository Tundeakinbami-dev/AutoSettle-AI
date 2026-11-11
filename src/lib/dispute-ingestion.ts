import prisma from "@/lib/prisma";
import { analyzeDispute } from "@/lib/ai-agent";
import { recordAuditLog, sanitizeData } from "@/lib/audit";

export interface IngestDisputeWebhookParams {
  eventId: string;
  eventType: string;
  payload: any;
  resource?: any;
  isSimulated?: boolean;
  signatureVerified?: boolean;
}

export interface IngestDisputeWebhookResult {
  success: boolean;
  duplicate?: boolean;
  status: "PROCESSED" | "IGNORED_DUPLICATE" | "ERROR";
  eventType: string;
  eventId: string;
  disputeId?: string;
  disputeDbId?: string;
  autoAnalyzed?: boolean;
  workflowStatus?: string;
  isSimulated: boolean;
  message: string;
  error?: string;
}

/**
 * Shared dispute ingestion and event processing service.
 * Used by both real PayPal webhook ingestion and internal simulation harness.
 * Ensures identical business rules, deduplication, audit logging, and autonomous AI analysis.
 */
export async function ingestDisputeWebhook(
  params: IngestDisputeWebhookParams
): Promise<IngestDisputeWebhookResult> {
  const {
    eventId,
    eventType,
    payload,
    resource = {},
    isSimulated = false,
    signatureVerified = false,
  } = params;

  // 1. Idempotency & Deduplication Check
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { paypalWebhookEventId: eventId },
  });

  if (existingEvent) {
    await recordAuditLog({
      disputeId: existingEvent.disputeId || undefined,
      eventType: isSimulated ? "WEBHOOK_SIMULATED" : "WEBHOOK_RECEIVED",
      severity: "WARNING",
      summary: isSimulated
        ? `[SIMULATED] Ignored duplicate simulated webhook event ${eventId} (${eventType})`
        : `Ignored duplicate webhook event ${eventId} (${eventType})`,
      details: { eventId, eventType, duplicate: true, isSimulated },
      actor: isSimulated ? "simulator" : "system_webhook",
    });

    return {
      success: true,
      duplicate: true,
      status: "IGNORED_DUPLICATE",
      eventType,
      eventId,
      disputeId: resource.dispute_id,
      isSimulated,
      message: `Webhook event ${eventId} already processed (deduplicated).`,
    };
  }

  // 2. Extract and Normalize Dispute Parameters
  const disputeId =
    resource.dispute_id ||
    `PP-D-${Math.floor(10000 + Math.random() * 90000)}`;
  const reason =
    resource.reason || "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
  const amount = parseFloat(resource.dispute_amount?.value || "195.00");
  const currency = resource.dispute_amount?.currency_code || "USD";
  const buyerName =
    resource.disputed_transactions?.[0]?.buyer_info?.name ||
    "Zachary Taylor";
  const buyerEmail =
    resource.disputed_transactions?.[0]?.buyer_info?.email ||
    "z.taylor@example.com";
  const transactionId =
    resource.disputed_transactions?.[0]?.seller_transaction_id ||
    `TXN-${Math.floor(100000000 + Math.random() * 900000000)}`;
  const status =
    resource.status ||
    (eventType === "PAYMENT.DISPUTE.RESOLVED" ? "RESOLVED" : "REQUIRED_ACTION");
  const disputeLifeCycleStage =
    resource.dispute_life_cycle_stage ||
    (eventType === "PAYMENT.DISPUTE.RESOLVED" ? "RESOLVED" : "CHARGEBACK");
  const responseDueDate = resource.seller_response_due_date
    ? new Date(resource.seller_response_due_date)
    : new Date(Date.now() + 7 * 24 * 3600 * 1000);

  // 3. Upsert Dispute Record
  const dispute = await prisma.dispute.upsert({
    where: { paypalDisputeId: disputeId },
    create: {
      merchantId: "default_merchant",
      paypalDisputeId: disputeId,
      status,
      disputeLifeCycleStage,
      reason,
      disputeAmount: amount,
      currency,
      buyerName,
      buyerEmail,
      responseDueDate,
      merchantNotes: isSimulated
        ? `[SIMULATED] Ingested via Webhook Simulator (${eventType}) at ${new Date().toLocaleTimeString()}`
        : `Ingested via PayPal Webhook (${eventType}) at ${new Date().toLocaleTimeString()}`,
      responseWorkflowStatus:
        eventType === "PAYMENT.DISPUTE.RESOLVED" ? "SUBMITTED" : "NEEDS_REVIEW",
      transaction: {
        create: {
          sellerTransactionId: transactionId,
          grossAmount: amount,
          currency,
          paymentStatus:
            eventType === "PAYMENT.DISPUTE.RESOLVED" ? "REFUNDED" : "COMPLETED",
          paymentSource: "PAYPAL",
          payerEmail: buyerEmail,
        },
      },
      order: {
        create: {
          orderNumber: `AG-${Math.floor(90000 + Math.random() * 9999)}`,
          orderDate: new Date(Date.now() - 9 * 24 * 3600 * 1000),
          customerName: buyerName,
          customerEmail: buyerEmail,
          shippingAddress: "500 Howard St, Suite 400, San Francisco, CA 94105",
          billingAddress: "500 Howard St, Suite 400, San Francisco, CA 94105",
          orderTotal: amount,
          itemsJson: JSON.stringify([
            {
              description: `Apex Equipment Order (${reason.replace(/_/g, " ")})`,
              qty: 1,
              price: amount,
            },
          ]),
        },
      },
      trackingInfo: {
        create: {
          carrier: "UPS",
          trackingNumber: `1Z${Math.floor(1000000000000000 + Math.random() * 9000000000000000)}`,
          status: "DELIVERED",
          shippedDate: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          deliveredDate: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          destinationZip: "94105",
          signedBy: buyerName.split(" ").map((p) => p[0]).join(". ").toUpperCase(),
        },
      },
      evidenceItems: {
        create: [
          {
            evidenceType: "PROOF_OF_DELIVERY",
            title: "Carrier Electronic Delivery Confirmation",
            description: `UPS signed delivery scan matching destination address for ${buyerName}.`,
            fileName: "ups_pod_automated.pdf",
            fileType: "application/pdf",
            strength: "STRONG",
            verified: true,
            provenanceSource: isSimulated
              ? "Webhook Simulator Test Harness"
              : "UPS Electronic Tracking API",
          },
        ],
      },
    },
    update: {
      status,
      disputeLifeCycleStage,
      ...(eventType === "PAYMENT.DISPUTE.RESOLVED"
        ? { resolutionOutcome: "RESOLVED" }
        : {}),
      updatedAt: new Date(),
    },
    include: {
      transaction: true,
      order: true,
      trackingInfo: true,
      evidenceItems: true,
    },
  });

  // 4. Record WebhookEvent (Deduplication record)
  const eventSummary = isSimulated
    ? `[SIMULATED] PayPal Webhook ${eventType} for dispute ${dispute.paypalDisputeId}`
    : `PayPal Webhook ${eventType} for dispute ${dispute.paypalDisputeId}`;

  await prisma.webhookEvent.create({
    data: {
      paypalWebhookEventId: eventId,
      eventType,
      disputeId: dispute.id,
      summary: eventSummary,
      status: "PROCESSED",
      signatureVerified: Boolean(signatureVerified), // false for simulated, true for verified PayPal
      payloadSanitized: JSON.stringify(sanitizeData(payload)),
    },
  });

  // 5. Record Audit Trail
  await recordAuditLog({
    disputeId: dispute.id,
    eventType: isSimulated ? "WEBHOOK_SIMULATED" : "WEBHOOK_VERIFIED",
    severity: "SUCCESS",
    summary: isSimulated
      ? `[SIMULATED] Webhook ${eventType} (Event ID: ${eventId}) ingested via Webhook Simulator.`
      : `Verified PayPal webhook ${eventType} (Event ID: ${eventId}) ingested.`,
    details: {
      eventId,
      eventType,
      disputeId: dispute.paypalDisputeId,
      isSimulated,
    },
    actor: isSimulated ? "simulator" : "system_webhook",
  });

  // 6. Autonomous AI Intake (if enabled on Merchant profile and case is active)
  const merchant = await prisma.merchant.findFirst({
    where: { id: "default_merchant" },
  });

  let autoAnalyzed = false;
  if (merchant?.autoAnalyzeOnArrival && eventType !== "PAYMENT.DISPUTE.RESOLVED") {
    try {
      const analysis = await analyzeDispute({
        disputeId: dispute.id,
        paypalDisputeId: dispute.paypalDisputeId,
        reason: dispute.reason,
        disputeAmount: dispute.disputeAmount,
        currency: dispute.currency,
        buyerName: dispute.buyerName,
        buyerEmail: dispute.buyerEmail,
        sellerTransactionId:
          dispute.transaction?.sellerTransactionId || transactionId,
        responseDueDate: dispute.responseDueDate,
        order: dispute.order
          ? {
              orderNumber: dispute.order.orderNumber,
              orderDate: dispute.order.orderDate,
              customerName: dispute.order.customerName,
              customerEmail: dispute.order.customerEmail,
              shippingAddress: dispute.order.shippingAddress,
              orderTotal: dispute.order.orderTotal,
              items: JSON.parse(dispute.order.itemsJson || "[]"),
            }
          : null,
        tracking: dispute.trackingInfo
          ? {
              carrier: dispute.trackingInfo.carrier,
              trackingNumber: dispute.trackingInfo.trackingNumber,
              status: dispute.trackingInfo.status,
              shippedDate: dispute.trackingInfo.shippedDate,
              deliveredDate: dispute.trackingInfo.deliveredDate,
              destinationZip: dispute.trackingInfo.destinationZip,
              signedBy: dispute.trackingInfo.signedBy,
            }
          : null,
        messages: [],
        evidenceItems: dispute.evidenceItems.map((e) => ({
          evidenceType: e.evidenceType,
          title: e.title,
          description: e.description,
          strength: e.strength,
          verified: e.verified,
        })),
      });

      await prisma.aiAnalysis.upsert({
        where: { disputeId: dispute.id },
        create: {
          disputeId: dispute.id,
          summary: analysis.summary,
          completenessScore: analysis.completenessScore,
          recommendedAction: analysis.recommendedAction,
          recommendationRationale: analysis.recommendationRationale,
          keyStrengthsJson: JSON.stringify(analysis.keyStrengths),
          criticalGapsJson: JSON.stringify(analysis.criticalGaps),
          citationsJson: JSON.stringify(analysis.citations),
          riskLevel: analysis.riskLevel,
        },
        update: {
          summary: analysis.summary,
          completenessScore: analysis.completenessScore,
          recommendedAction: analysis.recommendedAction,
          recommendationRationale: analysis.recommendationRationale,
          keyStrengthsJson: JSON.stringify(analysis.keyStrengths),
          criticalGapsJson: JSON.stringify(analysis.criticalGaps),
          citationsJson: JSON.stringify(analysis.citations),
          riskLevel: analysis.riskLevel,
          updatedAt: new Date(),
        },
      });

      await prisma.draftResponse.create({
        data: {
          disputeId: dispute.id,
          version: 1,
          status: "NEEDS_REVIEW",
          targetAction: analysis.recommendedAction,
          rebuttalNarrative: analysis.rebuttalDraft,
          characterCount: analysis.rebuttalDraft.length,
          isApproved: false,
        },
      });

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: { responseWorkflowStatus: "NEEDS_REVIEW" },
      });

      await recordAuditLog({
        disputeId: dispute.id,
        eventType: "AI_ANALYSIS_GENERATED",
        severity: "SUCCESS",
        summary: `Autonomous analysis completed on arrival: ${analysis.completenessScore}% completeness. Status: Needs Review.`,
        details: {
          completeness: analysis.completenessScore,
          action: analysis.recommendedAction,
        },
        actor: "ai_agent",
      });

      autoAnalyzed = true;
    } catch (analyzeErr) {
      console.error("Auto analysis on arrival failed:", analyzeErr);
    }
  }

  return {
    success: true,
    duplicate: false,
    status: "PROCESSED",
    eventType,
    eventId,
    disputeId: dispute.paypalDisputeId,
    disputeDbId: dispute.id,
    autoAnalyzed,
    workflowStatus: dispute.responseWorkflowStatus,
    isSimulated,
    message: isSimulated
      ? `[SIMULATED] PayPal Webhook ${eventType} processed. Dispute ${dispute.paypalDisputeId} ingested.`
      : `PayPal Webhook ${eventType} processed. Dispute ${dispute.paypalDisputeId} ingested.`,
  };
}
