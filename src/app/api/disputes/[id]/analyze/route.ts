import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { analyzeDispute, DisputeContext } from "@/lib/ai-agent";
import { recordAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const dispute = await prisma.dispute.findFirst({
      where: {
        OR: [{ id }, { paypalDisputeId: id }],
      },
      include: {
        transaction: true,
        order: true,
        trackingInfo: true,
        messages: true,
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

    // Retrieve PayPal connection / API settings
    const connection = await prisma.payPalConnection.findFirst({
      where: { merchantId: dispute.merchantId },
    });

    let parsedItems: any[] = [];
    if (dispute.order?.itemsJson) {
      try {
        parsedItems = JSON.parse(dispute.order.itemsJson);
      } catch {
        parsedItems = [{ description: "Disputed item", qty: 1, price: dispute.disputeAmount }];
      }
    }

    const context: DisputeContext = {
      disputeId: dispute.id,
      paypalDisputeId: dispute.paypalDisputeId,
      reason: dispute.reason,
      disputeAmount: dispute.disputeAmount,
      currency: dispute.currency,
      buyerName: dispute.buyerName,
      buyerEmail: dispute.buyerEmail,
      sellerTransactionId: dispute.transaction?.sellerTransactionId || dispute.paypalDisputeId,
      responseDueDate: dispute.responseDueDate,
      order: dispute.order
        ? {
            orderNumber: dispute.order.orderNumber,
            orderDate: dispute.order.orderDate,
            customerName: dispute.order.customerName,
            customerEmail: dispute.order.customerEmail,
            shippingAddress: dispute.order.shippingAddress,
            orderTotal: dispute.order.orderTotal,
            items: parsedItems,
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
            deliveryProofUrl: dispute.trackingInfo.deliveryProofUrl,
          }
        : null,
      messages: dispute.messages.map((m) => ({
        sender: m.sender,
        channel: m.channel,
        timestamp: m.timestamp,
        messageText: m.messageText,
      })),
      evidenceItems: dispute.evidenceItems.map((e) => ({
        evidenceType: e.evidenceType,
        title: e.title,
        description: e.description,
        strength: e.strength,
        verified: e.verified,
      })),
    };

    // Execute AI Agent analysis
    const analysisResult = await analyzeDispute(context);

    // Save or update AiAnalysis in DB
    const savedAnalysis = await prisma.aiAnalysis.upsert({
      where: { disputeId: dispute.id },
      create: {
        disputeId: dispute.id,
        summary: analysisResult.summary,
        completenessScore: analysisResult.completenessScore,
        recommendedAction: analysisResult.recommendedAction,
        recommendationRationale: analysisResult.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysisResult.keyStrengths),
        criticalGapsJson: JSON.stringify(analysisResult.criticalGaps),
        citationsJson: JSON.stringify(analysisResult.citations),
        riskLevel: analysisResult.riskLevel,
        antiHallucinationVerified: true,
      },
      update: {
        summary: analysisResult.summary,
        completenessScore: analysisResult.completenessScore,
        recommendedAction: analysisResult.recommendedAction,
        recommendationRationale: analysisResult.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysisResult.keyStrengths),
        criticalGapsJson: JSON.stringify(analysisResult.criticalGaps),
        citationsJson: JSON.stringify(analysisResult.citations),
        riskLevel: analysisResult.riskLevel,
        updatedAt: new Date(),
      },
    });

    // Create or update DraftResponse with status: NEEDS_REVIEW
    const latestDraft = dispute.draftResponses[0];
    if (latestDraft && latestDraft.status !== "SUBMITTED") {
      await prisma.draftResponse.update({
        where: { id: latestDraft.id },
        data: {
          status: "NEEDS_REVIEW",
          targetAction: analysisResult.recommendedAction,
          rebuttalNarrative: analysisResult.rebuttalDraft,
          characterCount: analysisResult.rebuttalDraft.length,
          isApproved: false,
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.draftResponse.create({
        data: {
          disputeId: dispute.id,
          version: (latestDraft?.version || 0) + 1,
          status: "NEEDS_REVIEW",
          targetAction: analysisResult.recommendedAction,
          rebuttalNarrative: analysisResult.rebuttalDraft,
          characterCount: analysisResult.rebuttalDraft.length,
          isApproved: false,
        },
      });
    }

    // Update dispute workflow status: NEEDS_REVIEW
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        responseWorkflowStatus: "NEEDS_REVIEW",
      },
    });

    // Record Audit Log entry
    await recordAuditLog({
      disputeId: dispute.id,
      merchantId: dispute.merchantId,
      eventType: "AI_ANALYSIS_GENERATED",
      severity: "SUCCESS",
      summary: `AI Agent generated analysis: ${analysisResult.completenessScore}% completeness. Action: ${analysisResult.recommendedAction}. Ready for merchant review.`,
      details: {
        completenessScore: analysisResult.completenessScore,
        recommendedAction: analysisResult.recommendedAction,
        riskLevel: analysisResult.riskLevel,
        keyStrengthsCount: analysisResult.keyStrengths.length,
        criticalGapsCount: analysisResult.criticalGaps.length,
        workflowStatus: "NEEDS_REVIEW",
      },
      actor: "ai_agent",
    });

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
      result: analysisResult,
      workflowStatus: "NEEDS_REVIEW",
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/analyze error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze dispute" },
      { status: 500 }
    );
  }
}
