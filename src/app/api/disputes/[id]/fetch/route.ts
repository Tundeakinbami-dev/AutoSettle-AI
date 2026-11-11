import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PayPalDisputesClient } from "@/lib/paypal";
import { analyzeDispute } from "@/lib/ai-agent";
import { recordAuditLog } from "@/lib/audit";

/**
 * GET /api/disputes/:id/fetch
 * Retrieves the latest dispute details from PayPal (live or sandbox) and updates the local record.
 * If the dispute does not exist locally, it will be created.
 * After successful sync, an AI analysis is (re)generated.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // this is the PayPal dispute ID (paypalDisputeId)
  const client = new PayPalDisputesClient();
  try {
    // 1️⃣ Fetch dispute via client (honors simulation mode without external network calls)
    const disputeRes = await client.getDispute(id);

    // 2️⃣ Upsert local Dispute record (simplified mapping)
    const resource = disputeRes.resource || disputeRes; // PayPal may wrap under `resource`
    const upserted = await prisma.dispute.upsert({
      where: { paypalDisputeId: id },
      create: {
        merchantId: "default_merchant",
        paypalDisputeId: id,
        status: resource.status ?? "UNKNOWN",
        disputeLifeCycleStage: resource.dispute_life_cycle_stage ?? "UNKNOWN",
        reason: resource.reason ?? "UNKNOWN",
        disputeAmount: parseFloat(resource.dispute_amount?.value ?? "0"),
        currency: resource.dispute_amount?.currency_code ?? "USD",
        buyerName: resource.buyer_name ?? "",
        buyerEmail: resource.buyer_email ?? "",
        responseDueDate: resource.seller_response_due_date ? new Date(resource.seller_response_due_date) : new Date(),
        responseWorkflowStatus: "NEEDS_REVIEW",
      },
      update: {
        status: resource.status ?? "UNKNOWN",
        disputeLifeCycleStage: resource.dispute_life_cycle_stage ?? "UNKNOWN",
        reason: resource.reason ?? "UNKNOWN",
        disputeAmount: parseFloat(resource.dispute_amount?.value ?? "0"),
        currency: resource.dispute_amount?.currency_code ?? "USD",
        buyerName: resource.buyer_name ?? "",
        buyerEmail: resource.buyer_email ?? "",
        responseDueDate: resource.seller_response_due_date ? new Date(resource.seller_response_due_date) : undefined,
        updatedAt: new Date(),
      },
      include: {
        transaction: true,
      },
    });

    // 3️⃣ Run AI analysis (auto‑analysis flag can be consulted if needed)
    const merchant = await prisma.merchant.findFirst({ where: { id: "default_merchant" } });
    if (merchant?.autoAnalyzeOnArrival) {
      const analysis = await analyzeDispute({
        disputeId: upserted.id,
        paypalDisputeId: upserted.paypalDisputeId,
        reason: upserted.reason,
        disputeAmount: upserted.disputeAmount,
        currency: upserted.currency,
        buyerName: upserted.buyerName,
        buyerEmail: upserted.buyerEmail,
        sellerTransactionId: upserted.transaction?.sellerTransactionId || "",
        responseDueDate: upserted.responseDueDate,
        order: null, // detailed order linking can be added later
        tracking: null,
        messages: [],
        evidenceItems: [],
      });

      await prisma.aiAnalysis.upsert({
        where: { disputeId: upserted.id },
        create: {
          disputeId: upserted.id,
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
    }

    await recordAuditLog({
      disputeId: upserted.id,
      eventType: "DISPUTE_SYNCED",
      severity: "SUCCESS",
      summary: `Dispute ${id} fetched from PayPal and synced locally.`,
      actor: "system_integration",
    });

    return NextResponse.json({ success: true, dispute: upserted });
  } catch (err: any) {
    console.error("GET /api/disputes/[id]/fetch error:", err);
    await recordAuditLog({
      disputeId: undefined,
      eventType: "DISPUTE_SYNC_FAILED",
      severity: "ERROR",
      summary: `Failed to fetch dispute ${id} from PayPal: ${err.message}`,
      actor: "system_integration",
    });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
