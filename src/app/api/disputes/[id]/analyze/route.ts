import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { analyzeDispute, DisputeContext } from "@/lib/ai-agent";

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
        order: true,
        trackingInfo: true,
        messages: true,
        evidenceItems: true,
      },
    });

    if (!dispute) {
      return NextResponse.json(
        { success: false, error: "Dispute not found" },
        { status: 404 }
      );
    }

    // Retrieve merchant settings for optional API keys
    const settings = await prisma.merchantSettings.findFirst({
      where: { id: "default" },
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
      sellerTransactionId: dispute.sellerTransactionId,
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
    const analysisResult = await analyzeDispute(context, settings?.openAiApiKey || undefined);

    // Save or update analysis in DB
    const savedAnalysis = await prisma.disputeAnalysis.upsert({
      where: { disputeId: dispute.id },
      create: {
        disputeId: dispute.id,
        summary: analysisResult.summary,
        completenessScore: analysisResult.completenessScore,
        recommendedAction: analysisResult.recommendedAction,
        recommendationRationale: analysisResult.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysisResult.keyStrengths),
        criticalGapsJson: JSON.stringify(analysisResult.criticalGaps),
        rebuttalDraft: analysisResult.rebuttalDraft,
        citationsJson: JSON.stringify(analysisResult.citations),
        riskLevel: analysisResult.riskLevel,
      },
      update: {
        summary: analysisResult.summary,
        completenessScore: analysisResult.completenessScore,
        recommendedAction: analysisResult.recommendedAction,
        recommendationRationale: analysisResult.recommendationRationale,
        keyStrengthsJson: JSON.stringify(analysisResult.keyStrengths),
        criticalGapsJson: JSON.stringify(analysisResult.criticalGaps),
        rebuttalDraft: analysisResult.rebuttalDraft,
        citationsJson: JSON.stringify(analysisResult.citations),
        riskLevel: analysisResult.riskLevel,
        updatedAt: new Date(),
      },
    });

    // Update dispute entity
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        aiAnalyzed: true,
        aiConfidenceScore: analysisResult.completenessScore,
        aiRecommendedAction: analysisResult.recommendedAction,
      },
    });

    // Create Audit Log entry
    await prisma.submissionAuditLog.create({
      data: {
        disputeId: dispute.id,
        action: "AUTO_ANALYZED",
        status: "SUCCESS",
        payloadSent: JSON.stringify({
          model: settings?.openAiApiKey ? "gpt-4o" : "deterministic-factual-engine",
          completeness: analysisResult.completenessScore,
          action: analysisResult.recommendedAction,
        }),
        submittedBy: "autosettle_agent",
      },
    });

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
      result: analysisResult,
    });
  } catch (error: any) {
    console.error("POST /api/disputes/[id]/analyze error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to analyze dispute" },
      { status: 500 }
    );
  }
}
